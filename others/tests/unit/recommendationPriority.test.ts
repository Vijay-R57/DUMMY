/**
 * src/test/unit/recommendationPriority.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for RecommendationEngine parser and priority mapping (Phase 2A.2).
 * Verifies that priority sorting, severity handling, and validation defaults
 * work correctly.
 */

import { describe, it, expect } from 'vitest';
import { parseRecommendations } from '../../../gemini/ai-engines/RecommendationEngine';

const mockValidJson = `[
  {
    "pillar": "SHINE",
    "severity": "MAJOR",
    "priority_label": "High Priority",
    "priority": 2,
    "title": "Clean Lathe Base",
    "problem": "Oil leaks detected at base of lathe.",
    "root_cause": "Lathe seal worn out.",
    "corrective_action": "Replace lathe seals and clean oil spill.",
    "expected_benefit": "Prevents slips and cuts.",
    "estimated_impact": "+10% on Seiso",
    "linked_question_id": "MNT_SHN_02"
  },
  {
    "pillar": "SORT",
    "severity": "CRITICAL",
    "priority_label": "Immediate Action",
    "priority": 1,
    "title": "Clear Fire Exit",
    "problem": "Fire exit is blocked by pallets.",
    "root_cause": "Inadequate storage space allocation.",
    "corrective_action": "Move pallets to designated storage racks immediately.",
    "expected_benefit": "Restores safe exit path.",
    "estimated_impact": "Critical safety compliance",
    "linked_question_id": "WH_SRT_01"
  }
]`;

describe('parseRecommendations', () => {
  it('parses valid recommendations correctly', () => {
    const list = parseRecommendations(mockValidJson);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('Clear Fire Exit'); // sorted by priority 1 first
    expect(list[1].title).toBe('Clean Lathe Base'); // priority 2 second
  });

  it('correctly handles markdown code fences', () => {
    const markdown = '```json\n' + mockValidJson + '\n```';
    const list = parseRecommendations(markdown);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('Clear Fire Exit');
  });

  it('hydrates missing or invalid fields with defaults', () => {
    const invalidJson = `[
      {
        "title": "Minimal Rec"
      }
    ]`;
    const list = parseRecommendations(invalidJson);
    expect(list).toHaveLength(1);
    expect(list[0].pillar).toBe('SORT');
    expect(list[0].severity).toBe('MINOR');
    expect(list[0].priority_label).toBe('Medium Priority');
    expect(list[0].priority).toBe(3); // default for Medium Priority
  });

  it('sorts by priority ascending', () => {
    const unsortedJson = `[
      { "title": "P3", "priority": 3 },
      { "title": "P1", "priority": 1 },
      { "title": "P4", "priority": 4 },
      { "title": "P2", "priority": 2 }
    ]`;
    const list = parseRecommendations(unsortedJson);
    expect(list.map((r) => r.title)).toEqual(['P1', 'P2', 'P3', 'P4']);
  });

  it('safely handles non-JSON plain text and malformed inputs', () => {
    const list = parseRecommendations('This is plain text and not JSON');
    expect(list).toEqual([]);
  });
});
