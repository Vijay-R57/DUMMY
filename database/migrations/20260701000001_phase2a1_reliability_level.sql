-- ============================================================
-- Phase 2A.1: Reliability Level Column
-- Migration: 20260701000001_phase2a1_reliability_level.sql
-- ============================================================
-- Adds the audit_reliability_level column to audit_sessions.
-- This stores the output of ReliabilityClassifier (EXCELLENT → REJECTED).
-- The value is INFORMATIONAL ONLY — it never modifies the audit score.
-- ============================================================

BEGIN;

-- ── 1. Add reliability level column to audit_sessions ────────────────────────

ALTER TABLE public.audit_sessions
  ADD COLUMN IF NOT EXISTS audit_reliability_level TEXT
  CHECK (audit_reliability_level IN ('EXCELLENT', 'HIGH', 'MEDIUM', 'LOW', 'REJECTED'));

COMMENT ON COLUMN public.audit_sessions.audit_reliability_level IS
  'Reliability classification assigned by ReliabilityClassifier after each audit. '
  'INFORMATIONAL ONLY — never used in score calculations. '
  'Values: EXCELLENT | HIGH | MEDIUM | LOW | REJECTED. '
  'REJECTED means the audit was flagged but is still saved and scored normally. '
  'Phase 2A.1 — set by analyze-5s edge function.';

-- ── 2. Index for analytics and reliability-based filtering ───────────────────

CREATE INDEX IF NOT EXISTS idx_audit_sessions_reliability_level
  ON public.audit_sessions (audit_reliability_level)
  WHERE audit_reliability_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_sessions_reliability_confidence
  ON public.audit_sessions (audit_reliability_level, audit_confidence DESC)
  WHERE audit_reliability_level IS NOT NULL;

-- ── 3. Update existing sessions to 'MEDIUM' as a safe default ────────────────
-- New sessions will have this set correctly by the function.
-- Historical sessions that predate 2A.1 get a neutral default.

UPDATE public.audit_sessions
SET audit_reliability_level = 'MEDIUM'
WHERE audit_reliability_level IS NULL
  AND status = 'COMPLETED';

COMMIT;
