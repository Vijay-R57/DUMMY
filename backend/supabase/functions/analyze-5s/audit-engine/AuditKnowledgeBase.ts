/**
 * supabase/functions/analyze-5s/audit-engine/AuditKnowledgeBase.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Zone Knowledge Base — 10 industrial zones × 7 dimensions (Phase 3B).
 *
 * Provides expected zone characteristics that PromptBuilder injects as
 * audit context, calibrating the AI's expectations for what "should be
 * present" in the selected zone.
 *
 * Design invariants:
 *  - Zero pillar names
 *  - Zero question text
 *  - Zero prompt content
 *  - Zone matching is keyword-based — always falls back to 'General'
 */

import type { ZoneKnowledge } from './types.ts';

// ── Zone definitions (10 zones × 7 dimensions) ────────────────────────────────

const ZONE_CATALOGUE: ZoneKnowledge[] = [
  // ── 1. Chemical Storage ─────────────────────────────────────────────────────
  {
    zoneName: 'Chemical Storage',
    expectedEquipment: [
      'chemical drums',
      'intermediate bulk containers (IBCs)',
      'spill pallets',
      'containment trays',
      'drum pumps',
      'secondary containment bunds',
    ],
    expectedDocuments: [
      'safety data sheets (SDS)',
      'HAZCHEM schedule',
      'hazardous material inventory register',
      'emergency response procedures',
      'chemical incompatibility chart',
    ],
    expectedSafetyAssets: [
      'hazard diamond signs',
      'spill kits',
      'segregation markings (chemical family)',
      'PPE station (gloves, goggles, apron)',
      'eyewash station',
      'fire extinguisher (dry powder or CO₂)',
    ],
    expectedLayout: [
      'segregated bays by chemical family',
      'minimum 1-metre clear access aisles',
      'bunded floor area to contain spills',
      'clear emergency exit path',
      'ventilation provision',
    ],
    expectedVisualControls: [
      'hazard class labels on all containers',
      'chemical name and concentration labels',
      'quantity limits posted',
      'spill response instructions posted',
      'storage incompatibility chart visible',
    ],
    expectedCleanliness: [
      'no liquid pooling or wet floors',
      'no residue on container exteriors',
      'dry bunded floor area',
      'no corroded or damaged containers',
    ],
    expectedStoragePractices: [
      'secondary containment for all liquid chemicals',
      'chemical families segregated (acids / bases / flammables separated)',
      'vertical stacking within drum manufacturer limits',
      'FIFO rotation applied to inventory',
    ],
  },

  // ── 2. Warehouse / Dispatch ─────────────────────────────────────────────────
  {
    zoneName: 'Warehouse',
    expectedEquipment: [
      'pallet racking',
      'pallets',
      'forklifts',
      'pallet jacks',
      'dock levellers',
      'stretch wrap dispensers',
    ],
    expectedDocuments: [
      'picking lists',
      'inventory labels',
      'shipping documents and delivery notes',
      'rack load limit placards',
      'FIFO rotation instructions',
    ],
    expectedSafetyAssets: [
      'safety barriers (pedestrian / forklift separation)',
      'pedestrian lane floor markings',
      'forklift speed limit signs',
      'safety footwear requirement signs',
      'rack damage inspection tags',
    ],
    expectedLayout: [
      'pedestrian lanes clearly marked and unobstructed',
      'FIFO flow direction indicated',
      'dock staging areas delineated',
      'minimum 3-metre forklift aisle width',
      'emergency exits clear and signposted',
    ],
    expectedVisualControls: [
      'rack location codes (row / bay / level)',
      'bin labels with SKU and description',
      'FIFO directional arrows',
      'maximum weight / height limit signs',
      'zone identification signage',
    ],
    expectedCleanliness: [
      'no debris or packaging waste on floors',
      'no loose shrink wrap in aisles',
      'rack bays clear of fallen stock',
      'dock areas swept and dry',
    ],
    expectedStoragePractices: [
      'FIFO racking applied',
      'all bins and locations labeled',
      'no floor stacking outside designated areas',
      'heavy items stored at low rack levels',
    ],
  },

  // ── 3. Production Line ──────────────────────────────────────────────────────
  {
    zoneName: 'Production Line',
    expectedEquipment: [
      'production machinery',
      'conveyors',
      'in-process bins',
      'jigs and fixtures',
      'hand tools',
      'measuring instruments',
    ],
    expectedDocuments: [
      'work instructions (current revision)',
      'quality checksheets',
      'production schedules',
      'defect / rejection tags',
      'changeover instructions',
    ],
    expectedSafetyAssets: [
      'machine guards installed and closed',
      'emergency stop buttons clearly marked',
      'safety tape on hazard zones',
      'eye wash station within 10 seconds travel',
      'PPE requirement signage at entry',
    ],
    expectedLayout: [
      'fixed workstation layout within designated zones',
      'WIP zones marked and sized to takt time',
      'tool shadow boards at point of use',
      'clear walkways between workstations',
      'raw material and finished goods areas delineated',
    ],
    expectedVisualControls: [
      'kanban cards in use',
      'WIP bin labels with quantity limits',
      'cycle time displays at workstations',
      'quality status boards (pass / fail counts)',
      'process parameter displays',
    ],
    expectedCleanliness: [
      'no metal swarf or chips on floor',
      'workbenches clear of non-production items between shifts',
      'coolant or oil not pooling on floor',
      'chip guards installed and positioned correctly',
    ],
    expectedStoragePractices: [
      'WIP bins sized to one takt cycle',
      'shadow boards at every workstation',
      'no hoarding of excess WIP beyond kanban quantity',
      'tools returned to shadow boards after use',
    ],
  },

  // ── 4. Assembly Area ────────────────────────────────────────────────────────
  {
    zoneName: 'Assembly',
    expectedEquipment: [
      'assembly workbenches',
      'torque tools and drivers',
      'jigs and assembly fixtures',
      'ESD mats and wrist straps',
      'part presentation racks',
      'testing equipment',
    ],
    expectedDocuments: [
      'assembly instructions (current revision)',
      'visual work aids',
      'bill of materials (BOM)',
      'inspection and acceptance records',
      'OK / NG sample standards visible at station',
    ],
    expectedSafetyAssets: [
      'anti-static precaution notices',
      'PPE requirement signs (as applicable)',
      'ergonomic guidance posted',
      'first aid kit location identified',
      'manual handling guidance for heavy components',
    ],
    expectedLayout: [
      'ergonomic bench heights set per operator',
      'all tools at point of use',
      'part presentation racks within reach',
      'finished assembly storage area designated',
      'rework and scrap areas clearly delineated',
    ],
    expectedVisualControls: [
      'revision-controlled assembly instructions posted',
      'OK / NG sample boards at each station',
      'part labels on all bins and racks',
      'torque specifications posted at fastening stations',
      'quality alert notices visible where applicable',
    ],
    expectedCleanliness: [
      'ESD mat surfaces clean and continuous',
      'benches free of non-assembly items',
      'floor clear of dropped components',
      'no dust accumulation on sensitive components',
    ],
    expectedStoragePractices: [
      'parts kitted per station per cycle',
      'shadow boards for all hand tools',
      'no excess stock at station beyond one-shift quantity',
      'components stored in ESD-safe containers where required',
    ],
  },

  // ── 5. Laboratory ───────────────────────────────────────────────────────────
  {
    zoneName: 'Laboratory',
    expectedEquipment: [
      'analytical instruments (balances, spectrophotometers, etc.)',
      'glassware (beakers, flasks, pipettes)',
      'reagent bottles and chemical containers',
      'centrifuges and incubators',
      'fume hood',
    ],
    expectedDocuments: [
      'standard operating procedures (SOPs) — current revision',
      'calibration records for all instruments',
      'reagent inventory and expiry log',
      'safety data sheets for all chemicals in use',
      'sample log and chain of custody records',
    ],
    expectedSafetyAssets: [
      'chemical splash goggles and lab coat requirement signs',
      'fume hood usage instructions posted',
      'spill kit accessible within the lab',
      'sharps disposal container',
      'eyewash station within 10 seconds travel',
    ],
    expectedLayout: [
      'instrument benches clear of non-analytical items',
      'reagent cabinets closed and segregated by chemical type',
      'designated clean and dirty glassware zones',
      'sample intake area separate from analysis area',
      'waste chemical disposal area delineated',
    ],
    expectedVisualControls: [
      'reagent labels (name, concentration, preparation date, expiry)',
      'instrument calibration status labels (due date visible)',
      'sample ID labels on all samples in progress',
      'hazard identification on all chemical storage cabinets',
    ],
    expectedCleanliness: [
      'no chemical residue on bench surfaces',
      'glassware clean and stored in designated areas',
      'floors dry and free of chemical splashes',
      'fume hood interior free of residue and debris',
    ],
    expectedStoragePractices: [
      'reagent cabinets locked when not in use',
      'samples labeled with ID, date, and responsible analyst',
      'expired reagents removed from active storage',
      'glassware stored inverted or covered to prevent contamination',
    ],
  },

  // ── 6. Office ───────────────────────────────────────────────────────────────
  {
    zoneName: 'Office',
    expectedEquipment: [
      'computers and monitors',
      'filing cabinets',
      'desks and chairs',
      'telephones',
      'printers and scanners',
    ],
    expectedDocuments: [
      'work procedures and standard forms',
      'notice boards (current, not outdated)',
      'policy documents',
      'meeting minutes and action logs',
      'employee directory and org chart',
    ],
    expectedSafetyAssets: [
      'fire extinguisher accessible and tagged',
      'emergency exit signs illuminated',
      'electrical safety notices near power boards',
      'first aid kit location identified',
    ],
    expectedLayout: [
      'desks clear of non-work items',
      'filing cabinets assigned by person or function',
      'aisles between desks unobstructed',
      'notice boards assigned and owned',
      'printer and supply area delineated',
    ],
    expectedVisualControls: [
      'file labels on all cabinet drawers',
      'cabinet labels by owner or department',
      'notice board contents dated and current',
      'desk nameplates or workspace identifiers',
    ],
    expectedCleanliness: [
      'no food debris on desks or in workspaces',
      'floors clear of bags and personal items',
      'bins not overflowing',
      'monitor screens and keyboards free of dust',
    ],
    expectedStoragePractices: [
      'all documents filed in labeled cabinets',
      'no paper stacked on floors or window sills',
      'digital files organized per naming convention',
      'personal belongings stored in assigned areas',
    ],
  },

  // ── 7. Utilities ────────────────────────────────────────────────────────────
  {
    zoneName: 'Utilities',
    expectedEquipment: [
      'pumps and compressors',
      'control panels and switchboards',
      'piping systems',
      'electrical panels',
      'HVAC equipment',
    ],
    expectedDocuments: [
      'preventive maintenance (PM) schedules posted',
      'maintenance log books',
      'P&ID (piping and instrument diagrams)',
      'isolation and lockout/tagout procedures',
      'equipment history cards',
    ],
    expectedSafetyAssets: [
      'lockout/tagout notices at all isolation points',
      'electrical hazard signs on all panels',
      'hot surface warning labels on steam lines',
      'confined space entry notices where applicable',
      'arc flash protection notices on electrical panels',
    ],
    expectedLayout: [
      'minimum 1-metre access clearance around all panels',
      'isolation points clearly labeled and accessible',
      'walkways through utilities area clear',
      'equipment identification numbers visible',
    ],
    expectedVisualControls: [
      'pipe identification (color code + flow direction arrows)',
      'panel labels and circuit identification',
      'valve tags with position indicators (open / closed)',
      'equipment ID tags with maintenance interval',
      'calibration stickers on gauges and instruments',
    ],
    expectedCleanliness: [
      'no fluid leaks on floors',
      'dust accumulation on panels within acceptable limits',
      'no rust or corrosion on visible pipe joints',
      'drip trays dry or emptied',
    ],
    expectedStoragePractices: [
      'spare parts in labeled, dedicated bins',
      'no improvised storage mounted on equipment',
      'consumables (gaskets, fittings) in closed, labeled containers',
    ],
  },

  // ── 8. Maintenance ──────────────────────────────────────────────────────────
  {
    zoneName: 'Maintenance',
    expectedEquipment: [
      'hand tools (spanners, screwdrivers, pliers)',
      'power tools',
      'spare parts inventory',
      'service and repair equipment',
      'measuring and testing instruments',
    ],
    expectedDocuments: [
      'job cards and work orders',
      'equipment history cards',
      'tool calibration records',
      'preventive maintenance checklists',
      'spare parts cross-reference lists',
    ],
    expectedSafetyAssets: [
      'PPE requirements posted at workshop entry',
      'machine-specific lockout/tagout procedures',
      'manual handling guidance for heavy parts',
      'first aid kit accessible',
      'fire extinguisher within 15 metres',
    ],
    expectedLayout: [
      'tool shadow boards in use at every workbench',
      'spare parts bins labeled and in assigned locations',
      'work-in-repair area delineated',
      'walkways through workshop clear',
      'hazardous waste (oils, solvents) storage area designated',
    ],
    expectedVisualControls: [
      'tool labels on every shadow board position',
      'bin labels with part number and description',
      'equipment ID tags on tools and instruments',
      'calibration due-date stickers on all measuring instruments',
      'spare parts minimum / maximum stock levels posted',
    ],
    expectedCleanliness: [
      'no oil spills on workshop floor',
      'workbenches clear of unused parts between jobs',
      'no open containers of solvents or lubricants',
      'swarf and filings collected and disposed of',
    ],
    expectedStoragePractices: [
      'tools returned to shadow boards immediately after use',
      'FIFO applied to spare parts bins',
      'no open containers of oil or solvent stored on benches',
      'calibrated instruments stored in protective cases',
    ],
  },

  // ── 9. Packaging ────────────────────────────────────────────────────────────
  {
    zoneName: 'Packaging',
    expectedEquipment: [
      'packaging machines (sealer, strapper, labeller)',
      'cartons and packaging materials',
      'weighing scales',
      'pallet wrappers',
      'label printers',
    ],
    expectedDocuments: [
      'packaging specifications',
      'batch records and production orders',
      'weight check records',
      'label verification records',
      'customer packaging requirements (where applicable)',
    ],
    expectedSafetyAssets: [
      'manual handling guidance for heavy cartons',
      'ergonomic signage at packing stations',
      'first aid kit location identified',
      'safety footwear requirement sign',
    ],
    expectedLayout: [
      'packaging material racks in designated areas',
      'finished goods staging lanes marked',
      'reject / rework area delineated',
      'label printer and verification station at point of use',
      'pallet build area marked and sized appropriately',
    ],
    expectedVisualControls: [
      'batch labels on all materials in use',
      'product labels verified against specifications before application',
      'weight check status boards at each station',
      'packaging material identification labels on all racks',
    ],
    expectedCleanliness: [
      'no loose packaging material (cardboard, foam, film) on floor',
      'sealer and labeller surfaces free of adhesive residue',
      'weighing scales calibration sticker current',
      'floors swept between product changeovers',
    ],
    expectedStoragePractices: [
      'packaging materials stored in labeled racks by type and size',
      'no excess material accumulated beyond one-shift supply at station',
      'labels stored in closed, humidity-controlled conditions',
      'finished pallets wrapped, labeled, and moved to staging within defined time',
    ],
  },

  // ── 10. General / Unknown (fallback) ────────────────────────────────────────
  {
    zoneName: 'General',
    expectedEquipment:        [], // Populated from WorkspaceContext.expected_equipment
    expectedDocuments:        ['work instructions', 'safety notices', 'operating procedures'],
    expectedSafetyAssets:     [], // Populated from WorkspaceContext.expected_safety_assets
    expectedLayout:           ['walkways clear', 'work areas delineated', 'storage zones marked'],
    expectedVisualControls:   ['item labels', 'zone identification signs', 'notice boards current'],
    expectedCleanliness:      ['floors dry and clear', 'surfaces free of unnecessary items'],
    expectedStoragePractices: ['items in designated locations', 'labeled storage positions'],
  },
];

// ── Keyword-to-zone matching ───────────────────────────────────────────────────

interface ZoneMatch {
  keywords: string[];
  index:    number;  // Index into ZONE_CATALOGUE
}

const ZONE_MATCHES: ZoneMatch[] = [
  { keywords: ['chemical', 'hazmat', 'hazchem', 'solvent', 'reagent storage'], index: 0 },
  { keywords: ['warehouse', 'dispatch', 'despatch', 'distribution', 'stores'],  index: 1 },
  { keywords: ['production', 'manufacturing', 'line', 'conveyor'],              index: 2 },
  { keywords: ['assembly', 'fit-up', 'build'],                                  index: 3 },
  { keywords: ['lab', 'laboratory', 'testing room', 'quality lab'],             index: 4 },
  { keywords: ['office', 'admin', 'administration', 'reception'],               index: 5 },
  { keywords: ['utilities', 'utility', 'plant room', 'boiler', 'compressor'],   index: 6 },
  { keywords: ['maintenance', 'workshop', 'repair', 'engineering'],             index: 7 },
  { keywords: ['packaging', 'packing', 'pack'],                                  index: 8 },
];

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Resolves a selected_zone string to the matching ZoneKnowledge profile.
 *
 * Falls back to the 'General' profile if no keyword matches. Injects the
 * WorkspaceContext equipment and safety fallback strings into the General
 * profile so audit expectations are never empty.
 */
export function resolveZoneKnowledge(
  selectedZone: string,
  fallback: { equipment: string; safety: string },
): ZoneKnowledge {
  const z = selectedZone.toLowerCase();

  for (const match of ZONE_MATCHES) {
    if (match.keywords.some((kw) => z.includes(kw))) {
      return ZONE_CATALOGUE[match.index];
    }
  }

  // General fallback — inject workspace context values
  const general = { ...ZONE_CATALOGUE[9] };
  if (fallback.equipment) {
    general.expectedEquipment = fallback.equipment
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (fallback.safety) {
    general.expectedSafetyAssets = fallback.safety
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return general;
}

/**
 * Returns a human-readable list of zone names available in the knowledge base.
 * Useful for logging and debugging.
 */
export function listKnownZones(): string[] {
  return ZONE_CATALOGUE.map((z) => z.zoneName);
}
