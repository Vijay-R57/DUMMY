-- ============================================================
-- Phase 2: AI-Driven Audit Scoring Architecture
-- Migration: 20260629000000_phase2_ai_scoring.sql
--
-- Refinements applied:
--  1. Rich answer states (audit_answer_state enum)
--  2. Evidence stored per response
--  3. Confidence is metadata only (no scoring)
--  4. Severity levels on questions
--  5. Flexible critical rule engine (audit_critical_rules)
--  6. Template immutability (BEFORE UPDATE trigger)
--  7. Prompt versioning (audit_prompt_versions)
--  8. Remove DB scoring triggers → move to TypeScript ScoringService
--  9. Explainability via score_breakdown JSONB
-- 10. Provider-independent image gen (config only)
-- ============================================================

BEGIN;

-- ── ENUM: audit_answer_state ─────────────────────────────────────────────────
-- Replaces boolean answer. NOT_VISIBLE/NOT_APPLICABLE excluded from scoring.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_answer_state') THEN
    CREATE TYPE public.audit_answer_state AS ENUM (
      'YES',             -- clearly compliant   → full points
      'NO',              -- clearly non-compliant → 0 points
      'PARTIAL',         -- partially compliant  → 50% of max_points
      'NOT_VISIBLE',     -- element not visible in image → excluded from denominator
      'NOT_APPLICABLE'   -- question not relevant to this area → excluded entirely
    );
  END IF;
END$$;

-- ── ENUM: audit_severity ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_severity') THEN
    CREATE TYPE public.audit_severity AS ENUM (
      'CRITICAL',  -- can cap pillar score; drives highest priority recommendations
      'MAJOR',     -- significant issue; high priority recommendations
      'MINOR'      -- minor issue; standard recommendations
    );
  END IF;
END$$;

-- ── EXTEND: audit_checklist_items ────────────────────────────────────────────
-- Add severity and a stable question_id for AI prompt reference

ALTER TABLE public.audit_checklist_items
  ADD COLUMN IF NOT EXISTS severity   public.audit_severity NOT NULL DEFAULT 'MINOR',
  ADD COLUMN IF NOT EXISTS question_id TEXT;  -- e.g. 'SORT_001' — set by trigger below

-- Generate question_id from pillar + display_order for existing rows
UPDATE public.audit_checklist_items
SET question_id = UPPER(REPLACE(pillar::TEXT, '_', '')) || '_' || LPAD(display_order::TEXT, 3, '0')
WHERE question_id IS NULL;

-- Trigger to auto-generate question_id on insert if not provided
CREATE OR REPLACE FUNCTION public.set_checklist_question_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.question_id IS NULL OR NEW.question_id = '' THEN
    NEW.question_id := UPPER(REPLACE(NEW.pillar::TEXT, '_', '')) || '_' ||
                       LPAD(NEW.display_order::TEXT, 3, '0') || '_' ||
                       UPPER(SUBSTR(NEW.id::TEXT, 1, 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_checklist_question_id ON public.audit_checklist_items;
CREATE TRIGGER trg_set_checklist_question_id
  BEFORE INSERT ON public.audit_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_checklist_question_id();

-- ── EXTEND: audit_session_items ──────────────────────────────────────────────
-- Snapshot must also carry severity and question_id

ALTER TABLE public.audit_session_items
  ADD COLUMN IF NOT EXISTS severity    public.audit_severity NOT NULL DEFAULT 'MINOR',
  ADD COLUMN IF NOT EXISTS question_id TEXT;

-- ── EXTEND: audit_item_responses ─────────────────────────────────────────────
-- Replace ai_score (numeric) with ai_answer (enum) + evidence TEXT.
-- manual_score integer is KEPT for Phase 1 manual audits.
-- Confidence is stored as metadata only — never used in scoring.

-- Drop ai_score column (replaced by ai_answer enum)
ALTER TABLE public.audit_item_responses
  DROP COLUMN IF EXISTS ai_score;

ALTER TABLE public.audit_item_responses
  ADD COLUMN IF NOT EXISTS ai_answer    public.audit_answer_state,
  ADD COLUMN IF NOT EXISTS evidence     TEXT,        -- AI observation supporting the answer
  ADD COLUMN IF NOT EXISTS ai_question_id TEXT;      -- links to audit_checklist_items.question_id

-- ── REMOVE: Database scoring triggers ────────────────────────────────────────
-- Score calculation moves to TypeScript ScoringService (Refinement #8).
-- The DB only stores data; it never computes scores.

DROP TRIGGER IF EXISTS trg_response_final_score      ON public.audit_item_responses;
DROP TRIGGER IF EXISTS trg_recalculate_session_score ON public.audit_item_responses;
DROP FUNCTION IF EXISTS public.set_response_final_score();
DROP FUNCTION IF EXISTS public.recalculate_session_score();

-- Keep final_score column for backward compat with manual audit Phase 1 reads.
-- ScoringService writes the computed value here after calculation.

-- ── EXTEND: audit_session_items snapshot — carry severity ────────────────────
-- Update existing snapshot trigger to also copy severity + question_id

CREATE OR REPLACE FUNCTION public.snapshot_checklist_items()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_session_items (
        audit_session_id,
        original_checklist_item_id,
        pillar,
        question_text,
        description,
        max_points,
        weight,
        display_order,
        is_mandatory,
        severity,
        question_id
    )
    SELECT
        NEW.id,
        id,
        pillar,
        question_text,
        description,
        max_points,
        weight,
        display_order,
        is_mandatory,
        severity,
        question_id
    FROM public.audit_checklist_items
    WHERE template_id = NEW.template_id
    ORDER BY pillar, display_order;

    -- Initialise max_score from the template (ScoringService will recalculate)
    UPDATE public.audit_sessions
    SET max_score  = (
            SELECT COALESCE(SUM(max_points * weight), 0)
            FROM public.audit_checklist_items
            WHERE template_id = NEW.template_id
        ),
        updated_at = now()
    WHERE id = NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── EXTEND: audit_sessions ───────────────────────────────────────────────────
-- Add AI pipeline metadata and explainability storage

ALTER TABLE public.audit_sessions
  ADD COLUMN IF NOT EXISTS score_breakdown        JSONB,          -- PillarScoreResult[] from ScoringService
  ADD COLUMN IF NOT EXISTS generated_after_image_url TEXT,        -- URL of AI-generated "After" image
  ADD COLUMN IF NOT EXISTS improvement_prompt     TEXT,           -- Prompt used to generate after image
  ADD COLUMN IF NOT EXISTS prompt_version_id      UUID,           -- FK → audit_prompt_versions.id
  ADD COLUMN IF NOT EXISTS vision_model_used      TEXT,           -- e.g. 'gemini-1.5-pro-vision'
  ADD COLUMN IF NOT EXISTS prompt_schema_version  TEXT,           -- e.g. '2.0'
  ADD COLUMN IF NOT EXISTS before_image_url       TEXT,           -- stored image URL (before)
  ADD COLUMN IF NOT EXISTS analysis_mode          TEXT NOT NULL DEFAULT 'MANUAL';
                                                                  -- 'MANUAL' | 'AI_ASSISTED' | 'FULL_AI'

-- ── TABLE: audit_prompt_versions ─────────────────────────────────────────────
-- Stores versioned AI prompts. Every session FKs to the exact prompt used.

CREATE TABLE IF NOT EXISTS public.audit_prompt_versions (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_type     TEXT          NOT NULL,  -- 'VISION_AUDIT' | 'RECOMMENDATIONS' | 'IMAGE_PROMPT' | 'AFTER_VALIDATION'
  version         TEXT          NOT NULL DEFAULT '1.0',
  vision_model    TEXT          NOT NULL DEFAULT 'gemini-1.5-pro',
  temperature     NUMERIC(3,2)  NOT NULL DEFAULT 0.10,
  schema_version  TEXT          NOT NULL DEFAULT '1.0',
  prompt_text     TEXT          NOT NULL,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT unique_active_prompt_type UNIQUE (prompt_type, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_type_active
  ON public.audit_prompt_versions(prompt_type, is_active) WHERE is_active = true;

-- Add FK constraint (deferred to avoid ordering issues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_prompt_version'
  ) THEN
    ALTER TABLE public.audit_sessions
      ADD CONSTRAINT fk_sessions_prompt_version
      FOREIGN KEY (prompt_version_id) REFERENCES public.audit_prompt_versions(id) ON DELETE SET NULL;
  END IF;
END$$;


-- ── TABLE: audit_critical_rules ──────────────────────────────────────────────
-- Flexible rule engine for score caps. Stored in DB — zero code changes needed.

CREATE TABLE IF NOT EXISTS public.audit_critical_rules (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id         UUID          REFERENCES public.audit_templates(id) ON DELETE CASCADE,
  checklist_item_id   UUID          REFERENCES public.audit_checklist_items(id) ON DELETE CASCADE,
  pillar              public.audit_pillar NOT NULL,
  trigger_answer      public.audit_answer_state NOT NULL DEFAULT 'NO',
  -- score_cap: maximum percentage (0–100) allowed for the pillar when rule triggers
  score_cap           NUMERIC(5,2)  NOT NULL,
  description         TEXT,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT valid_score_cap CHECK (score_cap >= 0 AND score_cap <= 100)
);

CREATE INDEX IF NOT EXISTS idx_critical_rules_template_id
  ON public.audit_critical_rules(template_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_critical_rules_item_id
  ON public.audit_critical_rules(checklist_item_id);

-- ── TABLE: audit_recommendations ─────────────────────────────────────────────
-- AI-generated recommendations stored per session

CREATE TABLE IF NOT EXISTS public.audit_recommendations (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_session_id UUID          NOT NULL REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
  pillar           public.audit_pillar NOT NULL,
  severity         public.audit_severity NOT NULL DEFAULT 'MINOR',
  priority         INT           NOT NULL DEFAULT 3,  -- 1=highest, 5=lowest
  title            TEXT          NOT NULL,
  description      TEXT          NOT NULL,
  root_cause       TEXT,
  corrective_action TEXT,
  linked_question_id TEXT,       -- references audit_checklist_items.question_id
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_session_id
  ON public.audit_recommendations(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_severity
  ON public.audit_recommendations(audit_session_id, severity, priority);

-- ── RLS: New tables ───────────────────────────────────────────────────────────

ALTER TABLE public.audit_prompt_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_critical_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_recommendations  ENABLE ROW LEVEL SECURITY;

-- Prompt versions: read-only for all authenticated
DROP POLICY IF EXISTS "Read prompt versions" ON public.audit_prompt_versions;
CREATE POLICY "Read prompt versions"
  ON public.audit_prompt_versions FOR SELECT TO authenticated USING (true);

-- Critical rules: read-only for all authenticated
DROP POLICY IF EXISTS "Read critical rules" ON public.audit_critical_rules;
CREATE POLICY "Read critical rules"
  ON public.audit_critical_rules FOR SELECT TO authenticated USING (true);

-- Recommendations: follow session ownership
DROP POLICY IF EXISTS "Read own recommendations" ON public.audit_recommendations;
CREATE POLICY "Read own recommendations"
  ON public.audit_recommendations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_sessions s
      WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insert own recommendations" ON public.audit_recommendations;
CREATE POLICY "Insert own recommendations"
  ON public.audit_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audit_sessions s
      WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
    )
  );

-- ── TRIGGER: Template Immutability (Refinement #6) ───────────────────────────
-- Active templates cannot be structurally modified. Only status changes allowed.

CREATE OR REPLACE FUNCTION public.enforce_template_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status changes (ACTIVE → DEPRECATED/ARCHIVED) and updated_at
  IF OLD.status = 'ACTIVE' AND (
    NEW.name            IS DISTINCT FROM OLD.name    OR
    NEW.description     IS DISTINCT FROM OLD.description OR
    NEW.version         IS DISTINCT FROM OLD.version OR
    NEW.is_default      IS DISTINCT FROM OLD.is_default
  ) THEN
    RAISE EXCEPTION
      'ARCOLAB-IMMUTABLE: Active audit template "%" (id: %) cannot be modified. '
      'Create a new template version instead.',
      OLD.name, OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_template_immutability ON public.audit_templates;
CREATE TRIGGER trg_template_immutability
  BEFORE UPDATE ON public.audit_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_template_immutability();

-- ── SEED: Default AI Prompt Versions ─────────────────────────────────────────

DO $$
BEGIN
  -- Vision Audit Prompt v1.0
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_prompt_versions
    WHERE prompt_type = 'VISION_AUDIT' AND version = '1.0'
  ) THEN
    INSERT INTO public.audit_prompt_versions
      (prompt_type, version, vision_model, temperature, schema_version, prompt_text, is_active)
    VALUES (
      'VISION_AUDIT',
      '1.0',
      'gemini-1.5-pro',
      0.10,
      '2.0',
      'You are a certified industrial 5S workplace auditor. Analyze the provided workplace image and answer ONLY the questions listed below for the {PILLAR} pillar. You must respond with a valid JSON array only — no markdown, no prose, no scores, no percentages. For each question, provide: question_id (string), answer (one of: YES/NO/PARTIAL/NOT_VISIBLE/NOT_APPLICABLE), confidence (number 0.0-1.0), evidence (one concise observation sentence describing exactly what you see that justifies your answer). Use NOT_VISIBLE if the relevant area/object is outside the camera frame or obscured. Use NOT_APPLICABLE if the question clearly does not apply to this type of workspace. Never assign numeric scores. Never calculate percentages. You are only observing and answering.',
      true
    );
  END IF;

  -- Recommendations Prompt v1.0
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_prompt_versions
    WHERE prompt_type = 'RECOMMENDATIONS' AND version = '1.0'
  ) THEN
    INSERT INTO public.audit_prompt_versions
      (prompt_type, version, vision_model, temperature, schema_version, prompt_text, is_active)
    VALUES (
      'RECOMMENDATIONS',
      '1.0',
      'gemini-1.5-pro',
      0.30,
      '2.0',
      'You are a 5S continuous improvement consultant. Based on the following audit findings (list of failed/partial checklist items with their evidence), generate actionable improvement recommendations. Respond with a valid JSON array only. Each item must have: pillar (string), severity (CRITICAL/MAJOR/MINOR), priority (integer 1-5, 1=highest), title (short action title), description (detailed description), root_cause (why this issue likely exists), corrective_action (specific steps to fix it), linked_question_id (the question_id this addresses). Never assign scores. Focus only on observations and corrective actions.',
      true
    );
  END IF;

  -- Image Prompt Generator v1.0
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_prompt_versions
    WHERE prompt_type = 'IMAGE_PROMPT' AND version = '1.0'
  ) THEN
    INSERT INTO public.audit_prompt_versions
      (prompt_type, version, vision_model, temperature, schema_version, prompt_text, is_active)
    VALUES (
      'IMAGE_PROMPT',
      '1.0',
      'gemini-1.5-pro',
      0.40,
      '2.0',
      'You are an industrial workplace design expert. Based on the 5S audit findings below, write a detailed image generation prompt describing an idealized, fully 5S-compliant version of the same workspace. The prompt should describe: organized tools in labeled shadow boards, clean floors, clear walkway markings, proper storage systems, visual management boards, and zero clutter. The generated image should look realistic and photographable, like a professional industrial photograph. Output only the image generation prompt text — nothing else.',
      true
    );
  END IF;
END$$;

-- ── SEED: Critical Rules for default template ─────────────────────────────────

DO $$
DECLARE
  v_template_id  UUID;
  v_item_id      UUID;
BEGIN
  -- Get default template
  SELECT id INTO v_template_id FROM public.audit_templates WHERE is_default = true LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    -- Rule: Blocked aisles/walkways → cap SET_IN_ORDER at 50%
    SELECT id INTO v_item_id
    FROM public.audit_checklist_items
    WHERE template_id = v_template_id
      AND pillar = 'SORT'
      AND question_text ILIKE '%aisles%walkways%'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.audit_checklist_items SET severity = 'CRITICAL' WHERE id = v_item_id;
      INSERT INTO public.audit_critical_rules
        (template_id, checklist_item_id, pillar, trigger_answer, score_cap, description)
      VALUES
        (v_template_id, v_item_id, 'SET_IN_ORDER', 'NO', 50.00,
         'Blocked aisles are a safety hazard. Set-in-Order score capped at 50% until resolved.')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Rule: Cleaning schedules not posted → cap SHINE at 60%
    SELECT id INTO v_item_id
    FROM public.audit_checklist_items
    WHERE template_id = v_template_id
      AND pillar = 'SHINE'
      AND question_text ILIKE '%cleaning schedule%'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.audit_checklist_items SET severity = 'MAJOR' WHERE id = v_item_id;
    END IF;

    -- Rule: Safety markings not visible → cap STANDARDIZE at 40%
    SELECT id INTO v_item_id
    FROM public.audit_checklist_items
    WHERE template_id = v_template_id
      AND pillar = 'STANDARDIZE'
      AND question_text ILIKE '%safety marking%'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.audit_checklist_items SET severity = 'CRITICAL' WHERE id = v_item_id;
      INSERT INTO public.audit_critical_rules
        (template_id, checklist_item_id, pillar, trigger_answer, score_cap, description)
      VALUES
        (v_template_id, v_item_id, 'STANDARDIZE', 'NO', 40.00,
         'Missing safety markings are a compliance violation. Standardize score capped at 40%.')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END$$;

COMMIT;
