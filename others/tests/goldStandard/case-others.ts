/**
 * Gold Standard Test Cases — Warehouse, Office, Laboratory, Maintenance
 */
import type { GoldStandardCase } from './dataset';
import { defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';

// ── WAREHOUSE ─────────────────────────────────────────────────────────────────

export const caseWarehouseIdeal: GoldStandardCase = {
  id:                   'WH_IDEAL_01',
  industry:             'Warehouse',
  template_type:        'Storage Rack Area',
  scenario_type:        'IDEAL',
  scenario_description: 'Clean warehouse with clear aisles, labeled racks, and marked pallet zones.',
  difficulty_notes:     'Good lighting, standard forklift-eye camera height.',
  observations: [
    { category: 'Floor Markings', finding: 'Pallet zones clearly painted', status: 'COMPLIANT', evidence: 'Yellow painted pallet boundaries and aisle lanes visible.', ...defaultObservationFields(), floor_markings: true, cleanliness_rating: 'CLEAN', confidence: 0.96 },
    { category: 'Labels', finding: 'Rack coordinates labeled', status: 'COMPLIANT', evidence: 'All rack faces show coordinate labels and load capacity signs.', ...defaultObservationFields(), labels_visible: true, confidence: 0.95 },
    { category: 'Cleanliness', finding: 'Floor clean', status: 'COMPLIANT', evidence: 'No oil, forklift marks, or water on floor surface.', ...defaultObservationFields(), cleanliness_rating: 'CLEAN', confidence: 0.94 },
    { category: 'Safety Markings', finding: 'Safety signs posted', status: 'COMPLIANT', evidence: 'Speed limit, PPE required, and forklift warning signs visible.', ...defaultObservationFields(), safety_equipment: ['speed limit sign', 'PPE required sign', 'forklift warning'], confidence: 0.93 },
  ],
  expected_rule_answers:   { 'WH_ORD_03': 'YES', 'WH_ORD_05': 'YES', 'WH_SHN_01': 'YES' },
  expected_score_range:    { min: 85, max: 100 },
  expected_reliability:    'EXCELLENT',
  expected_warning_ids:    [],
  test_audit_confidence:   94,
  test_not_visible_pct:    3,
  test_high_warnings:      0,
};

export const caseWarehouseEdge: GoldStandardCase = {
  id:                   'WH_EDGE_01',
  industry:             'Warehouse',
  template_type:        'Storage Rack Area',
  scenario_type:        'EDGE',
  scenario_description: 'Cluttered warehouse with mixed pallet zones and a blocked fire door.',
  difficulty_notes:     'Heavy clutter, multiple simultaneous violations, borderline lighting.',
  observations: [
    { category: 'Obstructions', finding: 'Pallet blocking fire door', status: 'NON_COMPLIANT', evidence: 'Wooden pallet directly in front of fire exit door.', ...defaultObservationFields(), obstructions: ['blocked emergency fire door'], hazards: ['blocked emergency exit'], confidence: 0.98 },
    { category: 'Clutter', finding: 'Broken pallets in aisle', status: 'NON_COMPLIANT', evidence: 'Three broken pallets and shrink wrap debris in main forklift aisle.', ...defaultObservationFields(), detected_objects: ['broken pallet', 'shrink wrap'], confidence: 0.92 },
    { category: 'Clutter', finding: 'Cardboard piles in pathway', status: 'NON_COMPLIANT', evidence: 'Cardboard boxes stacked to ceiling near loading bay entrance.', ...defaultObservationFields(), obstructions: ['cardboard blocking pathway'], confidence: 0.90 },
    { category: 'PPE Compliance', finding: 'Workers not wearing PPE', status: 'NON_COMPLIANT', evidence: 'No safety vests or steel-toed footwear visible on visible workers.', ...defaultObservationFields(), safety_equipment: [], confidence: 0.85 },
  ],
  expected_rule_answers:   { 'WH_SRT_01': 'NO', 'WH_SST_03': 'NO' },
  expected_score_range:    { min: 0, max: 40 },   // CRITICAL cap expected
  expected_reliability:    'REJECTED',
  expected_warning_ids:    ['C_CLUTTER_ORGANIZED', 'C_PPE_ABSENT_SUSTAIN'],
  test_audit_confidence:   45,
  test_not_visible_pct:    10,
  test_high_warnings:      2,
};

// ── OFFICE ────────────────────────────────────────────────────────────────────

export const caseOfficeIdeal: GoldStandardCase = {
  id:                   'OFC_IDEAL_01',
  industry:             'Office',
  template_type:        'Office Desk Area',
  scenario_type:        'IDEAL',
  scenario_description: 'Clean desk policy followed — tidy desk, organized cables, labeled files.',
  difficulty_notes:     'Standard overhead lighting, good visibility of desk area.',
  observations: [
    { category: 'Cleanliness', finding: 'Desk surface clean', status: 'COMPLIANT', evidence: 'No papers, food, or dust on desk surface.', ...defaultObservationFields(), cleanliness_rating: 'CLEAN', confidence: 0.97 },
    { category: 'Labels', finding: 'Binders labeled', status: 'COMPLIANT', evidence: 'Binders on shelf have clear color-coded labels.', ...defaultObservationFields(), labels_visible: true, confidence: 0.93 },
    { category: 'Tool Organization', finding: 'Cables organized', status: 'COMPLIANT', evidence: 'Computer cables tied and routed neatly off the floor.', ...defaultObservationFields(), detected_objects: ['cable ties', 'keyboard', 'monitor'], confidence: 0.91 },
  ],
  expected_rule_answers:   { 'OFC_SHN_01': 'YES', 'OFC_ORD_03': 'YES' },
  expected_score_range:    { min: 80, max: 100 },
  expected_reliability:    'EXCELLENT',
  expected_warning_ids:    [],
  test_audit_confidence:   91,
  test_not_visible_pct:    5,
  test_high_warnings:      0,
};

export const caseOfficeEdge: GoldStandardCase = {
  id:                   'OFC_EDGE_01',
  industry:             'Office',
  template_type:        'Office Desk Area',
  scenario_type:        'EDGE',
  scenario_description: 'Borderline desk clutter — cables tangled but files partially organized.',
  difficulty_notes:     'Unusual camera angle, some desk areas outside frame, ambiguous label readability.',
  observations: [
    { category: 'Clutter', finding: 'Papers scattered on desk', status: 'NON_COMPLIANT', evidence: 'Loose papers and sticky notes covering 60% of desk surface.', ...defaultObservationFields(), confidence: 0.75 },
    { category: 'Clutter', finding: 'Food waste on desk', status: 'NON_COMPLIANT', evidence: 'Coffee cup and snack wrapper on workstation.', ...defaultObservationFields(), confidence: 0.80 },
    { category: 'Labels', finding: 'Binder labels partially visible', status: 'PARTIAL', evidence: 'Some binders visible with labels; others outside camera frame.', ...defaultObservationFields(), labels_visible: null, confidence: 0.55 },
    { category: 'Cleanliness', finding: 'Carpet area not visible', status: 'NOT_VISIBLE', evidence: 'Camera angle does not capture floor area.', ...defaultObservationFields(), cleanliness_rating: 'NOT_VISIBLE', confidence: 0.90 },
  ],
  expected_rule_answers:   { 'OFC_SRT_01': 'NO' },
  expected_score_range:    { min: 25, max: 60 },
  expected_reliability:    'LOW',
  expected_warning_ids:    ['C_CLUTTER_ORGANIZED'],
  test_audit_confidence:   58,
  test_not_visible_pct:    15,
  test_high_warnings:      1,
};

// ── LABORATORY ────────────────────────────────────────────────────────────────

export const caseLaboratoryIdeal: GoldStandardCase = {
  id:                   'LAB_IDEAL_01',
  industry:             'Laboratory',
  template_type:        'Chemical Lab',
  scenario_type:        'IDEAL',
  scenario_description: 'Fully compliant chemistry lab — PPE present, reagents organized, benches clean.',
  difficulty_notes:     'Good lighting, camera captures full lab bench and safety equipment.',
  observations: [
    { category: 'PPE Compliance', finding: 'Lab coats, goggles, and gloves observed', status: 'COMPLIANT', evidence: 'Researchers wearing full PPE including lab coat, safety goggles, and nitrile gloves.', ...defaultObservationFields(), safety_equipment: ['lab coat', 'safety goggles', 'nitrile gloves'], confidence: 0.96 },
    { category: 'Labels', finding: 'Chemical bottles labeled', status: 'COMPLIANT', evidence: 'All reagent bottles have GHS hazard labels and expiry dates.', ...defaultObservationFields(), labels_visible: true, confidence: 0.97 },
    { category: 'Cleanliness', finding: 'Fume hood clean', status: 'COMPLIANT', evidence: 'No spills, stains, or corrosion inside fume hood.', ...defaultObservationFields(), cleanliness_rating: 'CLEAN', confidence: 0.93 },
    { category: 'Safety Markings', finding: 'Biohazard and hazard signs visible', status: 'COMPLIANT', evidence: 'Biohazard symbols and chemical hazard warning signs on storage cabinets.', ...defaultObservationFields(), safety_equipment: ['biohazard sign', 'chemical hazard label', 'fire extinguisher'], confidence: 0.95 },
  ],
  expected_rule_answers:   { 'LAB_ORD_04': 'YES', 'LAB_SHN_01': 'YES' },
  expected_score_range:    { min: 85, max: 100 },
  expected_reliability:    'EXCELLENT',
  expected_warning_ids:    [],
  test_audit_confidence:   95,
  test_not_visible_pct:    3,
  test_high_warnings:      0,
};

export const caseLaboratoryEdge: GoldStandardCase = {
  id:                   'LAB_EDGE_01',
  industry:             'Laboratory',
  template_type:        'Chemical Lab',
  scenario_type:        'EDGE',
  scenario_description: 'Lab with occluded fume hood and unusual high-angle camera position.',
  difficulty_notes:     'Overhead camera angle obscures bench top, fume hood interior not visible, inconsistent shadows.',
  observations: [
    { category: 'Cleanliness', finding: 'Bench partially visible, appears soiled', status: 'NON_COMPLIANT', evidence: 'Visible section of bench has dried chemical residue.', ...defaultObservationFields(), cleanliness_rating: 'DIRTY', confidence: 0.65 },
    { category: 'PPE Compliance', finding: 'No PPE visible', status: 'NOT_VISIBLE', evidence: 'Camera angle does not capture researcher positions or PPE.', ...defaultObservationFields(), safety_equipment: [], confidence: 0.80 },
    { category: 'Labels', finding: 'Labels not readable at this angle', status: 'NOT_VISIBLE', evidence: 'High camera angle prevents label text from being readable.', ...defaultObservationFields(), labels_visible: null, confidence: 0.55 },
    { category: 'Storage', finding: 'Storage system present but contents unclear', status: 'PARTIAL', evidence: 'Shelving visible but items too small to assess at this zoom level.', ...defaultObservationFields(), storage_present: true, confidence: 0.60 },
  ],
  expected_rule_answers:   { 'LAB_SHN_01': 'NO' },
  expected_score_range:    { min: 15, max: 55 },
  expected_reliability:    'REJECTED',
  expected_warning_ids:    [],
  test_audit_confidence:   42,
  test_not_visible_pct:    35,
  test_high_warnings:      1,
};

// ── MAINTENANCE WORKSHOP ──────────────────────────────────────────────────────

export const caseMaintenanceIdeal: GoldStandardCase = {
  id:                   'MNT_IDEAL_01',
  industry:             'Maintenance',
  template_type:        'Workshop',
  scenario_type:        'IDEAL',
  scenario_description: 'Well-organized maintenance workshop — shadow boards, no floor hazards, clear aisles.',
  difficulty_notes:     'Standard side-angle camera, good lighting.',
  observations: [
    { category: 'Tool Organization', finding: 'Shadow boards with all tools present', status: 'COMPLIANT', evidence: 'Complete shadow boards with tool outlines; all tools in place.', ...defaultObservationFields(), detected_objects: ['shadow board', 'socket set', 'wrench', 'screwdriver'], labels_visible: true, confidence: 0.97 },
    { category: 'Floor Markings', finding: 'Aisle tape in good condition', status: 'COMPLIANT', evidence: 'Yellow-black aisle tape intact and clearly defining walkways.', ...defaultObservationFields(), floor_markings: true, confidence: 0.95 },
    { category: 'Cleanliness', finding: 'Floor clean, no oil leaks', status: 'COMPLIANT', evidence: 'No oil puddles, metal chips, or coolant on floor.', ...defaultObservationFields(), cleanliness_rating: 'CLEAN', confidence: 0.93 },
    { category: 'Safety Markings', finding: 'Safety zones around grinders marked', status: 'COMPLIANT', evidence: 'Red floor markings around welding table and angle grinder stations.', ...defaultObservationFields(), safety_equipment: ['safety zone marking', 'PPE reminder sign'], confidence: 0.92 },
  ],
  expected_rule_answers:   { 'MNT_ORD_03': 'YES', 'MNT_ORD_05': 'YES', 'MNT_SHN_02': 'YES' },
  expected_score_range:    { min: 85, max: 100 },
  expected_reliability:    'EXCELLENT',
  expected_warning_ids:    [],
  test_audit_confidence:   94,
  test_not_visible_pct:    3,
  test_high_warnings:      0,
};

export const caseMaintenanceEdge: GoldStandardCase = {
  id:                   'MNT_EDGE_01',
  industry:             'Maintenance',
  template_type:        'Workshop',
  scenario_type:        'EDGE',
  scenario_description: 'Workshop viewed from multiple simulated camera positions — varying zoom and operator distance.',
  difficulty_notes:     'Camera position simulates different operator heights; some areas only partially visible at each angle.',
  observations: [
    { category: 'Cleanliness', finding: 'Oil drips visible near machine base', status: 'NON_COMPLIANT', evidence: 'Oil leaks detected at base of lathe — slip hazard.', ...defaultObservationFields(), cleanliness_rating: 'DIRTY', hazards: ['oil spill on floor'], confidence: 0.82 },
    { category: 'Floor Markings', finding: 'Aisle tape worn and partially missing', status: 'PARTIAL', evidence: 'Floor tape visible but gaps of 30cm+ present near corner.', ...defaultObservationFields(), floor_markings: null, confidence: 0.68 },
    { category: 'Obstructions', finding: 'Cart parked outside boundary', status: 'NON_COMPLIANT', evidence: 'Welding cart parked outside its yellow boundary marking.', ...defaultObservationFields(), obstructions: ['welding cart outside boundary'], confidence: 0.75 },
    { category: 'Tool Organization', finding: 'Some tool positions empty', status: 'PARTIAL', evidence: 'Three tool outlines on shadow board are empty — tools in use or missing.', ...defaultObservationFields(), detected_objects: ['shadow board'], confidence: 0.70 },
  ],
  expected_rule_answers:   { 'MNT_SHN_02': 'NO' },
  expected_score_range:    { min: 20, max: 60 },
  expected_reliability:    'LOW',
  expected_warning_ids:    [],
  test_audit_confidence:   61,
  test_not_visible_pct:    18,
  test_high_warnings:      1,
};
