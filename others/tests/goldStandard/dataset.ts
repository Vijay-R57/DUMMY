/**
 * src/test/goldStandard/dataset.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gold Standard Validation Dataset type definitions (Phase 2A.2).
 *
 * Each GoldStandardCase represents a known-good benchmark:
 *   - Pre-defined StructuredObservations (no AI calls)
 *   - Expected deterministic rule answers for rule-answerable questions
 *   - Expected score range (allows ±5% tolerance for partial-answer variation)
 *   - Expected reliability level
 *   - Expected consistency warning rule IDs
 *
 * Scenarios include both ideal and edge cases (poor lighting, occlusion,
 * camera angle variation, borderline compliance) to reflect real operating
 * conditions — not just perfect demonstrations.
 */

import type { StructuredObservation } from '../../../gemini/ai-engines/ObservationCache';
import type { ReliabilityLevel } from '../../../gemini/ai-engines/ReliabilityClassifier';

export type ScenarioType = 'IDEAL' | 'EDGE';

export interface GoldStandardCase {
  id:                   string;
  industry:             string;
  template_type:        string;
  scenario_type:        ScenarioType;
  scenario_description: string;
  difficulty_notes:     string;

  /** Pre-computed observations simulating the workplace image. */
  observations:         StructuredObservation[];

  /**
   * Expected deterministic answers for questions handled by the Rule Engine.
   * Map of question_id → expected AuditAnswerState.
   * Only include questions that the Rule Engine should handle — LLM answers not tested here.
   */
  expected_rule_answers: Record<string, string>;

  /** Expected overall score percentage range (inclusive). */
  expected_score_range: { min: number; max: number };

  /** Expected reliability classification. */
  expected_reliability: ReliabilityLevel;

  /** Expected consistency warning rule IDs (if any). */
  expected_warning_ids: string[];

  /** Audit confidence to use when testing ReliabilityClassifier. */
  test_audit_confidence: number;

  /** NOT_VISIBLE percentage to use when testing ReliabilityClassifier. */
  test_not_visible_pct:  number;

  /** HIGH consistency warning count to use when testing ReliabilityClassifier. */
  test_high_warnings:    number;
}
