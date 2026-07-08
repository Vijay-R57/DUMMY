/**
 * supabase/functions/analyze-5s/prompts/VisionAuditPrompt.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the per-pillar Vision AI prompt.
 * The AI must NEVER assign scores — only observe and answer.
 */

import type { AuditPillar } from '../../backend/supabase/functions/analyze-5s/audit-engine/scoring/types.ts';

export interface AuditQuestion {
  question_id: string;
  question_text: string;
  description: string | null;
}

export interface VisionAuditPromptInput {
  pillar: AuditPillar;
  pillarLabel: string;
  questions: AuditQuestion[];
  promptTemplate: string;  // from audit_prompt_versions.prompt_text
}

const PILLAR_LABELS: Record<AuditPillar, string> = {
  SORT:         'Sort (Seiri) — Remove unnecessary items',
  SET_IN_ORDER: 'Set in Order (Seiton) — Organize all remaining items',
  SHINE:        'Shine (Seiso) — Clean and maintain the workspace',
  STANDARDIZE:  'Standardize (Seiketsu) — Create and enforce standards',
  SUSTAIN:      'Sustain (Shitsuke) — Maintain discipline',
};

export function buildVisionAuditPrompt(input: VisionAuditPromptInput): string {
  const { pillar, questions, promptTemplate } = input;
  const pillarLabel = PILLAR_LABELS[pillar];

  const questionList = questions
    .map((q, i) =>
      `${i + 1}. question_id: "${q.question_id}"\n   question: "${q.question_text}"${
        q.description ? `\n   hint: "${q.description}"` : ''
      }`,
    )
    .join('\n\n');

  const base = promptTemplate.replace('{PILLAR}', pillarLabel);

  return `${base}

PILLAR: ${pillarLabel}

QUESTIONS TO ANSWER:
${questionList}

REQUIRED RESPONSE FORMAT (JSON array only, no other text):
[
  {
    "question_id": "<exact question_id from above>",
    "answer": "<YES|NO|PARTIAL|NOT_VISIBLE|NOT_APPLICABLE>",
    "confidence": <0.0-1.0>,
    "evidence": "<one concise sentence describing what you observe>"
  }
]

CRITICAL RULES:
- You MUST answer every question listed above
- "answer" must be exactly one of: YES, NO, PARTIAL, NOT_VISIBLE, NOT_APPLICABLE
- "confidence" is a decimal between 0.0 and 1.0
- "evidence" must describe what you actually see in the image
- Do NOT include scores, percentages, or numeric ratings
- Do NOT add any text outside the JSON array`;
}

export { PILLAR_LABELS };
