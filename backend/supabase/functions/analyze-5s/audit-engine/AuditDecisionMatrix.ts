/**
 * supabase/functions/analyze-5s/audit-engine/AuditDecisionMatrix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * @deprecated v5.0 — READ-ONLY ADAPTER
 *
 * This file is a backward-compatibility adapter.
 * All configuration now lives in QuestionEvaluationRegistry (QER).
 *
 * AuditDecisionMatrix delegates ALL reads to the QER.
 * It contains ZERO independent business logic.
 * It will be removed in engine version 6.0.
 *
 * Do NOT add new configuration here.
 * All changes must be made in QuestionEvaluationRegistry.ts.
 */

import type {
  QuestionDecisionConfig,
  PillarKey,
} from './types.ts';

import {
  getQuestionEvalConfig,
  getPillarEvalConfigs,
  getAllQuestionEvalConfigs,
  getQERCount,
} from './QuestionEvaluationRegistry.ts';

// ── Compatibility version ──────────────────────────────────────────────────────

/** @deprecated Use AUDIT_ENGINE_VERSIONS.decisionMatrixVersion from types.ts */
export const DECISION_MATRIX_VERSION = '2.0';

// ── Adapter: QuestionEvaluationConfig → QuestionDecisionConfig ────────────────

/**
 * Projects a QuestionEvaluationConfig to the legacy QuestionDecisionConfig shape.
 * Called by all legacy consumers; zero data transformation — direct field passthrough.
 */
function toDecisionConfig(qec: ReturnType<typeof getQuestionEvalConfig>): QuestionDecisionConfig {
  return {
    questionId:        qec.questionId,
    pillar:            qec.pillar,
    questionType:      qec.questionType,
    evidenceCategory:  qec.evidenceCategory,
    decisionStrategy:  qec.decisionStrategy,
    contextRequired:   qec.contextRequired,
    ratingPolicy:      qec.ratingPolicy,
    evidencePolicy:    qec.evidencePolicy,
    confidencePolicy:  qec.confidencePolicy,
    requiredEvidence:  qec.requiredEvidence,
    forbiddenEvidence: qec.forbiddenEvidence,
  };
}

// ── Public API (delegates to QER) ─────────────────────────────────────────────

/**
 * @deprecated Use getQuestionEvalConfig() from QuestionEvaluationRegistry.ts
 * Returns the decision config for a single question ID.
 */
export function getQuestionConfig(questionId: string): QuestionDecisionConfig {
  return toDecisionConfig(getQuestionEvalConfig(questionId));
}

/**
 * @deprecated Use getPillarEvalConfigs() from QuestionEvaluationRegistry.ts
 * Returns all decision configs for a given pillar.
 */
export function getPillarConfigs(pillar: PillarKey): QuestionDecisionConfig[] {
  return getPillarEvalConfigs(pillar).map(toDecisionConfig);
}

/**
 * @deprecated Use getAllQuestionEvalConfigs() from QuestionEvaluationRegistry.ts
 * Returns all 20 question configs.
 */
export function getAllConfigs(): QuestionDecisionConfig[] {
  return getAllQuestionEvalConfigs().map(toDecisionConfig);
}

/**
 * @deprecated Use getQERCount() from QuestionEvaluationRegistry.ts
 * Returns the number of registered questions (always 20).
 */
export function getRegisteredCount(): number {
  return getQERCount();
}
