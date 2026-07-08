/**
 * src/modules/audit/services/auditScoreCalculator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, side-effect-free score calculation service for the frontend.
 *
 * Used to:
 *  (a) Calculate scores from Phase 1 manual responses for the checklist UI
 *  (b) Convert AI-scored PillarScoreResult[] into UI-ready AuditScoreSummary
 *
 * Rules (mirrors ScoringService.ts in the edge function — Refinement #8):
 *  YES           → full points  (max_points × weight)
 *  PARTIAL       → 50% points   (max_points × weight × 0.5)
 *  NO            → 0 points     (included in denominator)
 *  NOT_VISIBLE   → excluded from denominator
 *  NOT_APPLICABLE → excluded from denominator
 *  confidence    → NEVER used in any calculation (Refinement #3)
 */

import { AUDIT_PILLARS, PILLAR_META } from '../constants/pillars';
import type { AuditPillar } from '../constants/pillars';
import type {
  AuditSessionItem,
  AuditItemResponse,
  PillarScore,
  PillarScoreResult,
  AuditScoreSummary,
  DeductionDetail,
} from '../types';

// ── Grade Mapping ──────────────────────────────────────────────────────────────

export interface GradeResult {
  grade:       string;
  color:       string;
  bgColor:     string;
  borderColor: string;
}

export function calculateGrade(percentage: number): GradeResult {
  if (percentage >= 90) return { grade: 'Excellent',        color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/40' };
  if (percentage >= 80) return { grade: 'Very Good',        color: 'text-green-400',   bgColor: 'bg-green-500/10',   borderColor: 'border-green-500/40'   };
  if (percentage >= 70) return { grade: 'Good',             color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10',  borderColor: 'border-yellow-500/40'  };
  if (percentage >= 60) return { grade: 'Average',          color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  borderColor: 'border-orange-500/40'  };
  return                      { grade: 'Needs Improvement', color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/40'     };
}

// ── Answer-state → points (for manual score fallback) ─────────────────────────

function aiAnswerToPoints(response: AuditItemResponse, maxPoints: number): {
  earned: number;
  excluded: boolean;
} {
  if (response.ai_answer) {
    switch (response.ai_answer) {
      case 'YES':             return { earned: maxPoints,        excluded: false };
      case 'PARTIAL':         return { earned: maxPoints * 0.5,  excluded: false };
      case 'NO':              return { earned: 0,                excluded: false };
      case 'NOT_VISIBLE':     return { earned: 0,                excluded: true  };
      case 'NOT_APPLICABLE':  return { earned: 0,                excluded: true  };
    }
  }
  // Phase 1 manual fallback: use final_score / manual_score
  const score = response.final_score ?? response.manual_score ?? 0;
  return { earned: score, excluded: false };
}

// ── Core calculations ──────────────────────────────────────────────────────────

/** Total weighted points earned for a set of responses */
export function calculateTotalScore(
  items:     AuditSessionItem[],
  responses: AuditItemResponse[],
): number {
  const responseMap = new Map(responses.map((r) => [r.session_item_id, r]));
  return items.reduce((sum, item) => {
    const r = responseMap.get(item.id);
    if (!r) return sum;
    const { earned, excluded } = aiAnswerToPoints(r, item.max_points);
    return excluded ? sum : sum + earned * item.weight;
  }, 0);
}

/** Maximum possible weighted score (excludes NOT_VISIBLE / NOT_APPLICABLE items) */
export function calculateMaximumScore(
  items:     AuditSessionItem[],
  responses: AuditItemResponse[],
): number {
  const responseMap = new Map(responses.map((r) => [r.session_item_id, r]));
  return items.reduce((sum, item) => {
    const r = responseMap.get(item.id);
    if (!r) return sum + item.max_points * item.weight; // assume included if no response yet
    const { excluded } = aiAnswerToPoints(r, item.max_points);
    return excluded ? sum : sum + item.max_points * item.weight;
  }, 0);
}

/** Percentage rounded to 1 decimal */
export function calculatePercentage(total: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((total / max) * 1000) / 10;
}

/** Per-pillar breakdown — supports both manual and AI responses */
export function calculateCategoryScore(
  pillar:    AuditPillar,
  items:     AuditSessionItem[],
  responses: AuditItemResponse[],
): PillarScore {
  const pillarItems = items.filter((i) => i.pillar === pillar);
  const responseMap = new Map(responses.map((r) => [r.session_item_id, r]));

  let total        = 0;
  let maximum      = 0;
  let passed       = 0;
  let partial      = 0;
  let failed       = 0;
  let critical     = 0;
  const answeredIds = new Set<string>();

  for (const item of pillarItems) {
    const r = responseMap.get(item.id);
    if (!r) {
      // No response yet — include in max for progress tracking
      maximum += item.max_points * item.weight;
      continue;
    }

    answeredIds.add(item.id);

    const { earned, excluded } = aiAnswerToPoints(r, item.max_points);

    if (!excluded) {
      total   += earned * item.weight;
      maximum += item.max_points * item.weight;
    }

    // Counters (for explainability display)
    if (r.ai_answer === 'YES') passed++;
    else if (r.ai_answer === 'PARTIAL') partial++;
    else if (r.ai_answer === 'NO') {
      failed++;
      if (item.severity === 'CRITICAL') critical++;
    }
  }

  return {
    pillar,
    total:         Math.round(total * 100) / 100,
    max:           Math.round(maximum * 100) / 100,
    percentage:    calculatePercentage(total, maximum),
    answeredCount: answeredIds.size,
    totalCount:    pillarItems.length,
    passed,
    partial,
    failed,
    critical,
  };
}

/** Full summary — all pillars + overall */
export function calculateOverallScore(
  items:     AuditSessionItem[],
  responses: AuditItemResponse[],
): AuditScoreSummary {
  const pillarScores = AUDIT_PILLARS.map((p) =>
    calculateCategoryScore(p, items, responses),
  );

  const overallTotal      = pillarScores.reduce((s, p) => s + p.total, 0);
  const overallMax        = pillarScores.reduce((s, p) => s + p.max,   0);
  const overallPercentage = calculatePercentage(overallTotal, overallMax);
  const { grade, color: gradeColor } = calculateGrade(overallPercentage);

  return {
    pillarScores,
    overallTotal:      Math.round(overallTotal * 100) / 100,
    overallMax:        Math.round(overallMax * 100) / 100,
    overallPercentage,
    grade,
    gradeColor,
    answeredCount:     responses.length,
    totalCount:        items.length,
    criticalFailures:  pillarScores.reduce((s, p) => s + (p.critical ?? 0), 0),
  };
}

/**
 * Convert AI PillarScoreResult[] (from edge function / score_breakdown JSONB)
 * directly into the UI AuditScoreSummary format.
 */
export function pillarResultsToSummary(
  pillarResults: PillarScoreResult[],
): AuditScoreSummary {
  const pillarScores: PillarScore[] = pillarResults.map((pr) => ({
    pillar:        pr.pillar,
    total:         pr.score,
    max:           pr.maximum,
    percentage:    pr.percentage,
    answeredCount: pr.passed + pr.partial + pr.failed + pr.not_visible + pr.not_applicable,
    totalCount:    pr.passed + pr.partial + pr.failed + pr.not_visible + pr.not_applicable,
    passed:        pr.passed,
    partial:       pr.partial,
    failed:        pr.failed,
    critical:      pr.critical,
    cap_applied:   pr.cap_applied,
    cap_value:     pr.cap_value,
    cap_reason:    pr.cap_reason,
    top_deductions: pr.top_deductions,
  }));

  const overallTotal      = pillarScores.reduce((s, p) => s + p.total, 0);
  const overallMax        = pillarScores.reduce((s, p) => s + p.max,   0);
  const overallPercentage = calculatePercentage(overallTotal, overallMax);
  const { grade, color: gradeColor } = calculateGrade(overallPercentage);

  return {
    pillarScores,
    overallTotal:      Math.round(overallTotal * 100) / 100,
    overallMax:        Math.round(overallMax * 100) / 100,
    overallPercentage,
    grade,
    gradeColor,
    answeredCount:     pillarScores.reduce((s, p) => s + p.answeredCount, 0),
    totalCount:        pillarScores.reduce((s, p) => s + p.totalCount,   0),
    criticalFailures:  pillarScores.reduce((s, p) => s + (p.critical ?? 0), 0),
  };
}

/** How many questions still need an answer */
export function countUnansweredItems(
  items:     AuditSessionItem[],
  responses: AuditItemResponse[],
): number {
  const answeredIds = new Set(responses.map((r) => r.session_item_id));
  return items.filter((i) => !answeredIds.has(i.id)).length;
}
