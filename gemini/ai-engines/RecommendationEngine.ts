/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * supabase/functions/analyze-5s/ai/RecommendationEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * RecommendationEngine (Phase 2A).
 * Generates action-oriented recommendations based on the audit failures.
 *
 * Implements:
 *  - Problem
 *  - Root Cause
 *  - Recommended Action (corrective_action)
 *  - Expected Benefit
 *  - Priority grouping (Immediate Action, High Priority, etc.)
 *  - Estimated Impact on 5S (e.g. "+5% on Seiso")
 */

import type { PillarScoreResult } from '../../backend/supabase/functions/analyze-5s/scoring/types.ts';

export interface AuditRecommendation {
  pillar:             string;
  severity:           'CRITICAL' | 'MAJOR' | 'MINOR';
  priority:           number;             // 1=Immediate, 2=High, 3=Medium, 4=Long-Term
  priority_label:     'Immediate Action' | 'High Priority' | 'Medium Priority' | 'Long-Term Improvement';
  title:              string;             // Action title
  problem:            string;             // What is wrong
  root_cause:         string;             // Why it exists
  corrective_action:  string;             // Recommended action
  expected_benefit:   string;             // Benefit after resolution
  estimated_impact:   string;             // Estimated impact on 5S scores (e.g. "+8% on Shine")
  linked_question_id: string;
}

export async function generateRecommendations(
  pillarScores:     PillarScoreResult[],
  promptTemplate:   string,
  geminiApiKey:     string,
  model =           'gemini-1.5-pro',
): Promise<AuditRecommendation[]> {
  const failedItems: string[] = [];

  for (const ps of pillarScores) {
    for (const d of ps.top_deductions) {
      failedItems.push(
        `- pillar: ${ps.pillar} | severity: ${d.severity} | question_id: ${d.question_id} | question: "${d.question_text}" | evidence: "${d.evidence}" | points_lost: ${d.points_lost}`
      );
    }
    if (ps.cap_applied) {
      failedItems.push(
        `- pillar: ${ps.pillar} | CRITICAL RULE TRIGGERED: ${ps.cap_reason} (score capped at ${ps.cap_value}%)`
      );
    }
  }

  if (failedItems.length === 0) {
    failedItems.push('No significant failures detected. Workplace is highly compliant.');
  }

  const prompt = `${promptTemplate || 'You are a 5S continuous improvement expert.'}

AUDIT FINDINGS:
${failedItems.join('\n')}

INSTRUCTIONS:
For each failure or critical cap listed above, generate a structured corrective action.
Each recommendation must contain:
1. "pillar": SORT | SET_IN_ORDER | SHINE | STANDARDIZE | SUSTAIN
2. "severity": CRITICAL | MAJOR | MINOR
3. "priority_label": "Immediate Action" (for Critical/Cap issues) | "High Priority" (for Major issues) | "Medium Priority" (for Minor issues) | "Long-Term Improvement" (for minor/optional improvements)
4. "priority": 1 (Immediate) | 2 (High) | 3 (Medium) | 4 (Long-Term)
5. "title": short action title (e.g., "Implement shadow board")
6. "problem": detailed explanation of the problem observed (Problem)
7. "root_cause": underlying operational or human factor (Root Cause)
8. "corrective_action": step-by-step resolution steps (Recommended Action)
9. "expected_benefit": how it helps the workspace efficiency or safety (Expected Benefit)
10. "estimated_impact": specific numerical estimate of the 5S score improvement (e.g. "+10% on Shine", "+5% on Set in Order")
11. "linked_question_id": exact question_id from the findings

Output a valid JSON array only. Sort recommendations by priority ascending (1 = most urgent). Limit to maximum 10 items.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.error(`[RecommendationEngine] API error: ${response.status}`);
      return [];
    }

    const data    = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseRecommendations(rawText);
  } catch (err) {
    console.error('[RecommendationEngine] Failed:', err);
    return [];
  }
}

export function parseRecommendations(rawText: string): AuditRecommendation[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((r) => r && typeof r.title === 'string')
      .map((r) => {
        let pLabel = r.priority_label;
        if (!['Immediate Action', 'High Priority', 'Medium Priority', 'Long-Term Improvement'].includes(pLabel)) {
          pLabel = 'Medium Priority';
        }
        let prio = Number(r.priority);
        if (isNaN(prio) || prio < 1 || prio > 4) {
          prio = pLabel === 'Immediate Action' ? 1 : pLabel === 'High Priority' ? 2 : pLabel === 'Medium Priority' ? 3 : 4;
        }

        return {
          pillar:             String(r.pillar ?? 'SORT'),
          severity:           (['CRITICAL', 'MAJOR', 'MINOR'].includes(r.severity) ? r.severity : 'MINOR') as any,
          priority:           prio,
          priority_label:     pLabel,
          title:              String(r.title ?? ''),
          problem:            String(r.problem ?? ''),
          root_cause:         String(r.root_cause ?? ''),
          corrective_action:  String(r.corrective_action ?? ''),
          expected_benefit:   String(r.expected_benefit ?? ''),
          estimated_impact:   String(r.estimated_impact ?? '+5% score impact'),
          linked_question_id: String(r.linked_question_id ?? ''),
        };
      })
      .sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}
