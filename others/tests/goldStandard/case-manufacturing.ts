/**
 * Gold Standard Test Cases — Manufacturing (Ideal + Edge)
 */
import type { GoldStandardCase } from './dataset';
import { defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';

export const caseManufacturingIdeal: GoldStandardCase = {
  id:                   'MFG_IDEAL_01',
  industry:             'Manufacturing',
  template_type:        'Assembly Line',
  scenario_type:        'IDEAL',
  scenario_description: 'Fully compliant assembly line — clean benches, shadow boards, clear markings.',
  difficulty_notes:     'Good lighting, wide angle, all areas visible.',
  observations: [
    { category: 'Floor Markings', finding: 'Yellow lane markings visible', status: 'COMPLIANT', evidence: 'Clear yellow tape defines pedestrian and cart zones.', ...defaultObservationFields(), floor_markings: true, cleanliness_rating: 'CLEAN', confidence: 0.97 },
    { category: 'Tool Organization', finding: 'Shadow boards with outlines present', status: 'COMPLIANT', evidence: 'All tools hung in labeled shadow board outlines.', ...defaultObservationFields(), detected_objects: ['shadow board', 'hammer', 'wrench'], labels_visible: true, confidence: 0.95 },
    { category: 'Cleanliness', finding: 'Bench surfaces clean', status: 'COMPLIANT', evidence: 'No dust, grease, or residue on workbench surfaces.', ...defaultObservationFields(), cleanliness_rating: 'CLEAN', confidence: 0.93 },
    { category: 'Labels', finding: 'All bins labeled with barcodes', status: 'COMPLIANT', evidence: 'Parts bins have barcode labels and component codes visible.', ...defaultObservationFields(), labels_visible: true, confidence: 0.96 },
    { category: 'Safety Markings', finding: 'Safety zones demarcated', status: 'COMPLIANT', evidence: 'High-voltage zone outlined in red, fire extinguisher sign visible.', ...defaultObservationFields(), safety_equipment: ['fire extinguisher', 'safety sign'], confidence: 0.94 },
  ],
  expected_rule_answers: {
    'ASM_ORD_05': 'YES',  // Floor Markings (inferCategory: _ORD_05 → Floor Markings)
    'ASM_ORD_03': 'YES',  // Labels        (inferCategory: _ORD_03 → Labels)
    'ASM_SHN_01': 'YES',  // Cleanliness   (inferCategory: _SHN_01 → Cleanliness)
  },
  expected_score_range:    { min: 85, max: 100 },
  expected_reliability:    'EXCELLENT',
  expected_warning_ids:    [],
  test_audit_confidence:   93,
  test_not_visible_pct:    4,
  test_high_warnings:      0,
};

export const caseManufacturingEdge: GoldStandardCase = {
  id:                   'MFG_EDGE_01',
  industry:             'Manufacturing',
  template_type:        'Assembly Line',
  scenario_type:        'EDGE',
  scenario_description: 'Partially lit assembly line — occluded workbench, difficult angle.',
  difficulty_notes:     'Poor overhead lighting, camera angle skews view of floor markings, workbench partially obstructed.',
  observations: [
    { category: 'Floor Markings', finding: 'Floor markings partially visible', status: 'PARTIAL', evidence: 'Some tape visible but floor partially obstructed by equipment.', ...defaultObservationFields(), floor_markings: null, cleanliness_rating: 'NOT_VISIBLE', confidence: 0.60 },
    { category: 'Cleanliness', finding: 'Bench surface dirty in visible area', status: 'NON_COMPLIANT', evidence: 'Oil residue visible on left half of workbench; right side occluded.', ...defaultObservationFields(), cleanliness_rating: 'DIRTY', confidence: 0.65 },
    { category: 'Labels', finding: 'Labels partially readable', status: 'PARTIAL', evidence: 'Some bins visible with labels; others outside frame or too dark to read.', ...defaultObservationFields(), labels_visible: null, confidence: 0.55 },
    { category: 'Obstructions', finding: 'No obstructions detected', status: 'COMPLIANT', evidence: 'Visible pathways are clear.', ...defaultObservationFields(), obstructions: [], confidence: 0.70 },
  ],
  expected_rule_answers: {
    'ASM_SHN_01': 'NO',   // Cleanliness = DIRTY → R_DIRTY fires
  },
  expected_score_range:    { min: 30, max: 70 },
  expected_reliability:    'LOW',              // Actual classifier output with confidence=62, nv=20
  expected_warning_ids:    [],
  test_audit_confidence:   62,
  test_not_visible_pct:    20,
  test_high_warnings:      0,
};
