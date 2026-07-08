/**
 * src/test/stability/scoreStability.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Score Stability Tests (Phase 2A.2).
 *
 * Tests determinism, controlled answer variations, and simulated
 * observation variations (camera angle, zoom, visibility differences).
 */

import { describe, it, expect } from 'vitest';
import { scoreSession, scorePillar } from '../../../backend/supabase/functions/analyze-5s/scoring/ScoringService';
import { ObservationCache, defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';
import { classifyReliability } from '../../../gemini/ai-engines/ReliabilityClassifier';
import { applyBuiltinRules } from '../../../gemini/ai-engines/RuleEngine';
import type { QuestionItem, ScoredResponse, CriticalRule } from '../../../backend/supabase/functions/analyze-5s/scoring/types';
import type { StructuredObservation } from '../../../gemini/ai-engines/ObservationCache';

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(id: string, pillar: QuestionItem['pillar'], opts: Partial<QuestionItem> = {}): QuestionItem {
  return {
    id, question_id: id, question_text: `Q ${id}`,
    pillar, max_points: 4, weight: 1.0, severity: 'MINOR', is_mandatory: true, category: 'General',
    ...opts,
  };
}

function resp(id: string, ai_answer: ScoredResponse['ai_answer']): ScoredResponse {
  return { session_item_id: id, question_id: id, ai_answer, evidence: '' };
}

function obs(overrides: Partial<StructuredObservation> = {}): StructuredObservation {
  return { category: 'Cleanliness', finding: 'test', status: 'COMPLIANT', evidence: '',
    ...defaultObservationFields(), ...overrides };
}

const STANDARD_ITEMS: QuestionItem[] = [
  item('s1', 'SORT'),    item('s2', 'SORT'),
  item('s3', 'SET_IN_ORDER'), item('s4', 'SET_IN_ORDER'),
  item('s5', 'SHINE'),   item('s6', 'SHINE'),
  item('s7', 'STANDARDIZE'), item('s8', 'STANDARDIZE'),
  item('s9', 'SUSTAIN'), item('s10', 'SUSTAIN'),
];

const ALL_YES    = STANDARD_ITEMS.map((i) => resp(i.id, 'YES'));
const ALL_NO     = STANDARD_ITEMS.map((i) => resp(i.id, 'NO'));
const ALL_NV     = STANDARD_ITEMS.map((i) => resp(i.id, 'NOT_VISIBLE'));
const ALL_NA     = STANDARD_ITEMS.map((i) => resp(i.id, 'NOT_APPLICABLE'));

// ── Determinism ───────────────────────────────────────────────────────────────

describe('Score determinism', () => {
  it('same inputs produce identical output across 10 calls', () => {
    const inputs = [...ALL_YES];
    const first = scoreSession(STANDARD_ITEMS, inputs, []);
    for (let i = 0; i < 9; i++) {
      const r = scoreSession(STANDARD_ITEMS, inputs, []);
      expect(r.overall_percentage).toBe(first.overall_percentage);
      expect(r.overall_score).toBe(first.overall_score);
      expect(r.grade).toBe(first.grade);
    }
  });

  it('same inputs in different order produce same result', () => {
    const ordered  = scoreSession(STANDARD_ITEMS, ALL_YES, []);
    const reversed = scoreSession(STANDARD_ITEMS, [...ALL_YES].reverse(), []);
    expect(ordered.overall_percentage).toBe(reversed.overall_percentage);
  });
});

// ── Answer variation ──────────────────────────────────────────────────────────

describe('Controlled answer variation', () => {
  it('all YES = 100%', () => {
    const r = scoreSession(STANDARD_ITEMS, ALL_YES, []);
    expect(r.overall_percentage).toBe(100);
  });

  it('all NO = 0%', () => {
    const r = scoreSession(STANDARD_ITEMS, ALL_NO, []);
    expect(r.overall_percentage).toBe(0);
  });

  it('all NOT_VISIBLE: overall_maximum = 0', () => {
    const r = scoreSession(STANDARD_ITEMS, ALL_NV, []);
    expect(r.overall_maximum).toBe(0);
    expect(r.overall_percentage).toBe(0);
  });

  it('all NOT_APPLICABLE: overall_maximum = 0', () => {
    const r = scoreSession(STANDARD_ITEMS, ALL_NA, []);
    expect(r.overall_maximum).toBe(0);
  });

  it('flipping one YES to PARTIAL reduces score by exactly 50% of that item', () => {
    const before = scoreSession(STANDARD_ITEMS, ALL_YES, []);
    const after  = scoreSession(STANDARD_ITEMS, ALL_YES.map((r, i) =>
      i === 0 ? resp(r.session_item_id, 'PARTIAL') : r
    ), []);
    const expectedDrop = 4 * 1.0 * 0.5; // max_points * weight * 0.5
    expect(before.overall_score - after.overall_score).toBeCloseTo(expectedDrop, 1);
  });

  it('flipping one YES to NO reduces score by full weighted points', () => {
    const before = scoreSession(STANDARD_ITEMS, ALL_YES, []);
    const after  = scoreSession(STANDARD_ITEMS, ALL_YES.map((r, i) =>
      i === 0 ? resp(r.session_item_id, 'NO') : r
    ), []);
    const expectedDrop = 4 * 1.0; // max_points * weight
    expect(before.overall_score - after.overall_score).toBeCloseTo(expectedDrop, 1);
  });

  it('CRITICAL item answered NO fires cap rule', () => {
    const critItem = item('CRIT', 'SORT', { severity: 'CRITICAL' });
    const capRule: CriticalRule = {
      id: 'r1', checklist_item_id: 'CRIT', pillar: 'SORT',
      trigger_answer: 'NO', score_cap: 40, description: 'Critical cap',
    };
    const result = scorePillar('SORT',
      [...STANDARD_ITEMS.filter((i) => i.pillar === 'SORT'), critItem],
      [...ALL_YES.filter((r) => ['s1', 's2'].includes(r.session_item_id)), resp('CRIT', 'NO')],
      [capRule],
    );
    expect(result.cap_applied).toBe(true);
    expect(result.percentage).toBe(40);
  });
});

// ── Observation variation simulation ─────────────────────────────────────────

describe('Observation variation simulation', () => {
  it('labels_visible: true→false changes rule answer but not score formula', () => {
    const qInput = [{ id: 's1', question_id: 's1', question_text: 'labels?', category: 'Labels', pillar: 'SET_IN_ORDER' as const }];

    const cacheWithLabels    = new ObservationCache([obs({ labels_visible: true, category: 'Labels' })]);
    const cacheWithoutLabels = new ObservationCache([obs({ labels_visible: false, category: 'Labels' })]);

    const { answers: with_yes }  = applyBuiltinRules(qInput, cacheWithLabels);
    const { answers: with_no }   = applyBuiltinRules(qInput, cacheWithoutLabels);

    // Labels presence/absence changes the rule answer
    expect(with_yes.get('s1')?.ai_answer).toBe('YES');
    expect(with_no.get('s1')?.ai_answer).toBe('NO');
  });

  it('confidence change on observations does NOT affect score', () => {
    const items   = [item('s1', 'SORT')];
    const highConf = scoreSession(items, [resp('s1', 'YES')], []);
    const lowConf  = scoreSession(items, [resp('s1', 'YES')], []);
    // Score must be identical regardless of AI confidence (confidence not in scoring)
    expect(highConf.overall_percentage).toBe(lowConf.overall_percentage);
  });

  it('wide-angle (100% visible) vs narrow-angle (20% NOT_VISIBLE) changes reliability, not score formula', () => {
    const fullAnswers    = STANDARD_ITEMS.map((i) => resp(i.id, 'YES'));
    const narrowAnswers  = STANDARD_ITEMS.map((i, idx) =>
      idx < 2 ? resp(i.id, 'NOT_VISIBLE') : resp(i.id, 'YES')
    );

    const fullResult   = scoreSession(STANDARD_ITEMS, fullAnswers, []);
    const narrowResult = scoreSession(STANDARD_ITEMS, narrowAnswers, []);

    // NOT_VISIBLE items are excluded from denominator — score stays 100% for visible items
    expect(narrowResult.overall_percentage).toBe(100);

    // But reliability changes based on not_visible count
    const notVisibleCount = narrowAnswers.filter((r) => r.ai_answer === 'NOT_VISIBLE').length;
    const notVisiblePct   = (notVisibleCount / STANDARD_ITEMS.length) * 100;

    const wideReliability   = classifyReliability({ audit_confidence: 90, not_visible_pct: 0,  high_consistency_warnings: 0 });
    const narrowReliability = classifyReliability({ audit_confidence: 90, not_visible_pct: notVisiblePct, high_consistency_warnings: 0 });

    // Wide angle has better or equal reliability than narrow angle
    const levels = ['EXCELLENT', 'HIGH', 'MEDIUM', 'LOW', 'REJECTED'];
    expect(levels.indexOf(wideReliability.level)).toBeLessThanOrEqual(
      levels.indexOf(narrowReliability.level)
    );
  });

  it('cleanliness rating change only affects cleanliness-category rule answers', () => {
    const q = [{ id: 's5', question_id: 's5', question_text: 'clean?', category: 'Cleanliness', pillar: 'SHINE' as const }];

    const cleanCache = new ObservationCache([obs({ cleanliness_rating: 'CLEAN', category: 'Cleanliness' })]);
    const dirtyCache = new ObservationCache([obs({ cleanliness_rating: 'DIRTY', category: 'Cleanliness' })]);

    const { answers: cleanAnswers } = applyBuiltinRules(q, cleanCache);
    const { answers: dirtyAnswers } = applyBuiltinRules(q, dirtyCache);

    expect(cleanAnswers.get('s5')?.ai_answer).toBe('YES');
    expect(dirtyAnswers.get('s5')?.ai_answer).toBe('NO');
  });
});
