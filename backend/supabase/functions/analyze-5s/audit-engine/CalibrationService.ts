/**
 * supabase/functions/analyze-5s/audit-engine/CalibrationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Post-Stage B calibration guard (Phase 4.1).
 *
 * Applies deterministic escalation overrides to QuestionResult[] after
 * Stage B LLM evaluation. The LLM makes the primary judgment; this service
 * enforces hard rules that must always hold regardless of LLM output.
 *
 * Escalation rules applied (in priority order):
 *  1. SHN-04 always forced to Average + LOW confidence (Type 3 question)
 *  2. CRITICAL violations in evidence → force Very Bad for the affected question
 *  3. CONSERVATIVE policy question rated Very Bad with no MAJOR+ violation
 *     → raise to Bad (prevent over-penalization by conservative questions)
 *  4. Evidence coverage < 30% and rating is Very Bad → raise to NOT_VISIBLE
 *
 * Design invariants:
 *  - Minimally invasive — only applies when a hard rule is violated
 *  - Every override is logged with a reason
 *  - Zero prompt content
 *  - Zero zone-specific logic
 *  - Never throws
 */

import type {
  QuestionResult,
  AuditEvidenceModel,
  QuestionCalibrationConfig,
  EvidenceCoverage,
  AuditRating,
} from './types.ts';
import { RATING_TO_SCORE } from './types.ts';

// ── CalibrationOverride record ────────────────────────────────────────────────

export interface CalibrationOverride {
  questionId:  string;
  rule:        string;
  fromRating:  AuditRating;
  toRating:    AuditRating;
  reason:      string;
}

// ── Question → pillar dimension helper ───────────────────────────────────────

const CONSERVATIVE_QUESTIONS = new Set([
  'SORT-02', 'SORT-03', 'SORT-04',
  'SIO-02', 'SIO-04',
  'SUS-01', 'SUS-04',
]);

// ── CalibrationService ────────────────────────────────────────────────────────

export class CalibrationService {

  /**
   * Applies all escalation rules to a set of QuestionResults.
   *
   * @param questions     - Stage B output from AuditValidator
   * @param evidence      - Shared AuditEvidenceModel from Stage A
   * @param calibrations  - QuestionCalibrationConfig array from AuditCalibrationMatrix
   * @param coverages     - EvidenceCoverage array from EvidenceCoverageService
   * @returns             - Corrected QuestionResult[] + applied overrides log
   */
  static applyEscalationRules(
    questions:    QuestionResult[],
    evidence:     AuditEvidenceModel,
    calibrations: QuestionCalibrationConfig[],
    coverages:    EvidenceCoverage[],
  ): { questions: QuestionResult[]; overrides: CalibrationOverride[] } {
    const calibMap   = new Map(calibrations.map((c) => [c.questionId, c]));
    const coverageMap = new Map(coverages.map((c) => [c.questionId, c]));
    const overrides: CalibrationOverride[] = [];

    const corrected: QuestionResult[] = questions.map((q) => {
      const calibration = calibMap.get(q.questionId);
      const coverage    = coverageMap.get(q.questionId);

      let rating  = q.rating;
      let confidence = q.confidence;

      // ── Rule 1: SHN-04 must always be Average ─────────────────────────────
      if (q.questionId === 'SHN-04' && rating !== 'Average') {
        overrides.push({
          questionId: q.questionId,
          rule:       'SHN04_FORCED_AVERAGE',
          fromRating: rating,
          toRating:   'Average',
          reason:     'SHN-04 evaluates routine cleaning behaviour — not determinable from a single photograph.',
        });
        rating     = 'Average';
        confidence = 'LOW';
      }

      // ── Rule 2: CRITICAL violation → force Very Bad ────────────────────────
      if (rating !== 'Very Bad' && rating !== 'NOT_VISIBLE') {
        const criticalForQuestion = evidence.violations.filter(
          (v) => v.severity === 'CRITICAL' && calibration?.escalationRules.some(
            (rule) => v.observation.toLowerCase().includes(rule.pattern.toLowerCase()),
          ),
        );

        if (criticalForQuestion.length > 0) {
          const escalation = calibration!.escalationRules.find((rule) =>
            criticalForQuestion.some((v) =>
              v.observation.toLowerCase().includes(rule.pattern.toLowerCase()),
            ),
          )!;
          overrides.push({
            questionId: q.questionId,
            rule:       'CRITICAL_ESCALATION',
            fromRating: rating,
            toRating:   'Very Bad',
            reason:     escalation?.reason ?? 'CRITICAL violation detected by CalibrationMatrix.',
          });
          rating     = 'Very Bad';
          confidence = 'HIGH';
        }
      }

      // ── Rule 3: Conservative questions — prevent unjustified Very Bad ──────
      if (
        rating === 'Very Bad' &&
        CONSERVATIVE_QUESTIONS.has(q.questionId) &&
        !evidence.violations.some(
          (v) => v.severity === 'MAJOR' || v.severity === 'CRITICAL',
        )
      ) {
        overrides.push({
          questionId: q.questionId,
          rule:       'CONSERVATIVE_FLOOR',
          fromRating: 'Very Bad',
          toRating:   'Bad',
          reason:     `Conservative question ${q.questionId} rated Very Bad without a MAJOR/CRITICAL violation — raised to Bad per calibration floor.`,
        });
        rating = 'Bad';
      }

      // ── Rule 4: Very low coverage + Very Bad → NOT_VISIBLE ────────────────
      if (
        rating === 'Very Bad' &&
        coverage &&
        coverage.coveragePercentage < 30 &&
        q.questionId !== 'SHN-04'
      ) {
        overrides.push({
          questionId: q.questionId,
          rule:       'LOW_COVERAGE_NOT_VISIBLE',
          fromRating: 'Very Bad',
          toRating:   'NOT_VISIBLE',
          reason:     `Coverage ${coverage.coveragePercentage}% is too low to support a Very Bad rating — marked NOT_VISIBLE per conservative audit principle.`,
        });
        rating     = 'NOT_VISIBLE';
        confidence = 'LOW';
      }

      const newScore = RATING_TO_SCORE[rating];
      return {
        ...q,
        rating,
        score: newScore,
        confidence,
      };
    });

    return { questions: corrected, overrides };
  }
}
