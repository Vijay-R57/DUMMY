-- ============================================================
-- Phase 2A.1: Custom Rules Table
-- Migration: 20260701000000_phase2a1_custom_rules.sql
-- ============================================================
-- Adds the audit_custom_rules table for Tier 2 of the hybrid Rule Engine.
-- Organisation-specific compliance rules that load at runtime without
-- requiring a function redeployment.
-- ============================================================

BEGIN;

-- ── 1. Create audit_custom_rules table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_custom_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: which template these rules apply to
  template_id     UUID        NOT NULL
                  REFERENCES  public.audit_templates(id) ON DELETE CASCADE,

  -- Unique rule identifier (stable, never change after production deploy)
  rule_id         TEXT        NOT NULL,

  -- Optional pillar filter (NULL = applies to all pillars)
  pillar          public.audit_pillar,

  -- Optional category filter (NULL = applies to all categories)
  category        TEXT,

  -- JSON-serialised condition descriptor.
  -- Supported types: has_hazard | has_obstruction | cleanliness | floor_markings |
  --                  labels_visible | storage_present | no_detected_objects |
  --                  safety_equipment_absent | non_compliant_count_gte
  -- Example: { "type": "cleanliness", "value": "DIRTY" }
  condition_json  JSONB       NOT NULL,

  -- The deterministic answer this rule produces when condition is met
  answer          TEXT        NOT NULL
                  CHECK (answer IN ('YES','NO','PARTIAL','NOT_VISIBLE','NOT_APPLICABLE')),

  -- Confidence level for this rule's answer (0.00–1.00)
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.95
                  CHECK (confidence BETWEEN 0 AND 1),

  -- Human-readable explanation stored in audit trace
  rationale       TEXT,

  -- Enable/disable without deleting
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup per template (called on every audit)
CREATE INDEX IF NOT EXISTS idx_custom_rules_template_active
  ON public.audit_custom_rules (template_id, is_active)
  WHERE is_active = true;

-- Optional filter by pillar
CREATE INDEX IF NOT EXISTS idx_custom_rules_template_pillar
  ON public.audit_custom_rules (template_id, pillar)
  WHERE is_active = true;

-- ── 3. Row-Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.audit_custom_rules ENABLE ROW LEVEL SECURITY;

-- Edge functions (service role) can manage all rules
CREATE POLICY "Service role can manage custom rules"
  ON public.audit_custom_rules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read active rules
CREATE POLICY "Authenticated users can read custom rules"
  ON public.audit_custom_rules
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ── 4. Updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_custom_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_custom_rules_updated_at
  BEFORE UPDATE ON public.audit_custom_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_custom_rules_updated_at();

COMMIT;
