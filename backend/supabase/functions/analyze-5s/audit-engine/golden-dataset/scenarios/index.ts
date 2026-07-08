/**
 * supabase/functions/analyze-5s/audit-engine/golden-dataset/scenarios/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All golden dataset scenarios (Phase 4.1).
 *
 * Four reference scenarios:
 *  1. chemical-storage-excellent — all expected items present, labelled, clean
 *  2. chemical-storage-poor     — multiple violations, blocked exit, spills
 *  3. warehouse-average         — mixed compliance
 *  4. production-good           — mostly compliant, minor dust only
 *
 * These fixtures are pre-computed AuditEvidenceModel objects.
 * No LLM calls required for regression tests.
 */

import type { GoldenDatasetScenario } from '../schema.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Chemical Storage — Excellent
// ═══════════════════════════════════════════════════════════════════════════════

const CHEMICAL_EXCELLENT: GoldenDatasetScenario = {
  scenarioId:  'chemical-storage-excellent',
  description: 'Model chemical storage area. All containers labelled, spill containment in place, SDS posted, clear aisles, eyewash accessible.',
  zone:        'Chemical Storage',

  evidenceModel: {
    generatedAt:       '2024-01-01T00:00:00Z',
    zone:              'Chemical Storage',
    expectedObjects:   ['chemical drums', 'spill pallets', 'SDS binder', 'PPE station', 'eyewash station', 'fire extinguisher'],
    overallConfidence: 'HIGH',
    imageNotes:        '',

    visibleObjects: [
      { description: 'blue 200L chemical drum with HAZCHEM label',             category: 'A', observationType: 'DIRECT', quantity: 'four',   location: 'left bay' },
      { description: 'yellow spill pallet under drum storage',                  category: 'A', observationType: 'DIRECT',                       location: 'left bay' },
      { description: 'SDS binder mounted on wall bracket',                      category: 'B', observationType: 'DIRECT',                       location: 'entrance wall' },
      { description: 'PPE station with gloves, goggles and apron',              category: 'B', observationType: 'DIRECT',                       location: 'entrance' },
      { description: 'eyewash station mounted on wall, unobstructed',           category: 'B', observationType: 'DIRECT',                       location: 'right wall' },
      { description: 'CO2 fire extinguisher on wall bracket',                   category: 'B', observationType: 'DIRECT',                       location: 'exit' },
      { description: 'chemical incompatibility chart laminated on wall',        category: 'B', observationType: 'DIRECT',                       location: 'centre wall' },
      { description: 'clear yellow aisle marking on floor',                     category: 'B', observationType: 'DIRECT',                       location: 'centre aisle' },
      { description: 'quantity limit sign posted above drum storage',           category: 'B', observationType: 'DIRECT',                       location: 'left bay upper' },
    ],

    positiveCompliance: [
      { dimension: 'labelling',     observation: 'All four drums have HAZCHEM labels and chemical name markings.',           observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'safety',        observation: 'Eyewash station is mounted, clearly visible, and path is unobstructed.',   observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'safety',        observation: 'PPE station is present at entrance with gloves, goggles, and apron.',      observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'layout',        observation: 'Clear 1-metre aisle markings visible throughout the storage bay.',          observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'organisation',  observation: 'SDS binder is mounted at entrance and appears current.',                    observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'standards',     observation: 'Chemical incompatibility chart and quantity limits are posted visibly.',    observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'cleanliness',   observation: 'Floor is dry, no residue or staining visible in the storage bay.',          observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'storage',       observation: 'All drums on spill pallets providing secondary containment.',               observationType: 'DIRECT', confidence: 'HIGH' },
    ],

    violations: [],   // No violations — excellent condition
  },

  expectations: {
    pillarRatings: {
      SORT:        'Very Good',
      SET_IN_ORDER: 'Very Good',
      SHINE:       'Very Good',
      STANDARDIZE: 'Very Good',
      SUSTAIN:     'Good',
    },
    questionRatings: {
      'SORT-01': 'Very Good',
      'SIO-01':  'Very Good',
      'SHN-02':  'Very Good',
      'STD-01':  'Very Good',
    },
    overallScore: { min: 80, max: 100, target: 92 },
    minReliability: 80,
    maxConsistencyFlags: 0,
  },

  humanAuditorNotes: 'Model chemical storage area. Full compliance across all five pillars. Eyewash, PPE, SDS, spill containment all present and accessible. Only minor uncertainty on Sustain — cannot confirm from one photo whether audits are regularly completed.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Chemical Storage — Poor
// ═══════════════════════════════════════════════════════════════════════════════

const CHEMICAL_POOR: GoldenDatasetScenario = {
  scenarioId:  'chemical-storage-poor',
  description: 'Severely non-compliant chemical storage. Unlabelled drums, blocked exit, visible spill, no SDS, no PPE.',
  zone:        'Chemical Storage',

  evidenceModel: {
    generatedAt:       '2024-01-01T00:00:00Z',
    zone:              'Chemical Storage',
    expectedObjects:   ['chemical drums', 'spill pallets', 'SDS binder', 'PPE station', 'eyewash station', 'fire extinguisher'],
    overallConfidence: 'MEDIUM',
    imageNotes:        'Moderate image quality — some rear of bay not visible.',

    visibleObjects: [
      { description: 'unmarked grey drum with no label',                        category: 'D', observationType: 'DIRECT', quantity: 'three',  location: 'centre' },
      { description: 'cardboard boxes stacked blocking emergency exit door',    category: 'D', observationType: 'DIRECT',                       location: 'rear right' },
      { description: 'dark liquid pooled on floor outside containment',         category: 'D', observationType: 'DIRECT',                       location: 'left foreground' },
      { description: 'fire extinguisher obscured by stacked drums',             category: 'D', observationType: 'DIRECT',                       location: 'left wall' },
      { description: 'old drum with crossed-out label and faded markings',      category: 'D', observationType: 'DIRECT',                       location: 'rear left' },
    ],

    positiveCompliance: [],  // No compliance evidence

    violations: [
      {
        dimension: 'safety',       observation: 'Three drums are completely unlabelled — chemical identity unknown.',
        severity:  'MAJOR',        evidence: 'unmarked grey drum with no label (three)',
        imageLocation: 'centre',   observationType: 'DIRECT',  confidence: 'HIGH',
      },
      {
        dimension: 'safety',       observation: 'Emergency exit door is blocked by stacked cardboard boxes.',
        severity:  'CRITICAL',     evidence: 'cardboard boxes stacked blocking emergency exit door',
        imageLocation: 'rear right', observationType: 'DIRECT', confidence: 'HIGH',
      },
      {
        dimension: 'cleanliness',  observation: 'Visible dark liquid pooled on floor outside secondary containment.',
        severity:  'MAJOR',        evidence: 'dark liquid pooled on floor outside containment',
        imageLocation: 'left foreground', observationType: 'DIRECT', confidence: 'HIGH',
      },
      {
        dimension: 'safety',       observation: 'Fire extinguisher is obscured and inaccessible due to drum placement.',
        severity:  'CRITICAL',     evidence: 'fire extinguisher obscured by stacked drums',
        imageLocation: 'left wall', observationType: 'DIRECT', confidence: 'HIGH',
      },
      {
        dimension: 'labelling',    observation: 'One drum has faded, crossed-out label — contents cannot be confirmed.',
        severity:  'MODERATE',     evidence: 'old drum with crossed-out label and faded markings',
        imageLocation: 'rear left', observationType: 'DIRECT', confidence: 'HIGH',
      },
    ],
  },

  expectations: {
    pillarRatings: {
      SORT:        'Very Bad',
      SET_IN_ORDER: 'Very Bad',
      SHINE:       'Very Bad',
      STANDARDIZE: 'Very Bad',
      SUSTAIN:     'Very Bad',
    },
    questionRatings: {
      'SORT-01': 'Very Bad',
      'SIO-03':  'Very Bad',
      'SHN-02':  'Very Bad',
      'STD-01':  'Very Bad',
    },
    overallScore: { min: 0, max: 20, target: 8 },
    minReliability: 40,
    maxConsistencyFlags: 5,
  },

  humanAuditorNotes: 'Severe non-compliance. CRITICAL safety violations (blocked exit, inaccessible fire extinguisher). Immediate corrective action required before resuming operations. All pillars fail.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Warehouse — Average
// ═══════════════════════════════════════════════════════════════════════════════

const WAREHOUSE_AVERAGE: GoldenDatasetScenario = {
  scenarioId:  'warehouse-average',
  description: 'Mixed compliance warehouse. Some floor markings, pallets in designated areas, some unlabelled shelves, minor dust.',
  zone:        'Warehouse',

  evidenceModel: {
    generatedAt:       '2024-01-01T00:00:00Z',
    zone:              'Warehouse',
    expectedObjects:   ['racking system', 'pallets', 'forklift', 'floor markings', 'safety signs'],
    overallConfidence: 'MEDIUM',
    imageNotes:        'Good image quality — rear of warehouse not visible.',

    visibleObjects: [
      { description: 'metal racking with labelled shelves on lower two tiers',  category: 'A', observationType: 'DIRECT',                       location: 'left wall' },
      { description: 'metal racking with no labels on upper two tiers',         category: 'A', observationType: 'DIRECT',                       location: 'left wall upper' },
      { description: 'pallets in yellow floor zone markings',                   category: 'A', observationType: 'DIRECT', quantity: 'four',      location: 'centre' },
      { description: 'forklift parked in designated bay',                       category: 'A', observationType: 'DIRECT',                       location: 'right' },
      { description: 'thin dust layer on upper shelving surfaces',              category: 'C', observationType: 'DIRECT',                       location: 'upper shelving' },
      { description: 'yellow floor aisle markings — partial coverage',          category: 'B', observationType: 'DIRECT',                       location: 'main aisle' },
      { description: 'one unlabelled cardboard box in aisle',                   category: 'C', observationType: 'DIRECT',                       location: 'centre aisle' },
    ],

    positiveCompliance: [
      { dimension: 'layout',        observation: 'Pallets are stored within clearly marked yellow floor zones.',             observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'organisation',  observation: 'Forklift is parked in its designated bay.',                                observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'labelling',     observation: 'Lower two tiers of racking have visible shelf labels.',                    observationType: 'DIRECT', confidence: 'MEDIUM' },
      { dimension: 'layout',        observation: 'Main aisle has yellow floor markings — partial coverage.',                 observationType: 'DIRECT', confidence: 'MEDIUM' },
    ],

    violations: [
      {
        dimension: 'labelling',    observation: 'Upper two tiers of racking have no visible shelf labels.',
        severity:  'MODERATE',     evidence: 'metal racking with no labels on upper two tiers',
        imageLocation: 'left wall upper', observationType: 'DIRECT', confidence: 'HIGH',
      },
      {
        dimension: 'cleanliness',  observation: 'Visible dust accumulation on upper shelving surfaces.',
        severity:  'MINOR',        evidence: 'thin dust layer on upper shelving surfaces',
        imageLocation: 'upper shelving', observationType: 'DIRECT', confidence: 'MEDIUM',
      },
      {
        dimension: 'organisation', observation: 'One unlabelled cardboard box placed in the main aisle.',
        severity:  'MINOR',        evidence: 'one unlabelled cardboard box in aisle',
        imageLocation: 'centre aisle', observationType: 'DIRECT', confidence: 'HIGH',
      },
    ],
  },

  expectations: {
    pillarRatings: {
      SORT:        'Good',
      SET_IN_ORDER: 'Average',
      SHINE:       'Average',
      STANDARDIZE: 'Average',
      SUSTAIN:     'Average',
    },
    questionRatings: {},
    overallScore: { min: 40, max: 65, target: 52 },
    minReliability: 55,
    maxConsistencyFlags: 2,
  },

  humanAuditorNotes: 'Mixed condition warehouse. Positive: pallets in zones, forklift in bay, partial labelling. Negatives: upper shelving unlabelled, minor dust, aisle markings incomplete. Average overall — improvement actions medium priority.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Production — Good
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCTION_GOOD: GoldenDatasetScenario = {
  scenarioId:  'production-good',
  description: 'Mostly compliant production zone. Machines labelled, tools on shadow boards, clean floors, one dusty corner.',
  zone:        'Production',

  evidenceModel: {
    generatedAt:       '2024-01-01T00:00:00Z',
    zone:              'Production',
    expectedObjects:   ['production machines', 'tool shadow board', 'workbench', 'cleaning station', 'SOP holder'],
    overallConfidence: 'HIGH',
    imageNotes:        '',

    visibleObjects: [
      { description: 'CNC machine with visible identification plate M-012',     category: 'A', observationType: 'DIRECT',                       location: 'centre left' },
      { description: 'shadow board with tool outlines, all tools present',      category: 'B', observationType: 'DIRECT',                       location: 'right wall' },
      { description: 'workbench with SOP holder and laminated instructions',    category: 'A', observationType: 'DIRECT',                       location: 'front left' },
      { description: 'cleaning station with broom, mop and wipes',             category: 'B', observationType: 'DIRECT',                       location: 'entrance' },
      { description: 'yellow floor aisle markings — full coverage',             category: 'B', observationType: 'DIRECT',                       location: 'all aisles' },
      { description: 'fine dust accumulation in far rear corner',               category: 'C', observationType: 'DIRECT',                       location: 'rear corner' },
      { description: 'SOP holder at second machine — SOP document present',    category: 'B', observationType: 'DIRECT',                       location: 'centre right' },
    ],

    positiveCompliance: [
      { dimension: 'labelling',     observation: 'CNC machine M-012 has clear identification plate visible.',                observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'organisation',  observation: 'Shadow board present with all tool outlines — all tools in place.',        observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'standards',     observation: 'SOP holder with laminated instructions at primary workbench.',              observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'cleanliness',   observation: 'Cleaning station at entrance with broom, mop, and wipes.',                 observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'layout',        observation: 'Full floor aisle marking coverage — all pathways clearly delineated.',     observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'standards',     observation: 'Second machine also has SOP document holder with current SOP.',            observationType: 'DIRECT', confidence: 'HIGH' },
      { dimension: 'cleanliness',   observation: 'Floor throughout main production area is clean and dry.',                  observationType: 'DIRECT', confidence: 'HIGH' },
    ],

    violations: [
      {
        dimension: 'cleanliness',  observation: 'Fine dust accumulation visible in far rear corner of the production zone.',
        severity:  'MINOR',        evidence: 'fine dust accumulation in far rear corner',
        imageLocation: 'rear corner', observationType: 'DIRECT', confidence: 'MEDIUM',
      },
    ],
  },

  expectations: {
    pillarRatings: {
      SORT:        'Good',
      SET_IN_ORDER: 'Very Good',
      SHINE:       'Good',
      STANDARDIZE: 'Very Good',
      SUSTAIN:     'Good',
    },
    questionRatings: {
      'SIO-01': 'Very Good',
      'SIO-02': 'Very Good',
      'SIO-03': 'Very Good',
      'STD-02': 'Very Good',
    },
    overallScore: { min: 65, max: 85, target: 78 },
    minReliability: 70,
    maxConsistencyFlags: 0,
  },

  humanAuditorNotes: 'Good production zone. Excellent organisation, labelling, and SOPs. One minor dust issue in rear corner — calibration should suppress this given strong positive compliance. Sustain rated Good (not Very Good) as only one audit cycle visible.',
};

// ── Export all scenarios ──────────────────────────────────────────────────────

export const GOLDEN_SCENARIOS: readonly GoldenDatasetScenario[] = [
  CHEMICAL_EXCELLENT,
  CHEMICAL_POOR,
  WAREHOUSE_AVERAGE,
  PRODUCTION_GOOD,
];

export {
  CHEMICAL_EXCELLENT,
  CHEMICAL_POOR,
  WAREHOUSE_AVERAGE,
  PRODUCTION_GOOD,
};
