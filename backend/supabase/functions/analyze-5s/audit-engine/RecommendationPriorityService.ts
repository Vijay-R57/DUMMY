/**
 * supabase/functions/analyze-5s/audit-engine/RecommendationPriorityService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Recommendation Prioritization Service — Engine v5.0 (Recommendation 11).
 *
 * Reads category, priority, title, and corrective action guidance from
 * the Question Evaluation Registry (QER recommendationTemplate).
 * The hardcoded QUESTION_CATEGORY and title maps are removed.
 *
 * Priority ordering (preserved from Phase 4.1):
 *   Immediate = Safety             sortKey  1–19
 *   High      = Compliance         sortKey 20–39
 *   High      = Organization       sortKey 40–59
 *   Medium    = Housekeeping       sortKey 60–79
 *   Low       = Continuous Improv  sortKey 80–99
 *
 * Design invariants:
 *  - No LLM calls — purely deterministic
 *  - No hardcoded category or title maps (QER is the single source of truth)
 *  - Every recommendation references a specific visible object from evidence model
 *  - Safety recommendations always sort before organizational ones
 *  - Never throws
 */

import type {
  PillarResult,
  QuestionResult,
  AuditEvidenceModel,
  PrioritizedRecommendation,
  RecommendationCategory,
  RecommendationPriority,
  PillarKey,
  CalibrationSeverity,
  AuditRating,
} from './types.ts';
import { getQuestionEvalConfig } from './QuestionEvaluationRegistry.ts';

// ── Rating → severity mapping ─────────────────────────────────────────────────

const RATING_SEVERITY: Partial<Record<AuditRating, CalibrationSeverity>> = {
  'Very Bad': 'MAJOR',
  'Bad':      'MODERATE',
};

// ── Category → sort base ──────────────────────────────────────────────────────

const CATEGORY_SORT_BASE: Record<RecommendationCategory, number> = {
  'Safety':                 1,
  'Compliance':            20,
  'Organization':          40,
  'Housekeeping':          60,
  'Continuous Improvement': 80,
};

const PRIORITY_FROM_SEVERITY: Record<CalibrationSeverity, RecommendationPriority> = {
  CRITICAL: 'Immediate',
  MAJOR:    'High',
  MODERATE: 'Medium',
  MINOR:    'Low',
};

// ── RecommendationPriorityService ─────────────────────────────────────────────

export class RecommendationPriorityService {

  /**
   * Generates prioritized recommendations from all pillar results.
   * Category, title, and corrective action are sourced from QER recommendationTemplate.
   *
   * @returns Sorted PrioritizedRecommendation[] (lowest sortKey = highest priority)
   */
  static generate(
    pillars:  PillarResult[],
    evidence: AuditEvidenceModel,
  ): PrioritizedRecommendation[] {
    const recommendations: PrioritizedRecommendation[] = [];

    for (const pillar of pillars) {
      for (const question of pillar.questions) {
        const rec = RecommendationPriorityService.buildForQuestion(
          question,
          pillar.pillar,
          evidence,
        );
        if (rec) {
          recommendations.push(rec);
        }
      }
    }

    return recommendations.sort((a, b) => a.sortKey - b.sortKey);
  }

  /**
   * Builds a PrioritizedRecommendation for a single question result.
   * Returns null if rating is Average, Good, Very Good, or NOT_VISIBLE.
   * Title and description are sourced from QER recommendationTemplate.
   */
  static buildForQuestion(
    question: QuestionResult,
    pillar:   PillarKey,
    evidence: AuditEvidenceModel,
  ): PrioritizedRecommendation | null {
    const severityBasis = RATING_SEVERITY[question.rating];
    if (!severityBasis) return null;

    // ── Source category + template from QER ───────────────────────────────
    let category:  RecommendationCategory  = 'Organization';
    let qerTitle:  string                  = `Address deficiency (${question.questionId})`;
    let qerDesc:   string                  = question.assessment;

    try {
      const config    = getQuestionEvalConfig(question.questionId);
      const template  = config.recommendationTemplate;
      category        = template.category;
      qerTitle        = template.title;
      qerDesc         = buildDescription(question, template.corrective, template.expectedBenefit, severityBasis);
    } catch {
      // QER lookup failed — use safe defaults
    }

    // ── Priority upgrade on CRITICAL violation in Safety category ─────────
    const hasCritical = evidence.violations.some((v) => v.severity === 'CRITICAL');
    const effectivePriority: RecommendationPriority = hasCritical && category === 'Safety'
      ? 'Immediate'
      : PRIORITY_FROM_SEVERITY[severityBasis];

    // ── Most relevant violation reference ─────────────────────────────────
    const relevantViolation = evidence.violations.find((v) => {
      const dimLower = v.dimension.toLowerCase();
      return (
        dimLower.includes(question.questionId.split('-')[0].toLowerCase()) ||
        dimLower.includes(category.toLowerCase())
      );
    });

    const evidenceRef = relevantViolation
      ? `${relevantViolation.evidence} (${relevantViolation.imageLocation})`
      : question.evidence;

    // ── sortKey within category ────────────────────────────────────────────
    const baseSort       = CATEGORY_SORT_BASE[category];
    const severityOffset = severityBasis === 'MAJOR' ? 0 : severityBasis === 'MODERATE' ? 5 : 10;
    const sortKey        = baseSort + severityOffset;

    return {
      questionId:    question.questionId,
      pillar,
      category,
      priority:      effectivePriority,
      title:         qerTitle,
      description:   qerDesc,
      evidence:      evidenceRef,
      rating:        question.rating,
      severityBasis,
      sortKey,
    };
  }
}

// ── Description builder using QER corrective + benefit ────────────────────────

function buildDescription(
  question:        QuestionResult,
  corrective:      string,
  expectedBenefit: string,
  severityBasis:   CalibrationSeverity,
): string {
  const urgencyWord = severityBasis === 'MAJOR'    ? 'immediately' :
                      severityBasis === 'MODERATE' ? 'promptly'    :
                      'as scheduled';
  return (
    `Rating: ${question.rating}. ` +
    `Corrective action required ${urgencyWord}. ` +
    `${corrective} ` +
    `Expected benefit: ${expectedBenefit}`
  );
}
