/**
 * supabase/functions/analyze-5s/audit-engine/CalibrationFeedback.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Calibration Feedback Model (Phase 4.2).
 *
 * Purpose:
 *  Allow comparison between system rating and human auditor rating to support
 *  continuous calibration of the Decision Matrix, Calibration Matrix, and
 *  Rating Policies — without modifying the architecture.
 *
 * Feedback flow:
 *  1. System produces a rating via AuditEngine (Stage A + Stage B)
 *  2. Human auditor reviews and assigns their own rating
 *  3. CalibrationFeedbackService records the delta
 *  4. Feedback records are analysed to identify systematic biases
 *  5. Calibration engineers adjust CalibrationRules / AuditCalibrationMatrix
 *
 * This module does NOT modify any matrix automatically. Feedback is advisory
 * and requires human engineering review before any matrix change is applied.
 *
 * Design invariants:
 *  - Zero LLM calls
 *  - Zero architectural side-effects
 *  - Fully serialisable (suitable for DB persistence or file export)
 *  - Never throws
 */

import type { AuditRating, CalibrationRuleKey, DecisionStrategy, PillarKey } from './types.ts';

// ── Feedback types ─────────────────────────────────────────────────────────────

export type RatingDirection = 'OVER_PENALIZED' | 'UNDER_PENALIZED' | 'ALIGNED';

export type FeedbackSeverity = 'MINOR' | 'MODERATE' | 'MAJOR';

/**
 * A suggested calibration adjustment based on the delta between
 * system rating and human rating.
 */
export interface CalibrationSuggestion {
  targetMatrix:       'DECISION_MATRIX' | 'CALIBRATION_MATRIX' | 'RATING_POLICY';
  questionId:         string;
  currentRule:        CalibrationRuleKey | DecisionStrategy | string;
  suggestedChange:    string;     // Human-readable suggested action
  rationaleSummary:   string;     // Why this change is suggested
  confidenceInSuggestion: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * A single human feedback record comparing system vs human rating.
 */
export interface CalibrationFeedbackRecord {
  feedbackId:          string;   // UUID generated at record time
  auditSessionId:      string;   // ID of the AuditSessionResult being reviewed
  questionId:          string;
  pillar:              PillarKey;
  decisionStrategy:    DecisionStrategy | 'UNKNOWN';

  // ── Ratings ──────────────────────────────────────────────────────────────
  systemRating:        AuditRating;
  humanRating:         AuditRating;
  systemConfidence:    string;

  // ── Delta analysis ───────────────────────────────────────────────────────
  ratingDelta:         number;   // humanScore - systemScore (positive = system too harsh)
  direction:           RatingDirection;
  severity:            FeedbackSeverity;

  // ── Context ───────────────────────────────────────────────────────────────
  humanComment:        string;   // Free-text note from the human auditor
  imageNotes:          string;   // Any image quality notes the human observed
  wasOverridden:       boolean;  // Whether CalibrationService changed the LLM rating

  // ── Suggestions ──────────────────────────────────────────────────────────
  suggestions:         CalibrationSuggestion[];

  // ── Metadata ─────────────────────────────────────────────────────────────
  recordedAt:          string;   // ISO timestamp
  reviewedBy:          string;   // Human auditor identifier (anonymisable)
}

/**
 * Aggregated feedback summary across multiple records for a question.
 * Used to identify systematic biases.
 */
export interface FeedbackAggregate {
  questionId:          string;
  totalFeedbacks:      number;
  overPenalizedCount:  number;   // System too harsh
  underPenalizedCount: number;   // System too lenient
  alignedCount:        number;
  avgRatingDelta:      number;   // Average (human - system) delta
  mostCommonDirection: RatingDirection;
  suggestedPriority:   'HIGH' | 'MEDIUM' | 'LOW';
  topSuggestions:      CalibrationSuggestion[];
}

// ── Rating numeric values (for delta calculation) ─────────────────────────────

const RATING_NUMERIC: Record<AuditRating, number> = {
  'NOT_VISIBLE': 0,
  'Very Bad':    1,
  'Bad':         2,
  'Average':     3,
  'Good':        4,
  'Very Good':   5,
};

// ── CalibrationFeedbackService ────────────────────────────────────────────────

export class CalibrationFeedbackService {

  /**
   * Creates a new feedback record comparing system vs human rating.
   *
   * @param auditSessionId  - ID of the AuditSessionResult
   * @param questionId      - Question being reviewed
   * @param pillar          - Pillar key
   * @param strategy        - Decision strategy used
   * @param systemRating    - Rating produced by AuditEngine
   * @param humanRating     - Rating assigned by human auditor
   * @param systemConfidence - Confidence string from system
   * @param humanComment    - Free-text auditor note
   * @param imageNotes      - Auditor image quality observations
   * @param wasOverridden   - Whether CalibrationService applied an override
   * @param reviewedBy      - Human auditor identifier
   */
  static createRecord(
    auditSessionId:   string,
    questionId:       string,
    pillar:           PillarKey,
    strategy:         DecisionStrategy | 'UNKNOWN',
    systemRating:     AuditRating,
    humanRating:      AuditRating,
    systemConfidence: string,
    humanComment:     string,
    imageNotes:       string,
    wasOverridden:    boolean,
    reviewedBy:       string,
  ): CalibrationFeedbackRecord {
    const sysScore   = RATING_NUMERIC[systemRating] ?? 0;
    const humScore   = RATING_NUMERIC[humanRating]  ?? 0;
    const delta      = humScore - sysScore;

    const direction: RatingDirection =
      delta > 0  ? 'OVER_PENALIZED'  :   // System too harsh — human rated higher
      delta < 0  ? 'UNDER_PENALIZED' :   // System too lenient — human rated lower
      'ALIGNED';

    const severity: FeedbackSeverity =
      Math.abs(delta) >= 3 ? 'MAJOR'    :
      Math.abs(delta) >= 1 ? 'MODERATE' :
      'MINOR';

    const suggestions = CalibrationFeedbackService.generateSuggestions(
      questionId, strategy, delta, direction, severity, wasOverridden,
    );

    return {
      feedbackId:       CalibrationFeedbackService.generateId(),
      auditSessionId,
      questionId,
      pillar,
      decisionStrategy: strategy,
      systemRating,
      humanRating,
      systemConfidence,
      ratingDelta:      delta,
      direction,
      severity,
      humanComment,
      imageNotes,
      wasOverridden,
      suggestions,
      recordedAt:       new Date().toISOString(),
      reviewedBy,
    };
  }

  /**
   * Generates calibration suggestions based on the delta and context.
   * Advisory only — does not modify any matrix.
   */
  static generateSuggestions(
    questionId:   string,
    strategy:     DecisionStrategy | 'UNKNOWN',
    delta:        number,
    direction:    RatingDirection,
    severity:     FeedbackSeverity,
    wasOverridden: boolean,
  ): CalibrationSuggestion[] {
    if (direction === 'ALIGNED') return [];

    const suggestions: CalibrationSuggestion[] = [];

    // Suggestion 1: If system over-penalized (human rated higher) → check calibration matrix
    if (direction === 'OVER_PENALIZED') {
      if (wasOverridden) {
        suggestions.push({
          targetMatrix:    'CALIBRATION_MATRIX',
          questionId,
          currentRule:     strategy,
          suggestedChange: `Review escalation rules for ${questionId} — override may be too aggressive.`,
          rationaleSummary: `System applied a CalibrationService override but human disagrees. Consider raising the minorTolerance or adjusting escalationRule patterns.`,
          confidenceInSuggestion: severity === 'MAJOR' ? 'HIGH' : 'MEDIUM',
        });
      } else {
        suggestions.push({
          targetMatrix:    'RATING_POLICY',
          questionId,
          currentRule:     strategy,
          suggestedChange: `Consider raising the rating floor for ${questionId} from CONSERVATIVE to STANDARD.`,
          rationaleSummary: `System rated lower than human without applying a calibration override. Decision strategy ${strategy} may be generating unnecessarily conservative LLM prompts.`,
          confidenceInSuggestion: severity === 'MAJOR' ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    // Suggestion 2: If system under-penalized (human rated lower) → check thresholds
    if (direction === 'UNDER_PENALIZED') {
      suggestions.push({
        targetMatrix:    'CALIBRATION_MATRIX',
        questionId,
        currentRule:     strategy,
        suggestedChange: `Consider adding an escalation rule for ${questionId} based on the human auditor's observation.`,
        rationaleSummary: `Human rated lower than system. The violation that concerned the human auditor may not be captured by current escalation patterns or severity thresholds.`,
        confidenceInSuggestion: severity === 'MAJOR' ? 'HIGH' : 'LOW',
      });
    }

    // Suggestion 3: If very large delta → review decision strategy
    if (Math.abs(delta) >= 3) {
      suggestions.push({
        targetMatrix:    'DECISION_MATRIX',
        questionId,
        currentRule:     strategy,
        suggestedChange: `Review decision strategy ${strategy} for ${questionId} — delta of ${delta} suggests a structural mismatch.`,
        rationaleSummary: `A delta of ${Math.abs(delta)} rating levels is large and suggests the evaluation framework may not be correctly modelling human expert judgment for this question type.`,
        confidenceInSuggestion: 'HIGH',
      });
    }

    return suggestions;
  }

  /**
   * Aggregates multiple feedback records for a question to identify
   * systematic biases.
   *
   * @param records - All feedback records for a single questionId
   */
  static aggregate(records: CalibrationFeedbackRecord[]): FeedbackAggregate | null {
    if (records.length === 0) return null;

    const qId = records[0].questionId;
    const overCount   = records.filter((r) => r.direction === 'OVER_PENALIZED').length;
    const underCount  = records.filter((r) => r.direction === 'UNDER_PENALIZED').length;
    const alignedCount = records.filter((r) => r.direction === 'ALIGNED').length;
    const avgDelta    = records.reduce((s, r) => s + r.ratingDelta, 0) / records.length;

    const mostCommon: RatingDirection =
      overCount >= underCount && overCount >= alignedCount ? 'OVER_PENALIZED' :
      underCount >= alignedCount                          ? 'UNDER_PENALIZED' :
      'ALIGNED';

    const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
      records.length >= 5 && mostCommon !== 'ALIGNED' ? 'HIGH' :
      records.length >= 2 && mostCommon !== 'ALIGNED' ? 'MEDIUM' :
      'LOW';

    const allSuggestions = records.flatMap((r) => r.suggestions);
    const topSuggestions = allSuggestions.filter(
      (s) => s.confidenceInSuggestion === 'HIGH',
    ).slice(0, 3);

    return {
      questionId:          qId,
      totalFeedbacks:      records.length,
      overPenalizedCount:  overCount,
      underPenalizedCount: underCount,
      alignedCount,
      avgRatingDelta:      Math.round(avgDelta * 100) / 100,
      mostCommonDirection: mostCommon,
      suggestedPriority:   priority,
      topSuggestions,
    };
  }

  /**
   * Generates a UUID-like feedback ID.
   * Uses crypto.randomUUID() where available, falls back to timestamp+random.
   */
  private static generateId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  }
}
