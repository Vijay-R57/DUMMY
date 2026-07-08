/**
 * supabase/functions/analyze-5s/ai/ReliabilityClassifier.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Reliability Classification (Phase 2A.1).
 *
 * Assigns a reliability level to each audit based on:
 *   - AI confidence score
 *   - NOT_VISIBLE question percentage
 *   - HIGH-severity consistency warning count
 *   - Optional image quality metrics (brightness, contrast)
 *
 * CRITICAL: Reliability classification is INFORMATIONAL ONLY.
 *   - It NEVER modifies the audit score.
 *   - It NEVER modifies individual question answers.
 *   - "REJECTED" means the audit is flagged, but still saved and scored.
 *   - The UI shows a warning banner for LOW and REJECTED audits.
 *   - Users can still view all results at any reliability level.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReliabilityLevel = 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED';

export interface ReliabilityResult {
  level:  ReliabilityLevel;
  label:  string;              // Human-readable display label
  score:  number;              // Computed reliability score 0–100 (NOT the audit score)
  reasons: string[];           // Specific factors that degraded reliability
}

export interface ReliabilityInput {
  /** AI audit confidence (0–100 scale, as stored in audit_sessions.audit_confidence). */
  audit_confidence:          number;
  /** Percentage of questions answered NOT_VISIBLE (0–100). */
  not_visible_pct:           number;
  /** Count of HIGH-severity consistency warnings from ConsistencyValidator. */
  high_consistency_warnings: number;
  /** Optional: image brightness score (0–1). Below 0.2 degrades reliability. */
  image_brightness_score?:   number;
  /** Optional: image contrast score (0–1). Below 0.15 degrades reliability. */
  image_contrast_score?:     number;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS: Array<{
  level:            ReliabilityLevel;
  label:            string;
  min_confidence:   number;
  max_not_visible:  number;
  max_high_warnings: number;
}> = [
  { level: 'EXCELLENT', label: 'Excellent Reliability',  min_confidence: 90, max_not_visible: 10, max_high_warnings: 0 },
  { level: 'HIGH',      label: 'High Reliability',       min_confidence: 75, max_not_visible: 20, max_high_warnings: 1 },
  { level: 'MEDIUM',    label: 'Medium Reliability',     min_confidence: 55, max_not_visible: 35, max_high_warnings: 3 },
  { level: 'LOW',       label: 'Low Reliability',        min_confidence: 35, max_not_visible: 60, max_high_warnings: Infinity },
];

// ── Classification Logic ──────────────────────────────────────────────────────

/**
 * Classify the reliability of an audit based on confidence, visibility,
 * consistency, and optional image quality metrics.
 *
 * The reliability score is computed by applying penalty deductions to a
 * base of 100, then mapped to the classification threshold table.
 */
export function classifyReliability(input: ReliabilityInput): ReliabilityResult {
  const reasons: string[] = [];

  // ── Compute weighted reliability score (0–100) ────────────────────────────

  // Start from audit_confidence (already 0–100 from audit pipeline)
  let score = Math.max(0, Math.min(100, input.audit_confidence));

  // Penalty: high NOT_VISIBLE percentage
  if (input.not_visible_pct > 10) {
    const penalty = Math.min(30, (input.not_visible_pct - 10) * 0.8);
    score -= penalty;
    reasons.push(
      `High proportion of unanswered questions (${input.not_visible_pct.toFixed(1)}% NOT_VISIBLE).`
    );
  }

  // Penalty: HIGH consistency warnings
  if (input.high_consistency_warnings > 0) {
    const penalty = Math.min(25, input.high_consistency_warnings * 7);
    score -= penalty;
    reasons.push(
      `${input.high_consistency_warnings} high-severity consistency contradiction(s) detected.`
    );
  }

  // Penalty: poor image brightness
  if (input.image_brightness_score !== undefined && input.image_brightness_score < 0.2) {
    const penalty = Math.min(15, (0.2 - input.image_brightness_score) * 60);
    score -= penalty;
    reasons.push(
      `Image brightness is low (${(input.image_brightness_score * 100).toFixed(0)}%). Dark images reduce observation accuracy.`
    );
  }

  // Penalty: low image contrast
  if (input.image_contrast_score !== undefined && input.image_contrast_score < 0.15) {
    const penalty = Math.min(10, (0.15 - input.image_contrast_score) * 50);
    score -= penalty;
    reasons.push(
      `Image contrast is low (${(input.image_contrast_score * 100).toFixed(0)}%). Low contrast reduces label/marking detection.`
    );
  }

  score = Math.max(0, Math.round(score * 10) / 10);

  // ── Hard REJECTED conditions (override score-based classification) ─────────

  if (input.not_visible_pct > 60) {
    reasons.push(`Critical: more than 60% of questions are NOT_VISIBLE (${input.not_visible_pct.toFixed(1)}%).`);
    return { level: 'REJECTED', label: 'Rejected — Insufficient Coverage', score, reasons };
  }

  if (score < 35 || input.audit_confidence < 35) {
    if (!reasons.some((r) => r.includes('confidence'))) {
      reasons.push(`Audit confidence is critically low (${input.audit_confidence.toFixed(1)}).`);
    }
    return { level: 'REJECTED', label: 'Rejected — Very Low Confidence', score, reasons };
  }

  // ── Score-based threshold classification ──────────────────────────────────

  for (const threshold of THRESHOLDS) {
    if (
      score >= threshold.min_confidence &&
      input.not_visible_pct <= threshold.max_not_visible &&
      input.high_consistency_warnings <= threshold.max_high_warnings
    ) {
      if (reasons.length === 0) {
        // No degradation — add positive note for EXCELLENT
        if (threshold.level === 'EXCELLENT') {
          reasons.push('High AI confidence, full workspace coverage, and no logical contradictions detected.');
        }
      }
      return { level: threshold.level, label: threshold.label, score, reasons };
    }
  }

  // Fallback: LOW
  return { level: 'LOW', label: 'Low Reliability', score, reasons };
}

// ── Display Helpers ───────────────────────────────────────────────────────────

/** CSS colour token for the reliability badge in the UI. */
export function reliabilityColor(level: ReliabilityLevel): string {
  switch (level) {
    case 'EXCELLENT': return '#22c55e'; // green-500
    case 'HIGH':      return '#84cc16'; // lime-500
    case 'MEDIUM':    return '#eab308'; // yellow-500
    case 'LOW':       return '#f97316'; // orange-500
    case 'REJECTED':  return '#ef4444'; // red-500
  }
}

/** Returns true if the UI should display a warning banner. */
export function shouldShowReliabilityWarning(level: ReliabilityLevel): boolean {
  return level === 'LOW' || level === 'REJECTED';
}
