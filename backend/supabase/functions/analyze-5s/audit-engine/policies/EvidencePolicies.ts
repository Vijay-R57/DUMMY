/**
 * supabase/functions/analyze-5s/audit-engine/policies/EvidencePolicies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Evidence and confidence policy definitions for the Audit Decision Matrix (Phase 4).
 *
 * Each policy defines HOW evidence must be gathered and weighted.
 * Question Evaluators reference a policy key from the ADM — they never embed
 * evidence-handling logic directly.
 *
 * Design invariants:
 *  - No pillar names
 *  - No question text
 *  - No zone names
 *  - No prompt content
 */

import type { EvidencePolicyKey, ConfidencePolicyKey, EvidenceConfidence } from '../types.ts';

// ── Evidence Policy Shape ──────────────────────────────────────────────────────

export interface EvidencePolicy {
  key:               EvidencePolicyKey;
  /** Only DIRECT observations (observationType = 'DIRECT') generate violations */
  requireDirectOnly: boolean;
  /** Evaluator must enumerate positive compliance before deductions */
  positiveFirst:     boolean;
  /** AuditKnowledgeBase zone knowledge must be consulted */
  zoneAware:         boolean;
  /**
   * Whether absence-of-item phrasing (e.g. "No floor markings visible")
   * is permitted as evidence. False for all policies except those where
   * absence is the direct compliance criterion.
   */
  allowAbsence:      boolean;
  /** When uncertain, prefer higher score rather than lower */
  conservativeBias:  boolean;
  description:       string;
}

// ── Evidence Policy Registry ───────────────────────────────────────────────────

export const EVIDENCE_POLICIES: Readonly<Record<EvidencePolicyKey, EvidencePolicy>> = {

  /**
   * DIRECT_ONLY — strictest evidence policy.
   * Used for Type 1 questions with Category A evidence.
   * Only unambiguously visible objects may generate violations.
   * No absence reasoning. No zone context required.
   */
  DIRECT_ONLY: {
    key:               'DIRECT_ONLY',
    requireDirectOnly: true,
    positiveFirst:     false,
    zoneAware:         false,
    allowAbsence:      false,
    conservativeBias:  false,
    description:       'Only DIRECT observations accepted; no absence reasoning',
  },

  /**
   * POSITIVE_FIRST — compliance inventory before deductions.
   * Used for questions evaluating overall condition or document organization.
   * Requires positive findings to be listed before any deductions.
   */
  POSITIVE_FIRST: {
    key:               'POSITIVE_FIRST',
    requireDirectOnly: true,
    positiveFirst:     true,
    zoneAware:         false,
    allowAbsence:      false,
    conservativeBias:  true,
    description:       'Compliance inventory required before deductions; conservative bias',
  },

  /**
   * ZONE_AWARE — zone knowledge is authoritative.
   * Used for Type 2 questions where necessity of items depends on zone type.
   * Expected items from AuditKnowledgeBase are NEVER penalized.
   * Evaluator must explicitly cite zone context in every deduction.
   */
  ZONE_AWARE: {
    key:               'ZONE_AWARE',
    requireDirectOnly: true,
    positiveFirst:     true,
    zoneAware:         true,
    allowAbsence:      false,
    conservativeBias:  true,
    description:       'Zone knowledge authoritative; expected items never penalized; positive first',
  },

  /**
   * NO_ABSENCE_REASONING — used for Type 3 questions.
   * Absence evidence, inferred violations, and organizational culture observations
   * are all strictly forbidden. Evaluator produces neutral output only.
   */
  NO_ABSENCE_REASONING: {
    key:               'NO_ABSENCE_REASONING',
    requireDirectOnly: false,
    positiveFirst:     true,
    zoneAware:         false,
    allowAbsence:      false,
    conservativeBias:  true,
    description:       'Type 3: no deductions; no absence reasoning; neutral only',
  },

  /**
   * CONSERVATIVE — maximum conservative bias.
   * Used where zone context + visual evidence are both required
   * and uncertainty is high.
   * Reduces confidence before reducing score.
   */
  CONSERVATIVE: {
    key:               'CONSERVATIVE',
    requireDirectOnly: true,
    positiveFirst:     true,
    zoneAware:         true,
    allowAbsence:      false,
    conservativeBias:  true,
    description:       'Max conservative bias; reduce confidence before reducing score',
  },
};

// ── Confidence Policy Shape ────────────────────────────────────────────────────

export interface ConfidencePolicy {
  key:                    ConfidencePolicyKey;
  /** Default confidence when evidence is uncertain */
  onUncertain:            EvidenceConfidence;
  /** Minimum confidence required before a deduction may be applied */
  minimumForDeduction:    EvidenceConfidence;
  /** Minimum confidence required before a high positive rating may be assigned */
  minimumForVeryGood:     EvidenceConfidence;
}

// ── Confidence Policy Registry ─────────────────────────────────────────────────

export const CONFIDENCE_POLICIES: Readonly<Record<ConfidencePolicyKey, ConfidencePolicy>> = {

  /** Standard: medium confidence permits deductions */
  STANDARD: {
    key:                 'STANDARD',
    onUncertain:         'MEDIUM',
    minimumForDeduction: 'MEDIUM',
    minimumForVeryGood:  'MEDIUM',
  },

  /** Conservative: high confidence required before any deduction */
  CONSERVATIVE: {
    key:                 'CONSERVATIVE',
    onUncertain:         'LOW',
    minimumForDeduction: 'HIGH',
    minimumForVeryGood:  'MEDIUM',
  },

  /** Forced LOW: always LOW confidence regardless of evidence quality (Type 3) */
  FORCED_LOW: {
    key:                 'FORCED_LOW',
    onUncertain:         'LOW',
    minimumForDeduction: 'HIGH', // Never met → no deductions possible
    minimumForVeryGood:  'HIGH', // Never met → no Very Good possible
  },
};

// ── Banned Violation Patterns ──────────────────────────────────────────────────

/**
 * Phrase fragments that must NEVER appear as the sole basis for a violation.
 * EvidenceValidator rejects any violation whose `evidence` field is composed
 * entirely of absence-of-management-system language.
 *
 * Context-aware exceptions are handled in EvidenceValidator via the
 * ALLOWED_ABSENCE_BY_QUESTION map.
 */
export const BANNED_VIOLATION_PATTERNS: readonly string[] = [
  'no red tag',
  'no shadow board',
  'no audit board',
  'no audit schedule',
  'no employee participation',
  'no training',
  'no management commitment',
  'no sop posted',
  'no standard operating procedure',
  'no cleaning schedule',
  'no maintenance schedule',
  'no calibration record',
  'no inspection record',
  'no 5s board',
  'no kaizen board',
  'no improvement board',
  'no floor marking',           // generic — allowed for SIO-03 specifically
  'no label',                   // generic — allowed for SIO-01/STD-01 specifically
  'lack of discipline',
  'lack of employee',
  'workers do not',
  'staff do not',
  'employees are not',
  'historically',
  'typically',
  'usually',
  'in the past',
];

/**
 * For specific question IDs, absence evidence IS valid (the question explicitly
 * evaluates presence of a physical item). EvidenceValidator consults this map
 * to make context-aware decisions.
 */
export const ALLOWED_ABSENCE_BY_QUESTION: Readonly<Record<string, readonly string[]>> = {
  'SIO-01': ['no label', 'no identification', 'not labelled', 'unlabelled'],
  'SIO-03': ['no floor marking', 'no floor tape', 'no aisle marking', 'unmarked'],
  'STD-01': ['no label', 'no colour code', 'no identification marking'],
  'STD-02': ['no sop posted', 'no work instruction', 'no visual standard'],
  'STD-03': ['no floor marking', 'no label', 'no visual control'],
  'STD-04': ['no cleaning standard', 'no inspection standard', 'no maintenance standard'],
  'SUS-02': ['no audit board', 'no 5s board', 'no improvement board'],
  'SUS-03': ['no kaizen board', 'no improvement board', 'no action board'],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getEvidencePolicy(key: EvidencePolicyKey): EvidencePolicy {
  return EVIDENCE_POLICIES[key];
}

export function getConfidencePolicy(key: ConfidencePolicyKey): ConfidencePolicy {
  return CONFIDENCE_POLICIES[key];
}

/**
 * Returns true if the evidence string contains a banned violation pattern
 * that is NOT permitted for the given question ID.
 */
export function isViolationBanned(evidence: string, questionId: string): boolean {
  const lower = evidence.toLowerCase();
  const allowedForThisQuestion = ALLOWED_ABSENCE_BY_QUESTION[questionId] ?? [];

  for (const banned of BANNED_VIOLATION_PATTERNS) {
    if (lower.includes(banned)) {
      // Check if this specific phrase is allowed for this question
      const isAllowed = allowedForThisQuestion.some((allowed) => lower.includes(allowed));
      if (!isAllowed) return true;
    }
  }
  return false;
}
