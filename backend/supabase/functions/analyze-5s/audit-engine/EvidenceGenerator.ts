/**
 * supabase/functions/analyze-5s/audit-engine/EvidenceGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stage A orchestrator — Phase 4.
 *
 * Responsibilities:
 *  - Build the Stage A evidence extraction prompt
 *  - Call LLMProvider with the workspace image (one vision call)
 *  - Return a raw AuditEvidenceModel for validation by EvidenceValidator
 *
 * The evidence model is generated ONCE per image and shared by all five
 * Stage B pillar evaluators. No per-pillar object detection occurs.
 *
 * Design invariants:
 *  - Zero pillar-specific logic
 *  - Zero question text
 *  - Zero score values
 *  - Never throws — returns a safe empty model on failure
 */

import type {
  WorkspaceContext,
  ZoneKnowledge,
  AuditEvidenceModel,
} from './types.ts';
import type { LLMProvider } from '../../../../../gemini/LLMProvider.ts';

// ── Evidence extraction prompt ─────────────────────────────────────────────────

export function buildEvidencePrompt(
  context:   WorkspaceContext,
  knowledge: ZoneKnowledge,
): string {
  const expectedItemsList = [
    ...knowledge.expectedEquipment,
    ...knowledge.expectedSafetyAssets,
    ...knowledge.expectedLayout,
  ].filter(Boolean);

  return [
    `ROLE:`,
    `You are an industrial 5S workplace analyst.`,
    `Your task is to extract a structured evidence model from a single workplace photograph.`,
    `You do NOT evaluate questions. You do NOT assign ratings. You ONLY extract evidence.`,
    ``,
    `WORKSPACE CONTEXT:`,
    `  • Industry    : ${context.industry}`,
    `  • Department  : ${context.department}`,
    `  • Area Name   : ${context.area_name}`,
    `  • Zone Type   : ${context.workspace_type}`,
    `  • Selected Zone: ${context.selected_zone}`,
    ``,
    `EXPECTED ITEMS FOR THIS ZONE:`,
    expectedItemsList.map((item) => `  - ${item}`).join('\n'),
    ``,
    `════════════════════════════════════════════════════════════════`,
    `EVIDENCE EXTRACTION INSTRUCTIONS`,
    `════════════════════════════════════════════════════════════════`,
    ``,
    `STEP 1 — OBJECT INVENTORY`,
    `Silently identify every movable visible object in the image.`,
    `For each object, determine:`,
    `  • description: specific description (e.g. "blue 200L chemical drum")`,
    `  • category: classify into exactly one of:`,
    `      A = Expected Equipment       (matches zone expectations — never penalize)`,
    `      B = Expected Support Item    (support/safety item for this zone — never penalize)`,
    `      C = Temporary Work Item      (may be temporary; only penalize if clearly abandoned)`,
    `      D = Clearly Unnecessary      (visibly out of place, clearly not needed for this zone)`,
    `      UNKNOWN = Purpose unclear    (never penalize; never classify as unnecessary)`,
    `  • observationType: classify as:`,
    `      DIRECT    = unambiguously visible`,
    `      INFERENCE = plausible but not certain`,
    `      UNKNOWN   = cannot be determined`,
    `  • quantity: optional (e.g. "three", "several")`,
    `  • location: optional (e.g. "left foreground", "rear right corner")`,
    ``,
    `CLASSIFICATION RULES:`,
    `  • If an object matches an expected item for this zone → A or B`,
    `  • If an object's purpose cannot be determined → UNKNOWN`,
    `  • UNKNOWN must NEVER be treated as unnecessary`,
    `  • Only DIRECT observations with category D may contribute to violations`,
    `  • Apply conservative evaluation: do not assume or invent violations if visual evidence is ambiguous`,
    ``,
    `STEP 2 — POSITIVE COMPLIANCE`,
    `Identify all visible indicators of 5S compliance. Include:`,
    `  • Clean surfaces and floors`,
    `  • Visible labels and markings`,
    `  • Organised storage`,
    `  • Accessible safety equipment`,
    `  • Posted instructions or standards`,
    `For each finding:`,
    `  • dimension: the 5S dimension (cleanliness, organization, labelling, safety, layout, standards)`,
    `  • observation: specific positive finding`,
    `  • observationType: DIRECT or INFERENCE`,
    `  • confidence: HIGH / MEDIUM / LOW`,
    ``,
    `STEP 3 — VIOLATIONS`,
    `Identify visible non-compliance. Strict rules:`,
    `  ✓ Only DIRECT observations may generate violations`,
    `  ✓ Every violation must reference a specific visible object`,
    `  ✓ Every violation must include an imageLocation`,
    `  ✗ NEVER create a violation for absence of a management system`,
    `     (No Red Tag, No Shadow Board, No cleaning schedule, etc.)`,
    `  ✗ NEVER penalize objects that match the expected items list`,
    `  ✗ UNKNOWN objects must NEVER generate violations`,
    `For each violation:`,
    `  • dimension: 5S dimension affected`,
    `  • observation: specific non-compliance description`,
    `  • severity: MINOR / MODERATE / MAJOR`,
    `  • evidence: verbatim visible object reference`,
    `  • imageLocation: where in the image (e.g. "left foreground")`,
    `  • observationType: must be "DIRECT"`,
    `  • confidence: HIGH / MEDIUM / LOW`,
    ``,
    `STEP 4 — OVERALL CONFIDENCE`,
    `Assess the overall image quality and visibility.`,
    `  HIGH   = all surfaces clearly visible, good lighting, full coverage`,
    `  MEDIUM = some areas unclear or partially obscured`,
    `  LOW    = poor lighting, limited view, or significant areas not visible`,
    ``,
    `STEP 5 — IMAGE NOTES`,
    `Briefly note any image quality issues that limit evidence quality.`,
    ``,
    `════════════════════════════════════════════════════════════════`,
    `RESPONSE FORMAT`,
    `════════════════════════════════════════════════════════════════`,
    ``,
    `Return ONLY a valid JSON object matching this schema. No prose. No markdown fences.`,
    ``,
    JSON.stringify({
      generatedAt:        '<ISO timestamp>',
      zone:               context.selected_zone,
      expectedObjects:    ['<list from zone knowledge>'],
      visibleObjects: [
        {
          description:     '<specific object description>',
          category:        'A | B | C | D | UNKNOWN',
          observationType: 'DIRECT | INFERENCE | UNKNOWN',
          quantity:        '<optional>',
          location:        '<optional image location>',
        },
      ],
      positiveCompliance: [
        {
          dimension:       '<5S dimension>',
          observation:     '<specific positive finding>',
          observationType: 'DIRECT | INFERENCE',
          confidence:      'HIGH | MEDIUM | LOW',
        },
      ],
      violations: [
        {
          dimension:       '<5S dimension>',
          observation:     '<specific non-compliance>',
          severity:        'MINOR | MODERATE | MAJOR',
          evidence:        '<specific visible object>',
          imageLocation:   '<location in image>',
          observationType: 'DIRECT',
          confidence:      'HIGH | MEDIUM | LOW',
        },
      ],
      overallConfidence: 'HIGH | MEDIUM | LOW',
      imageNotes:        '<any image quality notes, or empty string>',
    }, null, 2),
  ].join('\n');
}

// ── EvidenceGenerator ──────────────────────────────────────────────────────────

export class EvidenceGenerator {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Generates a raw AuditEvidenceModel from the workspace image.
   *
   * Returns { rawText, tokensUsed } for validation by EvidenceValidator.
   * Never throws.
   */
  async generate(
    imageBase64: string,
    context:     WorkspaceContext,
    knowledge:   ZoneKnowledge,
  ): Promise<{ rawText: string; tokensUsed: number | null }> {
    const prompt = buildEvidencePrompt(context, knowledge);

    try {
      const response = await this.provider.complete({
        systemPrompt: prompt,
        imageBase64,
        temperature:  0.0,  // Deterministic evidence extraction
      });
      return { rawText: response.rawText, tokensUsed: response.tokensUsed };
    } catch (err) {
      console.error('[EvidenceGenerator] LLM call failed:', err);
      return { rawText: '', tokensUsed: null };
    }
  }
}
