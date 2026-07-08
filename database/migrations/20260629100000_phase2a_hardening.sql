-- ============================================================
-- Phase 2A: Production Hardening & Analytics Readiness
-- Migration: 20260629100000_phase2a_hardening.sql
-- ============================================================

BEGIN;

-- ── 1. EXTEND SCHEMA ─────────────────────────────────────────────────────────

-- Template Hierarchy
ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS industry       TEXT,
  ADD COLUMN IF NOT EXISTS department     TEXT,
  ADD COLUMN IF NOT EXISTS workspace_type TEXT;

-- Question Categories
ALTER TABLE public.audit_checklist_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

ALTER TABLE public.audit_session_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

-- Workspace Context, Confidence and Analytics Report
ALTER TABLE public.audit_sessions
  ADD COLUMN IF NOT EXISTS industry               TEXT,
  ADD COLUMN IF NOT EXISTS department             TEXT,
  ADD COLUMN IF NOT EXISTS workspace_type         TEXT,
  ADD COLUMN IF NOT EXISTS expected_equipment     TEXT,
  ADD COLUMN IF NOT EXISTS expected_safety_assets TEXT,
  ADD COLUMN IF NOT EXISTS audit_confidence       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS explainability_report  JSONB;

-- Audit Reasoning Metadata
ALTER TABLE public.audit_item_responses
  ADD COLUMN IF NOT EXISTS reasoning   TEXT,
  ADD COLUMN IF NOT EXISTS observation TEXT;

-- ── 2. UPDATE SNAPSHOT TRIGGER ───────────────────────────────────────────────

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
        question_id,
        category
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
        question_id,
        category
    FROM public.audit_checklist_items
    WHERE template_id = NEW.template_id
    ORDER BY pillar, display_order;

    -- Initialise max_score from the template
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

-- ── 3. SEED HIERARCHICAL TEMPLATES ───────────────────────────────────────────

-- Helper function to seed questions easily
CREATE OR REPLACE FUNCTION public.seed_audit_question(
  p_template_id UUID,
  p_pillar public.audit_pillar,
  p_category TEXT,
  p_q_id TEXT,
  p_text TEXT,
  p_desc TEXT,
  p_order INT,
  p_severity public.audit_severity DEFAULT 'MINOR'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_checklist_items (
    template_id, pillar, category, question_id, question_text, description, max_points, weight, display_order, severity, is_mandatory
  ) VALUES (
    p_template_id, p_pillar, p_category, p_q_id, p_text, p_desc, 4, 1.00, p_order, p_severity, true
  );
END;
$$ LANGUAGE plpgsql;

-- Seed Templates DO block
DO $$
DECLARE
  v_assembly_id UUID;
  v_cnc_id      UUID;
  v_wh_id       UUID;
  v_office_id   UUID;
  v_lab_id      UUID;
  v_maint_id    UUID;
BEGIN
  -- Clear any existing seeded hierarchical templates to prevent duplicate violations on rerun
  DELETE FROM public.audit_templates WHERE industry IN ('Manufacturing', 'Warehouse', 'Office', 'Laboratory', 'Maintenance');

  -- ── TEMPLATE 1: Manufacturing Assembly Line ─────────────────────────────────
  INSERT INTO public.audit_templates (name, description, version, status, is_default, industry, department, workspace_type)
  VALUES (
    'Manufacturing Assembly Line Template',
    'Specialized 5S audit checklist tailored for manual and semi-automated assembly line areas.',
    '1.0', 'ACTIVE', false, 'Manufacturing', 'Assembly', 'Assembly Line'
  ) RETURNING id INTO v_assembly_id;

  -- SORT
  PERFORM public.seed_audit_question(v_assembly_id, 'SORT', 'Clutter', 'ASM_SRT_01', 'Are raw materials and assembly components sorted with clear boundary separation?', 'Check for unneeded clutter on assembly workstations.', 1);
  PERFORM public.seed_audit_question(v_assembly_id, 'SORT', 'Waste', 'ASM_SRT_02', 'Are empty bins, packing boxes, and protective plastics removed from assembly tables?', 'Prevent packing waste from taking up active workbench space.', 2);
  PERFORM public.seed_audit_question(v_assembly_id, 'SORT', 'Inventory', 'ASM_SRT_03', 'Is inventory at the assembly station limited to the current production shift requirements?', 'Excess parts should not restrict movement.', 3, 'MAJOR');
  PERFORM public.seed_audit_question(v_assembly_id, 'SORT', 'Obstructions', 'ASM_SRT_04', 'Are pedestrian walkways and assembly line pathways completely free of obstructions?', 'Ensure zero safety hazards along pathways.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_assembly_id, 'SORT', 'Waste', 'ASM_SRT_05', 'Are scrap metal, cut wires, or rejected materials segregated and put in designated scrap bins?', 'Ensure immediate disposal of raw waste.', 5);

  -- SET IN ORDER
  PERFORM public.seed_audit_question(v_assembly_id, 'SET_IN_ORDER', 'Tool Organization', 'ASM_ORD_01', 'Are hand tools, torque wrenches, and jigs stored in labeled shadow boards?', 'Check for tool outlines and labels.', 1, 'MAJOR');
  PERFORM public.seed_audit_question(v_assembly_id, 'SET_IN_ORDER', 'Labels', 'ASM_ORD_02', 'Are all parts bins clearly labeled with component codes and barcodes?', 'Visual check for barcode readability and correct labeling.', 2);
  PERFORM public.seed_audit_question(v_assembly_id, 'SET_IN_ORDER', 'Floor Markings', 'ASM_ORD_03', 'Are floor lanes for assembly carts, AGVs, and workers clearly marked with lines?', 'Check tape condition and lane continuity.', 3);
  PERFORM public.seed_audit_question(v_assembly_id, 'SET_IN_ORDER', 'Storage', 'ASM_ORD_04', 'Are workstations, cabinets, and storage shelves labeled with their contents?', 'Verify shelf layouts match labels.', 4);
  PERFORM public.seed_audit_question(v_assembly_id, 'SET_IN_ORDER', 'Tool Organization', 'ASM_ORD_05', 'Is there a dedicated layout spot for pneumatic lines and electrical cables?', 'Keep cables off floors and benches to prevent tripping.', 5);

  -- SHINE
  PERFORM public.seed_audit_question(v_assembly_id, 'SHINE', 'Cleanliness', 'ASM_SHN_01', 'Is the workstation bench surface clean and free of dust, grease, or liquids?', 'Wipe test for residue.', 1);
  PERFORM public.seed_audit_question(v_assembly_id, 'SHINE', 'Cleanliness', 'ASM_SHN_02', 'Is the assembly line floor clean and free of oil drips or water puddles?', 'No slip hazards.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_assembly_id, 'SHINE', 'Waste Disposal', 'ASM_SHN_03', 'Are recycling, waste, and hazard containers labeled and not overflowing?', 'Verify waste disposal protocol is followed.', 3);
  PERFORM public.seed_audit_question(v_assembly_id, 'SHINE', 'Dust', 'ASM_SHN_04', 'Are ventilation ducts and light fixtures clean and free of thick dust accumulation?', 'Ensure workspace air quality.', 4);
  PERFORM public.seed_audit_question(v_assembly_id, 'SHINE', 'Cleanliness', 'ASM_SHN_05', 'Are cleaning tools (brooms, microfibers) clean and stored in their proper rack?', 'Do not leave dirty cleaning items on the floor.', 5);

  -- STANDARDIZE
  PERFORM public.seed_audit_question(v_assembly_id, 'STANDARDIZE', 'Documented Standards', 'ASM_STD_01', 'Are 5S visual standards (Before/After sheets) posted nearby?', 'Look for visual management boards.', 1);
  PERFORM public.seed_audit_question(v_assembly_id, 'STANDARDIZE', 'Visual Indicators', 'ASM_STD_02', 'Are kanban cards and progress boards fully updated?', 'Verify visual metrics are current.', 2);
  PERFORM public.seed_audit_question(v_assembly_id, 'STANDARDIZE', 'Uniformity', 'ASM_STD_03', 'Are standard workstations laid out identically across the assembly bay?', 'Ensure setup uniformity.', 3);
  PERFORM public.seed_audit_question(v_assembly_id, 'STANDARDIZE', 'Safety Markings', 'ASM_STD_04', 'Are safety zones around high-voltage or hot equipment clearly demarcated?', 'Check safety lines and labels.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_assembly_id, 'STANDARDIZE', 'Documented Standards', 'ASM_STD_05', 'Are standard work instructions (SOPs) present and readable at each station?', 'SOPs must be in sight.', 5);

  -- SUSTAIN
  PERFORM public.seed_audit_question(v_assembly_id, 'SUSTAIN', 'Schedule Adherence', 'ASM_SST_01', 'Is the daily 5S cleaning log signed off by the shift supervisor?', 'Verify the logs.', 1);
  PERFORM public.seed_audit_question(v_assembly_id, 'SUSTAIN', 'Communication', 'ASM_SST_02', 'Are the latest 5S audit scores displayed on the team bulletin board?', 'Ensure public score board communication.', 2);
  PERFORM public.seed_audit_question(v_assembly_id, 'SUSTAIN', 'Employee Awareness', 'ASM_SST_03', 'Do operators demonstrate awareness of standard 5S practices in discussions?', 'Evaluate verbal compliance.', 3);
  PERFORM public.seed_audit_question(v_assembly_id, 'SUSTAIN', 'Correction Closure', 'ASM_SST_04', 'Are prior corrective action issues resolved and documented on the tracking sheet?', 'Check action logs.', 4, 'MAJOR');
  PERFORM public.seed_audit_question(v_assembly_id, 'SUSTAIN', 'Schedule Adherence', 'ASM_SST_05', 'Is there evidence of active leader involvement in 5S check walks?', 'Verify leadership sign-off.', 5);


  -- ── TEMPLATE 2: Warehouse Storage Racks ─────────────────────────────────────
  INSERT INTO public.audit_templates (name, description, version, status, is_default, industry, department, workspace_type)
  VALUES (
    'Warehouse Storage Rack Area Template',
    'Specialized 5S checklist tailored for storage racking, pallet zones, and forklift pathways.',
    '1.0', 'ACTIVE', false, 'Warehouse', 'Logistics', 'Storage Rack Area'
  ) RETURNING id INTO v_wh_id;

  -- SORT
  PERFORM public.seed_audit_question(v_wh_id, 'SORT', 'Clutter', 'WH_SRT_01', 'Are broken pallets, loose shrink wrap, and scrap bands disposed of?', 'Remove hazardous packing clutter.', 1, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'SORT', 'Waste', 'WH_SRT_02', 'Are unneeded packaging materials, boxes, and cardboard collected and flattened?', 'Clear packaging waste.', 2);
  PERFORM public.seed_audit_question(v_wh_id, 'SORT', 'Inventory', 'WH_SRT_03', 'Are there any dead stock or unidentified pallets sitting in active walkways?', 'Pathways must be clear.', 3, 'MAJOR');
  PERFORM public.seed_audit_question(v_wh_id, 'SORT', 'Obstructions', 'WH_SRT_04', 'Are fire doors, extinguishers, and electrical panels fully clear of pallets?', 'Strict safety access check.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'SORT', 'Waste', 'WH_SRT_05', 'Are damaged inventory items quarantined and moved to the designated repair zone?', 'Damaged items must be isolated.', 5);

  -- SET IN ORDER
  PERFORM public.seed_audit_question(v_wh_id, 'SET_IN_ORDER', 'Storage', 'WH_ORD_01', 'Are all storage racks labeled with shelf coordinates and maximum load capacities?', 'Ensure rack label visibility.', 1, 'MAJOR');
  PERFORM public.seed_audit_question(v_wh_id, 'SET_IN_ORDER', 'Floor Markings', 'WH_ORD_02', 'Are pallet parking zones and staging areas clearly marked on the floor?', 'Pallet boundaries must be painted.', 2);
  PERFORM public.seed_audit_question(v_wh_id, 'SET_IN_ORDER', 'Labels', 'WH_ORD_03', 'Are warehouse aisles, safety exits, and walkways marked with yellow/black floor tape?', 'Aisle visibility check.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'SET_IN_ORDER', 'Storage', 'WH_ORD_04', 'Are picking locations labeled correctly and match inventory stock records?', 'Inventory location accuracy.', 4);
  PERFORM public.seed_audit_question(v_wh_id, 'SET_IN_ORDER', 'Tool Organization', 'WH_ORD_05', 'Are shipping tools, packing tape guns, and scanning devices stored in designated slots?', 'Audit tool storage boards.', 5);

  -- SHINE
  PERFORM public.seed_audit_question(v_wh_id, 'SHINE', 'Cleanliness', 'WH_SHN_01', 'Are storage rack shelves clean and free of dust, loose cardboard, or spilled liquids?', 'Rack cleanliness check.', 1);
  PERFORM public.seed_audit_question(v_wh_id, 'SHINE', 'Cleanliness', 'WH_SHN_02', 'Are floors clean and free of forklift tire marks, oil spills, or water?', 'Floor cleaning check.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'SHINE', 'Dust', 'WH_SHN_03', 'Are high-level racking structures, columns, and walls free of cobwebs and dust?', 'Dust check.', 3);
  PERFORM public.seed_audit_question(v_wh_id, 'SHINE', 'Waste Disposal', 'WH_SHN_04', 'Are waste, plastic wrap, and cardboard bins placed correctly and emptied before overload?', 'Bin check.', 4);
  PERFORM public.seed_audit_question(v_wh_id, 'SHINE', 'Cleanliness', 'WH_SHN_05', 'Are spill response kits fully stocked, accessible, and clean?', 'Verify emergency equipment.', 5, 'MAJOR');

  -- STANDARDIZE
  PERFORM public.seed_audit_question(v_wh_id, 'STANDARDIZE', 'Safety Markings', 'WH_STD_01', 'Are load height limit lines visible on storage racks?', 'Racks must have maximum height lines.', 1);
  PERFORM public.seed_audit_question(v_wh_id, 'STANDARDIZE', 'Documented Standards', 'WH_STD_02', 'Are 5S warehouse map, layout rules, and standards posted at the aisle entry?', 'Check visual map boards.', 2);
  PERFORM public.seed_audit_question(v_wh_id, 'STANDARDIZE', 'Visual Indicators', 'WH_STD_03', 'Are safety signs (wear vests, speed limit, forklift traffic) clearly posted?', 'Warehouse safety postings.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'STANDARDIZE', 'Uniformity', 'WH_STD_04', 'Is warehouse color coding for bins (cardboard vs plastic wrap) followed uniformly?', 'Uniform bins audit.', 4);
  PERFORM public.seed_audit_question(v_wh_id, 'STANDARDIZE', 'Safety Markings', 'WH_STD_05', 'Are rack columns fitted with yellow safety corner protectors?', 'Verify protector integrity.', 5);

  -- SUSTAIN
  PERFORM public.seed_audit_question(v_wh_id, 'SUSTAIN', 'Schedule Adherence', 'WH_SST_01', 'Are daily aisle checks completed and signed off?', 'Aisle logs signoff.', 1);
  PERFORM public.seed_audit_question(v_wh_id, 'SUSTAIN', 'Communication', 'WH_SST_02', 'Are weekly warehouse 5S metrics published and shared?', 'Ensure board metrics updates.', 2);
  PERFORM public.seed_audit_question(v_wh_id, 'SUSTAIN', 'Employee Awareness', 'WH_SST_03', 'Are pickers and forklift drivers wearing correct PPE (vests, steel toes)?', 'PPE safety check.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_wh_id, 'SUSTAIN', 'Correction Closure', 'WH_SST_04', 'Are previous audit issues resolved?', 'Action tracker check.', 4);
  PERFORM public.seed_audit_question(v_wh_id, 'SUSTAIN', 'Schedule Adherence', 'WH_SST_05', 'Is there management verification of 5S compliance?', 'Verify leadership signature.', 5);


  -- ── TEMPLATE 3: Office Desk Area ────────────────────────────────────────────
  INSERT INTO public.audit_templates (name, description, version, status, is_default, industry, department, workspace_type)
  VALUES (
    'Office Desk Workspace Template',
    'Specialized 5S audit checklist tailored for office desks, shared cabins, and printer zones.',
    '1.0', 'ACTIVE', false, 'Office', 'Administration', 'Office Desk Area'
  ) RETURNING id INTO v_office_id;

  -- SORT
  PERFORM public.seed_audit_question(v_office_id, 'SORT', 'Clutter', 'OFC_SRT_01', 'Are unnecessary papers, sticky notes, and old documents shredded or archived?', 'Desk paper clutter.', 1);
  PERFORM public.seed_audit_question(v_office_id, 'SORT', 'Waste', 'OFC_SRT_02', 'Are empty bottles, lunch wraps, and cardboard clutter cleared from the desk?', 'Remove desk waste.', 2);
  PERFORM public.seed_audit_question(v_office_id, 'SORT', 'Inventory', 'OFC_SRT_03', 'Are old, broken office supplies (pens, staplers) discarded?', 'Discard supply clutter.', 3);
  PERFORM public.seed_audit_question(v_office_id, 'SORT', 'Obstructions', 'OFC_SRT_04', 'Are walkways, doorways, and corridors clear of file boxes or surplus chairs?', 'Corridor check.', 4, 'MAJOR');
  PERFORM public.seed_audit_question(v_office_id, 'SORT', 'Waste', 'OFC_SRT_05', 'Are files and digital data stored correctly on the cloud/drives instead of desk files?', 'Reduce storage footprint.', 5);

  -- SET IN ORDER
  PERFORM public.seed_audit_question(v_office_id, 'SET_IN_ORDER', 'Storage', 'OFC_ORD_01', 'Are documents stored in labeled files and binders in the cabinets?', 'Cabinet filing organization.', 1);
  PERFORM public.seed_audit_question(v_office_id, 'SET_IN_ORDER', 'Storage', 'OFC_ORD_02', 'Are desk drawers labeled and divided for specific office supplies?', 'Drawer audit.', 2);
  PERFORM public.seed_audit_question(v_office_id, 'SET_IN_ORDER', 'Labels', 'OFC_ORD_03', 'Are shared equipment (printers, shredders, laminators) clearly marked with visual instructions?', 'Equipment labeling.', 3);
  PERFORM public.seed_audit_question(v_office_id, 'SET_IN_ORDER', 'Storage', 'OFC_ORD_04', 'Are computer monitors, keyboards, and phones clean and aligned?', 'Desk layout uniformity.', 4);
  PERFORM public.seed_audit_question(v_office_id, 'SET_IN_ORDER', 'Tool Organization', 'OFC_ORD_05', 'Are power cords and computer cables organized with ties and kept out of walkways?', 'Cable tidiness.', 5, 'MAJOR');

  -- SHINE
  PERFORM public.seed_audit_question(v_office_id, 'SHINE', 'Cleanliness', 'OFC_SHN_01', 'Are desk surfaces wiped clean and free of dust, coffee stains, or crumbs?', 'Wipe check.', 1);
  PERFORM public.seed_audit_question(v_office_id, 'SHINE', 'Cleanliness', 'OFC_SHN_02', 'Is the office carpet clean and free of visible dirt or stains?', 'Carpet check.', 2);
  PERFORM public.seed_audit_question(v_office_id, 'SHINE', 'Dust', 'OFC_SHN_03', 'Are computer vents, screens, and printer trays free of dust?', 'Screen dust check.', 3);
  PERFORM public.seed_audit_question(v_office_id, 'SHINE', 'Waste Disposal', 'OFC_SHN_04', 'Are trash and paper shredder bins emptied regularly and not overflowing?', 'Bin check.', 4);
  PERFORM public.seed_audit_question(v_office_id, 'SHINE', 'Cleanliness', 'OFC_SHN_05', 'Are keyboards and mice clean and periodically sanitized?', 'Sanitation audit.', 5);

  -- STANDARDIZE
  PERFORM public.seed_audit_question(v_office_id, 'STANDARDIZE', 'Documented Standards', 'OFC_STD_01', 'Are office desk 5S guidelines visible or shared digitally?', 'Verify guideline visibility.', 1);
  PERFORM public.seed_audit_question(v_office_id, 'STANDARDIZE', 'Visual Indicators', 'OFC_STD_02', 'Are shared binders color-coded and clearly labeled to identify missing binders easily?', 'Binder color check.', 2);
  PERFORM public.seed_audit_question(v_office_id, 'STANDARDIZE', 'Uniformity', 'OFC_STD_03', 'Is the standard Clean Desk policy followed at the end of shifts?', 'Clean desk rule adherence.', 3);
  PERFORM public.seed_audit_question(v_office_id, 'STANDARDIZE', 'Safety Markings', 'OFC_STD_04', 'Are electrical wall plates and safety markers around heaters in good condition?', 'Safety markings.', 4);
  PERFORM public.seed_audit_question(v_office_id, 'STANDARDIZE', 'Documented Standards', 'OFC_STD_05', 'Is there a digital file naming standard followed for archiving project documents?', 'Digital standard.', 5);

  -- SUSTAIN
  PERFORM public.seed_audit_question(v_office_id, 'SUSTAIN', 'Schedule Adherence', 'OFC_SST_01', 'Are monthly desk self-audits performed and tracked?', 'Self-audit check.', 1);
  PERFORM public.seed_audit_question(v_office_id, 'SUSTAIN', 'Communication', 'OFC_SST_02', 'Are office 5S results reviewed and communicated during departmental meetings?', 'Verify board metrics.', 2);
  PERFORM public.seed_audit_question(v_office_id, 'SUSTAIN', 'Employee Awareness', 'OFC_SST_03', 'Do office employees demonstrate awareness of desk standard practices?', 'Verify awareness.', 3);
  PERFORM public.seed_audit_question(v_office_id, 'SUSTAIN', 'Correction Closure', 'OFC_SST_04', 'Are previous desk issues closed out?', 'Action log check.', 4);
  PERFORM public.seed_audit_question(v_office_id, 'SUSTAIN', 'Schedule Adherence', 'OFC_SST_05', 'Is there evidence of active leader involvement in office audits?', 'Leadership signature.', 5);


  -- ── TEMPLATE 4: Laboratory Area ─────────────────────────────────────────────
  INSERT INTO public.audit_templates (name, description, version, status, is_default, industry, department, workspace_type)
  VALUES (
    'Chemical Lab Template',
    'Specialized 5S audit checklist tailored for chemical, biological, or QC laboratories.',
    '1.0', 'ACTIVE', false, 'Laboratory', 'R&D', 'Chemical Lab'
  ) RETURNING id INTO v_lab_id;

  -- SORT
  PERFORM public.seed_audit_question(v_lab_id, 'SORT', 'Clutter', 'LAB_SRT_01', 'Are expired chemical reagents, old slides, and samples disposed of?', 'Lab clutter check.', 1, 'MAJOR');
  PERFORM public.seed_audit_question(v_lab_id, 'SORT', 'Waste', 'LAB_SRT_02', 'Are used pipettes, gloves, and paper towels disposed of immediately?', 'Biological waste check.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SORT', 'Inventory', 'LAB_SRT_03', 'Are chemical bottles at workbenches limited to active testing quantities?', 'Bench chemical volume check.', 3);
  PERFORM public.seed_audit_question(v_lab_id, 'SORT', 'Obstructions', 'LAB_SRT_04', 'Are emergency eye-wash stations and safety showers free of equipment/boxes?', 'Extremely critical safety check.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SORT', 'Waste', 'LAB_SRT_05', 'Are hazardous materials quarantined and stored in correct cabinets?', 'Hazard containment audit.', 5, 'CRITICAL');

  -- SET IN ORDER
  PERFORM public.seed_audit_question(v_lab_id, 'SET_IN_ORDER', 'Storage', 'LAB_ORD_01', 'Are chemical reagent bottles stored alphabetically or by hazard group in labeled racks?', 'Chemical shelf ordering.', 1, 'MAJOR');
  PERFORM public.seed_audit_question(v_lab_id, 'SET_IN_ORDER', 'Labels', 'LAB_ORD_02', 'Are hazardous chemicals stored in color-coded safety cabinets?', 'Cabinet color markers.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SET_IN_ORDER', 'Storage', 'LAB_ORD_03', 'Are lab glassware and tools stored in designated racks or shadow boxes?', 'Glassware storage.', 3);
  PERFORM public.seed_audit_question(v_lab_id, 'SET_IN_ORDER', 'Labels', 'LAB_ORD_04', 'Are sample containers labeled with contents, researcher name, and date?', 'Reagent labels.', 4);
  PERFORM public.seed_audit_question(v_lab_id, 'SET_IN_ORDER', 'Tool Organization', 'LAB_ORD_05', 'Are analytical balances, hot plates, and equipment stored at designated points of use?', 'Equipment point of use.', 5);

  -- SHINE
  PERFORM public.seed_audit_question(v_lab_id, 'SHINE', 'Cleanliness', 'LAB_SHN_01', 'Are lab bench surfaces wiped clean and sanitized regularly?', 'Bench check.', 1);
  PERFORM public.seed_audit_question(v_lab_id, 'SHINE', 'Cleanliness', 'LAB_SHN_02', 'Are fume hoods clean and free of visible spills, stains, or corrosion?', 'Hood cleaning check.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SHINE', 'Waste Disposal', 'LAB_SHN_03', 'Are hazardous waste streams segregated into correct labeled containers?', 'Chemical waste sorting.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SHINE', 'Dust', 'LAB_SHN_04', 'Are balance scales and microscope lenses free of dust and residue?', 'Balance scale dust.', 4);
  PERFORM public.seed_audit_question(v_lab_id, 'SHINE', 'Cleanliness', 'LAB_SHN_05', 'Are spill response kits stocked, accessible, and clean?', 'Verify lab safety kits.', 5, 'MAJOR');

  -- STANDARDIZE
  PERFORM public.seed_audit_question(v_lab_id, 'STANDARDIZE', 'Documented Standards', 'LAB_STD_01', 'Are standard lab cleaning and safety standards visible?', 'Visual SOP check.', 1);
  PERFORM public.seed_audit_question(v_lab_id, 'STANDARDIZE', 'Safety Markings', 'LAB_STD_02', 'Are biohazard signs and hazard labels visible on storage cabinets?', 'Cabinet hazard labels.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'STANDARDIZE', 'Visual Indicators', 'LAB_STD_03', 'Are gas cylinder lines color-coded and pressure status indicators operational?', 'Pressure indicators check.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'STANDARDIZE', 'Safety Markings', 'LAB_STD_04', 'Are safety zones and evacuation paths clearly marked on floors?', 'Floor markings audit.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'STANDARDIZE', 'Documented Standards', 'LAB_STD_05', 'Are SDS (Safety Data Sheets) binders updated and accessible?', 'SDS binder check.', 5);

  -- SUSTAIN
  PERFORM public.seed_audit_question(v_lab_id, 'SUSTAIN', 'Schedule Adherence', 'LAB_SST_01', 'Are weekly lab safety audits logged and signed off?', 'Safety log signoff.', 1);
  PERFORM public.seed_audit_question(v_lab_id, 'SUSTAIN', 'Communication', 'LAB_SST_02', 'Are lab audit results shared with team members?', 'Metrics updates board.', 2);
  PERFORM public.seed_audit_question(v_lab_id, 'SUSTAIN', 'Employee Awareness', 'LAB_SST_03', 'Are lab technicians wearing proper PPE (coat, goggles, gloves)?', 'PPE audit.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_lab_id, 'SUSTAIN', 'Correction Closure', 'LAB_SST_04', 'Are previous lab corrective actions closed out?', 'Action tracker check.', 4);
  PERFORM public.seed_audit_question(v_lab_id, 'SUSTAIN', 'Schedule Adherence', 'LAB_SST_05', 'Is there management verification of 5S compliance?', 'Verify leadership signature.', 5);


  -- ── TEMPLATE 5: Maintenance Workshop ────────────────────────────────────────
  INSERT INTO public.audit_templates (name, description, version, status, is_default, industry, department, workspace_type)
  VALUES (
    'Workshop Template',
    'Specialized 5S audit checklist tailored for facilities maintenance and tooling workshops.',
    '1.0', 'ACTIVE', false, 'Maintenance', 'Facilities', 'Workshop'
  ) RETURNING id INTO v_maint_id;

  -- SORT
  PERFORM public.seed_audit_question(v_maint_id, 'SORT', 'Clutter', 'MNT_SRT_01', 'Are broken parts, replaced motors, and scrap scrap metal disposed of?', 'Scrap clutter check.', 1);
  PERFORM public.seed_audit_question(v_maint_id, 'SORT', 'Waste', 'MNT_SRT_02', 'Are empty oil bottles, rags, and protective plastics cleared from work benches?', 'Remove workbench waste.', 2);
  PERFORM public.seed_audit_question(v_maint_id, 'SORT', 'Inventory', 'MNT_SRT_03', 'Are raw metals, spare fasteners, and parts limited to shift requirements?', 'Material pile check.', 3);
  PERFORM public.seed_audit_question(v_maint_id, 'SORT', 'Obstructions', 'MNT_SRT_04', 'Are emergency exits and high-voltage panels free of obstructions?', 'Strict panel access check.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'SORT', 'Waste', 'MNT_SRT_05', 'Are damaged tools segregated and sent to repair or red-tag area?', 'Broken tools audit.', 5, 'MAJOR');

  -- SET IN ORDER
  PERFORM public.seed_audit_question(v_maint_id, 'SET_IN_ORDER', 'Tool Organization', 'MNT_ORD_01', 'Are maintenance tools organized in designated shadow boards or racks?', 'Tool outlines visibility check.', 1, 'MAJOR');
  PERFORM public.seed_audit_question(v_maint_id, 'SET_IN_ORDER', 'Labels', 'MNT_ORD_02', 'Are storage shelves and toolboxes clearly labeled with content codes?', 'Shelves label check.', 2);
  PERFORM public.seed_audit_question(v_maint_id, 'SET_IN_ORDER', 'Floor Markings', 'MNT_ORD_03', 'Are aisles, safety exits, and walkways marked with yellow/black floor tape?', 'Aisle visibility check.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'SET_IN_ORDER', 'Storage', 'MNT_ORD_04', 'Are items returned to their designated location after use?', 'Audit items return.', 4);
  PERFORM public.seed_audit_question(v_maint_id, 'SET_IN_ORDER', 'Tool Organization', 'MNT_ORD_05', 'Are heavy equipment and welding carts parked inside designated yellow boundaries?', 'Cart boundaries painted.', 5);

  -- SHINE
  PERFORM public.seed_audit_question(v_maint_id, 'SHINE', 'Cleanliness', 'MNT_SHN_01', 'Are machine workshop workbench surfaces clean and free of oil, coolant, or grease?', 'Bench cleaning check.', 1);
  PERFORM public.seed_audit_question(v_maint_id, 'SHINE', 'Cleanliness', 'MNT_SHN_02', 'Are floors clean and free of oil leaks, puddles, or metal chips?', 'Slip and trip hazards check.', 2, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'SHINE', 'Dust', 'MNT_SHN_03', 'Are workshop tool racks, columns, and walls free of cobwebs and thick dust?', 'Dust check.', 3);
  PERFORM public.seed_audit_question(v_maint_id, 'SHINE', 'Waste Disposal', 'MNT_SHN_04', 'Are oily rags placed inside dedicated closed metal bins?', 'Spontaneous combustion prevention.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'SHINE', 'Cleanliness', 'MNT_SHN_05', 'Are spill response kits stocked, accessible, and clean?', 'Verify safety response kits.', 5, 'MAJOR');

  -- STANDARDIZE
  PERFORM public.seed_audit_question(v_maint_id, 'STANDARDIZE', 'Documented Standards', 'MNT_STD_01', 'Are 5S workshop guidelines posted nearby?', 'Look for visual management boards.', 1);
  PERFORM public.seed_audit_question(v_maint_id, 'STANDARDIZE', 'Visual Indicators', 'MNT_STD_02', 'Are tool boards colored to distinguish standard metrics vs imperial sockets?', 'Socket color indicators.', 2);
  PERFORM public.seed_audit_question(v_maint_id, 'STANDARDIZE', 'Uniformity', 'MNT_STD_03', 'Are standard workstation setups laid out identically?', 'Setup uniformity.', 3);
  PERFORM public.seed_audit_question(v_maint_id, 'STANDARDIZE', 'Safety Markings', 'MNT_STD_04', 'Are safety zones around welding tables and grinders demarcated?', 'Safety lines audit.', 4, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'STANDARDIZE', 'Safety Markings', 'MNT_STD_05', 'Are rack columns fitted with safety protectors?', 'Verify protector integrity.', 5);

  -- SUSTAIN
  PERFORM public.seed_audit_question(v_maint_id, 'SUSTAIN', 'Schedule Adherence', 'MNT_SST_01', 'Are daily workshop checks completed and signed off?', 'Logs signoff check.', 1);
  PERFORM public.seed_audit_question(v_maint_id, 'SUSTAIN', 'Communication', 'MNT_SST_02', 'Are weekly workshop 5S metrics published and shared?', 'Metrics updates board.', 2);
  PERFORM public.seed_audit_question(v_maint_id, 'SUSTAIN', 'Employee Awareness', 'MNT_SST_03', 'Do workshop workers wear steel toes, safety glasses, and ear plugs?', 'PPE audit.', 3, 'CRITICAL');
  PERFORM public.seed_audit_question(v_maint_id, 'SUSTAIN', 'Correction Closure', 'MNT_SST_04', 'Are previous workshop corrective actions closed out?', 'Action tracker check.', 4);
  PERFORM public.seed_audit_question(v_maint_id, 'SUSTAIN', 'Schedule Adherence', 'MNT_SST_05', 'Is there management verification of 5S compliance?', 'Verify leadership signature.', 5);

END$$;

-- Drop temporary helper function
DROP FUNCTION IF EXISTS public.seed_audit_question(UUID, public.audit_pillar, TEXT, TEXT, TEXT, TEXT, INT, public.audit_severity);

COMMIT;
