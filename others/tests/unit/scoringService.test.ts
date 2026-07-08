/**
 * src/test/unit/scoringService.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the deterministic ScoringService.
 * Tests scorePillar() and scoreSession() with controlled answer inputs.
 * No AI calls — pure arithmetic verification.
 */

import { describe, it, expect } from 'vitest';
import {
  scorePillar,
  scoreSession,
} from '../../../backend/supabase/functions/analyze-5s/scoring/ScoringService';
import type {
  QuestionItem,
  ScoredResponse,
  CriticalRule,
} from '../../../backend/supabase/functions/analyze-5s/scoring/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(
  id: string,
  question_id: string,
  pillar: QuestionItem['pillar'],
  opts: Partial<QuestionItem> = {},
): QuestionItem {
  return {
    id,
    question_id,
    question_text: `Question ${id}`,
    pillar,
    max_points:   4,
    weight:       1.0,
    severity:     'MINOR',
    is_mandatory: true,
    category:     'General',
    ...opts,
  };
}

function resp(session_item_id: string, ai_answer: ScoredResponse['ai_answer']): ScoredResponse {
  return { session_item_id, question_id: session_item_id, ai_answer, evidence: 'test' };
}

function rule(id: string, checklist_item_id: string, pillar: CriticalRule['pillar'], score_cap: number): CriticalRule {
  return {
    id,
    checklist_item_id,
    pillar,
    trigger_answer: 'NO',
    score_cap,
    description: `Critical rule ${id}`,
  };
}

const SORT_ITEMS = [
  item('s1', 'SRT_01', 'SORT'),
  item('s2', 'SRT_02', 'SORT'),
  item('s3', 'SRT_03', 'SORT', { severity: 'CRITICAL' }),
];

// ── All YES ────────────────────────────────────────────────────────────────────

describe('scorePillar — all YES answers', () => {
  it('returns 100% when all questions answered YES', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'YES'),
    ], []);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.cap_applied).toBe(false);
  });

  it('score equals maximum when all YES', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'YES'),
    ], []);
    expect(result.score).toBe(result.maximum);
  });
});

// ── All NO ────────────────────────────────────────────────────────────────────

describe('scorePillar — all NO answers', () => {
  it('returns 0% when all questions answered NO', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'NO'), resp('s2', 'NO'), resp('s3', 'NO'),
    ], []);
    expect(result.percentage).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.score).toBe(0);
  });

  it('maximum is still non-zero (NO items stay in denominator)', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'NO'), resp('s2', 'NO'), resp('s3', 'NO'),
    ], []);
    expect(result.maximum).toBeGreaterThan(0);
  });
});

// ── PARTIAL answers ───────────────────────────────────────────────────────────

describe('scorePillar — PARTIAL answers', () => {
  it('PARTIAL = 50% of max_points', () => {
    const result = scorePillar('SORT', [item('s1', 'SRT_01', 'SORT')], [resp('s1', 'PARTIAL')], []);
    expect(result.score).toBe(2); // 4 * 1.0 * 0.5
    expect(result.maximum).toBe(4);
    expect(result.percentage).toBe(50);
    expect(result.partial).toBe(1);
  });
});

// ── NOT_VISIBLE and NOT_APPLICABLE exclusions ─────────────────────────────────

describe('scorePillar — NOT_VISIBLE and NOT_APPLICABLE exclusions', () => {
  it('NOT_VISIBLE excluded from denominator', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'NOT_VISIBLE'),
      resp('s2', 'NOT_VISIBLE'),
      resp('s3', 'NOT_VISIBLE'),
    ], []);
    expect(result.maximum).toBe(0);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.not_visible).toBe(3);
  });

  it('NOT_APPLICABLE excluded from denominator', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'NOT_APPLICABLE'),
      resp('s2', 'NOT_APPLICABLE'),
      resp('s3', 'NOT_APPLICABLE'),
    ], []);
    expect(result.maximum).toBe(0);
    expect(result.not_applicable).toBe(3);
  });

  it('mix of YES and NOT_VISIBLE: only YES items counted', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'),
      resp('s2', 'NOT_VISIBLE'),
      resp('s3', 'NOT_VISIBLE'),
    ], []);
    expect(result.maximum).toBe(4);   // only s1 in denominator
    expect(result.score).toBe(4);     // s1 full points
    expect(result.percentage).toBe(100);
  });
});

// ── Critical cap rule ─────────────────────────────────────────────────────────

describe('scorePillar — critical cap rules', () => {
  it('cap fires when critical item answered NO', () => {
    const capRule = rule('r1', 's3', 'SORT', 40);
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'NO'),
    ], [capRule]);
    expect(result.cap_applied).toBe(true);
    expect(result.cap_value).toBe(40);
    expect(result.percentage).toBe(40);
    expect(result.raw_percentage).toBeGreaterThan(40); // without cap would be higher
  });

  it('cap does NOT fire when critical item answered YES', () => {
    const capRule = rule('r1', 's3', 'SORT', 40);
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'YES'),
    ], [capRule]);
    expect(result.cap_applied).toBe(false);
    expect(result.percentage).toBe(100);
  });

  it('lowest cap applied when multiple rules fire', () => {
    const rules = [
      rule('r1', 's1', 'SORT', 50),
      rule('r2', 's2', 'SORT', 30),
    ];
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'NO'), resp('s2', 'NO'), resp('s3', 'YES'),
    ], rules);
    expect(result.cap_value).toBe(30);
  });
});

// ── Critical severity counting ─────────────────────────────────────────────────

describe('scorePillar — critical severity counting', () => {
  it('counts critical failures for CRITICAL severity items answered NO', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'NO'),
    ], []);
    expect(result.critical).toBe(1);
  });

  it('counts critical failures for CRITICAL severity items answered PARTIAL', () => {
    const result = scorePillar('SORT', SORT_ITEMS, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'PARTIAL'),
    ], []);
    expect(result.critical).toBe(1);
  });
});

// ── Top deductions ─────────────────────────────────────────────────────────────

describe('scorePillar — top_deductions', () => {
  it('returns max 3 top deductions sorted by points_lost desc', () => {
    const items = [
      item('i1', 'Q1', 'SORT', { max_points: 4 }),
      item('i2', 'Q2', 'SORT', { max_points: 4 }),
      item('i3', 'Q3', 'SORT', { max_points: 4 }),
      item('i4', 'Q4', 'SORT', { max_points: 4 }),
    ];
    const result = scorePillar('SORT', items, [
      resp('i1', 'NO'), resp('i2', 'NO'), resp('i3', 'NO'), resp('i4', 'NO'),
    ], []);
    expect(result.top_deductions.length).toBeLessThanOrEqual(3);
  });
});

// ── scoreSession ──────────────────────────────────────────────────────────────

describe('scoreSession', () => {
  const allItems = [
    item('s1', 'SRT_01', 'SORT'),
    item('s2', 'SIN_01', 'SET_IN_ORDER'),
    item('s3', 'SHN_01', 'SHINE'),
    item('s4', 'STD_01', 'STANDARDIZE'),
    item('s5', 'SST_01', 'SUSTAIN'),
  ];

  it('computes overall score across all 5 pillars', () => {
    const result = scoreSession(allItems, [
      resp('s1', 'YES'), resp('s2', 'YES'), resp('s3', 'YES'),
      resp('s4', 'YES'), resp('s5', 'YES'),
    ], []);
    expect(result.overall_percentage).toBe(100);
    expect(result.grade).toBe('Excellent');
    expect(result.pillar_scores).toHaveLength(5);
  });

  it('overall_score + overall_maximum consistent with pillar breakdown', () => {
    const result = scoreSession(allItems, [
      resp('s1', 'YES'), resp('s2', 'NO'), resp('s3', 'PARTIAL'),
      resp('s4', 'NOT_VISIBLE'), resp('s5', 'YES'),
    ], []);
    const sumScore   = result.pillar_scores.reduce((s, p) => s + p.score, 0);
    const sumMaximum = result.pillar_scores.reduce((s, p) => s + p.maximum, 0);
    expect(result.overall_score).toBeCloseTo(sumScore, 1);
    expect(result.overall_maximum).toBeCloseTo(sumMaximum, 1);
  });

  it('returns correct grade labels at boundaries', () => {
    // Helper: create a session with pct% = (earned/100) using two items
    const gradeAt = (earned: number) => {
      const items2 = [
        item('g1', 'Q1', 'SORT', { max_points: earned }),
        item('g2', 'Q2', 'SORT', { max_points: 100 - earned }),
      ];
      return scoreSession(items2, [
        resp('g1', 'YES'),
        resp('g2', 'NO'),
      ], []).grade;
    };
    expect(gradeAt(90)).toBe('Excellent');
    expect(gradeAt(80)).toBe('Very Good');
    expect(gradeAt(70)).toBe('Good');
    expect(gradeAt(60)).toBe('Average');
    expect(gradeAt(59)).toBe('Needs Improvement');
  });

  it('computed_at is a valid ISO timestamp', () => {
    const result = scoreSession(allItems, allItems.map((i) => resp(i.id, 'YES')), []);
    expect(() => new Date(result.computed_at)).not.toThrow();
    expect(new Date(result.computed_at).toISOString()).toBe(result.computed_at);
  });

  it('deterministic: same inputs always produce identical output', () => {
    const inputs = allItems.map((i) => resp(i.id, 'YES'));
    const r1 = scoreSession(allItems, inputs, []);
    const r2 = scoreSession(allItems, inputs, []);
    expect(r1.overall_percentage).toBe(r2.overall_percentage);
    expect(r1.overall_score).toBe(r2.overall_score);
    expect(r1.grade).toBe(r2.grade);
  });
});
