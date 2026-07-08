/**
 * supabase/functions/analyze-5s/ai/ConsistencyValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-Question Consistency Validator (Phase 2A.1).
 *
 * Detects logical contradictions between audit answers and observations.
 * Policy: Warning-only. Contradictions are recorded and included in the
 * explainability report and fed into ReliabilityClassifier.
 * No auto-retry. Retry logic is a future configurable enterprise feature.
 *
 * Each consistency rule checks for a specific logical contradiction pattern.
 * When a contradiction is found:
 *  - A ConsistencyWarning is created with severity and affected question IDs.
 *  - The warning is included in the explainability report.
 *  - The count of HIGH warnings is passed to ReliabilityClassifier.
 *  - Scores are NEVER modified.
 */

import type { ObservationCache } from './ObservationCache.ts';
import type { ValidatedAuditResponse } from './VisionAnalyzer.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConsistencyWarningSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConsistencyWarning {
  rule_id:               string;
  description:           string;
  contradiction:         string;         // Human-readable description of the contradiction
  affected_question_ids: string[];
  severity:              ConsistencyWarningSeverity;
}

// ── Internal rule type ────────────────────────────────────────────────────────

interface ConsistencyRule {
  id:          string;
  description: string;
  severity:    ConsistencyWarningSeverity;
  check: (
    responses:    Map<string, ValidatedAuditResponse>,
    cache:        ObservationCache,
    questionMap:  Map<string, { category?: string; pillar: string }>,
  ) => { contradiction: string; affected: string[] } | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getAnswer(
  responses: Map<string, ValidatedAuditResponse>,
  questionId: string,
): string | undefined {
  return responses.get(questionId)?.ai_answer;
}

/**
 * Returns all question_ids whose category matches any of the given categories.
 */
function questionsForCategories(
  questionMap: Map<string, { category?: string; pillar: string }>,
  categories:  string[],
): string[] {
  return [...questionMap.entries()]
    .filter(([, q]) => q.category && categories.includes(q.category))
    .map(([id]) => id);
}

// ── Consistency rules ─────────────────────────────────────────────────────────

const CONSISTENCY_RULES: ConsistencyRule[] = [
  // C1: Storage labels visible but labels were observed absent
  {
    id:          'C_STORAGE_LABEL_CONTRADICTION',
    description: 'Storage exists but label observations indicate labels are absent',
    severity:    'MEDIUM',
    check: (responses, cache, questionMap) => {
      const storagePresent = cache.getStoragePresent();
      if (storagePresent !== true) return null;
      const labelsAbsent = cache.getLabelsVisible() === false;
      if (!labelsAbsent) return null;

      // Find label questions answered YES
      const labelQs = questionsForCategories(questionMap, ['Labels']);
      const contradicted = labelQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'Storage was observed present but labels were explicitly absent in observations, yet label questions were answered YES.',
        affected: contradicted,
      };
    },
  },

  // C2: No tools detected but tool organization answered YES
  {
    id:          'C_NO_TOOLS_ORGANIZED',
    description: 'No tools detected in observations but tool organization answered YES',
    severity:    'MEDIUM',
    check: (responses, cache, questionMap) => {
      const objects = cache.getDetectedObjects();
      const hasTools = objects.some((o) => /tool|hammer|wrench|jig|shadow.?board|spanner|screwdriver/i.test(o));
      if (hasTools) return null;

      const toolQs = questionsForCategories(questionMap, ['Tool Organization']);
      const contradicted = toolQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'No tools detected in any observation, but tool organization questions were answered YES.',
        affected: contradicted,
      };
    },
  },

  // C3: Floor not visible in observations but floor cleanliness not marked NOT_VISIBLE
  {
    id:          'C_FLOOR_NOT_VISIBLE',
    description: 'Floor not observed but floor cleanliness not marked NOT_VISIBLE',
    severity:    'HIGH',
    check: (responses, cache, questionMap) => {
      const cleanlinessObs = cache.getByCategory('Cleanliness');
      const allNotVisible  = cleanlinessObs.length > 0 &&
        cleanlinessObs.every((o) => o.status === 'NOT_VISIBLE');
      if (!allNotVisible) return null;

      const cleanQs = questionsForCategories(questionMap, ['Cleanliness']);
      const contradicted = cleanQs.filter((id) => {
        const ans = getAnswer(responses, id);
        return ans !== undefined && ans !== 'NOT_VISIBLE';
      });
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'All cleanliness observations are NOT_VISIBLE, but cleanliness questions were not answered NOT_VISIBLE.',
        affected: contradicted,
      };
    },
  },

  // C4: PPE absent but PPE sustain question answered YES
  {
    id:          'C_PPE_ABSENT_SUSTAIN',
    description: 'No PPE/safety equipment observed but PPE question answered YES',
    severity:    'HIGH',
    check: (responses, cache, questionMap) => {
      if (cache.getSafetyEquipment().length > 0) return null;

      const ppeQs = questionsForCategories(questionMap, ['PPE Compliance']);
      const contradicted = ppeQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'No PPE or safety equipment detected in any observation, yet PPE compliance questions were answered YES.',
        affected: contradicted,
      };
    },
  },

  // C5: Heavy clutter observed but organization answered YES
  {
    id:          'C_CLUTTER_ORGANIZED',
    description: 'Heavy clutter observed but organization/sort questions answered YES',
    severity:    'HIGH',
    check: (responses, cache, questionMap) => {
      const clutterObs = [
        ...cache.getByCategory('Clutter'),
        ...cache.getByCategory('Waste'),
      ].filter((o) => o.status === 'NON_COMPLIANT');
      if (clutterObs.length < 2) return null;

      const sortQs = [...questionMap.entries()]
        .filter(([, q]) => q.pillar === 'SORT')
        .map(([id]) => id);
      const contradicted = sortQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'Multiple NON_COMPLIANT clutter/waste observations were found, but SORT questions were answered YES.',
        affected: contradicted,
      };
    },
  },

  // C6: Dirty workspace but standardize cleanliness answered YES
  {
    id:          'C_DIRTY_STANDARDIZED',
    description: 'Multiple dirty observations but standardize/cleanliness answered YES',
    severity:    'MEDIUM',
    check: (responses, cache, questionMap) => {
      const dirtyCount = ['Cleanliness', 'Dust', 'Waste']
        .flatMap((cat) => cache.getByCategory(cat))
        .filter((o) => o.status === 'NON_COMPLIANT').length;
      if (dirtyCount < 2) return null;

      const stdQs = [...questionMap.entries()]
        .filter(([, q]) => q.pillar === 'STANDARDIZE')
        .map(([id]) => id);
      const contradicted = stdQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'Multiple dirty/waste NON_COMPLIANT observations exist but STANDARDIZE questions were answered YES.',
        affected: contradicted,
      };
    },
  },

  // C7: Hazards detected but safety zone question answered YES
  {
    id:          'C_HAZARD_SAFE',
    description: 'Hazards detected but safety question answered YES',
    severity:    'HIGH',
    check: (responses, cache, questionMap) => {
      if (!cache.hasHazards()) return null;

      const safetyQs = questionsForCategories(questionMap, ['Safety Markings']);
      const contradicted = safetyQs.filter((id) => {
        const ans = getAnswer(responses, id);
        return ans === 'YES';
      });
      // Only flag if there are significant hazards (not just minor ones)
      const seriousHazards = cache.getAllHazards()
        .filter((h) => /blocked|spill|exposed|fire|emergency|toxic/i.test(h));
      if (seriousHazards.length === 0 || contradicted.length === 0) return null;

      return {
        contradiction: `Serious hazards detected (${seriousHazards.join(', ')}) but safety zone questions were answered YES.`,
        affected: contradicted,
      };
    },
  },

  // C8: Label contradiction within same category (some say visible, some say absent)
  {
    id:          'C_LABEL_INTERNAL_CONTRADICTION',
    description: 'Label observations contradict each other (visible vs absent in same category)',
    severity:    'MEDIUM',
    check: (responses, cache) => {
      const labelObs = cache.getByCategory('Labels');
      const hasVisible = labelObs.some((o) => o.labels_visible === true);
      const hasAbsent  = labelObs.some((o) => o.labels_visible === false);
      if (!hasVisible || !hasAbsent) return null;

      // Report as informational — find label question IDs
      const contradicted = [...responses.entries()]
        .filter(([, r]) => r.ai_answer === 'YES' || r.ai_answer === 'NO')
        .map(([id]) => id)
        .slice(0, 3);

      return {
        contradiction: 'Label observations contain contradictory findings: some areas show labels present, others show labels absent.',
        affected: contradicted,
      };
    },
  },

  // C9: Empty area (no detected objects) but many questions answered YES
  {
    id:          'C_EMPTY_AREA_HIGH_SCORE',
    description: 'No objects detected but multiple questions answered YES',
    severity:    'LOW',
    check: (responses, cache) => {
      if (cache.getDetectedObjects().length > 0) return null;
      if (cache.size() === 0) return null;

      const yesAnswers = [...responses.values()].filter((r) => r.ai_answer === 'YES');
      if (yesAnswers.length < 3) return null;

      return {
        contradiction: 'No physical objects detected in any observation, yet multiple checklist questions were answered YES.',
        affected: yesAnswers.map((r) => r.question_id).slice(0, 5),
      };
    },
  },

  // C10: Obstructions in aisles but SET_IN_ORDER floor marking answered YES
  {
    id:          'C_OBSTRUCTION_FLOOR_CLEAR',
    description: 'Aisles obstructed but floor marking/organization answered YES',
    severity:    'HIGH',
    check: (responses, cache, questionMap) => {
      const hasAisleObstruction = cache.getAllObstructions()
        .some((o) => /aisle|pathway|corridor|walkway/i.test(o));
      if (!hasAisleObstruction) return null;

      const floorQs = questionsForCategories(questionMap, ['Floor Markings']);
      const contradicted = floorQs.filter((id) => getAnswer(responses, id) === 'YES');
      if (contradicted.length === 0) return null;

      return {
        contradiction: 'Obstructions detected in aisles or walkways, but floor marking/organization questions were answered YES.',
        affected: contradicted,
      };
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates cross-question consistency of audit answers against observations.
 *
 * @param responses   - Audit answers (question_id → ValidatedAuditResponse)
 * @param cache       - Structured observation cache
 * @param questionMap - Map of question_id → { category, pillar } for context
 * @returns           Array of consistency warnings (empty = no contradictions)
 */
export function validateConsistency(
  responses:    ValidatedAuditResponse[],
  cache:        ObservationCache,
  questionMeta: Array<{ question_id: string; category?: string; pillar: string }>,
): ConsistencyWarning[] {
  const responseMap  = new Map(responses.map((r) => [r.question_id, r]));
  const questionMap  = new Map(
    questionMeta.map((q) => [q.question_id, { category: q.category, pillar: q.pillar }])
  );

  const warnings: ConsistencyWarning[] = [];

  for (const rule of CONSISTENCY_RULES) {
    try {
      const result = rule.check(responseMap, cache, questionMap);
      if (result) {
        warnings.push({
          rule_id:               rule.id,
          description:           rule.description,
          contradiction:         result.contradiction,
          affected_question_ids: result.affected,
          severity:              rule.severity,
        });
      }
    } catch (e) {
      // Consistency rules must never crash the pipeline
      console.warn(`[ConsistencyValidator] Rule ${rule.id} threw an error:`, e);
    }
  }

  return warnings;
}

/** Count of HIGH severity warnings (used by ReliabilityClassifier). */
export function countHighWarnings(warnings: ConsistencyWarning[]): number {
  return warnings.filter((w) => w.severity === 'HIGH').length;
}
