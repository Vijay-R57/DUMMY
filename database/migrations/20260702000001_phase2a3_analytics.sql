-- ============================================================
-- Phase 2A.3: Analytics Infrastructure
-- Migration: 20260702000001_phase2a3_analytics.sql
-- ============================================================
-- Adds indexes to optimize common analytics queries and 2 minimum reporting views.
-- ============================================================

BEGIN;

-- ── 1. Create Analytics Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_industry_date
  ON public.audit_sessions (industry, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_dept_date
  ON public.audit_sessions (department, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_confidence
  ON public.audit_sessions (audit_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_reliability
  ON public.audit_sessions (audit_reliability_level);

CREATE INDEX IF NOT EXISTS idx_responses_session_answer
  ON public.audit_item_responses (audit_session_id, ai_answer);

CREATE INDEX IF NOT EXISTS idx_responses_question
  ON public.audit_item_responses (ai_question_id);

CREATE INDEX IF NOT EXISTS idx_recommendations_session_priority
  ON public.audit_recommendations (audit_session_id, priority ASC);

CREATE INDEX IF NOT EXISTS idx_recommendations_pillar_severity
  ON public.audit_recommendations (pillar, severity);

-- ── 2. Create Minimum Required Views (Exactly 2 views) ───────────────────────

-- View 1: Session summary view (avoids repeated complex JSON parsing in queries)
CREATE OR REPLACE VIEW public.v_audit_session_summary AS
SELECT
  s.id,
  s.status,
  s.created_at,
  s.industry,
  s.department,
  s.workspace_type,
  s.audit_confidence,
  s.audit_reliability_level,
  s.engine_version,
  (s.score_breakdown->>'overall_percentage')::NUMERIC AS overall_percentage,
  (s.score_breakdown->>'grade')::TEXT               AS grade
FROM public.audit_sessions s;

-- View 2: Question failure rates (to support "most failed questions" analytics)
CREATE OR REPLACE VIEW public.v_question_failure_rates AS
SELECT
  r.ai_question_id,
  COUNT(*)                                            AS total_responses,
  COUNT(*) FILTER (WHERE r.ai_answer = 'NO')          AS failed_count,
  COUNT(*) FILTER (WHERE r.ai_answer = 'PARTIAL')     AS partial_count,
  ROUND(
    COUNT(*) FILTER (WHERE r.ai_answer = 'NO')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                   AS failure_rate_pct
FROM public.audit_item_responses r
GROUP BY r.ai_question_id;

COMMIT;
