/**
 * supabase/functions/analyze-5s/audit-engine/policies/RatingPolicies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rating policy definitions for the Audit Decision Matrix (Phase 4).
 *
 * Question Evaluators never hardcode score ranges or allowed ratings.
 * They reference a RatingPolicy by key, loaded from the ADM config.
 *
 * Design invariants:
 *  - No pillar names
 *  - No question text
 *  - No zone names
 *  - No prompt content
 */

import type { AuditRating, RatingPolicyKey } from '../types.ts';

// ── Rating Policy Shape ────────────────────────────────────────────────────────

export interface RatingPolicy {
  key:                    RatingPolicyKey;
  /** Ratings the evaluator is allowed to select for questions using this policy */
  allowedRange:           readonly AuditRating[];
  /** Rating used when confidence falls below the minimum threshold */
  defaultOnLowConfidence: AuditRating;
  /** Minimum numeric score that may be assigned (inclusive) */
  scoreFloor:             number;
  /** If true, Very Bad requires an explicit override justification */
  requiresVeryBadEvidence: boolean;
  description:            string;
}

// ── Policy Registry ────────────────────────────────────────────────────────────

export const RATING_POLICIES: Readonly<Record<RatingPolicyKey, RatingPolicy>> = {

  /**
   * STANDARD — full rating scale.
   * Used for Type 1 (Direct Visual) questions where clear evidence is available.
   * All ratings permitted. Very Bad requires strong visible evidence.
   */
  STANDARD: {
    key:                    'STANDARD',
    allowedRange:           ['Very Bad', 'Bad', 'Average', 'Good', 'Very Good', 'NOT_VISIBLE'],
    defaultOnLowConfidence: 'NOT_VISIBLE',
    scoreFloor:             0,
    requiresVeryBadEvidence: true,
    description:            'Full rating scale; all ratings permitted with appropriate evidence',
  },

  /**
   * CONSERVATIVE — restricted scale.
   * Used for Type 2 (Visual + Context) questions requiring zone knowledge.
   * Very Bad is prohibited unless overwhelming direct evidence supports it.
   * Low confidence defaults to Average (not NOT_VISIBLE) to preserve a neutral result.
   */
  CONSERVATIVE: {
    key:                    'CONSERVATIVE',
    allowedRange:           ['Bad', 'Average', 'Good', 'Very Good', 'NOT_VISIBLE'],
    defaultOnLowConfidence: 'Average',
    scoreFloor:             1,
    requiresVeryBadEvidence: true,
    description:            'Very Bad prohibited; prefers higher score when uncertain',
  },

  /**
   * NEUTRAL_ONLY — forced neutral.
   * Used for Type 3 (Not Reliably Visual) questions — e.g. SHN-04.
   * Always returns Average with LOW confidence.
   * No deductions permitted. No improvement above Average.
   */
  NEUTRAL_ONLY: {
    key:                    'NEUTRAL_ONLY',
    allowedRange:           ['Average'],
    defaultOnLowConfidence: 'Average',
    scoreFloor:             2,
    requiresVeryBadEvidence: false,
    description:            'Type 3 questions: always Average, always LOW confidence',
  },
};

// ── Helper ─────────────────────────────────────────────────────────────────────

/** Returns the RatingPolicy for a given key. Never throws. */
export function getRatingPolicy(key: RatingPolicyKey): RatingPolicy {
  return RATING_POLICIES[key];
}

/**
 * Checks whether a given AuditRating is allowed by the specified policy.
 * Used by EvidenceValidator to reject out-of-range ratings before
 * they reach Stage B evaluators.
 */
export function isRatingAllowed(rating: AuditRating, policy: RatingPolicy): boolean {
  return (policy.allowedRange as readonly string[]).includes(rating);
}
