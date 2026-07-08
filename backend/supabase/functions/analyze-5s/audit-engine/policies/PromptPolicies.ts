/**
 * supabase/functions/analyze-5s/audit-engine/policies/PromptPolicies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable prompt section templates for the Audit Decision Matrix (Phase 4).
 *
 * PromptBuilder assembles Stage A and Stage B prompts from named sections
 * defined here. No evaluation logic is duplicated across prompt builds.
 *
 * Design invariants:
 *  - Pure string constants — no runtime logic
 *  - No pillar names
 *  - No zone names
 *  - No question text
 *  - No score values
 */

export type PromptSectionKey =
  | 'UNIVERSAL_AUDIT_HEADER'
  | 'POSITIVE_COMPLIANCE_FIRST'
  | 'HUMAN_AUDITOR_DECISION_RULE'
  | 'EVIDENCE_CATEGORY_RULE'
  | 'VIOLATION_BASED_INSTRUCTIONS'
  | 'COMPLIANCE_BASED_INSTRUCTIONS'
  | 'CONDITION_ASSESSMENT_INSTRUCTIONS'
  | 'PRESENCE_DETECTION_INSTRUCTIONS'
  | 'VISUAL_CONTEXT_INSTRUCTIONS'
  | 'CONSERVATIVE_INFERENCE_INSTRUCTIONS'
  | 'FORBIDDEN_EVIDENCE_RULE'
  | 'CONFIDENCE_DEGRADATION_RULE'
  | 'REFLECTION_CHECKLIST';

// ── Prompt Section Registry ────────────────────────────────────────────────────

export const PROMPT_POLICIES: Readonly<Record<PromptSectionKey, string>> = {

  // ── Universal audit constraints (injected into every Stage B call) ───────────

  UNIVERSAL_AUDIT_HEADER: `
═══════════════════════════════════════════════════════════════════════════════
UNIVERSAL AUDIT RULE — MANDATORY FOR ALL QUESTIONS
═══════════════════════════════════════════════════════════════════════════════

The uploaded workplace image is the ONLY source of truth.

Never assume:
  • Historical activities or past behaviour
  • Employee participation or discipline levels
  • Maintenance schedules or cleaning frequency
  • Audit schedules, audit history, or audit scores
  • Management commitment or organizational culture
  • Training records or compliance history
  • Any condition that is not directly visible in the image

Evaluate ONLY directly visible evidence.

If evidence cannot be observed from the image:
  → Reduce confidence rather than inventing violations.
  → Use NOT_VISIBLE if the condition is completely indeterminate.
  → Use Average with LOW confidence if the question is not reliably
     answerable from a single photograph.`.trim(),

  // ── Evaluation sequence ───────────────────────────────────────────────────────

  POSITIVE_COMPLIANCE_FIRST: `
MANDATORY EVALUATION SEQUENCE (follow this exact order for every question):

  Step 1 — POSITIVE COMPLIANCE
    First identify every visible indicator of compliance for this question.
    Record positive findings explicitly before searching for deficiencies.
    Even minor positive indicators must be recorded.

  Step 2 — VISIBLE DEFICIENCIES
    Identify only directly observable non-compliance.
    Every deduction requires a specific visible object reference.
    Generic observations ("the area appears disorganized") are not acceptable.

  Step 3 — CONFIDENCE ASSESSMENT
    Assess confidence: HIGH / MEDIUM / LOW
    Prefer reducing confidence over reducing the score when uncertain.

  Step 4 — QUESTION TYPE CHECK
    Apply the strategy specified for this question:
    Type 1 → Full evaluation; all ratings permitted
    Type 2 → Zone context required; conservative interpretation
    Type 3 → Neutral rating (Average); LOW confidence; no deductions

  Step 5 — RATING ASSIGNMENT
    Derive the rating from the balance of positive and negative evidence.
    Never assign a rating before completing Steps 1–4.

  Step 6 — ASSESSMENT SENTENCE
    Write exactly one sentence.
    When both positive and negative evidence exist, reference both.`.trim(),

  // ── Human auditor reasoning ───────────────────────────────────────────────────

  HUMAN_AUDITOR_DECISION_RULE: `
INTERNAL REASONING SEQUENCE (complete before assigning any rating):

  1. WHAT CAN I CLEARLY SEE?
     List all visible objects and conditions relevant to this question.

  2. WHAT IS EXPECTED FOR THIS ZONE?
     Consult the zone knowledge provided. Which objects and conditions are
     normal and expected for this selected workplace?

  3. WHAT POSITIVE EVIDENCE EXISTS?
     Identify all compliance observations for this question.

  4. WHAT VIOLATIONS ARE DIRECTLY VISIBLE?
     Identify only observations with observationType = DIRECT.
     Inference and Unknown observations may not generate violations.

  5. CAN I JUSTIFY EVERY DEDUCTION?
     For each violation, verify: "I can describe this using a specific
     visible object and its location in the image."
     Remove any deduction that cannot pass this test.

  6. IS THIS QUESTION ANSWERABLE FROM ONE IMAGE?
     If the question requires historical behaviour, culture, or human
     activity patterns → assign neutral rating, LOW confidence.

  7. ASSIGN RATING
     Only after completing steps 1–6.
     The rating must derive from evidence — not precede it.`.trim(),

  // ── Evidence category rule ────────────────────────────────────────────────────

  EVIDENCE_CATEGORY_RULE: `
EVIDENCE CATEGORY RULE (applies to every observation):

  CATEGORY A — Directly Observable
    The condition is unambiguously visible in the image.
    Full rating scale applies.
    Examples: floor markings, equipment labels, containers, cleanliness.

  CATEGORY B — Partially Observable
    Visible evidence exists but does not completely confirm the condition.
    Reduce confidence before reducing score.
    Examples: whether items are currently in use, inspection indicators.

  CATEGORY C — Not Reliably Observable from One Image
    The condition depends on history, behaviour, or culture.
    Always assign: Average rating + LOW confidence.
    Never assign Very Bad or Very Good.
    Examples: audit frequency, employee discipline, training history.`.trim(),

  // ── Strategy-specific instructions ───────────────────────────────────────────

  VIOLATION_BASED_INSTRUCTIONS: `
QUESTION STRATEGY: VIOLATION_BASED
  This question's score decreases ONLY when direct violations are visible.
  Absence of violations means the area passes.
  Deduct only for visible, unambiguous, directly observable conditions.
  Do not deduct for conditions that are not clearly visible.`.trim(),

  COMPLIANCE_BASED_INSTRUCTIONS: `
QUESTION STRATEGY: COMPLIANCE_BASED
  This question's score derives from observable compliance indicators.
  Begin by identifying every visible indicator of compliance.
  Deductions apply only where compliance is visibly absent.
  Use conservative judgement. When uncertain, prefer higher score.`.trim(),

  CONDITION_ASSESSMENT_INSTRUCTIONS: `
QUESTION STRATEGY: CONDITION_ASSESSMENT
  This question evaluates the visible physical condition of the workplace.
  Assess the current observable state.
  Use the full rating scale proportionally to visible condition quality.
  Good condition → Good/Very Good. Poor condition → Bad/Very Bad.`.trim(),

  PRESENCE_DETECTION_INSTRUCTIONS: `
QUESTION STRATEGY: PRESENCE_DETECTION
  This question evaluates whether specific physical items are visibly present.
  Score reflects presence, absence, and condition of identifiable elements.
  Very Good: all expected elements visibly present and in good condition.
  Bad/Very Bad: key elements clearly absent or visibly non-functional.
  If elements are partially visible, use Average or reduce confidence.`.trim(),

  VISUAL_CONTEXT_INSTRUCTIONS: `
QUESTION STRATEGY: VISUAL_CONTEXT
  This question requires BOTH visible evidence AND selected zone context.
  Step 1: Consult the zone knowledge provided. What is expected here?
  Step 2: Identify visible objects that match expected items. Do NOT penalize these.
  Step 3: Identify visible objects that are clearly outside zone expectations.
  Step 4: Only objects that are clearly unnecessary AND visibly confirmed
          as such may contribute to a lower score.
  Never penalize an item because its purpose is unknown.
  Unknown purpose = Unknown category = No deduction.`.trim(),

  CONSERVATIVE_INFERENCE_INSTRUCTIONS: `
QUESTION STRATEGY: CONSERVATIVE_INFERENCE (Type 3 — Not Reliably Visual)
  This question cannot be reliably answered from a single photograph.
  MANDATORY RESPONSE:
    → Rating:     Average
    → Confidence: LOW
    → Evidence:   Describe what is visible that relates to this question.
    → Assessment: Explain that this condition requires supplementary evidence
                  (records, observation, or interview) to fully assess.
  Do NOT assign Very Bad or Very Good.
  Do NOT invent violations based on absence of non-visible systems.`.trim(),

  // ── Forbidden evidence ────────────────────────────────────────────────────────

  FORBIDDEN_EVIDENCE_RULE: `
FORBIDDEN EVIDENCE (never use these as violation evidence):
  ✗ "No Red Tag System is visible."
  ✗ "No Shadow Board is present."
  ✗ "No audit schedule visible."
  ✗ "No employee participation evidence."
  ✗ "No training records observed."
  ✗ "No management commitment visible."
  ✗ "Workers do not appear to follow procedures."
  ✗ "Historically, this area..."
  ✗ "This suggests that cleaning is infrequent."
  ✗ Any inference about past behaviour, culture, or routine.

These patterns describe invisible organizational conditions.
They are NOT valid visual evidence and MUST NOT appear in the evidence field.`.trim(),

  // ── Confidence degradation rule ───────────────────────────────────────────────

  CONFIDENCE_DEGRADATION_RULE: `
CONFIDENCE DEGRADATION RULE:
  When evidence is ambiguous or incomplete:
  → First reduce confidence from HIGH to MEDIUM.
  → If still uncertain, reduce from MEDIUM to LOW.
  → Only as a last resort, change rating to NOT_VISIBLE.
  → Never fabricate evidence to justify a rating.
  Uncertainty must degrade confidence — not generate violations.`.trim(),

  // ── Self-review checklist ─────────────────────────────────────────────────────

  REFLECTION_CHECKLIST: `
SELF-REVIEW (complete before emitting the final JSON):

  CHECK 1 — EVIDENCE SPECIFICITY
    Does every evidence field reference a specific visible object?
    Generic: "the area appears disorganized" → REJECT
    Specific: "three unlabeled drums on the left aisle" → ACCEPT
    If no specific object can be cited → change rating to NOT_VISIBLE.

  CHECK 2 — FORBIDDEN PATTERNS
    Does any evidence field contain absence-of-system language?
    (No Red Tag, No Shadow Board, No audit schedule, etc.)
    If yes → remove the violation; adjust rating upward if needed.

  CHECK 3 — RATING–EVIDENCE CONSISTENCY
    Does the rating logically follow from the cited evidence?
    Significant deficiencies → cannot be Good or Very Good.
    Full compliance → cannot be Bad or Very Bad.
    Correct the rating if inconsistent.

  CHECK 4 — CONSERVATIVE INFERENCE COMPLIANCE
    For any Type 3 question: is the rating Average with LOW confidence?
    If not → correct it now.

  CHECK 5 — POSITIVE FINDINGS INCLUDED
    Does at least one evidence field or assessment reference a positive finding?
    A workplace always has some positive aspects — capture them.

Only after completing all five checks, emit the final JSON array.
Do not include the review process in your output — only the JSON.`.trim(),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getPromptSection(key: PromptSectionKey): string {
  return PROMPT_POLICIES[key];
}
