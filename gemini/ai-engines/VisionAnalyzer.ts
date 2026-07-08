/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * supabase/functions/analyze-5s/ai/VisionAnalyzer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Refactored VisionAnalyzer (Phase 2A.1).
 *
 * Two-pass pipeline (unchanged):
 *  Pass 1 — Observation Pass (Vision AI):
 *    Analyzes the image with WorkspaceContext to generate a structured
 *    knowledge cache of typed observations.
 *
 *  Pass 2 — Checklist Mapping (Text AI):
 *    1. Rule Engine answers deterministic questions without LLM.
 *    2. Only ambiguous questions are batched to the LLM.
 *    3. Results are merged into ValidatedAuditResponse[].
 *
 * Improvements in 2A.1:
 *  - StructuredObservation carries 9 typed knowledge fields.
 *  - generateObservations() prompt requests structured fields.
 *  - parseObservations() hydrates all new fields with safe defaults.
 *  - mapObservationsToChecklist() accepts pre-computed rule answers to skip.
 */

import {
  ObservationCache,
  defaultObservationFields,
} from './ObservationCache.ts';
import type { StructuredObservation, ObservationStatus, CleanlinessRating } from './ObservationCache.ts';
import type { AuditPillar, AuditAnswerState } from '../../backend/supabase/functions/analyze-5s/scoring/types.ts';

export type { StructuredObservation };

export interface WorkspaceContext {
  industry:                string;
  department:              string;
  workspace_type:          string;
  area_name:               string;
  machine_type?:           string;
  expected_equipment:      string;
  expected_safety_assets:  string;
  applicable_regulations?: string;
}

export interface ValidatedAuditResponse {
  question_id:    string;
  ai_answer:      AuditAnswerState;
  confidence:     number;
  evidence:       string;
  reasoning:      string;
  answeredByRule: boolean;     // true = deterministic rule answered this, LLM not called
  ruleId?:        string;      // which rule answered (if answeredByRule)
}

// ── Pass 1: Vision Observation ─────────────────────────────────────────────

/**
 * Calls Gemini Vision API to analyze the image and generate structured
 * typed observations stored in the ObservationCache.
 */
export async function generateObservations(
  imageBase64:   string,
  context:       WorkspaceContext,
  geminiApiKey:  string,
  model =        'gemini-1.5-pro',
): Promise<StructuredObservation[]> {
  const prompt = `You are a certified industrial 5S safety and layout inspector operating strictly as a neutral observation engine.
Your sole job is to document objectively visible workplace conditions. You must NOT act as a scoring or recommendation engine.

WORKSPACE CONTEXT:
- Industry: ${context.industry}
- Department: ${context.department}
- Workspace Type: ${context.workspace_type}
- Area / Workstation Name: ${context.area_name}
- Expected Equipment: ${context.expected_equipment}
- Expected Safety Assets: ${context.expected_safety_assets}
${context.applicable_regulations ? `- Applicable Regulations: ${context.applicable_regulations}` : ''}

OBSERVATION PRINCIPLES & CONSTRAINTS:
1. Observe ONLY what is visible: Never guess, never assume hidden objects exist, never infer missing equipment/safety assets, and never infer regulatory compliance.
2. Positive and Negative Balance: You must document a balanced view. Recording positive findings (e.g. clearly marked walkways, visible labels, proper storage tools) is MANDATORY whenever visible. Also document negative findings (e.g. visible dust, unreadable labels) and unknown findings (e.g. if a required fire extinguisher is not visible, document it as NOT_VISIBLE with high confidence, do not assume it is a failure).
3. Use Neutral, Objective Language: Avoid subjective words like "poor", "excellent", "unsafe", "compliant", "organized", "disorganized", "good", "bad", "messy", "neat". Instead, describe measurable visual facts. (e.g., write "The containers are arranged in three rows" instead of "The storage is organized"; write "A pile of cardboard boxes occupies the floor space" instead of "The area is disorganized/messy").
4. Conservative Evaluation: Never convert a partial observation into a complete failure. For example, if some containers have readable labels and others do not, the status must be "PARTIAL", not "NON_COMPLIANT". If evidence is insufficient, use "NOT_VISIBLE".
5. Confidence Rule: For any observation, if your confidence is below 70% (0.70), you must set the status to "NOT_VISIBLE" and do not guess.
6. Evidence Requirements: Every observation must reference specific visible objects. Avoid generic phrases like "hazards detected". Use descriptive facts like "three plastic containers on the workbench do not have readable labels".

OBSERVATION SEQUENCE FOR EACH ELEMENT:
1. Identify the object.
2. Identify its location in the photo.
3. Describe its visible condition.
4. Record supporting evidence referencing specific visible elements.
5. Estimate confidence (0.00 to 1.00).

CATEGORIES FOR STRUCTURED OBSERVATIONS:
- "Clutter" (unneeded items, scrap, packaging)
- "Waste" (empty wrappers, liquids, residues)
- "Inventory" (stored goods, volumes, status)
- "Obstructions" (blocked aisles, fire exits, doors)
- "Tool Organization" (jigs, shadow boards, points of use)
- "Labels" (bins, barcode labels, machinery signs)
- "Floor Markings" (lanes, safety tapes, borders)
- "Storage" (shelves, cabinet markings, locations)
- "Cleanliness" (dust, floors, benches, grime, leaks)
- "Safety Markings" (hazard signs, voltage zones, protection)
- "PPE Compliance" (goggles, vests, gloves, steel toes)
- "Waste Disposal" (bins, waste segregation)
- "Dust" (dust accumulation on equipment/surfaces)

RESPONSE JSON STRUCTURE:
Provide ONLY a valid JSON array. Do not output markdown codeblocks, explanations, or prose.

RESPONSE FORMAT:
[
  {
    "category": "Storage",
    "finding": "Three steel storage racks present along the back wall.",
    "status": "COMPLIANT",
    "evidence": "Racks are bolted to the floor and contain boxed components on shelves.",
    "location": "center-background",
    "detected_objects": ["steel storage rack", "cardboard boxes"],
    "safety_equipment": [],
    "hazards": [],
    "obstructions": [],
    "cleanliness_rating": "CLEAN",
    "floor_markings": null,
    "storage_present": true,
    "labels_visible": null,
    "confidence": 0.98
  }
]`;

  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;
  const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const response = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature:      0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision Observation failed: ${response.status} - ${err}`);
  }

  const data    = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseObservations(rawText);
}

// ── Pass 2: Checklist Mapping ──────────────────────────────────────────────

/**
 * Maps observations in the cache to checklist questions.
 * Questions already answered by the Rule Engine (ruleAnswers) are excluded
 * from the LLM call. Rule answers are merged into the final result.
 */
export async function mapObservationsToChecklist(
  questions:    Array<{ id: string; question_id: string; question_text: string; category?: string; pillar: AuditPillar }>,
  cache:        ObservationCache,
  geminiApiKey: string,
  model =       'gemini-1.5-pro',
  ruleAnswers:  Map<string, ValidatedAuditResponse> = new Map(),
): Promise<ValidatedAuditResponse[]> {
  // Split: questions needing LLM vs already answered by rules
  const unanswered = questions.filter((q) => !ruleAnswers.has(q.question_id));

  let llmAnswers: Map<string, ValidatedAuditResponse> = new Map();

  if (unanswered.length > 0) {
    llmAnswers = await callLLMForMapping(unanswered, cache, geminiApiKey, model);
  }

  // Merge: rule answers take precedence for their questions
  return questions.map((q) => {
    const ruleAnswer = ruleAnswers.get(q.question_id);
    if (ruleAnswer) return ruleAnswer;

    return llmAnswers.get(q.question_id) ?? {
      question_id:    q.question_id,
      ai_answer:      'NOT_VISIBLE' as AuditAnswerState,
      confidence:     0.0,
      evidence:       'Question was not mapped by the evaluation engine.',
      reasoning:      'Evaluation fallback triggered due to missing observations.',
      answeredByRule: false,
    };
  });
}

// ── Internal: LLM mapping call ────────────────────────────────────────────

async function callLLMForMapping(
  questions:    Array<{ id: string; question_id: string; question_text: string; category?: string; pillar: AuditPillar }>,
  cache:        ObservationCache,
  geminiApiKey: string,
  model:        string,
): Promise<Map<string, ValidatedAuditResponse>> {
  const observationsList = cache.getObservations()
    .map((obs, idx) =>
      `${idx + 1}. [${obs.category}] Status: ${obs.status} | Finding: "${obs.finding}"\n` +
      `   Evidence: "${obs.evidence}"\n` +
      `   Location: ${obs.location ?? 'unspecified'}\n` +
      `   Objects: [${obs.detected_objects.join(', ') || 'none'}]\n` +
      `   Hazards: [${obs.hazards.join(', ') || 'none'}]\n` +
      `   Cleanliness: ${obs.cleanliness_rating} | Floor Markings: ${obs.floor_markings ?? 'n/a'} | Labels: ${obs.labels_visible ?? 'n/a'}`
    )
    .join('\n\n');

  const questionsList = questions
    .map((q) =>
      `- id: "${q.id}" | question_id: "${q.question_id}" | pillar: "${q.pillar}"${q.category ? ` | category: "${q.category}"` : ''} | question: "${q.question_text}"`
    )
    .join('\n');

  const prompt = `You are a certified industrial 5S auditor.
Based ONLY on the structured observations below, answer the 5S checklist questions.

STRUCTURED OBSERVATIONS:
${observationsList}

AUDIT CHECKLIST QUESTIONS TO ANSWER:
${questionsList}

INSTRUCTIONS:
1. For every question, check which observations relate to the category.
2. Determine the answer:
   - "YES" if observations show full compliance.
   - "NO" if observations show clear non-compliance.
   - "PARTIAL" if there is partial compliance or minor issues.
   - "NOT_VISIBLE" if observations lack sufficient info (element outside frame or obscured).
   - "NOT_APPLICABLE" if the question is not relevant to this workspace.
3. Provide:
   - "question_id": exact question_id from above.
   - "answer": YES | NO | PARTIAL | NOT_VISIBLE | NOT_APPLICABLE.
   - "confidence": decimal 0.0–1.0.
   - "evidence": concise observation cited directly from the findings.
   - "reasoning": detailed reasoning explaining why you selected this answer.
4. Do NOT perform any mathematical calculations or score summaries.
5. Return ONLY a valid JSON array. No markdown code fences or conversational text.

RESPONSE FORMAT:
[
  {
    "question_id": "ASM_SRT_01",
    "answer": "YES",
    "confidence": 0.95,
    "evidence": "Raw materials are segregated in yellow border-marked pallet zones.",
    "reasoning": "Observations show clear boundary separation with color-coded markers, satisfying the sorting criteria."
  }
]`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const response = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:      0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Checklist Mapping failed: ${response.status} - ${err}`);
  }

  const data    = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseAuditAnswers(rawText);
}

// ── Parsing Helpers ───────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<ObservationStatus>([
  'COMPLIANT', 'NON_COMPLIANT', 'PARTIAL', 'NOT_VISIBLE', 'NOT_APPLICABLE',
]);

const VALID_CLEANLINESS = new Set<CleanlinessRating>([
  'CLEAN', 'DIRTY', 'PARTIAL', 'NOT_VISIBLE',
]);

export function parseObservations(rawText: string): StructuredObservation[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((o: any): StructuredObservation => {
      const defaults = defaultObservationFields();

      const status: ObservationStatus = VALID_STATUSES.has(o.status)
        ? o.status
        : 'NOT_VISIBLE';

      const cleanlinessRaw = String(o.cleanliness_rating ?? '').toUpperCase();
      const cleanliness_rating: CleanlinessRating = VALID_CLEANLINESS.has(cleanlinessRaw as CleanlinessRating)
        ? (cleanlinessRaw as CleanlinessRating)
        : defaults.cleanliness_rating;

      // Parse tri-state boolean fields
      const parseTriBool = (val: unknown): boolean | null => {
        if (val === true || val === false) return val;
        if (val === null || val === undefined) return null;
        const s = String(val).toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
        return null;
      };

      return {
        category:           String(o.category ?? 'General'),
        finding:            String(o.finding ?? ''),
        status,
        evidence:           String(o.evidence ?? ''),
        location:           o.location ? String(o.location) : undefined,
        detected_objects:   Array.isArray(o.detected_objects)   ? o.detected_objects.map(String)   : defaults.detected_objects,
        safety_equipment:   Array.isArray(o.safety_equipment)   ? o.safety_equipment.map(String)   : defaults.safety_equipment,
        hazards:            Array.isArray(o.hazards)             ? o.hazards.map(String)             : defaults.hazards,
        obstructions:       Array.isArray(o.obstructions)        ? o.obstructions.map(String)        : defaults.obstructions,
        cleanliness_rating,
        floor_markings:     parseTriBool(o.floor_markings),
        storage_present:    parseTriBool(o.storage_present),
        labels_visible:     parseTriBool(o.labels_visible),
        confidence:         typeof o.confidence === 'number'
          ? Math.max(0, Math.min(1, o.confidence))
          : defaults.confidence,
      };
    });
  } catch {
    return [];
  }
}

export function parseAuditAnswers(rawText: string): Map<string, ValidatedAuditResponse> {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const resultMap = new Map<string, ValidatedAuditResponse>();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return resultMap;

    for (const item of parsed) {
      const qid = String(item.question_id ?? '').trim();
      if (!qid) continue;

      const ans    = String(item.answer ?? '').toUpperCase().trim();
      const validAnswer = (['YES', 'NO', 'PARTIAL', 'NOT_VISIBLE', 'NOT_APPLICABLE'].includes(ans))
        ? (ans as AuditAnswerState)
        : 'NOT_VISIBLE';

      const conf = typeof item.confidence === 'number'
        ? Math.max(0, Math.min(1, item.confidence))
        : 0.8;

      resultMap.set(qid, {
        question_id:    qid,
        ai_answer:      validAnswer,
        confidence:     conf,
        evidence:       String(item.evidence  ?? 'No direct evidence provided.').trim(),
        reasoning:      String(item.reasoning ?? 'No reasoning provided.').trim(),
        answeredByRule: false,
      });
    }
  } catch (e) {
    console.error('[VisionAnalyzer] Parsing audit answers failed:', e);
  }

  return resultMap;
}
