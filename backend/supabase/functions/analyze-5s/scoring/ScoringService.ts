/**
 * supabase/functions/analyze-5s/scoring/ScoringService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic, pure TypeScript scoring engine.
 *
 * Rules:
 *  - YES    → full points  (max_points * weight)
 *  - PARTIAL → 50% points  (max_points * weight * 0.5)
 *  - NO     → 0 points     (included in denominator)
 *  - NOT_VISIBLE → 0 points, EXCLUDED from denominator
 *  - NOT_APPLICABLE → 0 points, EXCLUDED from denominator
 *
 * Confidence is NEVER used in any calculation (Refinement #3).
 * All arithmetic lives here — the AI never performs math (Refinement #12).
 */

import type {
  QuestionItem,
  ScoredResponse,
  CriticalRule,
  PillarScoreResult,
  SessionScoreResult,
  DeductionDetail,
  AuditPillar,
  AuditAnswerState,
} from './types.ts';

const PILLARS: AuditPillar[] = [
  'SORT',
  'SET_IN_ORDER',
  'SHINE',
  'STANDARDIZE',
  'SUSTAIN',
];

// ── Grade mapping (same thresholds as Phase 1) ────────────────────────────────

function getGrade(pct: number): { grade: string; grade_color: string } {
  if (pct >= 90) return { grade: 'Excellent',         grade_color: 'text-emerald-400' };
  if (pct >= 80) return { grade: 'Very Good',         grade_color: 'text-green-400'   };
  if (pct >= 70) return { grade: 'Good',              grade_color: 'text-yellow-400'  };
  if (pct >= 60) return { grade: 'Average',           grade_color: 'text-orange-400'  };
  return              { grade: 'Needs Improvement',   grade_color: 'text-red-400'     };
}

// ── Answer → points conversion ────────────────────────────────────────────────

function pointsForAnswer(answer: AuditAnswerState, maxPoints: number): number {
  switch (answer) {
    case 'YES':     return maxPoints;
    case 'PARTIAL': return maxPoints * 0.5;
    case 'NO':      return 0;
    case 'NOT_VISIBLE':     return 0;  // excluded from denominator separately
    case 'NOT_APPLICABLE':  return 0;  // excluded from denominator separately
  }
}

function isExcludedFromDenominator(answer: AuditAnswerState): boolean {
  return answer === 'NOT_VISIBLE' || answer === 'NOT_APPLICABLE';
}

// ── Pillar scoring ─────────────────────────────────────────────────────────────

export function scorePillar(
  pillar: AuditPillar,
  items: QuestionItem[],
  responses: ScoredResponse[],
  activeRules: CriticalRule[],
): PillarScoreResult {
  const pillarItems = items.filter((i) => i.pillar === pillar);
  const responseMap = new Map(responses.map((r) => [r.session_item_id, r]));

  let score   = 0;
  let maximum = 0;
  let passed  = 0;
  let partial = 0;
  let failed  = 0;
  let notVisible    = 0;
  let notApplicable = 0;
  let criticalFailures = 0;
  const deductions: DeductionDetail[] = [];

  for (const item of pillarItems) {
    const response = responseMap.get(item.id);
    if (!response) continue;

    const answer       = response.ai_answer;
    const weightedMax  = item.max_points * item.weight;
    const earned       = pointsForAnswer(answer, item.max_points) * item.weight;
    const excluded     = isExcludedFromDenominator(answer);

    if (!excluded) {
      maximum += weightedMax;
      score   += earned;
    }

    // Counters
    switch (answer) {
      case 'YES':            passed++;           break;
      case 'PARTIAL':        partial++;          break;
      case 'NO':             failed++;           break;
      case 'NOT_VISIBLE':    notVisible++;       break;
      case 'NOT_APPLICABLE': notApplicable++;    break;
    }

    // Track critical severity failures
    if ((answer === 'NO' || answer === 'PARTIAL') && item.severity === 'CRITICAL') {
      criticalFailures++;
    }

    // Track deductions (for explainability)
    if (!excluded && earned < weightedMax) {
      deductions.push({
        question_id:   item.question_id,
        question_text: item.question_text,
        severity:      item.severity,
        evidence:      response.evidence,
        points_lost:   Math.round((weightedMax - earned) * 100) / 100,
      });
    }
  }

  const rawPercentage = maximum > 0 ? Math.round((score / maximum) * 10000) / 100 : 0;

  // ── Apply critical rules ─────────────────────────────────────────────────────
  const triggeredRules = activeRules.filter((rule) => {
    if (rule.pillar !== pillar) return false;
    const ruleItem = pillarItems.find(
      (i) => i.id === rule.checklist_item_id || i.question_id === rule.checklist_item_id,
    );
    if (!ruleItem) return false;
    const response = responseMap.get(ruleItem.id);
    return response?.ai_answer === rule.trigger_answer;
  });

  let finalPercentage = rawPercentage;
  let capApplied      = false;
  let capValue: number | undefined;
  let capReason: string | undefined;

  if (triggeredRules.length > 0) {
    const lowestCap = Math.min(...triggeredRules.map((r) => r.score_cap));
    if (rawPercentage > lowestCap) {
      finalPercentage = lowestCap;
      capApplied      = true;
      capValue        = lowestCap;
      capReason       = triggeredRules.find((r) => r.score_cap === lowestCap)?.description;
    }
  }

  // Top 3 deductions by points_lost desc
  const topDeductions = [...deductions]
    .sort((a, b) => b.points_lost - a.points_lost)
    .slice(0, 3);

  return {
    pillar,
    score:          Math.round(score * 100) / 100,
    maximum:        Math.round(maximum * 100) / 100,
    percentage:     finalPercentage,
    raw_percentage: rawPercentage,
    passed,
    partial,
    failed,
    not_visible:    notVisible,
    not_applicable: notApplicable,
    critical:       criticalFailures,
    cap_applied:    capApplied,
    cap_value:      capValue,
    cap_reason:     capReason,
    top_deductions: topDeductions,
  };
}

// ── Full session scoring ───────────────────────────────────────────────────────

export function scoreSession(
  items: QuestionItem[],
  responses: ScoredResponse[],
  activeRules: CriticalRule[],
): SessionScoreResult {
  const pillarScores = PILLARS.map((p) =>
    scorePillar(p, items, responses, activeRules),
  );

  const overallScore   = pillarScores.reduce((s, p) => s + p.score,   0);
  const overallMaximum = pillarScores.reduce((s, p) => s + p.maximum, 0);
  const overallPct     =
    overallMaximum > 0
      ? Math.round((overallScore / overallMaximum) * 10000) / 100
      : 0;

  const { grade, grade_color } = getGrade(overallPct);

  return {
    pillar_scores:       pillarScores,
    overall_score:       Math.round(overallScore * 100) / 100,
    overall_maximum:     Math.round(overallMaximum * 100) / 100,
    overall_percentage:  overallPct,
    grade,
    grade_color,
    total_answered:      responses.length,
    total_questions:     items.length,
    critical_failures:   pillarScores.reduce((s, p) => s + p.critical, 0),
    computed_at:         new Date().toISOString(),
  };
}
