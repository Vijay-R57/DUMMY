/**
 * supabase/functions/analyze-5s/prompts/ImagePromptGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a DALL-E / Imagen prompt for the optimized "After" workplace image.
 */

import type { PillarScoreResult } from '../../backend/supabase/functions/analyze-5s/scoring/types.ts';

export interface ImagePromptInput {
  pillarScores: PillarScoreResult[];
  promptTemplate: string;  // from audit_prompt_versions (IMAGE_PROMPT)
}

export function buildImagePrompt(input: ImagePromptInput): string {
  const { pillarScores, promptTemplate } = input;

  const issues = pillarScores
    .flatMap((ps) =>
      ps.top_deductions.map(
        (d) => `${ps.pillar}: ${d.question_text} — ${d.evidence}`,
      ),
    )
    .slice(0, 8);

  const issueContext =
    issues.length > 0
      ? `Issues found in current workspace:\n${issues.map((i) => `- ${i}`).join('\n')}`
      : 'The workspace is mostly compliant. Show a pristine, fully optimized version.';

  return `${promptTemplate}

${issueContext}

The image must show:
- All tools and equipment in clearly labeled shadow boards or designated storage
- Clean, unobstructed floor with visible yellow safety lane markings
- Zero clutter on work surfaces and around machines
- Clearly posted visual management boards with 5S standards
- Clean machines with no oil or dirt visible
- Labeled waste bins in designated areas
- All items in their proper, labeled storage positions

Style: professional industrial facility photograph, bright fluorescent lighting, high resolution, realistic.`;
}
