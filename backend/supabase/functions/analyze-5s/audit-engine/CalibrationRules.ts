/**
 * supabase/functions/analyze-5s/audit-engine/CalibrationRules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Named reusable calibration rules (Phase 4.1).
 *
 * Each rule represents a concrete observable workplace condition with a
 * named severity. Rules are referenced by QuestionCalibrationConfig and
 * injected into Stage B prompts as examples, giving the LLM concrete
 * guidance on how a human auditor would classify similar situations.
 *
 * Design invariants:
 *  - Zero pillar-specific logic
 *  - Zero zone-specific logic
 *  - Zero prompt content (only description + examples)
 *  - Pure data — no functions
 */

import type { CalibrationRuleKey, CalibrationSeverity } from './types.ts';

// ── Rule definition ────────────────────────────────────────────────────────────

export interface CalibrationRule {
  key:         CalibrationRuleKey;
  severity:    CalibrationSeverity;
  description: string;
  examples:    string[];
  /** If true, this condition caps rating at Very Bad regardless of other evidence */
  isCritical:  boolean;
}

// ── All named rules ────────────────────────────────────────────────────────────

export const CALIBRATION_RULES: Readonly<Record<CalibrationRuleKey, CalibrationRule>> = {

  ISOLATED_ITEM_NO_PENALTY: {
    key:         'ISOLATED_ITEM_NO_PENALTY',
    severity:    'MINOR',
    description: 'A single displaced or out-of-place item that has no operational or safety consequence.',
    examples: [
      'One loose chair near a workstation in an otherwise organised area',
      'A single empty box temporarily placed on a clear aisle',
      'One tool temporarily on a bench during active work',
    ],
    isCritical: false,
  },

  SINGLE_DUSTY_SURFACE_MINOR: {
    key:         'SINGLE_DUSTY_SURFACE_MINOR',
    severity:    'MINOR',
    description: 'Light or isolated dust accumulation on one surface area only.',
    examples: [
      'Thin dust layer on top of one storage cabinet',
      'Fine dust on a shelf that is otherwise clean',
      'Dust in a corner of a room where equipment is rarely accessed',
    ],
    isCritical: false,
  },

  BLOCKED_EMERGENCY_ACCESS_CRITICAL: {
    key:         'BLOCKED_EMERGENCY_ACCESS_CRITICAL',
    severity:    'CRITICAL',
    description: 'Any obstruction to emergency egress paths, fire equipment, or first-aid access.',
    examples: [
      'Items stacked blocking the path to a fire extinguisher',
      'Pallets placed across a marked emergency exit route',
      'Equipment positioned in front of eyewash station',
      'Boxes obstructing emergency exit door',
    ],
    isCritical: true,
  },

  SINGLE_UNLABELED_CONTAINER_MODERATE: {
    key:         'SINGLE_UNLABELED_CONTAINER_MODERATE',
    severity:    'MODERATE',
    description: 'One container, drum, or piece of equipment with no visible identification label.',
    examples: [
      'One chemical drum with no label or markings',
      'A single storage bin with no product name or contents label',
      'One machine with no identification plate or number',
    ],
    isCritical: false,
  },

  LOOSE_ITEM_IN_ACTIVE_ZONE_MINOR: {
    key:         'LOOSE_ITEM_IN_ACTIVE_ZONE_MINOR',
    severity:    'MINOR',
    description: 'A tool or item temporarily displaced during or just after active work.',
    examples: [
      'A wrench on a workbench next to an open machine panel',
      'A glove placed on a counter near a workstation',
      'A clipboard set aside during an inspection task',
    ],
    isCritical: false,
  },

  MULTIPLE_UNLABELED_EQUIPMENT_MAJOR: {
    key:         'MULTIPLE_UNLABELED_EQUIPMENT_MAJOR',
    severity:    'MAJOR',
    description: 'Three or more items, machines, or containers without any visible identification.',
    examples: [
      'Multiple drums with no labels in a chemical storage bay',
      'Several machines in a production area with no ID plates',
      'A row of storage bins with no labels or product names',
    ],
    isCritical: false,
  },

  CHEMICAL_SPILL_VISIBLE_MAJOR: {
    key:         'CHEMICAL_SPILL_VISIBLE_MAJOR',
    severity:    'MAJOR',
    description: 'Visible liquid spill or chemical residue on floor or surfaces, not in containment.',
    examples: [
      'Dark liquid pooled on floor near drum storage',
      'Chemical staining on floor outside containment bund',
      'Coloured residue visible on floor near mixing area',
    ],
    isCritical: false,
  },

  RUST_OR_CORROSION_MODERATE: {
    key:         'RUST_OR_CORROSION_MODERATE',
    severity:    'MODERATE',
    description: 'Visible surface rust, corrosion, or oxidation on equipment, piping, or structures.',
    examples: [
      'Orange-brown rust visible on pipe joints',
      'Corroded surface on machine frame',
      'Rust staining on a metal rack or shelving unit',
    ],
    isCritical: false,
  },

  ABSENT_CLEANING_TOOLS_MODERATE: {
    key:         'ABSENT_CLEANING_TOOLS_MODERATE',
    severity:    'MODERATE',
    description: 'No visible cleaning tools (mop, broom, wipes, vacuum) in a zone where they are expected.',
    examples: [
      'No broom or dustpan visible in a production zone',
      'No cleaning station or wipe dispenser in a food-grade area',
      'No mop and bucket visible in a chemical storage area',
    ],
    isCritical: false,
  },

  ABSENT_FLOOR_MARKINGS_MODERATE: {
    key:         'ABSENT_FLOOR_MARKINGS_MODERATE',
    severity:    'MODERATE',
    description: 'No visible floor markings, delineation, or aisle markings in a zone where they are expected.',
    examples: [
      'No yellow lines marking aisle boundaries in a warehouse',
      'No floor tape delineating storage zones in production',
      'No walkway marking visible in a zone requiring pedestrian segregation',
    ],
    isCritical: false,
  },

  ABSENT_ALL_LABELS_MAJOR: {
    key:         'ABSENT_ALL_LABELS_MAJOR',
    severity:    'MAJOR',
    description: 'No visible labels, signage, or identification on any equipment or storage across the area.',
    examples: [
      'Entire shelving system with no labels on any level',
      'All drums in a storage bay completely unlabelled',
      'No identification visible on any of several machines in the area',
    ],
    isCritical: false,
  },

  ABSENT_SOP_AT_WORKSTATION_MODERATE: {
    key:         'ABSENT_SOP_AT_WORKSTATION_MODERATE',
    severity:    'MODERATE',
    description: 'No visible SOP, work instruction, or operating standard at a workstation where one is expected.',
    examples: [
      'No laminated SOP visible at a chemical dispensing point',
      'No work instruction posted at a machine operation panel',
      'No visual guide visible at an assembly workstation',
    ],
    isCritical: false,
  },
};

/** Returns all rules that are CRITICAL (safety escalation triggers) */
export function getCriticalRules(): CalibrationRule[] {
  return Object.values(CALIBRATION_RULES).filter((r) => r.isCritical);
}

/** Returns the rule definition for a given key */
export function getCalibrationRule(key: CalibrationRuleKey): CalibrationRule {
  return CALIBRATION_RULES[key];
}

/** Returns a one-line example summary for prompt injection */
export function getCalibrationRuleExamples(keys: CalibrationRuleKey[]): string {
  return keys
    .map((k) => {
      const rule = CALIBRATION_RULES[k];
      return `  • ${rule.severity}: ${rule.description.split('.')[0]}`;
    })
    .join('\n');
}
