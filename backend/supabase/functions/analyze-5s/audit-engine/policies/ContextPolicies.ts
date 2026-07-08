/**
 * supabase/functions/analyze-5s/audit-engine/policies/ContextPolicies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Zone-specific interpretation policies for the Audit Decision Matrix (Phase 4).
 *
 * Supplements AuditKnowledgeBase by defining:
 *  - Which objects must NEVER be penalized in a given zone
 *  - Question-specific override rules for a zone
 *
 * These policies prevent false violations like flagging spill pallets as
 * "unnecessary equipment" in a chemical storage zone.
 *
 * Design invariants:
 *  - No pillar names
 *  - No prompt content
 *  - Zero hardcoded ratings
 */

// ── Context Policy Shape ───────────────────────────────────────────────────────

export type ContextPolicyKey =
  | 'CHEMICAL_STORAGE'
  | 'WAREHOUSE'
  | 'LABORATORY'
  | 'PRODUCTION'
  | 'MAINTENANCE'
  | 'OFFICE'
  | 'ASSEMBLY'
  | 'UTILITIES'
  | 'PACKAGING'
  | 'GENERAL';

export interface ContextPolicy {
  key:        ContextPolicyKey;
  /** Zone name substrings that trigger this policy (lowercase) */
  zoneNames:  string[];
  /**
   * Objects that are ALWAYS expected in this zone.
   * These must never be penalized regardless of any other logic.
   * Matched case-insensitively against VisibleObject.description.
   */
  alwaysExpected: string[];
  /**
   * Per-question overrides: maps a questionId to a clarifying instruction
   * injected into the Stage B evaluator prompt for that question only.
   */
  questionOverrides: Partial<Record<string, string>>;
}

// ── Policy Registry ────────────────────────────────────────────────────────────

export const CONTEXT_POLICIES: Readonly<Record<ContextPolicyKey, ContextPolicy>> = {

  CHEMICAL_STORAGE: {
    key:      'CHEMICAL_STORAGE',
    zoneNames: ['chemical', 'hazchem', 'hazmat', 'solvent', 'reagent storage'],
    alwaysExpected: [
      'chemical drum', 'chemical drums',
      'spill pallet', 'spill pallets',
      'containment tray', 'containment trays',
      'drum pump', 'drum pumps',
      'ibc', 'intermediate bulk container',
      'secondary containment',
      'bunded floor', 'bund',
      'hazard diamond', 'hazchem sign',
      'ppe station', 'eyewash', 'eye wash',
      'fire extinguisher',
      'spill kit',
    ],
    questionOverrides: {
      'SORT-02': 'Drum pumps, spill pallets, containment trays and PPE are always expected in a Chemical Storage zone. Do NOT classify them as unnecessary tools.',
      'SORT-03': 'Secondary containment equipment, bunded platforms and chemical handling equipment are always expected. Do NOT flag as unused machines.',
      'SHN-01': 'Spill kits and hazmat-specific cleaning equipment are expected here. Absence of general domestic cleaning tools is not a deficiency.',
    },
  },

  WAREHOUSE: {
    key:      'WAREHOUSE',
    zoneNames: ['warehouse', 'dispatch', 'despatch', 'distribution', 'stores'],
    alwaysExpected: [
      'pallet racking', 'racking',
      'pallets', 'pallet',
      'forklift', 'pallet jack',
      'stretch wrap', 'shrink wrap',
      'dock leveller',
    ],
    questionOverrides: {
      'SORT-03': 'Forklifts and pallet jacks are expected warehouse equipment. Do NOT flag as unused machines unless visibly decommissioned.',
    },
  },

  PRODUCTION: {
    key:      'PRODUCTION',
    zoneNames: ['production', 'manufacturing', 'line', 'conveyor'],
    alwaysExpected: [
      'production machinery', 'conveyor',
      'in-process bin', 'in process bin',
      'jig', 'fixture',
      'hand tool', 'measuring instrument',
      'wip bin', 'work in progress',
    ],
    questionOverrides: {
      'SORT-02': 'Jigs, fixtures, and in-process bins are expected production items. Evaluate only items visibly displaced from their designated area.',
      'SORT-03': 'Production machinery is expected. Do NOT flag as unused unless clearly decommissioned (e.g. visibly disconnected, covered, or tagged out).',
    },
  },

  ASSEMBLY: {
    key:      'ASSEMBLY',
    zoneNames: ['assembly', 'fit-up', 'build'],
    alwaysExpected: [
      'assembly workbench', 'workbench',
      'torque tool', 'driver',
      'jig', 'assembly fixture',
      'esd mat', 'wrist strap',
      'part presentation rack',
      'testing equipment',
    ],
    questionOverrides: {
      'SORT-02': 'Assembly tools, torque drivers, ESD wrist straps, and part presentation racks are expected assembly items.',
    },
  },

  LABORATORY: {
    key:      'LABORATORY',
    zoneNames: ['lab', 'laboratory', 'testing room', 'quality lab'],
    alwaysExpected: [
      'balance', 'spectrophotometer', 'analytical instrument',
      'glassware', 'beaker', 'flask', 'pipette',
      'reagent bottle', 'chemical container',
      'centrifuge', 'incubator',
      'fume hood',
      'reagent cabinet',
    ],
    questionOverrides: {
      'SORT-02': 'Analytical instruments, glassware and reagent containers are expected laboratory equipment. Evaluate only items clearly abandoned or expired.',
      'SORT-03': 'Centrifuges, incubators, and fume hoods are expected. Do NOT flag as unused unless visibly disconnected or inoperative.',
      'SHN-01': 'Lab-specific cleaning equipment (lint-free wipes, solvent-appropriate cleaning agents) is expected. General domestic cleaning tools may not be present.',
    },
  },

  OFFICE: {
    key:      'OFFICE',
    zoneNames: ['office', 'admin', 'administration', 'reception'],
    alwaysExpected: [
      'computer', 'monitor', 'keyboard',
      'filing cabinet',
      'desk', 'chair',
      'printer', 'scanner',
    ],
    questionOverrides: {
      'SORT-01': 'Office documents and filing materials are expected. Evaluate only items visibly out of place or accumulated excessively.',
    },
  },

  UTILITIES: {
    key:      'UTILITIES',
    zoneNames: ['utilities', 'utility', 'plant room', 'boiler', 'compressor'],
    alwaysExpected: [
      'pump', 'compressor',
      'control panel', 'switchboard',
      'electrical panel',
      'piping', 'pipe',
      'hvac', 'valve',
      'gauge', 'instrument',
    ],
    questionOverrides: {
      'SORT-03': 'Pumps, compressors, and control panels are integral utilities equipment. Do NOT flag as unnecessary unless clearly decommissioned.',
    },
  },

  MAINTENANCE: {
    key:      'MAINTENANCE',
    zoneNames: ['maintenance', 'workshop', 'repair', 'engineering'],
    alwaysExpected: [
      'hand tool', 'spanner', 'screwdriver', 'pliers',
      'power tool',
      'spare part', 'spare parts',
      'service equipment',
      'measuring instrument', 'testing instrument',
    ],
    questionOverrides: {
      'SORT-02': 'Hand tools and service equipment are expected in a Maintenance zone. Evaluate only items visibly displaced from shadow boards or abandoned.',
    },
  },

  PACKAGING: {
    key:      'PACKAGING',
    zoneNames: ['packaging', 'packing', 'pack'],
    alwaysExpected: [
      'packaging machine', 'sealer', 'strapper', 'labeller',
      'carton', 'packaging material',
      'weighing scale',
      'pallet wrapper',
      'label printer',
    ],
    questionOverrides: {
      'SORT-01': 'Cartons and packaging materials are expected. Evaluate only excessive accumulation beyond one shift supply at the station.',
    },
  },

  GENERAL: {
    key:      'GENERAL',
    zoneNames: [],  // fallback — matches when no other zone matches
    alwaysExpected: [],
    questionOverrides: {},
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resolves the ContextPolicy that best matches a given zone name string.
 * Falls back to GENERAL if no keywords match.
 */
export function resolveContextPolicy(selectedZone: string): ContextPolicy {
  const z = selectedZone.toLowerCase();
  for (const policy of Object.values(CONTEXT_POLICIES)) {
    if (policy.zoneNames.some((kw) => z.includes(kw))) {
      return policy;
    }
  }
  return CONTEXT_POLICIES.GENERAL;
}

/**
 * Returns true if the object description matches any alwaysExpected item
 * in the given context policy. Case-insensitive substring match.
 */
export function isAlwaysExpected(description: string, policy: ContextPolicy): boolean {
  const d = description.toLowerCase();
  return policy.alwaysExpected.some((expected) => d.includes(expected.toLowerCase()));
}

/**
 * Returns the question-specific override text for a given questionId
 * within a ContextPolicy, or null if no override exists.
 */
export function getQuestionOverride(
  questionId: string,
  policy: ContextPolicy,
): string | null {
  return policy.questionOverrides[questionId] ?? null;
}
