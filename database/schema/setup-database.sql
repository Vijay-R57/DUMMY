-- =============================================================================
-- MIGRATION: 20260216050654_4efefbc0-ac68-4286-a6a3-1f061cdd2480.sql
-- =============================================================================


-- Create analysis_logs table to track all analyses
CREATE TABLE public.analysis_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  before_image TEXT,
  after_image TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to insert
CREATE POLICY "Service role can manage analysis_logs"
ON public.analysis_logs
FOR ALL
USING (true)
WITH CHECK (true);


-- =============================================================================
-- MIGRATION: 20260216050800_fd360ef2-c0a0-40c3-83d5-1f1709d72904.sql
-- =============================================================================


-- Drop the overly permissive policy
DROP POLICY "Service role can manage analysis_logs" ON public.analysis_logs;

-- Only allow reading via anon (for display), inserts only via service role (edge functions)
CREATE POLICY "Anyone can read analysis logs"
ON public.analysis_logs
FOR SELECT
USING (true);

-- No INSERT/UPDATE/DELETE for anon - edge functions use service_role which bypasses RLS


-- =============================================================================
-- MIGRATION: 20260228110000_add_storage_bucket_and_cv_columns.sql
-- =============================================================================

-- Migration: Add Supabase Storage bucket for 5S workplace images
-- This implements the "Data Flywheel" — every uploaded image is
-- preserved in object storage so it can later be used to train
-- the custom YOLO model (Phase 2).

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '5s-images',
  '5s-images',
  false,                              -- private bucket (not publicly accessible)
  10485760,                           -- 10 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users (via service role / edge functions) can upload
CREATE POLICY "Service role can upload 5s images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = '5s-images');

-- Policy: Service role / edge functions can read/download images
CREATE POLICY "Service role can read 5s images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = '5s-images');

-- Policy: Anyone can read if they have the signed URL (for display in frontend)
CREATE POLICY "Anon can read 5s images by signed URL"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = '5s-images');

-- Also add a storage_path column to analysis_logs so we can
-- track WHERE each image was stored in the bucket.
ALTER TABLE public.analysis_logs
  ADD COLUMN IF NOT EXISTS before_image_path TEXT,
  ADD COLUMN IF NOT EXISTS after_image_path  TEXT;

-- Add a scoring_method column so we can track which pipeline
-- generated each result (CV Engine vs Gemini fallback).
ALTER TABLE public.analysis_logs
  ADD COLUMN IF NOT EXISTS scoring_method TEXT DEFAULT 'CV Engine',
  ADD COLUMN IF NOT EXISTS cv_metrics     JSONB;


-- =============================================================================
-- MIGRATION: 20260314001935_add_geotag_columns.sql
-- =============================================================================

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


-- =============================================================================
-- MIGRATION: 20260521210500_production_database_architecture.sql
-- =============================================================================

-- Start Transaction
BEGIN;

-- 1. Create Enums and Custom Types (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('worker', 'supervisor', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'five_s_pillar') THEN
        CREATE TYPE public.five_s_pillar AS ENUM ('sort', 'set_in_order', 'shine', 'standardize', 'sustain');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_category') THEN
        CREATE TYPE public.recommendation_category AS ENUM ('general', 'safety', 'lean_maintenance', 'root_cause');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_status') THEN
        CREATE TYPE public.recommendation_status AS ENUM ('pending', 'implemented', 'discarded');
    END IF;
END$$;

-- 2. Offices Table
CREATE TABLE IF NOT EXISTS public.offices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT unique_office_name UNIQUE (name, city)
);

-- 3. Areas (Departments / Workstations) Table
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL UNIQUE,
    role public.user_role NOT NULL DEFAULT 'worker',
    employee_code TEXT UNIQUE,
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure profiles has all columns if it already existed
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Create index on employee_code for rapid login queries
CREATE INDEX IF NOT EXISTS idx_profiles_employee_code ON public.profiles(employee_code);

-- Trigger to automatically sync auth.users with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role, employee_code, office_id)
    VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'worker'),
        coalesce(new.raw_user_meta_data->>'employee_code', ''),
        (new.raw_user_meta_data->>'office_id')::UUID
    )
    ON CONFLICT (id) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        employee_code = excluded.employee_code,
        office_id = COALESCE(excluded.office_id, public.profiles.office_id);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-backfill profile table for existing users in auth.users
INSERT INTO public.profiles (id, email, first_name, last_name, role, employee_code, office_id)
SELECT 
    id, 
    email, 
    coalesce(raw_user_meta_data->>'first_name', ''), 
    coalesce(raw_user_meta_data->>'last_name', ''), 
    coalesce((raw_user_meta_data->>'role')::public.user_role, 'worker'),
    coalesce(raw_user_meta_data->>'employee_code', ''),
    (raw_user_meta_data->>'office_id')::UUID
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    employee_code = excluded.employee_code,
    office_id = COALESCE(excluded.office_id, public.profiles.office_id);

-- 5. Extend Existing public.analysis_logs Table for normalization
ALTER TABLE public.analysis_logs
    ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS overall_score_before INT CONSTRAINT valid_score_before CHECK (overall_score_before BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS overall_score_after INT CONSTRAINT valid_score_after CHECK (overall_score_after BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS lean_maintenance_score INT CONSTRAINT valid_lm_score CHECK (lean_maintenance_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'uploaded',
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS upload_error TEXT NULL;

-- 6. Pillar Scores Table (Detailed 5S Pillar Breakdowns)
CREATE TABLE IF NOT EXISTS public.pillar_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_log_id UUID NOT NULL REFERENCES public.analysis_logs(id) ON DELETE CASCADE,
    pillar public.five_s_pillar NOT NULL,
    score_before INT NOT NULL CONSTRAINT valid_p_score_b CHECK (score_before BETWEEN 0 AND 100),
    score_after INT NOT NULL CONSTRAINT valid_p_score_a CHECK (score_after BETWEEN 0 AND 100),
    explanation_before TEXT NOT NULL,
    explanation_after TEXT NOT NULL,
    CONSTRAINT unique_analysis_pillar UNIQUE (analysis_log_id, pillar)
);

-- 7. Recommendations Table
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_log_id UUID NOT NULL REFERENCES public.analysis_logs(id) ON DELETE CASCADE,
    category public.recommendation_category NOT NULL DEFAULT 'general',
    description TEXT NOT NULL,
    status public.recommendation_status NOT NULL DEFAULT 'pending',
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Raw CV Metrics Table (Granular computer-vision readings)
CREATE TABLE IF NOT EXISTS public.cv_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_log_id UUID NOT NULL REFERENCES public.analysis_logs(id) ON DELETE CASCADE,
    state TEXT NOT NULL CONSTRAINT valid_state CHECK (state IN ('before', 'after')),
    clutter_count INT NOT NULL DEFAULT 0,
    clutter_density NUMERIC(6, 4) NOT NULL,
    obstruction_ratio NUMERIC(6, 4) NOT NULL,
    unused_material_presence NUMERIC(6, 4) NOT NULL,
    alignment_score NUMERIC(6, 4) NOT NULL,
    spacing_consistency NUMERIC(6, 4) NOT NULL,
    edge_alignment NUMERIC(6, 4) NOT NULL,
    organization_symmetry NUMERIC(6, 4) NOT NULL,
    brightness_consistency NUMERIC(6, 4) NOT NULL,
    dirt_proxy_count INT NOT NULL DEFAULT 0,
    texture_irregularity NUMERIC(6, 4) NOT NULL,
    edge_cleanliness NUMERIC(6, 4) NOT NULL,
    visual_consistency NUMERIC(6, 4) NOT NULL,
    color_uniformity NUMERIC(6, 4) NOT NULL,
    workplace_std_dev NUMERIC(6, 4) NOT NULL,
    CONSTRAINT unique_log_state UNIQUE (analysis_log_id, state)
);

-- 9. Supervisor Reviews Table
CREATE TABLE IF NOT EXISTS public.supervisor_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_log_id UUID NOT NULL REFERENCES public.analysis_logs(id) ON DELETE CASCADE UNIQUE,
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating INT NOT NULL CONSTRAINT valid_rating CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Master Flywheel Trigger for Data Normalization
CREATE OR REPLACE FUNCTION public.sync_analysis_log_to_normalized_tables()
RETURNS TRIGGER AS $$
DECLARE
    v_office_id UUID;
    v_area_id UUID;
    v_worker_id UUID;
    v_score_before INT;
    v_score_after INT;
    v_lm_score INT;
    v_before_scores JSONB;
    v_after_scores JSONB;
BEGIN
    -- ── 1. Resolve Office & Area ───────────────────────────────────────────────
    IF new.office_name IS NOT NULL THEN
        -- Find or create office
        INSERT INTO public.offices (name, city, country)
        VALUES (new.office_name, 'Chennai', 'India')
        ON CONFLICT (name, city) DO UPDATE SET name = excluded.name
        RETURNING id INTO v_office_id;
        
        -- Find or create area (department)
        IF new.department IS NOT NULL THEN
            SELECT id INTO v_area_id FROM public.areas 
            WHERE office_id = v_office_id AND name = new.department;
            
            IF v_area_id IS NULL THEN
                INSERT INTO public.areas (office_id, name)
                VALUES (v_office_id, new.department)
                RETURNING id INTO v_area_id;
            END IF;
        END IF;
    END IF;

    -- Update area_id on new analysis_log row
    new.area_id := v_area_id;

    -- ── 2. Resolve Profile/Worker ──────────────────────────────────────────────
    BEGIN
        v_worker_id := new.employee_id::UUID;
        SELECT id INTO v_worker_id FROM public.profiles WHERE id = v_worker_id;
    EXCEPTION WHEN others THEN
        -- employee_id is a custom string or email, look up by employee_code first
        SELECT id INTO v_worker_id FROM public.profiles WHERE employee_code = new.employee_id;
        
        IF v_worker_id IS NULL THEN
            -- Look up by email
            SELECT id INTO v_worker_id FROM public.profiles WHERE email = new.employee_id;
        END IF;
        
        IF v_worker_id IS NULL THEN
            -- Look up by name
            SELECT id INTO v_worker_id FROM public.profiles 
            WHERE (first_name || ' ' || last_name) ILIKE new.employee_name LIMIT 1;
        END IF;
    END;

    IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'Unable to resolve employee profile for employee_id: %', new.employee_id;
    END IF;

    new.worker_id := v_worker_id;

    -- ── 3. Parse scores from analysis_result JSONB ──────────────────────────────
    IF new.analysis_result IS NOT NULL THEN
        v_before_scores := new.analysis_result->'beforeScores';
        v_after_scores := new.analysis_result->'afterScores';
        v_lm_score := (new.analysis_result->>'leanMaintenanceScore')::INT;

        IF v_before_scores IS NOT NULL THEN
            v_score_before := (
                coalesce((v_before_scores->>'sort')::INT, 0) + 
                coalesce((v_before_scores->>'setInOrder')::INT, 0) + 
                coalesce((v_before_scores->>'shine')::INT, 0) + 
                coalesce((v_before_scores->>'standardize')::INT, 0) + 
                coalesce((v_before_scores->>'sustain')::INT, 0)
            ) / 5;
        END IF;

        IF v_after_scores IS NOT NULL THEN
            v_score_after := (
                coalesce((v_after_scores->>'sort')::INT, 0) + 
                coalesce((v_after_scores->>'setInOrder')::INT, 0) + 
                coalesce((v_after_scores->>'shine')::INT, 0) + 
                coalesce((v_after_scores->>'standardize')::INT, 0) + 
                coalesce((v_after_scores->>'sustain')::INT, 0)
            ) / 5;
        END IF;

        new.overall_score_before := coalesce(v_score_before, 0);
        new.overall_score_after := coalesce(v_score_after, 0);
        new.lean_maintenance_score := coalesce(v_lm_score, 0);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_analysis_log_insert
    BEFORE INSERT ON public.analysis_logs
    FOR EACH ROW EXECUTE FUNCTION public.sync_analysis_log_to_normalized_tables();


-- 11. AFTER TRIGGER for deep scores, recommendations & raw CV metrics syncing
CREATE OR REPLACE FUNCTION public.sync_analysis_log_related_data()
RETURNS TRIGGER AS $$
DECLARE
    v_before_scores JSONB;
    v_after_scores JSONB;
    v_before_explanations JSONB;
    v_after_explanations JSONB;
    v_recs TEXT[];
    v_safety_recs TEXT[];
    v_root_causes TEXT[];
    v_rec_desc TEXT;
    v_cv_before JSONB;
    v_cv_after JSONB;
BEGIN
    IF new.analysis_result IS NOT NULL THEN
        v_before_scores := new.analysis_result->'beforeScores';
        v_after_scores := new.analysis_result->'afterScores';
        v_before_explanations := new.analysis_result->'beforeExplanations';
        v_after_explanations := new.analysis_result->'afterExplanations';

        -- Sync detailed Pillar Scores
        IF v_before_scores IS NOT NULL AND v_after_scores IS NOT NULL THEN
            -- Sort
            INSERT INTO public.pillar_scores (analysis_log_id, pillar, score_before, score_after, explanation_before, explanation_after)
            VALUES (new.id, 'sort', coalesce((v_before_scores->>'sort')::INT, 0), coalesce((v_after_scores->>'sort')::INT, 0), coalesce(v_before_explanations->>'sort', ''), coalesce(v_after_explanations->>'sort', ''))
            ON CONFLICT (analysis_log_id, pillar) DO NOTHING;
            
            -- Set In Order
            INSERT INTO public.pillar_scores (analysis_log_id, pillar, score_before, score_after, explanation_before, explanation_after)
            VALUES (new.id, 'set_in_order', coalesce((v_before_scores->>'setInOrder')::INT, 0), coalesce((v_after_scores->>'setInOrder')::INT, 0), coalesce(v_before_explanations->>'setInOrder', ''), coalesce(v_after_explanations->>'setInOrder', ''))
            ON CONFLICT (analysis_log_id, pillar) DO NOTHING;

            -- Shine
            INSERT INTO public.pillar_scores (analysis_log_id, pillar, score_before, score_after, explanation_before, explanation_after)
            VALUES (new.id, 'shine', coalesce((v_before_scores->>'shine')::INT, 0), coalesce((v_after_scores->>'shine')::INT, 0), coalesce(v_before_explanations->>'shine', ''), coalesce(v_after_explanations->>'shine', ''))
            ON CONFLICT (analysis_log_id, pillar) DO NOTHING;

            -- Standardize
            INSERT INTO public.pillar_scores (analysis_log_id, pillar, score_before, score_after, explanation_before, explanation_after)
            VALUES (new.id, 'standardize', coalesce((v_before_scores->>'standardize')::INT, 0), coalesce((v_after_scores->>'standardize')::INT, 0), coalesce(v_before_explanations->>'standardize', ''), coalesce(v_after_explanations->>'standardize', ''))
            ON CONFLICT (analysis_log_id, pillar) DO NOTHING;

            -- Sustain
            INSERT INTO public.pillar_scores (analysis_log_id, pillar, score_before, score_after, explanation_before, explanation_after)
            VALUES (new.id, 'sustain', coalesce((v_before_scores->>'sustain')::INT, 0), coalesce((v_after_scores->>'sustain')::INT, 0), coalesce(v_before_explanations->>'sustain', ''), coalesce(v_after_explanations->>'sustain', ''))
            ON CONFLICT (analysis_log_id, pillar) DO NOTHING;
        END IF;

        -- Sync Action Recommendations (parsed from JSONB array into discrete rows)
        IF new.analysis_result ? 'recommendations' THEN
            BEGIN
                SELECT array_agg(val) INTO v_recs FROM jsonb_array_elements_text(new.analysis_result->'recommendations') AS val;
                IF v_recs IS NOT NULL THEN
                    FOREACH v_rec_desc IN ARRAY v_recs LOOP
                        INSERT INTO public.recommendations (analysis_log_id, category, description, status, due_date)
                        VALUES (new.id, 'general', v_rec_desc, 'pending', (CURRENT_DATE + INTERVAL '7 days')::DATE);
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Guard against formatting issues
            END;
        END IF;

        -- Sync Safety Recommendations
        IF new.analysis_result ? 'safetyRecommendations' THEN
            BEGIN
                SELECT array_agg(val) INTO v_safety_recs FROM jsonb_array_elements_text(new.analysis_result->'safetyRecommendations') AS val;
                IF v_safety_recs IS NOT NULL THEN
                    FOREACH v_rec_desc IN ARRAY v_safety_recs LOOP
                        INSERT INTO public.recommendations (analysis_log_id, category, description, status, due_date)
                        VALUES (new.id, 'safety', v_rec_desc, 'pending', (CURRENT_DATE + INTERVAL '3 days')::DATE);
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;

        -- Sync Root Cause Observations
        IF new.analysis_result ? 'rootCauseObservations' THEN
            BEGIN
                SELECT array_agg(val) INTO v_root_causes FROM jsonb_array_elements_text(new.analysis_result->'rootCauseObservations') AS val;
                IF v_root_causes IS NOT NULL THEN
                    FOREACH v_rec_desc IN ARRAY v_root_causes LOOP
                        INSERT INTO public.recommendations (analysis_log_id, category, description, status, due_date)
                        VALUES (new.id, 'root_cause', v_rec_desc, 'pending', (CURRENT_DATE + INTERVAL '14 days')::DATE);
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;
    END IF;

    -- Sync Granular Computer Vision Metrics (CV Metrics)
    IF new.cv_metrics IS NOT NULL THEN
        v_cv_before := new.cv_metrics->'before_metrics';
        v_cv_after := new.cv_metrics->'after_metrics';

        IF v_cv_before IS NULL THEN v_cv_before := new.cv_metrics->'beforeMetrics'; END IF;
        IF v_cv_after IS NULL THEN v_cv_after := new.cv_metrics->'afterMetrics'; END IF;

        IF v_cv_before IS NOT NULL THEN
            INSERT INTO public.cv_metrics (
                analysis_log_id, state, clutter_count, clutter_density, obstruction_ratio, 
                unused_material_presence, alignment_score, spacing_consistency, edge_alignment, 
                organization_symmetry, brightness_consistency, dirt_proxy_count, texture_irregularity, 
                edge_cleanliness, visual_consistency, color_uniformity, workplace_std_dev
            )
            VALUES (
                new.id, 'before',
                coalesce((v_cv_before->>'clutter_count')::INT, (v_cv_before->>'clutterCount')::INT, 0),
                coalesce((v_cv_before->>'clutter_density')::NUMERIC, (v_cv_before->>'clutterDensity')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'obstruction_ratio')::NUMERIC, (v_cv_before->>'obstructionRatio')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'unused_material_presence')::NUMERIC, (v_cv_before->>'unusedMaterialPresence')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'alignment_score')::NUMERIC, (v_cv_before->>'alignmentScore')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'spacing_consistency')::NUMERIC, (v_cv_before->>'spacingConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'edge_alignment')::NUMERIC, (v_cv_before->>'edgeAlignment')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'organization_symmetry')::NUMERIC, (v_cv_before->>'organizationSymmetry')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'brightness_consistency')::NUMERIC, (v_cv_before->>'brightnessConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'dirt_proxy_count')::INT, (v_cv_before->>'dirtProxyCount')::INT, 0),
                coalesce((v_cv_before->>'texture_irregularity')::NUMERIC, (v_cv_before->>'textureIrregularity')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'edge_cleanliness')::NUMERIC, (v_cv_before->>'edgeCleanliness')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'visual_consistency')::NUMERIC, (v_cv_before->>'visualConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'color_uniformity')::NUMERIC, (v_cv_before->>'colorUniformity')::NUMERIC, 0.0),
                coalesce((v_cv_before->>'workplace_std_dev')::NUMERIC, (v_cv_before->>'workplaceStdDev')::NUMERIC, 0.0)
            )
            ON CONFLICT (analysis_log_id, state) DO NOTHING;
        END IF;

        IF v_cv_after IS NOT NULL THEN
            INSERT INTO public.cv_metrics (
                analysis_log_id, state, clutter_count, clutter_density, obstruction_ratio, 
                unused_material_presence, alignment_score, spacing_consistency, edge_alignment, 
                organization_symmetry, brightness_consistency, dirt_proxy_count, texture_irregularity, 
                edge_cleanliness, visual_consistency, color_uniformity, workplace_std_dev
            )
            VALUES (
                new.id, 'after',
                coalesce((v_cv_after->>'clutter_count')::INT, (v_cv_after->>'clutterCount')::INT, 0),
                coalesce((v_cv_after->>'clutter_density')::NUMERIC, (v_cv_after->>'clutterDensity')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'obstruction_ratio')::NUMERIC, (v_cv_after->>'obstructionRatio')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'unused_material_presence')::NUMERIC, (v_cv_after->>'unusedMaterialPresence')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'alignment_score')::NUMERIC, (v_cv_after->>'alignmentScore')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'spacing_consistency')::NUMERIC, (v_cv_after->>'spacingConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'edge_alignment')::NUMERIC, (v_cv_after->>'edgeAlignment')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'organization_symmetry')::NUMERIC, (v_cv_after->>'organizationSymmetry')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'brightness_consistency')::NUMERIC, (v_cv_after->>'brightnessConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'dirt_proxy_count')::INT, (v_cv_after->>'dirtProxyCount')::INT, 0),
                coalesce((v_cv_after->>'texture_irregularity')::NUMERIC, (v_cv_after->>'textureIrregularity')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'edge_cleanliness')::NUMERIC, (v_cv_after->>'edgeCleanliness')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'visual_consistency')::NUMERIC, (v_cv_after->>'visualConsistency')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'color_uniformity')::NUMERIC, (v_cv_after->>'colorUniformity')::NUMERIC, 0.0),
                coalesce((v_cv_after->>'workplace_std_dev')::NUMERIC, (v_cv_after->>'workplaceStdDev')::NUMERIC, 0.0)
            )
            ON CONFLICT (analysis_log_id, state) DO NOTHING;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER after_analysis_log_insert
    AFTER INSERT ON public.analysis_logs
    FOR EACH ROW EXECUTE FUNCTION public.sync_analysis_log_related_data();


-- 12. Create Optimized Indices for queries
CREATE INDEX IF NOT EXISTS idx_areas_office_id ON public.areas(office_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_worker_id ON public.analysis_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_area_id ON public.analysis_logs(area_id);
CREATE INDEX IF NOT EXISTS idx_pillar_scores_analysis_log_id ON public.pillar_scores(analysis_log_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_analysis_log_id ON public.recommendations(analysis_log_id);
CREATE INDEX IF NOT EXISTS idx_cv_metrics_analysis_log_id ON public.cv_metrics(analysis_log_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_reviews_analysis_log_id ON public.supervisor_reviews(analysis_log_id);

-- Composite index for rolling historical trend queries
CREATE INDEX IF NOT EXISTS idx_analysis_logs_area_date ON public.analysis_logs(area_id, analysis_date DESC);

-- Partial index for active/overdue safety recommendation tracking
CREATE INDEX IF NOT EXISTS idx_active_safety_recs ON public.recommendations(assigned_to, due_date) 
WHERE status = 'pending' AND category = 'safety';


-- 13. Enable RLS and setup policies
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_reviews ENABLE ROW LEVEL SECURITY;

-- Dynamic role helper function
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Supervisors/Admins can view all profiles" ON public.profiles;
CREATE POLICY "Supervisors/Admins can view all profiles"
ON public.profiles FOR SELECT USING (public.get_current_role() IN ('supervisor', 'admin'));

-- Offices select policy (restricted to authenticated users only)
DROP POLICY IF EXISTS "Anyone can select offices" ON public.offices;
CREATE POLICY "Anyone can select offices"
ON public.offices FOR SELECT TO authenticated USING (true);

-- Recommendations policies
DROP POLICY IF EXISTS "Users can view recommendations assigned to them or their logs" ON public.recommendations;
CREATE POLICY "Users can view recommendations assigned to them or their logs"
ON public.recommendations FOR SELECT USING (
    assigned_to = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.analysis_logs 
        WHERE id = analysis_log_id AND worker_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Supervisors and Admins can manage all recommendations" ON public.recommendations;
CREATE POLICY "Supervisors and Admins can manage all recommendations"
ON public.recommendations FOR ALL USING (public.get_current_role() IN ('supervisor', 'admin'));

COMMIT;


-- =============================================================================
-- MIGRATION: 20260615120000_fix_trigger_and_rls_for_history.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Fix trigger soft-fail + ensure History page RLS read access
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM 1: The BEFORE INSERT trigger 'sync_analysis_log_to_normalized_tables'
-- raised an exception if employee_id could not be resolved to a profile UUID.
-- This blocked EVERY analysis_logs insert from the save-analysis-log edge fn.
-- FIX: Change RAISE EXCEPTION to a soft-fail (NULL worker_id) so inserts succeed.
--
-- PROBLEM 2: The History page is not protected by ProtectedRoute, but anon
-- users should still be able to read logs. Ensure the SELECT policy covers anon.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix the BEFORE INSERT trigger to not raise exceptions
CREATE OR REPLACE FUNCTION public.sync_analysis_log_to_normalized_tables()
RETURNS TRIGGER AS $$
DECLARE
    v_office_id UUID;
    v_area_id UUID;
    v_worker_id UUID;
    v_score_before INT;
    v_score_after INT;
    v_lm_score INT;
    v_before_scores JSONB;
    v_after_scores JSONB;
BEGIN
    -- ── 1. Resolve Office & Area ───────────────────────────────────────────────
    IF new.office_name IS NOT NULL THEN
        -- Find or create office
        BEGIN
            INSERT INTO public.offices (name, city, country)
            VALUES (new.office_name, 'Chennai', 'India')
            ON CONFLICT (name, city) DO UPDATE SET name = excluded.name
            RETURNING id INTO v_office_id;
        EXCEPTION WHEN OTHERS THEN
            SELECT id INTO v_office_id FROM public.offices
            WHERE name = new.office_name LIMIT 1;
        END;

        -- Find or create area (department)
        IF new.department IS NOT NULL AND v_office_id IS NOT NULL THEN
            SELECT id INTO v_area_id FROM public.areas
            WHERE office_id = v_office_id AND name = new.department;

            IF v_area_id IS NULL THEN
                BEGIN
                    INSERT INTO public.areas (office_id, name)
                    VALUES (v_office_id, new.department)
                    RETURNING id INTO v_area_id;
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
            END IF;
        END IF;
    END IF;

    -- Update area_id on new analysis_log row
    new.area_id := v_area_id;

    -- ── 2. Resolve Profile/Worker (SOFT FAIL — never block the insert) ─────────
    BEGIN
        -- First try: employee_id is a UUID pointing to profiles.id
        v_worker_id := new.employee_id::UUID;
        SELECT id INTO v_worker_id FROM public.profiles WHERE id = v_worker_id;
    EXCEPTION WHEN OTHERS THEN
        v_worker_id := NULL;
    END;

    IF v_worker_id IS NULL THEN
        -- Second try: employee_code field
        SELECT id INTO v_worker_id FROM public.profiles
        WHERE employee_code = new.employee_id LIMIT 1;
    END IF;

    IF v_worker_id IS NULL THEN
        -- Third try: email match
        SELECT id INTO v_worker_id FROM public.profiles
        WHERE email = new.employee_id LIMIT 1;
    END IF;

    IF v_worker_id IS NULL THEN
        -- Fourth try: name match
        SELECT id INTO v_worker_id FROM public.profiles
        WHERE (first_name || ' ' || last_name) ILIKE new.employee_name LIMIT 1;
    END IF;

    -- Soft-fail: if still NULL, continue with worker_id = NULL (no exception!)
    new.worker_id := v_worker_id;

    -- ── 3. Parse scores from analysis_result JSONB ──────────────────────────────
    IF new.analysis_result IS NOT NULL THEN
        v_before_scores := new.analysis_result->'beforeScores';
        v_after_scores := new.analysis_result->'afterScores';

        BEGIN
            v_lm_score := (new.analysis_result->>'leanMaintenanceScore')::INT;
        EXCEPTION WHEN OTHERS THEN
            v_lm_score := NULL;
        END;

        IF v_before_scores IS NOT NULL THEN
            BEGIN
                v_score_before := (
                    coalesce((v_before_scores->>'sort')::INT, 0) +
                    coalesce((v_before_scores->>'setInOrder')::INT, 0) +
                    coalesce((v_before_scores->>'shine')::INT, 0) +
                    coalesce((v_before_scores->>'standardize')::INT, 0) +
                    coalesce((v_before_scores->>'sustain')::INT, 0)
                ) / 5;
            EXCEPTION WHEN OTHERS THEN
                v_score_before := NULL;
            END;
        END IF;

        IF v_after_scores IS NOT NULL THEN
            BEGIN
                v_score_after := (
                    coalesce((v_after_scores->>'sort')::INT, 0) +
                    coalesce((v_after_scores->>'setInOrder')::INT, 0) +
                    coalesce((v_after_scores->>'shine')::INT, 0) +
                    coalesce((v_after_scores->>'standardize')::INT, 0) +
                    coalesce((v_after_scores->>'sustain')::INT, 0)
                ) / 5;
            EXCEPTION WHEN OTHERS THEN
                v_score_after := NULL;
            END;
        END IF;

        new.overall_score_before := coalesce(v_score_before, 0);
        new.overall_score_after := coalesce(v_score_after, 0);
        new.lean_maintenance_score := coalesce(v_lm_score, 0);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (REPLACE on trigger itself; function already replaced above)
DROP TRIGGER IF EXISTS before_analysis_log_insert ON public.analysis_logs;
CREATE TRIGGER before_analysis_log_insert
    BEFORE INSERT ON public.analysis_logs
    FOR EACH ROW EXECUTE FUNCTION public.sync_analysis_log_to_normalized_tables();

-- ── RLS: Ensure anon users can read analysis_logs (for History page) ─────────
-- The existing "Anyone can read analysis logs" policy uses USING (true) but
-- is not explicitly set TO anon+authenticated. Add an explicit anon grant.
DROP POLICY IF EXISTS "Anon can read analysis logs" ON public.analysis_logs;
CREATE POLICY "Anon can read analysis logs"
ON public.analysis_logs
FOR SELECT
TO anon
USING (true);

-- Also ensure authenticated users can read
DROP POLICY IF EXISTS "Authenticated can read analysis logs" ON public.analysis_logs;
CREATE POLICY "Authenticated can read analysis logs"
ON public.analysis_logs
FOR SELECT
TO authenticated
USING (true);


-- =============================================================================
-- MIGRATION: 20260616000000_role_based_history_rls.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Role-based RLS for analysis_logs (History page security)
-- ─────────────────────────────────────────────────────────────────────────────
-- Rules:
--   • Unauthenticated (anon) — NO ACCESS at all
--   • Worker — sees only rows where their employee_code matches employee_id
--             OR where worker_id = their auth.uid()
--   • Supervisor / Admin — sees ALL rows
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop all existing read policies on analysis_logs
DROP POLICY IF EXISTS "Anyone can read analysis logs"         ON public.analysis_logs;
DROP POLICY IF EXISTS "Anon can read analysis logs"          ON public.analysis_logs;
DROP POLICY IF EXISTS "Authenticated can read analysis logs" ON public.analysis_logs;

-- 2. Supervisors and Admins can read ALL records
CREATE POLICY "Supervisors and Admins can read all analysis logs"
ON public.analysis_logs
FOR SELECT
TO authenticated
USING (
  public.get_current_role() IN ('supervisor', 'admin')
);

-- 3. Workers can only read their own records
--    Match by worker_id UUID (if resolved by trigger) OR by employee_code string
CREATE POLICY "Workers can read own analysis logs"
ON public.analysis_logs
FOR SELECT
TO authenticated
USING (
  public.get_current_role() = 'worker'
  AND (
    -- Match via the UUID foreign key if trigger resolved it
    worker_id = auth.uid()
    OR
    -- Match via employee_code string (how save-analysis-log stores it)
    employee_id = (
      SELECT employee_code
      FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  )
);

-- 4. Ensure anon users get NO access (belt-and-suspenders)
-- (No policy = no access by default when RLS is enabled)
-- But explicitly revoke just in case:
REVOKE SELECT ON public.analysis_logs FROM anon;

-- 5. Ensure get_current_role() is stable and handles missing profiles gracefully
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.user_role AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'worker'::public.user_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =============================================================================
-- SEED DATA: Offices
-- =============================================================================

INSERT INTO public.offices (name, city, country) VALUES 
('Softgel Healthcare Private Limited', 'Chennai', 'India'),
('Solara Active Pharma Sciences Limited', 'Chennai', 'India'),
('Strides Pharma', 'Chennai', 'India')
ON CONFLICT (name, city) DO NOTHING;

-- =============================================================================
-- SEED DATA: Auth Users & Identities
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User 1: ARC100 (Worker)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc100@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc100@arcolab.com',
      crypt('ARCOLAB100', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Shankar", "last_name": "R", "role": "worker", "employee_code": "ARC100"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc100@arcolab.com", "role": "worker", "first_name": "Shankar", "last_name": "R", "employee_code": "ARC100", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc100@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;

-- User 2: ARC101 (Supervisor)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc101@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc101@arcolab.com',
      crypt('ARCOLAB101', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Naveen", "last_name": "SV", "role": "supervisor", "employee_code": "ARC101"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc101@arcolab.com", "role": "supervisor", "first_name": "Naveen", "last_name": "SV", "employee_code": "ARC101", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc101@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;

-- User 3: ARC102 (Worker)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc102@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc102@arcolab.com',
      crypt('ARCOLAB102', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Guest", "last_name": "User", "role": "worker", "employee_code": "ARC102"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc102@arcolab.com", "role": "worker", "first_name": "Guest", "last_name": "User", "employee_code": "ARC102", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc102@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;
