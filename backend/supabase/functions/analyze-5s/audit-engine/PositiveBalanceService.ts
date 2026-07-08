/**
 * supabase/functions/analyze-5s/audit-engine/PositiveBalanceService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Positive vs Violation balance computation (Phase 4.1).
 *
 * Computes a BalanceResult per question from the AuditEvidenceModel,
 * comparing weighted positive compliance against weighted violations.
 *
 * The balance ratio drives rating guidance injected into Stage B prompts.
 * This prevents isolated minor deficiencies from producing disproportionately
 * low ratings when strong positive compliance is present.
 *
 * Algorithm:
 *   positiveScore = Σ(HIGH: 3pts, MEDIUM: 2pts, LOW: 1pt)
 *   violationScore = Σ(CRITICAL: 10pts, MAJOR: 6pts, MODERATE: 3pts, MINOR: 1pt)
 *   balanceRatio = positiveScore / (positiveScore + violationScore)
 *   CRITICAL violation → forces Very Bad regardless of positiveScore
 *
 * Design invariants:
 *  - No LLM calls
 *  - No prompt content
 *  - No zone-specific logic
 *  - Never throws
 */

import type {
  AuditEvidenceModel,
  BalanceResult,
  AuditRating,
  QuestionCalibrationConfig,
  PositiveObservation,
  ViolationObservation,
} from './types.ts';

// ── Scoring weights ────────────────────────────────────────────────────────────

const POSITIVE_WEIGHTS: Record<string, number> = {
  HIGH:   3,
  MEDIUM: 2,
  LOW:    1,
};

const VIOLATION_WEIGHTS: Record<string, number> = {
  CRITICAL: 10,
  MAJOR:     6,
  MODERATE:  3,
  MINOR:     1,
};

// ── Question → dimension keywords (same map as EvidenceCoverageService) ────────
// Kept local to keep each service self-contained

const QUESTION_DIMENSIONS: Readonly<Record<string, readonly string[]>> = {
  'SORT-01':  ['unnecessary', 'unused', 'obsolete', 'displaced'],
  'SORT-02':  ['equipment', 'machinery', 'layout', 'zone'],
  'SORT-03':  ['document', 'record', 'instruction', 'manual'],
  'SORT-04':  ['item', 'object', 'material', 'stock'],
  'SIO-01':   ['label', 'identification', 'sign', 'marking'],
  'SIO-02':   ['floor', 'marking', 'aisle', 'delineation'],
  'SIO-03':   ['storage', 'location', 'position', 'organisation'],
  'SIO-04':   ['document', 'file', 'record', 'instruction'],
  'SHN-01':   ['cleaning', 'tool', 'mop', 'broom', 'wipe'],
  'SHN-02':   ['floor', 'surface', 'dust', 'dirt', 'cleanliness'],
  'SHN-03':   ['machine', 'equipment', 'surface', 'oil', 'rust'],
  'SHN-04':   ['cleaning', 'routine', 'hygiene'],
  'STD-01':   ['label', 'identification', 'colour', 'marking'],
  'STD-02':   ['instruction', 'SOP', 'procedure', 'posted'],
  'STD-03':   ['storage', 'location', 'control', 'visual'],
  'STD-04':   ['cleaning', 'inspection', 'maintenance', 'posted'],
  'SUS-01':   ['cleanliness', 'organisation', 'maintained', 'condition'],
  'SUS-02':   ['audit', 'board', 'score', 'display'],
  'SUS-03':   ['kaizen', 'improvement', 'action', 'board'],
  'SUS-04':   ['standard', 'ownership', 'visual', 'maintained'],
};

// ── PositiveBalanceService ─────────────────────────────────────────────────────

export class PositiveBalanceService {

  /**
   * Computes a BalanceResult for every question in the provided list.
   */
  static computeAll(
    questionIds:   string[],
    evidence:      AuditEvidenceModel,
    calibrations:  QuestionCalibrationConfig[],
  ): BalanceResult[] {
    const calibMap = new Map(calibrations.map((c) => [c.questionId, c]));
    return questionIds.map((qId) =>
      PositiveBalanceService.computeForQuestion(qId, evidence, calibMap.get(qId)),
    );
  }

  /**
   * Computes BalanceResult for a single question.
   * Never throws.
   */
  static computeForQuestion(
    questionId:   string,
    evidence:     AuditEvidenceModel,
    calibration?: QuestionCalibrationConfig,
  ): BalanceResult {
    try {
      const dims = QUESTION_DIMENSIONS[questionId] ?? [];

      // ── Filter relevant positive findings ─────────────────────────────────
      const relevantPositive: PositiveObservation[] = evidence.positiveCompliance.filter((pos) =>
        dims.length === 0 || dims.some((dim) =>
          pos.dimension.toLowerCase().includes(dim) ||
          pos.observation.toLowerCase().includes(dim),
        ),
      );

      // ── Filter relevant violations ────────────────────────────────────────
      const relevantViolations: ViolationObservation[] = evidence.violations.filter((v) =>
        dims.length === 0 || dims.some((dim) =>
          v.dimension.toLowerCase().includes(dim) ||
          v.observation.toLowerCase().includes(dim),
        ),
      );

      // ── Check for CRITICAL violation (hard override) ──────────────────────
      const hasCritical = relevantViolations.some((v) => v.severity === 'CRITICAL');

      // ── Compute scores ─────────────────────────────────────────────────────
      const positiveScore = relevantPositive.reduce(
        (sum, p) => sum + (POSITIVE_WEIGHTS[p.confidence] ?? 1),
        0,
      );

      const violationScore = relevantViolations.reduce(
        (sum, v) => sum + (VIOLATION_WEIGHTS[v.severity] ?? 1),
        0,
      );

      // ── Balance ratio ─────────────────────────────────────────────────────
      const total        = positiveScore + violationScore;
      const balanceRatio = total === 0 ? 0.6 : positiveScore / total; // 0.6 = neutral Good default

      // ── Rating guidance from balance ratio ────────────────────────────────
      let ratingGuidance: AuditRating;
      if (hasCritical) {
        ratingGuidance = 'Very Bad';
      } else if (balanceRatio >= 0.85) {
        ratingGuidance = 'Very Good';
      } else if (balanceRatio >= 0.65) {
        ratingGuidance = 'Good';
      } else if (balanceRatio >= 0.45) {
        ratingGuidance = 'Average';
      } else if (balanceRatio >= 0.25) {
        ratingGuidance = 'Bad';
      } else {
        ratingGuidance = 'Very Bad';
      }

      // ── Suppress minor check ──────────────────────────────────────────────
      const onlyMinor = relevantViolations.every((v) => v.severity === 'MINOR');
      const positiveMeetsFloor = calibration
        ? relevantPositive.length >= calibration.positiveInfluence.minimumPositiveCount
        : false;
      const suppressMinor =
        !hasCritical &&
        onlyMinor &&
        positiveMeetsFloor &&
        (calibration?.positiveInfluence.suppressMinor ?? false);

      // ── Balance explanation ───────────────────────────────────────────────
      const balanceExplanation = hasCritical
        ? `CRITICAL violation present — Very Bad override applied regardless of ${positiveScore} positive findings.`
        : total === 0
        ? 'No relevant positive findings or violations found — neutral evaluation.'
        : `${positiveScore} positive weight vs ${violationScore} violation weight (ratio: ${balanceRatio.toFixed(2)}).${suppressMinor ? ' Minor violations suppressed by strong positive compliance.' : ''}`;

      return {
        questionId,
        positiveScore,
        violationScore,
        balanceRatio,
        suppressMinor,
        ratingGuidance,
        balanceExplanation,
      };

    } catch {
      // Safe fallback
      return {
        questionId,
        positiveScore:      0,
        violationScore:     0,
        balanceRatio:       0.5,
        suppressMinor:      false,
        ratingGuidance:     'Average',
        balanceExplanation: 'Balance computation failed — using neutral guidance.',
      };
    }
  }

  /**
   * Returns a compact one-line summary for PromptBuilder injection.
   * Format: "Balance: 0.72 (Good), Minor suppressed: Yes"
   */
  static toOneLine(balance: BalanceResult): string {
    const suppressed = balance.suppressMinor ? ', Minor suppressed: Yes' : '';
    return `Balance: ${balance.balanceRatio.toFixed(2)} → Guidance: ${balance.ratingGuidance}${suppressed}`;
  }
}
