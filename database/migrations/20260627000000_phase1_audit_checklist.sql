-- ============================================================
-- Phase 1: Industrial 5S Audit Checklist Module
-- Migration: 20260627000000_phase1_audit_checklist.sql
-- Apply via Supabase SQL Editor
--
-- NOTE: This migration is self-contained. Foreign key references
-- to profiles / areas / analysis_logs are stored as plain UUID
-- columns so the Audit module works even before the main app
-- schema is applied to this Supabase project.
-- ============================================================

BEGIN;

-- ── ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_pillar') THEN
    CREATE TYPE public.audit_pillar AS ENUM (
      'SORT',
      'SET_IN_ORDER',
      'SHINE',
      'STANDARDIZE',
      'SUSTAIN'
    );
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status') THEN
    CREATE TYPE public.audit_status AS ENUM (
      'DRAFT',
      'IN_PROGRESS',
      'UNDER_REVIEW',
      'COMPLETED',
      'ARCHIVED'
    );
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_status') THEN
    CREATE TYPE public.template_status AS ENUM (
      'ACTIVE',
      'DEPRECATED',
      'ARCHIVED'
    );
  END IF;
END$$;

-- ── TABLE: audit_templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_templates (
    id            UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name          TEXT          NOT NULL,
    description   TEXT,
    version       TEXT          NOT NULL DEFAULT '1.0',
    status        public.template_status NOT NULL DEFAULT 'ACTIVE',
    is_default    BOOLEAN       NOT NULL DEFAULT false,
    -- created_by references auth.users UUID (no FK so this works standalone)
    created_by    UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_templates_status
    ON public.audit_templates(status);
CREATE INDEX IF NOT EXISTS idx_audit_templates_is_default
    ON public.audit_templates(is_default) WHERE is_default = true;

-- ── TABLE: audit_checklist_items ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_checklist_items (
    id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id    UUID        NOT NULL REFERENCES public.audit_templates(id) ON DELETE CASCADE,
    pillar         public.audit_pillar NOT NULL,
    question_text  TEXT        NOT NULL,
    description    TEXT,
    max_points     INT         NOT NULL DEFAULT 4
                               CONSTRAINT valid_max_points CHECK (max_points IN (1,2,3,4,5)),
    weight         NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    display_order  INT         NOT NULL DEFAULT 0,
    is_mandatory   BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template_id
    ON public.audit_checklist_items(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_pillar
    ON public.audit_checklist_items(template_id, pillar);

-- ── TABLE: audit_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_sessions (
    id                UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    -- audit_number is auto-generated via trigger; stored for report printing
    audit_number      TEXT,
    template_id       UUID          NOT NULL REFERENCES public.audit_templates(id),
    -- Snapshots — survive template edits / org restructuring
    template_name     TEXT          NOT NULL,
    template_version  TEXT          NOT NULL,
    -- auditor_id = auth.users UUID (plain UUID, no FK to keep standalone)
    auditor_id        UUID          NOT NULL,
    auditor_name      TEXT          NOT NULL,
    -- area_id / analysis_log_id are optional references (no FK enforcement here)
    area_id           UUID,
    area_name         TEXT,
    department_name   TEXT,
    plant_name        TEXT,
    analysis_log_id   UUID,
    audit_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    status            public.audit_status NOT NULL DEFAULT 'DRAFT',
    total_score       NUMERIC(8,2)  NOT NULL DEFAULT 0,
    max_score         NUMERIC(8,2)  NOT NULL DEFAULT 0,
    percentage        NUMERIC(5,2)  GENERATED ALWAYS AS (
                          CASE WHEN max_score > 0
                               THEN ROUND((total_score / max_score) * 100, 2)
                               ELSE 0 END
                      ) STORED,
    notes             TEXT,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_auditor_id
    ON public.audit_sessions(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status
    ON public.audit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_audit_date
    ON public.audit_sessions(audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_template_id
    ON public.audit_sessions(template_id);

-- ── TABLE: audit_session_items (immutable checklist snapshot per session) ─────

CREATE TABLE IF NOT EXISTS public.audit_session_items (
    id                          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_session_id            UUID        NOT NULL
                                            REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
    -- original_checklist_item_id for traceability; nullable if item was deleted
    original_checklist_item_id  UUID
                                REFERENCES public.audit_checklist_items(id) ON DELETE SET NULL,
    pillar                      public.audit_pillar NOT NULL,
    question_text               TEXT        NOT NULL,
    description                 TEXT,
    max_points                  INT         NOT NULL DEFAULT 4,
    weight                      NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    display_order               INT         NOT NULL DEFAULT 0,
    is_mandatory                BOOLEAN     NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_items_session_id
    ON public.audit_session_items(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_pillar
    ON public.audit_session_items(audit_session_id, pillar);

-- ── TABLE: audit_item_responses ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_item_responses (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_session_id     UUID        NOT NULL
                                     REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
    session_item_id      UUID        NOT NULL
                                     REFERENCES public.audit_session_items(id) ON DELETE CASCADE,
    -- Phase 1: manual_score → final_score
    -- Phase 2: ai_score + reviewer override → final_score
    manual_score         INT         CONSTRAINT valid_manual_score CHECK (manual_score BETWEEN 0 AND 5),
    ai_score             NUMERIC(4,2),          -- Phase 2: AI-generated score
    final_score          NUMERIC(4,2),          -- computed by trigger (Phase 1 = manual_score)
    confidence           NUMERIC(4,2),          -- Phase 2: AI confidence 0–1
    ai_reason            TEXT,                  -- Phase 2: AI explanation
    reviewer_comment     TEXT,                  -- Phase 2+: supervisor override note
    notes                TEXT,                  -- auditor observation
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_response_per_item UNIQUE (audit_session_id, session_item_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_session_id
    ON public.audit_item_responses(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_responses_session_item
    ON public.audit_item_responses(session_item_id);

-- ── TRIGGER: Phase 1 — final_score = manual_score ────────────────────────────

CREATE OR REPLACE FUNCTION public.set_response_final_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.final_score := COALESCE(NEW.manual_score, 0);
    NEW.updated_at  := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_response_final_score ON public.audit_item_responses;
CREATE TRIGGER trg_response_final_score
    BEFORE INSERT OR UPDATE ON public.audit_item_responses
    FOR EACH ROW EXECUTE FUNCTION public.set_response_final_score();

-- ── TRIGGER: recalculate session score after each response upsert ─────────────

CREATE OR REPLACE FUNCTION public.recalculate_session_score()
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
    v_total      NUMERIC(8,2);
    v_max        NUMERIC(8,2);
BEGIN
    v_session_id := COALESCE(NEW.audit_session_id, OLD.audit_session_id);

    SELECT
        COALESCE(SUM(r.final_score * si.weight), 0),
        COALESCE(SUM(si.max_points * si.weight), 0)
    INTO v_total, v_max
    FROM public.audit_session_items si
    LEFT JOIN public.audit_item_responses r
        ON r.session_item_id = si.id
       AND r.audit_session_id = si.audit_session_id
    WHERE si.audit_session_id = v_session_id;

    UPDATE public.audit_sessions
    SET total_score = v_total,
        max_score   = v_max,
        updated_at  = now()
    WHERE id = v_session_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalculate_session_score ON public.audit_item_responses;
CREATE TRIGGER trg_recalculate_session_score
    AFTER INSERT OR UPDATE OR DELETE ON public.audit_item_responses
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_session_score();

-- ── TRIGGER: updated_at ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.audit_templates;
CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON public.audit_templates
    FOR EACH ROW EXECUTE FUNCTION public.audit_touch_updated_at();

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON public.audit_sessions;
CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON public.audit_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_touch_updated_at();

-- ── TRIGGER: snapshot checklist items on new session ─────────────────────────

CREATE OR REPLACE FUNCTION public.snapshot_checklist_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Copy every item from the template into audit_session_items
    INSERT INTO public.audit_session_items (
        audit_session_id,
        original_checklist_item_id,
        pillar,
        question_text,
        description,
        max_points,
        weight,
        display_order,
        is_mandatory
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
        is_mandatory
    FROM public.audit_checklist_items
    WHERE template_id = NEW.template_id
    ORDER BY pillar, display_order;

    -- Initialise max_score from the template immediately
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

DROP TRIGGER IF EXISTS trg_snapshot_checklist_items ON public.audit_sessions;
CREATE TRIGGER trg_snapshot_checklist_items
    AFTER INSERT ON public.audit_sessions
    FOR EACH ROW EXECUTE FUNCTION public.snapshot_checklist_items();

-- ── TRIGGER: set_audit_session_number ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_audit_session_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.audit_number := 'AUD-' || TO_CHAR(COALESCE(NEW.created_at, now()), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::TEXT, 1, 6));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_audit_session_number ON public.audit_sessions;
CREATE TRIGGER trg_set_audit_session_number
    BEFORE INSERT ON public.audit_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_audit_session_number();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_session_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_item_responses  ENABLE ROW LEVEL SECURITY;

-- Templates: all authenticated users can read
DROP POLICY IF EXISTS "Authenticated can read templates" ON public.audit_templates;
CREATE POLICY "Authenticated can read templates"
    ON public.audit_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can manage templates" ON public.audit_templates;
CREATE POLICY "Authenticated can manage templates"
    ON public.audit_templates FOR ALL TO authenticated USING (true);

-- Checklist items: all authenticated users can read
DROP POLICY IF EXISTS "Authenticated can read checklist items" ON public.audit_checklist_items;
CREATE POLICY "Authenticated can read checklist items"
    ON public.audit_checklist_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can manage checklist items" ON public.audit_checklist_items;
CREATE POLICY "Authenticated can manage checklist items"
    ON public.audit_checklist_items FOR ALL TO authenticated USING (true);

-- Sessions: users see their own (auditor_id = their auth.uid())
DROP POLICY IF EXISTS "Users can view own sessions" ON public.audit_sessions;
CREATE POLICY "Users can view own sessions"
    ON public.audit_sessions FOR SELECT TO authenticated
    USING (auditor_id = auth.uid());

DROP POLICY IF EXISTS "Users can create sessions" ON public.audit_sessions;
CREATE POLICY "Users can create sessions"
    ON public.audit_sessions FOR INSERT TO authenticated
    WITH CHECK (auditor_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sessions" ON public.audit_sessions;
CREATE POLICY "Users can update own sessions"
    ON public.audit_sessions FOR UPDATE TO authenticated
    USING (auditor_id = auth.uid());

-- Session items: follow session visibility
DROP POLICY IF EXISTS "Session items follow session" ON public.audit_session_items;
CREATE POLICY "Session items follow session"
    ON public.audit_session_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.audit_sessions s
            WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
        )
    );

-- Responses: follow session visibility
DROP POLICY IF EXISTS "Responses select" ON public.audit_item_responses;
CREATE POLICY "Responses select"
    ON public.audit_item_responses FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.audit_sessions s
            WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Responses insert" ON public.audit_item_responses;
CREATE POLICY "Responses insert"
    ON public.audit_item_responses FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.audit_sessions s
            WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Responses update" ON public.audit_item_responses;
CREATE POLICY "Responses update"
    ON public.audit_item_responses FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.audit_sessions s
            WHERE s.id = audit_session_id AND s.auditor_id = auth.uid()
        )
    );

-- ── SEED: Default Template ────────────────────────────────────────────────────

DO $$
DECLARE
    v_template_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.audit_templates WHERE is_default = true) THEN

        INSERT INTO public.audit_templates (name, description, version, status, is_default)
        VALUES (
            'Industrial Standard 5S Audit',
            'Comprehensive 5S audit template based on industry best practices. Contains 25 standard checklist items across all five 5S pillars.',
            '1.0',
            'ACTIVE',
            true
        )
        RETURNING id INTO v_template_id;

        -- ── SORT ──────────────────────────────────────────────────────────
        INSERT INTO public.audit_checklist_items
            (template_id, pillar, question_text, description, max_points, weight, display_order)
        VALUES
        (v_template_id, 'SORT', 'Are unnecessary items removed from the work area?',
         'Check for tools, materials, or equipment not needed for current work.', 4, 1.00, 1),
        (v_template_id, 'SORT', 'Is there a clear red-tag system for unneeded items?',
         'Verify red-tag or similar disposal tagging process is in place.', 4, 1.00, 2),
        (v_template_id, 'SORT', 'Are aisles and walkways free from obstructions?',
         'All emergency and operational pathways must be unobstructed.', 4, 1.20, 3),
        (v_template_id, 'SORT', 'Are only required quantities of materials present at the station?',
         'Excess inventory should not accumulate at workstations.', 4, 1.00, 4),
        (v_template_id, 'SORT', 'Are expired or defective items segregated and labeled?',
         'Non-conforming materials must be visually identified and quarantined.', 4, 1.10, 5);

        -- ── SET IN ORDER ──────────────────────────────────────────────────
        INSERT INTO public.audit_checklist_items
            (template_id, pillar, question_text, description, max_points, weight, display_order)
        VALUES
        (v_template_id, 'SET_IN_ORDER', 'Does every item have a designated, labeled storage location?',
         'Shadow boards, floor markings, or labels must be present.', 4, 1.00, 1),
        (v_template_id, 'SET_IN_ORDER', 'Are tools and equipment stored at the point of use?',
         'Frequently used tools must be closest to the operator.', 4, 1.00, 2),
        (v_template_id, 'SET_IN_ORDER', 'Are storage locations clearly marked with visual indicators?',
         'Color-coding, signage, and floor tape are in good condition.', 4, 1.00, 3),
        (v_template_id, 'SET_IN_ORDER', 'Is there a visual system to identify when items are missing?',
         'Silhouettes, labels, or quantity indicators must be present.', 4, 1.00, 4),
        (v_template_id, 'SET_IN_ORDER', 'Are items returned to their designated location after use?',
         'Items must not be found outside their designated area.', 4, 1.10, 5);

        -- ── SHINE ─────────────────────────────────────────────────────────
        INSERT INTO public.audit_checklist_items
            (template_id, pillar, question_text, description, max_points, weight, display_order)
        VALUES
        (v_template_id, 'SHINE', 'Is the work area floor clean and free of debris, oil, or water?',
         'No spills, dirt, or obstacles on floor surfaces.', 4, 1.20, 1),
        (v_template_id, 'SHINE', 'Are machines and equipment surfaces clean and properly maintained?',
         'Equipment must be wiped down regularly with no visible grime.', 4, 1.00, 2),
        (v_template_id, 'SHINE', 'Are cleaning schedules posted and being followed?',
         'Cleaning log or schedule must be visible and up to date.', 4, 1.00, 3),
        (v_template_id, 'SHINE', 'Are cleaning tools and supplies properly stored and available?',
         'Mops, brooms, and supplies are in designated locations.', 4, 1.00, 4),
        (v_template_id, 'SHINE', 'Are waste bins available, labeled, and emptied regularly?',
         'Bins must not be overflowing and must be correctly labeled.', 4, 1.00, 5);

        -- ── STANDARDIZE ───────────────────────────────────────────────────
        INSERT INTO public.audit_checklist_items
            (template_id, pillar, question_text, description, max_points, weight, display_order)
        VALUES
        (v_template_id, 'STANDARDIZE', 'Are 5S standards documented and visible at the workstation?',
         'Visual standard sheets, work instructions, or SOPs must be posted.', 4, 1.00, 1),
        (v_template_id, 'STANDARDIZE', 'Is color-coding consistently applied across all areas?',
         'Consistent color scheme for safety, zones, and storage categories.', 4, 1.00, 2),
        (v_template_id, 'STANDARDIZE', 'Are workstation layouts uniform and consistent across shifts?',
         'Layouts must not change between shift handovers.', 4, 1.00, 3),
        (v_template_id, 'STANDARDIZE', 'Are visual controls (andon, kanban, status boards) maintained?',
         'All visual management tools are up to date and functional.', 4, 1.10, 4),
        (v_template_id, 'STANDARDIZE', 'Are safety markings and hazard identifications clearly visible?',
         'All safety labels, floor markings, and warning signs are intact.', 4, 1.20, 5);

        -- ── SUSTAIN ───────────────────────────────────────────────────────
        INSERT INTO public.audit_checklist_items
            (template_id, pillar, question_text, description, max_points, weight, display_order)
        VALUES
        (v_template_id, 'SUSTAIN', 'Is a regular 5S audit schedule established and followed?',
         'Audit calendar or schedule must be visible and adhered to.', 4, 1.00, 1),
        (v_template_id, 'SUSTAIN', 'Are 5S results communicated and displayed on team boards?',
         'Audit scores and trends must be visible to all team members.', 4, 1.00, 2),
        (v_template_id, 'SUSTAIN', 'Are employees trained and aware of 5S responsibilities?',
         'Workers should be able to explain their 5S duties.', 4, 1.00, 3),
        (v_template_id, 'SUSTAIN', 'Are corrective actions from previous audits closed out?',
         'Prior audit findings must have documented closure evidence.', 4, 1.20, 4),
        (v_template_id, 'SUSTAIN', 'Is management actively involved in supporting 5S activities?',
         'Leadership gemba walks, recognition, or support is documented.', 4, 1.10, 5);

    END IF;
END$$;

COMMIT;
