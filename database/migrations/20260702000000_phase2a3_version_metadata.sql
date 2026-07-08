-- ============================================================
-- Phase 2A.3: Engine Version Metadata Columns
-- Migration: 20260702000000_phase2a3_version_metadata.sql
-- ============================================================
-- Adds version metadata columns to audit_sessions to record exact sub-module
-- versions used for every audit, supporting long-term reproducibility.
-- ============================================================

BEGIN;

ALTER TABLE public.audit_sessions
  ADD COLUMN IF NOT EXISTS engine_version                TEXT DEFAULT '2A.3',
  ADD COLUMN IF NOT EXISTS observation_schema_version    TEXT DEFAULT '2.0',
  ADD COLUMN IF NOT EXISTS scoring_engine_version        TEXT DEFAULT '2A.1',
  ADD COLUMN IF NOT EXISTS rule_engine_version           TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS recommendation_engine_version  TEXT DEFAULT '2A.1';

COMMENT ON COLUMN public.audit_sessions.engine_version IS 'Overall engine orchestration version';
COMMENT ON COLUMN public.audit_sessions.observation_schema_version IS 'Observation schema structure version';
COMMENT ON COLUMN public.audit_sessions.scoring_engine_version IS 'Scoring logic module version';
COMMENT ON COLUMN public.audit_sessions.rule_engine_version IS 'Rule engine logic version';
COMMENT ON COLUMN public.audit_sessions.recommendation_engine_version IS 'Recommendation logic module version';

COMMIT;
