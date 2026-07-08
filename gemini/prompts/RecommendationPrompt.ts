/**
 * supabase/functions/analyze-5s/prompts/RecommendationPrompt.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the recommendation generation prompt from failed audit items.
 */

import type { DeductionDetail, PillarScoreResult } from '../../backend/supabase/functions/analyze-5s/audit-engine/scoring/types.ts';

export interface RecommendationPromptInput {
  pillarScores: PillarScoreResult[];
  promptTemplate: string;  // from audit_prompt_versions.prompt_text (RECOMMENDATIONS)
}

export function buildRecommendationPrompt(input: RecommendationPromptInput): string {
  const { pillarScores, promptTemplate } = input;

  const failedItems: string[] = [];

  for (const ps of pillarScores) {
    for (const d of ps.top_deductions) {
      failedItems.push(
        `- pillar: ${ps.pillar} | severity: ${d.severity} | question_id: ${d.question_id} | question: "${d.question_text}" | evidence: "${d.evidence}" | points_lost: ${d.points_lost}`,
      );
    }
    if (ps.cap_applied) {
      failedItems.push(
        `- pillar: ${ps.pillar} | CRITICAL RULE TRIGGERED: ${ps.cap_reason} (score capped at ${ps.cap_value}%)`,
      );
    }
  }

  if (failedItems.length === 0) {
    failedItems.push('No significant failures detected. Workspace is highly compliant.');
  }

  return `${promptTemplate}

AUDIT FINDINGS:
${failedItems.join('\n')}

REQUIRED RESPONSE FORMAT (JSON array only):
[
  {
    "pillar": "<SORT|SET_IN_ORDER|SHINE|STANDARDIZE|SUSTAIN>",
    "severity": "<CRITICAL|MAJOR|MINOR>",
    "priority": <1-5>,
    "title": "<short action title>",
    "description": "<detailed description of the issue>",
    "root_cause": "<why this issue likely exists>",
    "corrective_action": "<specific steps to fix it>",
    "linked_question_id": "<question_id this addresses>"
  }
]

Sort recommendations by priority ascending (1 = most urgent).
Limit to maximum 10 recommendations.`;
}
