/**
 * supabase/functions/analyze-5s/audit-engine/AuditReliabilityService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Overall Audit Reliability Score (Phase 4.1 / 4.2).
 *
 * Computes a 0–100 reliability score from four components:
 *
 *   Component              Weight   Source
 *   ─────────────────────  ───────  ──────────────────────────────────
 *   Evidence Coverage Avg   35%     EvidenceCoverage[].coveragePercentage
 *   Image Quality           30%     AuditEvidenceModel.overallConfidence
 *   Cross-Question Consist  20%     ConsistencyFlag[].severity
 *   Context Completeness    15%     EvidenceCoverage[].contextCompleteness
 *
 * Levels:
 *   EXCELLENT  ≥ 85
 *   HIGH       ≥ 65
 *   MODERATE   ≥ 40
 *   LOW        <  40
 *
 * Phase 4.2 additions:
 *  - positiveFactors: top strengths of this audit (up to 3)
 *  - limitingFactors: top weaknesses / caveats (up to 3)
 *  - Both are displayed in the final report as ✓/⚠ bullet lists
 *
 * This score represents confidence in the AUDIT ITSELF — not workplace performance.
 *
 * Design invariants:
 *  - No LLM calls — purely deterministic
 *  - No prompt content
 *  - Zero zone-specific logic
 *  - Never throws
 */

import type {
  AuditEvidenceModel,
  EvidenceCoverage,
  ConsistencyFlag,
  ReliabilityScore,
  ReliabilityLevel,
} from './types.ts';

// ── Component weights ─────────────────────────────────────────────────────────

const W_COVERAGE   = 0.35;
const W_IMAGE      = 0.30;
const W_CONSISTENCY = 0.20;
const W_CONTEXT    = 0.15;

// ── Image confidence → numeric ────────────────────────────────────────────────

const CONFIDENCE_SCORE: Record<string, number> = {
  HIGH:   100,
  MEDIUM:  60,
  LOW:     25,
};

// ── Consistency severity → penalty ────────────────────────────────────────────

const CONSISTENCY_PENALTY: Record<string, number> = {
  MINOR:    10,
  MODERATE: 20,
  MAJOR:    35,
};

// ── Context completeness → score ──────────────────────────────────────────────

const COMPLETENESS_SCORE: Record<string, number> = {
  FULL:    100,
  PARTIAL:  60,
  MINIMAL:  20,
};

// ── AuditReliabilityService ───────────────────────────────────────────────────

export class AuditReliabilityService {

  /**
   * Computes the overall audit reliability score with full explanation.
   *
   * @param evidence    - Shared AuditEvidenceModel (provides image quality)
   * @param coverages   - Per-question EvidenceCoverage from EvidenceCoverageService
   * @param flags       - Cross-question ConsistencyFlags
   * @returns           - ReliabilityScore with level, score, components, reasons,
   *                       positiveFactors (✓), and limitingFactors (⚠)
   */
  static compute(
    evidence:  AuditEvidenceModel,
    coverages: EvidenceCoverage[],
    flags:     ConsistencyFlag[],
  ): ReliabilityScore {
    const positiveFactors: string[] = [];
    const limitingFactors: string[] = [];

    // ── Component 1: Evidence Coverage Average (35%) ──────────────────
    const avgCoverage = coverages.length === 0
      ? 50
      : Math.round(
          coverages.reduce((sum, c) => sum + c.coveragePercentage, 0) / coverages.length,
        );

    if (avgCoverage >= 75) {
      positiveFactors.push(`Strong evidence coverage (${avgCoverage}%) — most questions have well-supported evaluations.`);
    } else if (avgCoverage < 45) {
      limitingFactors.push(`Low average evidence coverage (${avgCoverage}%) — many questions have insufficient visible context.`);
    }

    // ── Component 2: Image Quality (30%) ──────────────────────────
    const imageQualityScore = CONFIDENCE_SCORE[evidence.overallConfidence] ?? 60;

    if (evidence.overallConfidence === 'HIGH') {
      positiveFactors.push('High image quality — clear, well-lit image supports confident evidence extraction.');
    } else if (evidence.overallConfidence === 'LOW') {
      limitingFactors.push('Low image quality — poor lighting or limited visibility reduces audit reliability.');
    }
    if (evidence.imageNotes) {
      limitingFactors.push(`Image notes: ${evidence.imageNotes}`);
    }

    // ── Component 3: Cross-Question Consistency (20%) ─────────────────
    let consistencyScore = 100;
    if (flags.length === 0) {
      positiveFactors.push('Consistent cross-question logic — no contradictions detected across the 20 evaluation questions.');
    }
    for (const flag of flags) {
      const penalty = CONSISTENCY_PENALTY[flag.severity] ?? 10;
      consistencyScore -= penalty;
      limitingFactors.push(`Inconsistency detected: ${flag.description} (−${penalty} reliability pts).`);
    }
    consistencyScore = Math.max(0, consistencyScore);

    // ── Component 4: Context Completeness (15%) ────────────────────
    const contextDistribution = {
      FULL:    coverages.filter((c) => c.contextCompleteness === 'FULL').length,
      PARTIAL: coverages.filter((c) => c.contextCompleteness === 'PARTIAL').length,
      MINIMAL: coverages.filter((c) => c.contextCompleteness === 'MINIMAL').length,
    };

    const contextCompleteScore = coverages.length === 0
      ? 60
      : Math.round(
          (contextDistribution.FULL    * COMPLETENESS_SCORE.FULL    +
           contextDistribution.PARTIAL * COMPLETENESS_SCORE.PARTIAL +
           contextDistribution.MINIMAL * COMPLETENESS_SCORE.MINIMAL) /
          coverages.length,
        );

    if (contextDistribution.FULL >= Math.ceil(coverages.length * 0.7)) {
      positiveFactors.push(`Full context for ${contextDistribution.FULL}/${coverages.length} questions — zone knowledge is well-matched to visible evidence.`);
    }
    if (contextDistribution.MINIMAL > 5) {
      limitingFactors.push(`${contextDistribution.MINIMAL} questions have minimal context — zone-expected items not visible.`);
    } else if (contextDistribution.PARTIAL > 0) {
      limitingFactors.push(`Partial context for ${contextDistribution.PARTIAL} question(s) — some expected zone elements were not visible.`);
    }

    // ── Weighted composite score ──────────────────────────────────
    const score = Math.round(
      avgCoverage          * W_COVERAGE    +
      imageQualityScore    * W_IMAGE       +
      consistencyScore     * W_CONSISTENCY +
      contextCompleteScore * W_CONTEXT,
    );

    // ── Level classification ──────────────────────────────────────────────
    const level: ReliabilityLevel =
      score >= 85 ? 'EXCELLENT' :
      score >= 65 ? 'HIGH' :
      score >= 40 ? 'MODERATE' :
      'LOW';

    const levelLabel: Record<ReliabilityLevel, string> = {
      EXCELLENT: 'Excellent Reliability',
      HIGH:      'High Reliability',
      MODERATE:  'Moderate Reliability',
      LOW:       'Low Reliability',
    };

    // ── Fallback reasons when nothing was logged ────────────────────
    if (positiveFactors.length === 0) {
      positiveFactors.push('Audit reliability within normal parameters.');
    }
    if (limitingFactors.length === 0 && level !== 'EXCELLENT') {
      limitingFactors.push('No major limiting factors identified.');
    }

    // Legacy reasons array = positive + limiting (backwards compat)
    const reasons = [...positiveFactors, ...limitingFactors];

    return {
      level,
      label:               levelLabel[level],
      score,
      evidenceCoverageAvg: avgCoverage,
      imageQualityScore,
      consistencyScore,
      contextCompleteScore,
      reasons,
      positiveFactors,
      limitingFactors,
    };
  }
}
