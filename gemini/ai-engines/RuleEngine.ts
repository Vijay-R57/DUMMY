/**
 * supabase/functions/analyze-5s/ai/RuleEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hybrid Rule-First Question Mapping Engine (Phase 2A.1).
 *
 * Two-tier architecture:
 *
 * Tier 1 — Built-in TypeScript rules:
 *   Core deterministic rules hard-coded here. Fast, zero DB round-trip,
 *   independently testable, deployed with the function. These cover
 *   universally applicable 5S standards (blocked exits, missing labels, etc.).
 *
 * Tier 2 — Database-configurable rules (audit_custom_rules table):
 *   Organisation-specific overrides loaded at runtime. Enable customer-specific
 *   standards, plant-level compliance requirements, and custom checklist
 *   overrides without redeployment. DB rules take precedence over built-in.
 *
 * Rule evaluation flow:
 *   1. Apply DB custom rules first (per template).
 *   2. Apply built-in rules for questions not yet answered.
 *   3. Return a Map<question_id, ValidatedAuditResponse> for matched questions.
 *   4. Unmatched questions are batched to the LLM in VisionAnalyzer.
 *
 * IMPORTANT: Rules never modify scores. They only determine audit answers.
 *            Confidence is always 1.0 for built-in rules, configurable for DB rules.
 */

import type { ObservationCache } from './ObservationCache.ts';
import type { AuditPillar, AuditAnswerState } from '../../backend/supabase/functions/analyze-5s/scoring/types.ts';
import type { ValidatedAuditResponse } from './VisionAnalyzer.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuestionInput {
  id:            string;
  question_id:   string;
  question_text: string;
  category?:     string;
  pillar:        AuditPillar;
}

export interface RuleEvaluation {
  question_id: string;
  rule_id:     string;
  answer:      AuditAnswerState;
  confidence:  number;
  rationale:   string;
  source:      'BUILTIN' | 'DB';
}

/**
 * Serialised condition descriptor for DB-configurable rules.
 * Allows organisation-specific rules without redeployment.
 */
export interface DbCustomRule {
  id:             string;
  rule_id:        string;
  template_id:    string;
  pillar:         AuditPillar | null;
  category:       string | null;
  condition_json: DbRuleCondition;
  answer:         AuditAnswerState;
  confidence:     number;
  rationale:      string | null;
  is_active:      boolean;
}

/**
 * Serialised condition descriptor — simple, JSON-safe, no function references.
 * The evaluateDbCondition() function interprets these.
 */
export interface DbRuleCondition {
  type:  'has_hazard' | 'has_obstruction' | 'cleanliness' | 'floor_markings' |
         'labels_visible' | 'storage_present' | 'no_detected_objects' |
         'safety_equipment_absent' | 'non_compliant_count_gte';
  value?: unknown;  // type-specific payload
}

// ── Built-in rule definitions ─────────────────────────────────────────────────
//
// Each entry contains:
//   id         — unique stable identifier (never change once in production)
//   pillar     — null means applies to all pillars
//   category   — null means applies to all categories matching the condition
//   matchCategory — list of category strings this rule applies to (OR logic)
//   condition  — function receiving (cache, question) → boolean
//   answer     — the deterministic answer to return
//   confidence — always 0.98 for built-in rules (near-certain)
//   rationale  — human-readable explanation stored in the trace

interface BuiltinRule {
  id:           string;
  pillar?:      AuditPillar;
  matchCategory?: string[];
  condition:    (cache: ObservationCache, question: QuestionInput) => boolean;
  answer:       AuditAnswerState;
  confidence:   number;
  rationale:    string;
}

const BUILTIN_RULES: BuiltinRule[] = [
  // ── Safety-critical: blocked emergency exits ────────────────────────────────
  {
    id:    'R_OBS_EXIT',
    pillar: 'SORT',
    condition: (cache) =>
      cache.getAllObstructions().some((o) =>
        /exit|fire.?door|emergency.?door/i.test(o)
      ),
    answer:     'NO',
    confidence: 0.99,
    rationale:  'An obstruction blocking an emergency exit or fire door was detected. Automatic CRITICAL NON-COMPLIANT.',
  },

  // ── Safety-critical: blocked electrical panels ─────────────────────────────
  {
    id:    'R_OBS_PANEL',
    pillar: 'SORT',
    condition: (cache) =>
      cache.getAllObstructions().some((o) =>
        /electrical.?panel|fuse.?box|breaker/i.test(o)
      ),
    answer:     'NO',
    confidence: 0.99,
    rationale:  'An obstruction blocking an electrical panel or fuse box was detected. Automatic NON-COMPLIANT.',
  },

  // ── Floor markings absent ──────────────────────────────────────────────────
  {
    id:           'R_FLOOR_MISSING',
    pillar:       'SET_IN_ORDER',
    matchCategory: ['Floor Markings'],
    condition: (cache, q) =>
      q.category === 'Floor Markings' && cache.getFloorMarkings() === false,
    answer:     'NO',
    confidence: 0.97,
    rationale:  'No floor markings detected in any observation. Marking question answered NO.',
  },

  // ── Floor markings present ─────────────────────────────────────────────────
  {
    id:           'R_FLOOR_PRESENT',
    pillar:       'SET_IN_ORDER',
    matchCategory: ['Floor Markings'],
    condition: (cache, q) =>
      q.category === 'Floor Markings' && cache.getFloorMarkings() === true,
    answer:     'YES',
    confidence: 0.95,
    rationale:  'Floor markings detected in observations. Marking question answered YES.',
  },

  // ── Labels absent ──────────────────────────────────────────────────────────
  {
    id:           'R_LABELS_MISSING',
    pillar:       'SET_IN_ORDER',
    matchCategory: ['Labels'],
    condition: (cache, q) =>
      q.category === 'Labels' && cache.getLabelsVisible() === false,
    answer:     'NO',
    confidence: 0.97,
    rationale:  'Labels explicitly absent in observations. Label question answered NO.',
  },

  // ── Labels visible ─────────────────────────────────────────────────────────
  {
    id:           'R_LABELS_PRESENT',
    pillar:       'SET_IN_ORDER',
    matchCategory: ['Labels'],
    condition: (cache, q) =>
      q.category === 'Labels' && cache.getLabelsVisible() === true,
    answer:     'YES',
    confidence: 0.95,
    rationale:  'Labels visible in observations. Label question answered YES.',
  },

  // ── Cleanliness: CLEAN ─────────────────────────────────────────────────────
  {
    id:           'R_CLEAN',
    matchCategory: ['Cleanliness', 'Dust'],
    condition: (cache, q) =>
      ['Cleanliness', 'Dust'].includes(q.category ?? '') &&
      cache.getCleanliness(q.category) === 'CLEAN',
    answer:     'YES',
    confidence: 0.95,
    rationale:  'Observations confirm clean conditions in this category.',
  },

  // ── Cleanliness: DIRTY ─────────────────────────────────────────────────────
  {
    id:           'R_DIRTY',
    matchCategory: ['Cleanliness', 'Dust'],
    condition: (cache, q) =>
      ['Cleanliness', 'Dust'].includes(q.category ?? '') &&
      cache.getCleanliness(q.category) === 'DIRTY',
    answer:     'NO',
    confidence: 0.97,
    rationale:  'Observations confirm dirty or contaminated conditions in this category.',
  },

  // ── Hazards present in SORT pillar ────────────────────────────────────────
  {
    id:    'R_HAZARD_SORT',
    pillar: 'SORT',
    condition: (cache) => cache.hasHazards(),
    answer:     'NO',
    confidence: 0.98,
    rationale:  'Hazards were detected in workplace observations. SORT question answered NO.',
  },

  // ── PPE absent in SUSTAIN ─────────────────────────────────────────────────
  {
    id:           'R_PPE_ABSENT',
    pillar:       'SUSTAIN',
    matchCategory: ['PPE Compliance'],
    condition: (cache, q) =>
      q.category === 'PPE Compliance' &&
      cache.getSafetyEquipment().length === 0,
    answer:     'NO',
    confidence: 0.93,
    rationale:  'No safety equipment or PPE detected in any observation. PPE question answered NO.',
  },

  // ── Storage not visible ────────────────────────────────────────────────────
  {
    id:           'R_STORAGE_NOT_VISIBLE',
    matchCategory: ['Storage'],
    condition: (cache, q) =>
      q.category === 'Storage' && cache.getStoragePresent() === false,
    answer:     'NOT_VISIBLE',
    confidence: 0.92,
    rationale:  'No storage system detected in any observation. Storage question marked NOT_VISIBLE.',
  },

  // ── All observations in category are NOT_VISIBLE ───────────────────────────
  {
    id:    'R_CATEGORY_NOT_VISIBLE',
    condition: (cache, q) => {
      if (!q.category) return false;
      const catObs = cache.getByCategory(q.category);
      return catObs.length > 0 && catObs.every((o) => o.status === 'NOT_VISIBLE');
    },
    answer:     'NOT_VISIBLE',
    confidence: 0.90,
    rationale:  'All observations for this category are NOT_VISIBLE. Question answered NOT_VISIBLE.',
  },

  // ── Safety signage present (STANDARDIZE) ──────────────────────────────────
  {
    id:           'R_SAFETY_SIGNAGE',
    pillar:       'STANDARDIZE',
    matchCategory: ['Safety Markings'],
    condition: (cache, q) =>
      q.category === 'Safety Markings' &&
      cache.getSafetyEquipment().length > 0,
    answer:     'YES',
    confidence: 0.90,
    rationale:  'Safety equipment or signage detected. Safety Markings question answered YES.',
  },

  // ── Waste compliant ────────────────────────────────────────────────────────
  {
    id:           'R_WASTE_COMPLIANT',
    matchCategory: ['Waste', 'Waste Disposal'],
    condition: (cache, q) => {
      const category = q.category ?? '';
      if (!['Waste', 'Waste Disposal'].includes(category)) return false;
      const catObs = cache.getByCategory(category);
      return catObs.length > 0 && catObs.every((o) => o.status === 'COMPLIANT');
    },
    answer:     'YES',
    confidence: 0.94,
    rationale:  'All waste-related observations are COMPLIANT. Waste question answered YES.',
  },

  // ── No clutter detected ────────────────────────────────────────────────────
  {
    id:           'R_NO_CLUTTER',
    matchCategory: ['Clutter'],
    condition: (cache, q) => {
      if (q.category !== 'Clutter') return false;
      const catObs = cache.getByCategory('Clutter');
      return catObs.length > 0 && catObs.every((o) => o.status === 'COMPLIANT');
    },
    answer:     'YES',
    confidence: 0.94,
    rationale:  'All clutter observations are COMPLIANT. Clutter question answered YES.',
  },

  // ── Heavy clutter present ──────────────────────────────────────────────────
  {
    id:           'R_HEAVY_CLUTTER',
    matchCategory: ['Clutter', 'Waste'],
    condition: (cache, q) => {
      const category = q.category ?? '';
      if (!['Clutter', 'Waste'].includes(category)) return false;
      const nonCompliant = cache.getByCategory(category)
        .filter((o) => o.status === 'NON_COMPLIANT');
      return nonCompliant.length >= 2;
    },
    answer:     'NO',
    confidence: 0.96,
    rationale:  'Multiple NON_COMPLIANT clutter/waste observations. Question answered NO.',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply all built-in rules to the question list.
 * Returns a Map<question_id, ValidatedAuditResponse> for matched questions only.
 * Unmatched questions must be sent to the LLM.
 */
export function applyBuiltinRules(
  questions: QuestionInput[],
  cache:     ObservationCache,
): { answers: Map<string, ValidatedAuditResponse>; evaluations: RuleEvaluation[] } {
  const answers     = new Map<string, ValidatedAuditResponse>();
  const evaluations: RuleEvaluation[] = [];

  for (const question of questions) {
    // Already answered (should not happen but be defensive)
    if (answers.has(question.question_id)) continue;

    for (const rule of BUILTIN_RULES) {
      // Pillar filter: if rule specifies a pillar, skip non-matching questions
      if (rule.pillar && rule.pillar !== question.pillar) continue;

      // Evaluate condition
      if (!rule.condition(cache, question)) continue;

      // Rule matched — record answer and evaluation
      const evaluation: RuleEvaluation = {
        question_id: question.question_id,
        rule_id:     rule.id,
        answer:      rule.answer,
        confidence:  rule.confidence,
        rationale:   rule.rationale,
        source:      'BUILTIN',
      };
      evaluations.push(evaluation);

      answers.set(question.question_id, {
        question_id:    question.question_id,
        ai_answer:      rule.answer,
        confidence:     rule.confidence,
        evidence:       rule.rationale,
        reasoning:      `Rule ${rule.id} applied: ${rule.rationale}`,
        answeredByRule: true,
        ruleId:         rule.id,
      });

      break; // First matching rule wins; move to next question
    }
  }

  return { answers, evaluations };
}

/**
 * Apply DB-configurable custom rules loaded from audit_custom_rules table.
 * DB rules take precedence over built-in rules — call this first.
 */
export function applyDbRules(
  questions: QuestionInput[],
  cache:     ObservationCache,
  dbRules:   DbCustomRule[],
): { answers: Map<string, ValidatedAuditResponse>; evaluations: RuleEvaluation[] } {
  const answers     = new Map<string, ValidatedAuditResponse>();
  const evaluations: RuleEvaluation[] = [];

  for (const question of questions) {
    if (answers.has(question.question_id)) continue;

    // Filter rules applicable to this question
    const applicable = dbRules.filter((r) =>
      r.is_active &&
      (r.pillar   === null || r.pillar   === question.pillar) &&
      (r.category === null || r.category === question.category)
    );

    for (const rule of applicable) {
      if (!evaluateDbCondition(rule.condition_json, cache, question)) continue;

      const rationale = rule.rationale ?? `DB rule ${rule.rule_id} matched.`;
      evaluations.push({
        question_id: question.question_id,
        rule_id:     rule.rule_id,
        answer:      rule.answer,
        confidence:  rule.confidence,
        rationale,
        source:      'DB',
      });

      answers.set(question.question_id, {
        question_id:    question.question_id,
        ai_answer:      rule.answer,
        confidence:     rule.confidence,
        evidence:       rationale,
        reasoning:      `DB custom rule ${rule.rule_id} applied: ${rationale}`,
        answeredByRule: true,
        ruleId:         rule.rule_id,
      });

      break;
    }
  }

  return { answers, evaluations };
}

/**
 * Full hybrid evaluation: DB rules first, then built-in rules for remaining questions.
 * Returns merged answers and a complete evaluation log.
 */
export function applyAllRules(
  questions: QuestionInput[],
  cache:     ObservationCache,
  dbRules:   DbCustomRule[] = [],
): { answers: Map<string, ValidatedAuditResponse>; evaluations: RuleEvaluation[] } {
  // Tier 1: DB custom rules (org-specific, highest priority)
  const { answers: dbAnswers, evaluations: dbEvals } = applyDbRules(questions, cache, dbRules);

  // Tier 2: Built-in rules for unanswered questions only
  const unanswered = questions.filter((q) => !dbAnswers.has(q.question_id));
  const { answers: builtinAnswers, evaluations: builtinEvals } = applyBuiltinRules(unanswered, cache);

  // Merge
  const allAnswers = new Map([...dbAnswers, ...builtinAnswers]);
  const allEvals   = [...dbEvals, ...builtinEvals];

  return { answers: allAnswers, evaluations: allEvals };
}

// ── DB condition evaluator ────────────────────────────────────────────────────

function evaluateDbCondition(
  condition: DbRuleCondition,
  cache:     ObservationCache,
  question:  QuestionInput,
): boolean {
  switch (condition.type) {
    case 'has_hazard':
      return cache.hasHazards();

    case 'has_obstruction':
      return cache.hasObstructions();

    case 'cleanliness': {
      const expected = condition.value as string;
      return cache.getCleanliness(question.category) === expected;
    }

    case 'floor_markings': {
      const expected = condition.value as boolean | null;
      return cache.getFloorMarkings() === expected;
    }

    case 'labels_visible': {
      const expected = condition.value as boolean | null;
      return cache.getLabelsVisible() === expected;
    }

    case 'storage_present': {
      const expected = condition.value as boolean | null;
      return cache.getStoragePresent() === expected;
    }

    case 'no_detected_objects':
      return cache.getDetectedObjects().length === 0;

    case 'safety_equipment_absent':
      return cache.getSafetyEquipment().length === 0;

    case 'non_compliant_count_gte': {
      const threshold = Number(condition.value ?? 1);
      const category  = question.category;
      const count     = category
        ? cache.getByCategory(category).filter((o) => o.status === 'NON_COMPLIANT').length
        : cache.nonCompliantCount();
      return count >= threshold;
    }

    default:
      return false;
  }
}
