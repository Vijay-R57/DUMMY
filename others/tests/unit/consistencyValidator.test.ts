/**
 * src/test/unit/consistencyValidator.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for ConsistencyValidator — one test per contradiction rule.
 * Tests both contradictory inputs (warning expected) and consistent inputs (no warning).
 */

import { describe, it, expect } from 'vitest';
import { ObservationCache, defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';
import type { StructuredObservation } from '../../../gemini/ai-engines/ObservationCache';
import { validateConsistency, countHighWarnings } from '../../../gemini/ai-engines/ConsistencyValidator';
import type { ValidatedAuditResponse } from '../../../gemini/ai-engines/VisionAnalyzer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function obs(overrides: Partial<StructuredObservation> = {}): StructuredObservation {
  return {
    category:  'General',
    finding:   'test',
    status:    'COMPLIANT',
    evidence:  'evidence',
    ...defaultObservationFields(),
    ...overrides,
  };
}

function response(question_id: string, ai_answer: string, opts: Partial<ValidatedAuditResponse> = {}): ValidatedAuditResponse {
  return {
    question_id,
    ai_answer: ai_answer as ValidatedAuditResponse['ai_answer'],
    confidence: 0.9,
    evidence: 'test evidence',
    reasoning: 'test reasoning',
    answeredByRule: false,
    ...opts,
  };
}

function meta(question_id: string, category: string, pillar: string) {
  return { question_id, category, pillar };
}

// ── C_STORAGE_LABEL_CONTRADICTION ─────────────────────────────────────────────

describe('C_STORAGE_LABEL_CONTRADICTION', () => {
  it('warns when storage present + labels absent + label question YES', () => {
    const cache = new ObservationCache([
      obs({ storage_present: true, labels_visible: false, category: 'Labels' }),
    ]);
    const warnings = validateConsistency(
      [response('ORD_001', 'YES')],
      cache,
      [meta('ORD_001', 'Labels', 'SET_IN_ORDER')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_STORAGE_LABEL_CONTRADICTION');
    expect(w).toBeDefined();
    expect(w!.affected_question_ids).toContain('ORD_001');
  });

  it('no warning when labels_visible=true', () => {
    const cache = new ObservationCache([obs({ storage_present: true, labels_visible: true })]);
    const warnings = validateConsistency(
      [response('ORD_001', 'YES')],
      cache,
      [meta('ORD_001', 'Labels', 'SET_IN_ORDER')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_STORAGE_LABEL_CONTRADICTION')).toBeUndefined();
  });
});

// ── C_NO_TOOLS_ORGANIZED ──────────────────────────────────────────────────────

describe('C_NO_TOOLS_ORGANIZED', () => {
  it('warns when no tools detected but tool organization answered YES', () => {
    const cache = new ObservationCache([obs({ detected_objects: ['barrel', 'pallet'] })]);
    const warnings = validateConsistency(
      [response('ORD_002', 'YES')],
      cache,
      [meta('ORD_002', 'Tool Organization', 'SET_IN_ORDER')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_NO_TOOLS_ORGANIZED');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('MEDIUM');
  });

  it('no warning when tools are detected', () => {
    const cache = new ObservationCache([obs({ detected_objects: ['hammer', 'shadow board'] })]);
    const warnings = validateConsistency(
      [response('ORD_002', 'YES')],
      cache,
      [meta('ORD_002', 'Tool Organization', 'SET_IN_ORDER')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_NO_TOOLS_ORGANIZED')).toBeUndefined();
  });
});

// ── C_FLOOR_NOT_VISIBLE ───────────────────────────────────────────────────────

describe('C_FLOOR_NOT_VISIBLE', () => {
  it('warns when all cleanliness observations are NOT_VISIBLE but question answered YES', () => {
    const cache = new ObservationCache([
      obs({ category: 'Cleanliness', status: 'NOT_VISIBLE' }),
      obs({ category: 'Cleanliness', status: 'NOT_VISIBLE' }),
    ]);
    const warnings = validateConsistency(
      [response('SHN_001', 'YES')],
      cache,
      [meta('SHN_001', 'Cleanliness', 'SHINE')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_FLOOR_NOT_VISIBLE');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('HIGH');
  });

  it('no warning when question answered NOT_VISIBLE correctly', () => {
    const cache = new ObservationCache([obs({ category: 'Cleanliness', status: 'NOT_VISIBLE' })]);
    const warnings = validateConsistency(
      [response('SHN_001', 'NOT_VISIBLE')],
      cache,
      [meta('SHN_001', 'Cleanliness', 'SHINE')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_FLOOR_NOT_VISIBLE')).toBeUndefined();
  });
});

// ── C_PPE_ABSENT_SUSTAIN ──────────────────────────────────────────────────────

describe('C_PPE_ABSENT_SUSTAIN', () => {
  it('warns when no safety equipment but PPE question answered YES', () => {
    const cache = new ObservationCache([obs({ safety_equipment: [] })]);
    const warnings = validateConsistency(
      [response('SST_001', 'YES')],
      cache,
      [meta('SST_001', 'PPE Compliance', 'SUSTAIN')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_PPE_ABSENT_SUSTAIN');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('HIGH');
  });

  it('no warning when safety equipment is detected', () => {
    const cache = new ObservationCache([obs({ safety_equipment: ['safety vest'] })]);
    const warnings = validateConsistency(
      [response('SST_001', 'YES')],
      cache,
      [meta('SST_001', 'PPE Compliance', 'SUSTAIN')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_PPE_ABSENT_SUSTAIN')).toBeUndefined();
  });
});

// ── C_CLUTTER_ORGANIZED ───────────────────────────────────────────────────────

describe('C_CLUTTER_ORGANIZED', () => {
  it('warns when 2+ NON_COMPLIANT clutter obs but SORT question answered YES', () => {
    const cache = new ObservationCache([
      obs({ category: 'Clutter', status: 'NON_COMPLIANT' }),
      obs({ category: 'Clutter', status: 'NON_COMPLIANT' }),
    ]);
    const warnings = validateConsistency(
      [response('SRT_001', 'YES')],
      cache,
      [meta('SRT_001', 'Clutter', 'SORT')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_CLUTTER_ORGANIZED');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('HIGH');
  });

  it('no warning with only 1 NON_COMPLIANT observation', () => {
    const cache = new ObservationCache([obs({ category: 'Clutter', status: 'NON_COMPLIANT' })]);
    const warnings = validateConsistency(
      [response('SRT_001', 'YES')],
      cache,
      [meta('SRT_001', 'Clutter', 'SORT')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_CLUTTER_ORGANIZED')).toBeUndefined();
  });
});

// ── C_HAZARD_SAFE ─────────────────────────────────────────────────────────────

describe('C_HAZARD_SAFE', () => {
  it('warns when serious hazard detected but safety question answered YES', () => {
    const cache = new ObservationCache([obs({ hazards: ['blocked emergency exit'] })]);
    const warnings = validateConsistency(
      [response('STD_001', 'YES')],
      cache,
      [meta('STD_001', 'Safety Markings', 'STANDARDIZE')],
    );
    const w = warnings.find((w) => w.rule_id === 'C_HAZARD_SAFE');
    expect(w).toBeDefined();
  });

  it('no warning when hazards are minor (no serious keywords)', () => {
    const cache = new ObservationCache([obs({ hazards: ['minor dust on shelf'] })]);
    const warnings = validateConsistency(
      [response('STD_001', 'YES')],
      cache,
      [meta('STD_001', 'Safety Markings', 'STANDARDIZE')],
    );
    expect(warnings.find((w) => w.rule_id === 'C_HAZARD_SAFE')).toBeUndefined();
  });
});

// ── Multiple simultaneous warnings ────────────────────────────────────────────

describe('Multiple simultaneous contradictions', () => {
  it('returns all matching warnings', () => {
    const cache = new ObservationCache([
      obs({ hazards: ['blocked emergency exit'], obstructions: ['blocked emergency exit'], safety_equipment: [] }),
      obs({ category: 'Clutter', status: 'NON_COMPLIANT' }),
      obs({ category: 'Clutter', status: 'NON_COMPLIANT' }),
    ]);
    const warnings = validateConsistency(
      [
        response('SRT_001', 'YES'),   // SORT with hazard + clutter
        response('SST_001', 'YES'),   // PPE
        response('STD_001', 'YES'),   // Safety Markings with hazard
      ],
      cache,
      [
        meta('SRT_001', 'Clutter', 'SORT'),
        meta('SST_001', 'PPE Compliance', 'SUSTAIN'),
        meta('STD_001', 'Safety Markings', 'STANDARDIZE'),
      ],
    );
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Empty inputs ──────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('returns empty warnings for empty response list', () => {
    const cache = new ObservationCache([]);
    const warnings = validateConsistency([], cache, []);
    expect(warnings).toHaveLength(0);
  });

  it('countHighWarnings returns correct count', () => {
    const cache = new ObservationCache([obs({ safety_equipment: [] })]);
    const warnings = validateConsistency(
      [response('SST_001', 'YES')],
      cache,
      [meta('SST_001', 'PPE Compliance', 'SUSTAIN')],
    );
    const high = warnings.filter((w) => w.severity === 'HIGH');
    expect(countHighWarnings(warnings)).toBe(high.length);
  });

  it('consistency rules never throw even with malformed inputs', () => {
    const cache = new ObservationCache([obs()]);
    expect(() =>
      validateConsistency(
        [response('Q1', 'YES'), response('Q2', 'NO')],
        cache,
        [meta('Q1', '', ''), meta('Q2', '', '')],
      )
    ).not.toThrow();
  });
});
