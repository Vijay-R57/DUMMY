/**
 * supabase/functions/analyze-5s/versions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Engine Version Metadata (Phase 2A.3).
 *
 * Keeps track of version metadata for all engine sub-modules for observability
 * and audit reproducibility.
 */

export const ENGINE_VERSIONS = {
  engine:                    '2A.3',
  observation_schema:        '2.0',    // bumped from 1.0 after 2A.1 structured observation schema changes
  scoring_engine:            '2A.1',   // unchanged since 2A.1
  rule_engine:               '1.0',
  recommendation_engine:     '2A.1',
} as const;
