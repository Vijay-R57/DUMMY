/**
 * supabase/functions/analyze-5s/audit-engine/AuditCalibrationMatrix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * @deprecated v5.0 — READ-ONLY ADAPTER
 *
 * This file is a backward-compatibility adapter.
 * All configuration now lives in QuestionEvaluationRegistry (QER).
 *
 * AuditCalibrationMatrix delegates ALL reads to the QER.
 * It contains ZERO independent business logic.
 * It will be removed in engine version 6.0.
 *
 * Do NOT add new configuration here.
 * All changes must be made in QuestionEvaluationRegistry.ts.
 */

import type {
  QuestionCalibrationConfig,
} from './types.ts';

import {
  getQuestionEvalConfig,
  getAllQuestionEvalConfigs,
} from './QuestionEvaluationRegistry.ts';

// ── Compatibility version ──────────────────────────────────────────────────────

/** @deprecated Use AUDIT_ENGINE_VERSIONS.calibrationVersion from types.ts */
export const CALIBRATION_MATRIX_VERSION = '2.0';

// ── Adapter: QuestionEvaluationConfig → QuestionCalibrationConfig ─────────────

/**
 * Projects a QuestionEvaluationConfig to the legacy QuestionCalibrationConfig shape.
 * Zero data transformation — direct field passthrough from QER.
 */
function toCalibrationConfig(qec: ReturnType<typeof getQuestionEvalConfig>): QuestionCalibrationConfig {
  return {
    questionId:        qec.questionId,
    minorTolerance:    qec.minorTolerance,
    thresholds:        qec.thresholds,
    positiveInfluence: qec.positiveInfluence,
    escalationRules:   qec.escalationRules,
    calibrationRules:  qec.calibrationRules,
  };
}

// ── Public API (delegates to QER) ─────────────────────────────────────────────

/**
 * @deprecated Use getQuestionEvalConfig() from QuestionEvaluationRegistry.ts
 * Returns the calibration config for a question ID.
 */
export function getCalibrationConfig(questionId: string): QuestionCalibrationConfig {
  return toCalibrationConfig(getQuestionEvalConfig(questionId));
}

/**
 * @deprecated Use getAllQuestionEvalConfigs() from QuestionEvaluationRegistry.ts
 * Returns calibration configs for questions whose ID starts with pillarPrefix.
 */
export function getPillarCalibrationConfigs(pillarPrefix: string): QuestionCalibrationConfig[] {
  return getAllQuestionEvalConfigs()
    .filter((c) => c.questionId.startsWith(pillarPrefix))
    .map(toCalibrationConfig);
}

/**
 * @deprecated Use getAllQuestionEvalConfigs() from QuestionEvaluationRegistry.ts
 * Returns all 20 calibration configs.
 */
export function getAllCalibrationConfigs(): QuestionCalibrationConfig[] {
  return getAllQuestionEvalConfigs().map(toCalibrationConfig);
}
