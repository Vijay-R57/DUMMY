-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add geotag / geo-audit columns to analysis_logs
-- ─────────────────────────────────────────────────────────────────────────────
-- These columns store the GPS coordinates and timestamps captured by the
-- browser Geolocation API when the employee uses "Take Photo with Geotag".
-- They form the geo-audit trail required for 5S compliance reporting.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analysis_logs
  -- Office name (from session at time of analysis)
  ADD COLUMN IF NOT EXISTS office_name          TEXT,

  -- GPS coordinates for the BEFORE image capture
  ADD COLUMN IF NOT EXISTS before_latitude      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS before_longitude     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS before_captured_at   TIMESTAMP WITH TIME ZONE,

  -- GPS coordinates for the AFTER image capture
  ADD COLUMN IF NOT EXISTS after_latitude       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS after_longitude      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS after_captured_at    TIMESTAMP WITH TIME ZONE,

  -- Timestamp when "Run 5S Analysis" was triggered
  ADD COLUMN IF NOT EXISTS captured_at          TIMESTAMP WITH TIME ZONE;

-- Index on office for per-office history queries
CREATE INDEX IF NOT EXISTS idx_analysis_logs_office_name
  ON public.analysis_logs (office_name);

-- Index on before_captured_at for time-range audit queries
CREATE INDEX IF NOT EXISTS idx_analysis_logs_before_captured_at
  ON public.analysis_logs (before_captured_at);

-- Useful comment on the table for documentation
COMMENT ON COLUMN public.analysis_logs.office_name        IS 'Office selected by employee at login time';
COMMENT ON COLUMN public.analysis_logs.before_latitude    IS 'GPS latitude recorded at Before image capture';
COMMENT ON COLUMN public.analysis_logs.before_longitude   IS 'GPS longitude recorded at Before image capture';
COMMENT ON COLUMN public.analysis_logs.before_captured_at IS 'Timestamp of Before image GPS capture';
COMMENT ON COLUMN public.analysis_logs.after_latitude     IS 'GPS latitude recorded at After image capture';
COMMENT ON COLUMN public.analysis_logs.after_longitude    IS 'GPS longitude recorded at After image capture';
COMMENT ON COLUMN public.analysis_logs.after_captured_at  IS 'Timestamp of After image GPS capture';
COMMENT ON COLUMN public.analysis_logs.captured_at        IS 'Timestamp when Run 5S Analysis was triggered';
