/**
 * src/test/unit/ruleEngine.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the hybrid Rule Engine.
 * One test per built-in rule (condition MET + condition NOT MET).
 * Tests DB custom rule evaluation via applyDbRules.
 * Tests full hybrid merging via applyAllRules.
 * No AI calls — pure deterministic logic.
 */

import { describe, it, expect } from 'vitest';
import { ObservationCache, defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';
import type { StructuredObservation } from '../../../gemini/ai-engines/ObservationCache';
import {
  applyBuiltinRules,
  applyDbRules,
  applyAllRules,
} from '../../../gemini/ai-engines/RuleEngine';
import type { QuestionInput, DbCustomRule } from '../../../gemini/ai-engines/RuleEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

function obs(overrides: Partial<StructuredObservation> = {}): StructuredObservation {
  return {
    category:  'Cleanliness',
    finding:   'test',
    status:    'COMPLIANT',
    evidence:  'test evidence',
    ...defaultObservationFields(),
    ...overrides,
  };
}

function q(overrides: Partial<QuestionInput> & Pick<QuestionInput, 'question_id' | 'pillar'>): QuestionInput {
  return {
    id:            overrides.question_id,
    question_text: 'Test question',
    category:      'General',
    ...overrides,
  };
}

function makeCache(observations: StructuredObservation[]): ObservationCache {
  return new ObservationCache(observations);
}

// ── R_OBS_EXIT ─────────────────────────────────────────────────────────────────

describe('Built-in Rule: R_OBS_EXIT (blocked emergency exit)', () => {
  it('fires when obstruction contains "exit" keyword', () => {
    const cache = makeCache([obs({ obstructions: ['blocked emergency exit'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_001', pillar: 'SORT' })], cache);
    expect(answers.get('SORT_001')?.ai_answer).toBe('NO');
    expect(answers.get('SORT_001')?.ruleId).toBe('R_OBS_EXIT');
  });

  it('fires when obstruction contains "fire door" keyword', () => {
    const cache = makeCache([obs({ obstructions: ['pallet blocking fire door'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_001', pillar: 'SORT' })], cache);
    expect(answers.get('SORT_001')?.ai_answer).toBe('NO');
  });

  it('does NOT fire when no exit-related obstruction exists', () => {
    const cache = makeCache([obs({ obstructions: ['aisle clutter'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_001', pillar: 'SORT' })], cache);
    expect(answers.has('SORT_001')).toBe(false);
  });

  it('does NOT fire on non-SORT pillar question', () => {
    const cache = makeCache([obs({ obstructions: ['blocked emergency exit'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SHN_001', pillar: 'SHINE' })], cache);
    expect(answers.has('SHN_001')).toBe(false);
  });
});

// ── R_OBS_PANEL ────────────────────────────────────────────────────────────────

describe('Built-in Rule: R_OBS_PANEL (blocked electrical panel)', () => {
  it('fires when obstruction contains "electrical panel"', () => {
    const cache = makeCache([obs({ obstructions: ['box in front of electrical panel'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_002', pillar: 'SORT' })], cache);
    expect(answers.get('SORT_002')?.ai_answer).toBe('NO');
    expect(answers.get('SORT_002')?.ruleId).toBe('R_OBS_PANEL');
  });

  it('does NOT fire when no electrical panel obstruction', () => {
    const cache = makeCache([obs({ obstructions: ['loose boxes on shelf'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_002', pillar: 'SORT' })], cache);
    expect(answers.has('SORT_002')).toBe(false);
  });
});

// ── R_FLOOR_MISSING ────────────────────────────────────────────────────────────

describe('Built-in Rule: R_FLOOR_MISSING (floor markings absent)', () => {
  it('fires NO when floor_markings=false and category=Floor Markings', () => {
    const cache = makeCache([obs({ floor_markings: false, category: 'Floor Markings' })]);
    const q1 = q({ question_id: 'ORD_001', pillar: 'SET_IN_ORDER', category: 'Floor Markings' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('ORD_001')?.ai_answer).toBe('NO');
  });

  it('does NOT fire when category is not Floor Markings', () => {
    const cache = makeCache([obs({ floor_markings: false })]);
    const q1 = q({ question_id: 'ORD_001', pillar: 'SET_IN_ORDER', category: 'Clutter' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.has('ORD_001')).toBe(false);
  });
});

// ── R_FLOOR_PRESENT ────────────────────────────────────────────────────────────

describe('Built-in Rule: R_FLOOR_PRESENT (floor markings visible)', () => {
  it('fires YES when floor_markings=true and category=Floor Markings', () => {
    const cache = makeCache([obs({ floor_markings: true, category: 'Floor Markings' })]);
    const q1 = q({ question_id: 'ORD_001', pillar: 'SET_IN_ORDER', category: 'Floor Markings' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('ORD_001')?.ai_answer).toBe('YES');
  });
});

// ── R_LABELS_MISSING / R_LABELS_PRESENT ───────────────────────────────────────

describe('Built-in Rules: R_LABELS_MISSING / R_LABELS_PRESENT', () => {
  it('fires NO when labels_visible=false and category=Labels', () => {
    const cache = makeCache([obs({ labels_visible: false, category: 'Labels' })]);
    const q1 = q({ question_id: 'ORD_002', pillar: 'SET_IN_ORDER', category: 'Labels' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('ORD_002')?.ai_answer).toBe('NO');
  });

  it('fires YES when labels_visible=true and category=Labels', () => {
    const cache = makeCache([obs({ labels_visible: true, category: 'Labels' })]);
    const q1 = q({ question_id: 'ORD_002', pillar: 'SET_IN_ORDER', category: 'Labels' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('ORD_002')?.ai_answer).toBe('YES');
  });
});

// ── R_CLEAN / R_DIRTY ──────────────────────────────────────────────────────────

describe('Built-in Rules: R_CLEAN / R_DIRTY (cleanliness)', () => {
  it('fires YES when cleanliness=CLEAN and category=Cleanliness', () => {
    const cache = makeCache([obs({ cleanliness_rating: 'CLEAN', category: 'Cleanliness' })]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE', category: 'Cleanliness' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('SHN_001')?.ai_answer).toBe('YES');
  });

  it('fires NO when cleanliness=DIRTY and category=Cleanliness', () => {
    const cache = makeCache([obs({ cleanliness_rating: 'DIRTY', category: 'Cleanliness' })]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE', category: 'Cleanliness' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('SHN_001')?.ai_answer).toBe('NO');
  });

  it('does NOT fire for wrong category', () => {
    const cache = makeCache([obs({ cleanliness_rating: 'DIRTY' })]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE', category: 'Labels' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.has('SHN_001')).toBe(false);
  });
});

// ── R_HAZARD_SORT ──────────────────────────────────────────────────────────────

describe('Built-in Rule: R_HAZARD_SORT (hazards in SORT pillar)', () => {
  it('fires NO when hazards detected and pillar=SORT', () => {
    const cache = makeCache([obs({ hazards: ['oil spill'] })]);
    const q1 = q({ question_id: 'SRT_001', pillar: 'SORT' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('SRT_001')?.ai_answer).toBe('NO');
  });

  it('does NOT fire on SHINE pillar even with hazards', () => {
    const cache = makeCache([obs({ hazards: ['oil spill'] })]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.has('SHN_001')).toBe(false);
  });
});

// ── R_PPE_ABSENT ───────────────────────────────────────────────────────────────

describe('Built-in Rule: R_PPE_ABSENT (PPE compliance)', () => {
  it('fires NO when safety_equipment=[] and category=PPE Compliance', () => {
    const cache = makeCache([obs({ safety_equipment: [], category: 'PPE Compliance' })]);
    const q1 = q({ question_id: 'SST_001', pillar: 'SUSTAIN', category: 'PPE Compliance' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('SST_001')?.ai_answer).toBe('NO');
  });

  it('does NOT fire when safety equipment exists', () => {
    const cache = makeCache([obs({ safety_equipment: ['safety goggles'] })]);
    const q1 = q({ question_id: 'SST_001', pillar: 'SUSTAIN', category: 'PPE Compliance' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.has('SST_001')).toBe(false);
  });
});

// ── R_CATEGORY_NOT_VISIBLE ────────────────────────────────────────────────────

describe('Built-in Rule: R_CATEGORY_NOT_VISIBLE', () => {
  it('fires NOT_VISIBLE when all observations in category are NOT_VISIBLE', () => {
    const cache = makeCache([
      obs({ category: 'Dust', status: 'NOT_VISIBLE' }),
      obs({ category: 'Dust', status: 'NOT_VISIBLE' }),
    ]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE', category: 'Dust' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.get('SHN_001')?.ai_answer).toBe('NOT_VISIBLE');
  });

  it('does NOT fire when category has NO observations at all', () => {
    const cache = makeCache([obs({ category: 'Cleanliness' })]);
    const q1 = q({ question_id: 'SHN_001', pillar: 'SHINE', category: 'Dust' });
    const { answers } = applyBuiltinRules([q1], cache);
    expect(answers.has('SHN_001')).toBe(false);
  });
});

// ── Rule evaluations record ───────────────────────────────────────────────────

describe('Rule evaluations trace', () => {
  it('records evaluations with source=BUILTIN', () => {
    const cache = makeCache([obs({ obstructions: ['blocked emergency exit'] })]);
    const { evaluations } = applyBuiltinRules([q({ question_id: 'SORT_001', pillar: 'SORT' })], cache);
    expect(evaluations.length).toBeGreaterThan(0);
    expect(evaluations[0].source).toBe('BUILTIN');
    expect(evaluations[0].rule_id).toBe('R_OBS_EXIT');
  });

  it('answeredByRule=true on all rule-matched responses', () => {
    const cache = makeCache([obs({ obstructions: ['blocked emergency exit'] })]);
    const { answers } = applyBuiltinRules([q({ question_id: 'SORT_001', pillar: 'SORT' })], cache);
    expect(answers.get('SORT_001')?.answeredByRule).toBe(true);
  });
});

// ── Empty cache ────────────────────────────────────────────────────────────────

describe('Rule engine with empty cache', () => {
  it('returns no rule answers when cache is empty', () => {
    const cache = new ObservationCache([]);
    const questions = [
      q({ question_id: 'Q1', pillar: 'SORT' }),
      q({ question_id: 'Q2', pillar: 'SHINE', category: 'Cleanliness' }),
    ];
    const { answers } = applyBuiltinRules(questions, cache);
    // No rules should fire on an empty cache
    expect(answers.size).toBe(0);
  });
});

// ── DB custom rules ───────────────────────────────────────────────────────────

describe('DB custom rules (Tier 2)', () => {
  const dbRule: DbCustomRule = {
    id:            'db-rule-1',
    rule_id:       'CUSTOM_HAZARD',
    template_id:   'template-1',
    pillar:        'SORT',
    category:      null,
    condition_json: { type: 'has_hazard' },
    answer:        'NO',
    confidence:    0.99,
    rationale:     'Custom org rule: any hazard triggers NO',
    is_active:     true,
  };

  it('fires DB rule when condition matches', () => {
    const cache = makeCache([obs({ hazards: ['spill'] })]);
    const { answers } = applyDbRules(
      [q({ question_id: 'SORT_001', pillar: 'SORT' })],
      cache,
      [dbRule],
    );
    expect(answers.get('SORT_001')?.ai_answer).toBe('NO');
    expect(answers.get('SORT_001')?.ruleId).toBe('CUSTOM_HAZARD');
  });

  it('records source=DB in evaluations', () => {
    const cache = makeCache([obs({ hazards: ['spill'] })]);
    const { evaluations } = applyDbRules(
      [q({ question_id: 'SORT_001', pillar: 'SORT' })],
      cache,
      [dbRule],
    );
    expect(evaluations[0].source).toBe('DB');
  });

  it('inactive DB rule is ignored', () => {
    const cache = makeCache([obs({ hazards: ['spill'] })]);
    const inactiveRule = { ...dbRule, is_active: false };
    const { answers } = applyDbRules(
      [q({ question_id: 'SORT_001', pillar: 'SORT' })],
      cache,
      [inactiveRule],
    );
    expect(answers.has('SORT_001')).toBe(false);
  });
});

// ── Hybrid applyAllRules ───────────────────────────────────────────────────────

describe('applyAllRules — hybrid merge', () => {
  it('DB rules take precedence over built-in rules for same question', () => {
    const dbRule: DbCustomRule = {
      id:            'db-1',
      rule_id:       'CUSTOM_EXIT',
      template_id:   'tmpl-1',
      pillar:        'SORT',
      category:      null,
      condition_json: { type: 'has_obstruction' },
      answer:        'PARTIAL',   // DB says PARTIAL
      confidence:    0.9,
      rationale:     'Custom org rule',
      is_active:     true,
    };
    const cache = makeCache([obs({ obstructions: ['blocked emergency exit'] })]);
    const { answers } = applyAllRules(
      [q({ question_id: 'SORT_001', pillar: 'SORT' })],
      cache,
      [dbRule],
    );
    // DB rule should win: PARTIAL (not the builtin NO)
    expect(answers.get('SORT_001')?.ai_answer).toBe('PARTIAL');
    expect(answers.get('SORT_001')?.ruleId).toBe('CUSTOM_EXIT');
  });

  it('falls back to builtin for questions with no matching DB rule', () => {
    const cache = makeCache([obs({ floor_markings: false, category: 'Floor Markings' })]);
    const { answers } = applyAllRules(
      [q({ question_id: 'ORD_001', pillar: 'SET_IN_ORDER', category: 'Floor Markings' })],
      cache,
      [], // no DB rules
    );
    expect(answers.get('ORD_001')?.ai_answer).toBe('NO');
    expect(answers.get('ORD_001')?.ruleId).toBe('R_FLOOR_MISSING');
  });

  it('returns empty answers for questions with no matching rules', () => {
    const cache = new ObservationCache([]);
    const { answers } = applyAllRules(
      [q({ question_id: 'STD_001', pillar: 'STANDARDIZE', category: 'Documented Standards' })],
      cache,
    );
    expect(answers.has('STD_001')).toBe(false);
  });
});
