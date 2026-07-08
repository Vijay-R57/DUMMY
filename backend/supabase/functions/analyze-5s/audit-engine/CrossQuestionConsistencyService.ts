/**
 * supabase/functions/analyze-5s/audit-engine/CrossQuestionConsistencyService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-Question Consistency Validator (Phase 4.1).
 *
 * Validates logical consistency between all 20 audit question results before
 * generating the final report.
 *
 * If two question results are logically contradictory (e.g. "Very Good" for
 * floor cleanliness and "Very Bad" for contamination control) the service:
 *   1. Records a ConsistencyFlag with the affected question IDs
 *   2. Reduces confidence on both affected questions by confidenceDrop
 *   3. Logs the inconsistency for explainability
 *   4. DOES NOT change ratings (only confidence)
 *
 * Rules are deterministic — zero LLM calls, zero randomness.
 *
 * Design invariants:
 *  - Never changes ratings — only logs + reduces confidence
 *  - Zero prompt content
 *  - Zero zone-specific logic
 *  - Never throws
 */

import type {
  QuestionResult,
  ConsistencyFlag,
  AuditRating,
} from './types.ts';

// ── Consistency rule definition ───────────────────────────────────────────────

interface ConsistencyRule {
  ruleId:       string;
  description:  string;
  questionA:    string;          // First question in the pair
  questionB:    string;          // Second question in the pair
  /** Rating patterns that are mutually inconsistent */
  incompatible: Array<{
    ratingA: AuditRating[];      // If Q-A is one of these...
    ratingB: AuditRating[];      // ...and Q-B is one of these → flag
  }>;
  confidenceDrop: number;        // Percentage points (e.g. 15 = -15% confidence)
  severity:       'MINOR' | 'MODERATE' | 'MAJOR';
}

// ── All consistency rules ─────────────────────────────────────────────────────

const CONSISTENCY_RULES: ConsistencyRule[] = [

  // ── Sort × Set in Order ───────────────────────────────────────────────────
  {
    ruleId:      'SORT_EXCELLENT_vs_LAYOUT_POOR',
    description: 'Excellent unnecessary item removal is inconsistent with very poor organisation.',
    questionA:   'SORT-01',
    questionB:   'SIO-01',
    incompatible: [
      { ratingA: ['Very Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],  ratingB: ['Very Good'] },
    ],
    confidenceDrop: 10,
    severity:       'MINOR',
  },

  // ── Shine ─────────────────────────────────────────────────────────────────
  {
    ruleId:      'FLOOR_CLEAN_vs_MACHINE_CONTAMINATED',
    description: 'Excellent floor cleanliness is inconsistent with very poor machine cleanliness.',
    questionA:   'SHN-02',
    questionB:   'SHN-03',
    incompatible: [
      { ratingA: ['Very Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],  ratingB: ['Very Good'] },
    ],
    confidenceDrop: 15,
    severity:       'MODERATE',
  },

  {
    ruleId:      'CLEANING_TOOLS_vs_CLEANLINESS',
    description: 'Very Good cleaning tool availability is inconsistent with Very Bad cleanliness outcomes.',
    questionA:   'SHN-01',
    questionB:   'SHN-02',
    incompatible: [
      { ratingA: ['Very Good'], ratingB: ['Very Bad'] },
    ],
    confidenceDrop: 10,
    severity:       'MINOR',
  },

  // ── Safety / Access ───────────────────────────────────────────────────────
  {
    ruleId:      'CLEAR_AISLE_vs_BLOCKED_ACCESS',
    description: 'Clear aisle markings are inconsistent with blocked or inaccessible emergency equipment.',
    questionA:   'SIO-02',  // floor markings
    questionB:   'SIO-03',  // organisation and access
    incompatible: [
      { ratingA: ['Very Good', 'Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],          ratingB: ['Very Good', 'Good'] },
    ],
    confidenceDrop: 20,
    severity:       'MAJOR',
  },

  // ── Standardize × Sustain ─────────────────────────────────────────────────
  {
    ruleId:      'STANDARDS_POSTED_vs_SUSTAIN_ABSENT',
    description: 'Comprehensive posted standards are inconsistent with no visible evidence of 5S being sustained.',
    questionA:   'STD-02',  // SOPs posted
    questionB:   'SUS-01',  // maintained condition
    incompatible: [
      { ratingA: ['Very Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],  ratingB: ['Very Good'] },
    ],
    confidenceDrop: 10,
    severity:       'MINOR',
  },

  {
    ruleId:      'AUDIT_BOARD_vs_NO_SUSTAIN_EVIDENCE',
    description: 'Active 5S audit boards are inconsistent with no visible sustained 5S condition.',
    questionA:   'SUS-02',  // audit boards
    questionB:   'SUS-04',  // visual ownership
    incompatible: [
      { ratingA: ['Very Good', 'Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],          ratingB: ['Very Good', 'Good'] },
    ],
    confidenceDrop: 15,
    severity:       'MODERATE',
  },

  // ── Overall consistency ───────────────────────────────────────────────────
  {
    ruleId:      'EXCELLENT_LABELS_vs_NO_STANDARDS',
    description: 'Excellent labelling and identification is inconsistent with no visible standardization.',
    questionA:   'STD-01',  // visual identification
    questionB:   'STD-03',  // storage visual controls
    incompatible: [
      { ratingA: ['Very Good'], ratingB: ['Very Bad'] },
      { ratingA: ['Very Bad'],  ratingB: ['Very Good'] },
    ],
    confidenceDrop: 10,
    severity:       'MINOR',
  },
];

// ── CrossQuestionConsistencyService ──────────────────────────────────────────

export class CrossQuestionConsistencyService {

  /**
   * Validates all question results for logical cross-question consistency.
   * Returns a list of ConsistencyFlags and the affected question IDs with
   * suggested confidence reductions.
   *
   * Does NOT modify ratings. Only logs flags and confidence drops.
   */
  static validate(questions: QuestionResult[]): {
    flags:              ConsistencyFlag[];
    confidenceDropMap:  Map<string, number>;
  } {
    const ratingMap = new Map<string, AuditRating>(
      questions.map((q) => [q.questionId, q.rating]),
    );

    const flags:             ConsistencyFlag[] = [];
    const confidenceDropMap: Map<string, number> = new Map();

    for (const rule of CONSISTENCY_RULES) {
      const ratingA = ratingMap.get(rule.questionA);
      const ratingB = ratingMap.get(rule.questionB);

      if (!ratingA || !ratingB) continue;

      // Check if any incompatible pair matches
      const triggered = rule.incompatible.some(
        (pair) => pair.ratingA.includes(ratingA) && pair.ratingB.includes(ratingB),
      );

      if (triggered) {
        flags.push({
          flagId:         rule.ruleId,
          questionIds:    [rule.questionA, rule.questionB],
          description:    rule.description,
          confidenceDrop: rule.confidenceDrop,
          severity:       rule.severity,
        });

        // Accumulate confidence drop for each affected question
        for (const qId of [rule.questionA, rule.questionB]) {
          confidenceDropMap.set(
            qId,
            (confidenceDropMap.get(qId) ?? 0) + rule.confidenceDrop,
          );
        }
      }
    }

    return { flags, confidenceDropMap };
  }

  /**
   * Applies confidence drops from consistency flags to question results.
   * Confidence is expressed as a percentage string (e.g. "87%").
   * Drop is capped so confidence never falls below 10%.
   */
  static applyConfidenceDrops(
    questions:         QuestionResult[],
    confidenceDropMap: Map<string, number>,
  ): QuestionResult[] {
    return questions.map((q) => {
      const drop = confidenceDropMap.get(q.questionId) ?? 0;
      if (drop === 0) return q;

      const currentPct = parseConfidencePct(q.confidence);
      const newPct     = Math.max(10, currentPct - drop);
      return {
        ...q,
        confidence: `${newPct}%`,
      };
    });
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function parseConfidencePct(confidence: string): number {
  const match = confidence.replace('%', '').trim();
  const num   = parseFloat(match);
  return isNaN(num) ? 70 : Math.max(10, Math.min(100, num));
}

// ── R11: Dependency export ─────────────────────────────────────────────────────

/**
 * Returns the list of question IDs that `questionId` has a consistency
 * dependency with, derived from CONSISTENCY_RULES.
 *
 * Used by QuestionEvaluationRegistry to populate consistencyDependencies
 * for each question entry.
 */
export function getConsistencyDependencies(questionId: string): string[] {
  const deps = new Set<string>();
  for (const rule of CONSISTENCY_RULES) {
    if (rule.questionA === questionId) deps.add(rule.questionB);
    if (rule.questionB === questionId) deps.add(rule.questionA);
  }
  return [...deps];
}
