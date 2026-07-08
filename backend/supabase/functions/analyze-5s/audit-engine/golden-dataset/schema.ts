/**
 * supabase/functions/analyze-5s/audit-engine/golden-dataset/schema.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Golden Dataset type definitions (Phase 4.1).
 *
 * Pre-computed AuditEvidenceModel fixtures (no real images required).
 * Each scenario defines a complete evidence model + expected calibration outputs.
 * Tests must achieve ±5% score agreement with expected ranges.
 *
 * Q3 resolution: evidence model fixtures only — no live LLM calls in regression tests.
 */

import type {
  AuditEvidenceModel,
  AuditRating,
  PillarKey,
} from '../types.ts';

export interface GoldenScenarioExpectations {
  /** Expected rating per question ID (human auditor reference) */
  questionRatings:  Partial<Record<string, AuditRating>>;
  /** Expected pillar rating (Very Bad/Bad/Average/Good/Very Good) */
  pillarRatings:    Partial<Record<PillarKey, string>>;
  /** Acceptable overall score range (±5% of target) */
  overallScore: {
    min: number;   // Minimum acceptable score percentage
    max: number;   // Maximum acceptable score percentage
    target: number; // Expected midpoint (human auditor consensus)
  };
  /** Expected minimum reliability score */
  minReliability: number;   // 0–100
  /** Expected max consistency flags */
  maxConsistencyFlags: number;
}

export interface GoldenDatasetScenario {
  scenarioId:         string;
  description:        string;
  zone:               string;
  /** Pre-computed Stage A evidence model (no image needed) */
  evidenceModel:      AuditEvidenceModel;
  expectations:       GoldenScenarioExpectations;
  humanAuditorNotes:  string;
}
