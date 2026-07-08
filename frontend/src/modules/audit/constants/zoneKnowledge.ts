/**
 * src/modules/audit/constants/zoneKnowledge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend mirror of the backend AuditKnowledgeBase.
 * Provides zone-specific inspection focus displayed to the auditor
 * before the audit begins — requires no API call.
 */

export interface ZoneProfile {
  /** Display label */
  label:         string;
  /** Emoji icon for visual identification */
  icon:          string;
  /** Short description of what the audit focuses on */
  auditFocus:    string;
  /** Items the auditor should expect to observe */
  expectedItems: string[];
  /** Key safety/compliance concerns */
  keyConcerns:   string[];
}

export const ZONE_KNOWLEDGE: Record<string, ZoneProfile> = {
  'Chemical Storage': {
    label:      'Chemical Storage Area',
    icon:       '⚗️',
    auditFocus: 'Hazardous material segregation, labelling, and containment compliance',
    expectedItems: [
      'Chemical containers and drums',
      'Spill containment pallets / bunds',
      'Hazard warning labels (GHS/SDS)',
      'Floor zone markings and segregation lines',
      'Secondary containment barriers',
      'Fire extinguishers and eyewash stations',
      'Ventilation signage',
    ],
    keyConcerns: [
      'Incompatible chemicals stored together',
      'Missing or expired SDS sheets',
      'Inadequate spill containment',
      'Unlabelled containers',
    ],
  },

  'Warehouse / Storage': {
    label:      'Warehouse / Storage Area',
    icon:       '📦',
    auditFocus: 'Material organisation, aisle clearance, and storage system compliance',
    expectedItems: [
      'Racking and shelving units',
      'Pallet storage areas',
      'Aisle and bay markings',
      'Forklift operating zones',
      'Inventory labelling and location codes',
      'Fire exit markings',
      'Loading/unloading bay',
    ],
    keyConcerns: [
      'Blocked emergency exits or aisles',
      'Overloaded racking without load ratings',
      'Unlabelled inventory locations',
      'Floor markings worn or missing',
    ],
  },

  'Production Line': {
    label:      'Production Line / Assembly Floor',
    icon:       '🏭',
    auditFocus: 'Workstation organisation, tooling control, and process cleanliness',
    expectedItems: [
      'Production machinery and fixtures',
      'Tool storage (shadow boards, cabinets)',
      'In-process inventory staging zones',
      'Work instructions / SOPs at point of use',
      'Quality check stations',
      'Scrap / rework quarantine area',
      'PPE stations',
    ],
    keyConcerns: [
      'Unneeded items on the production floor',
      'Missing or obsolete work instructions',
      'Tools not returned to designated locations',
      'Accumulated scrap without disposal',
    ],
  },

  'Assembly Area': {
    label:      'Assembly / Integration Area',
    icon:       '🔧',
    auditFocus: 'Component traceability, tool management, and assembly station order',
    expectedItems: [
      'Assembly jigs and fixtures',
      'Component kits and sub-assemblies',
      'Torque wrenches and calibrated tools',
      'Assembly SOPs and traveller cards',
      'Inspection checkpoints',
      'ESD protection mats and wrist straps',
    ],
    keyConcerns: [
      'Mixed / unverified component batches',
      'Uncalibrated torque tools in use',
      'Missing traveller documentation',
      'ESD protection absent near sensitive components',
    ],
  },

  'Laboratory': {
    label:      'Laboratory / Testing Area',
    icon:       '🔬',
    auditFocus: 'Sample control, equipment calibration, and contamination prevention',
    expectedItems: [
      'Lab benches and fume hoods',
      'Calibrated measurement instruments',
      'Sample storage and labelling',
      'Chemical reagent storage',
      'PPE (gloves, goggles, lab coats)',
      'Waste disposal containers',
      'Equipment calibration certificates',
    ],
    keyConcerns: [
      'Unlabelled samples or reagents',
      'Out-of-calibration instruments in use',
      'Inadequate fume hood usage',
      'Expired reagents not disposed of',
    ],
  },

  'Office / Admin': {
    label:      'Office / Administrative Area',
    icon:       '💼',
    auditFocus: 'Desk organisation, document management, and digital workspace discipline',
    expectedItems: [
      'Workstations and desks',
      'Filing systems and document storage',
      'Notice boards and communication zones',
      'Printer and shared equipment stations',
      'Cable management',
      'Break areas',
    ],
    keyConcerns: [
      'Cluttered desks with personal items',
      'Outdated notices or documents on boards',
      'Unsecured confidential documents',
      'Tangled or unsafe cabling',
    ],
  },

  'Utilities / Plant Room': {
    label:      'Utilities / Mechanical Plant Room',
    icon:       '⚡',
    auditFocus: 'Equipment accessibility, safety labelling, and maintenance traceability',
    expectedItems: [
      'Boilers, compressors, and HVAC units',
      'Electrical panels and distribution boards',
      'Pipework with flow direction labels',
      'Pressure and temperature gauges',
      'Isolation valves with tags',
      'Maintenance logs and service records',
    ],
    keyConcerns: [
      'Unlabelled isolation points',
      'Overdue service records',
      'Blocked access to emergency shutoffs',
      'Missing lock-out / tag-out procedures',
    ],
  },

  'Maintenance Workshop': {
    label:      'Maintenance Workshop',
    icon:       '🛠️',
    auditFocus: 'Tool control, spare parts management, and work order traceability',
    expectedItems: [
      'Hand tools and power tools',
      'Spare parts and components store',
      'Work order boards',
      'Lubrication and consumables cabinet',
      'Calibrated measurement tools',
      'Safety equipment (hearing protection, PPE)',
    ],
    keyConcerns: [
      'Unlabelled or mixed spare parts',
      'Tools not returned to shadow boards',
      'Open work orders without assignment',
      'Unsafe tool storage (sharp items exposed)',
    ],
  },

  'Packaging Area': {
    label:      'Packaging / Dispatch Area',
    icon:       '📫',
    auditFocus: 'Material flow, labelling accuracy, and outbound staging discipline',
    expectedItems: [
      'Packaging material storage (boxes, wrap)',
      'Labelling and barcoding stations',
      'Finished goods staging zones',
      'Dispatch documentation area',
      'Shrink wrap / strapping equipment',
      'Pallet wrapping station',
    ],
    keyConcerns: [
      'Mixed finished goods without separation',
      'Mislabelled or unlabelled outbound pallets',
      'Packaging materials blocking aisles',
      'Dispatch docs not matched to shipments',
    ],
  },

  'General Workplace': {
    label:      'General Workplace',
    icon:       '🏢',
    auditFocus: 'Overall 5S discipline across a mixed-use workspace',
    expectedItems: [
      'Workstations and work surfaces',
      'Storage areas and cabinets',
      'Walkways and circulation routes',
      'Notice boards',
      'Cleaning and maintenance stations',
      'Safety equipment and first aid',
    ],
    keyConcerns: [
      'General clutter and unneeded items',
      'Poor visual management',
      'Cleaning not maintained to standard',
      'Safety notices absent or outdated',
    ],
  },
};

/** Ordered list of zone keys for dropdown display */
export const ZONE_OPTIONS = Object.keys(ZONE_KNOWLEDGE);

/** Workspace type options */
export const WORKSPACE_TYPE_OPTIONS = [
  'Production Floor',
  'Office / Administrative',
  'Laboratory',
  'Warehouse / Logistics',
  'Workshop / Maintenance',
  'Chemical / Hazardous Materials',
  'Packaging / Dispatch',
  'Plant Room / Utilities',
  'General / Mixed Use',
] as const;

export type WorkspaceType = (typeof WORKSPACE_TYPE_OPTIONS)[number];
