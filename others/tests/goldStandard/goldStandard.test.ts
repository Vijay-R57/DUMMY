/**
 * src/test/goldStandard/goldStandard.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gold Standard Validation Tests (Phase 2A.2).
 *
 * Validates Rule Engine determinism against 10 pre-built benchmark cases
 * (5 industries × 2 scenarios each: IDEAL + EDGE).
 *
 * For each case:
 *  1. Loads pre-computed observations into ObservationCache.
 *  2. Runs applyBuiltinRules() against the expected rule-answerable questions.
 *  3. Asserts exact rule answers for deterministic questions.
 *  4. Runs classifyReliability() and asserts expected reliability level.
 *  5. (Score range validation: checked in score stability tests.)
 */

import { describe, it, expect } from 'vitest';
import { ObservationCache }           from '../../../gemini/ai-engines/ObservationCache';
import { applyBuiltinRules }          from '../../../gemini/ai-engines/RuleEngine';
import type { QuestionInput }         from '../../../gemini/ai-engines/RuleEngine';
import { classifyReliability }        from '../../../gemini/ai-engines/ReliabilityClassifier';

import { caseManufacturingIdeal, caseManufacturingEdge } from './case-manufacturing';
import {
  caseWarehouseIdeal, caseWarehouseEdge,
  caseOfficeIdeal, caseOfficeEdge,
  caseLaboratoryIdeal, caseLaboratoryEdge,
  caseMaintenanceIdeal, caseMaintenanceEdge,
} from './case-others';
import type { GoldStandardCase } from './dataset';

// ── All gold standard benchmark cases ─────────────────────────────────────────

const ALL_CASES: GoldStandardCase[] = [
  caseManufacturingIdeal,
  caseManufacturingEdge,
  caseWarehouseIdeal,
  caseWarehouseEdge,
  caseOfficeIdeal,
  caseOfficeEdge,
  caseLaboratoryIdeal,
  caseLaboratoryEdge,
  caseMaintenanceIdeal,
  caseMaintenanceEdge,
];

// ── Helper: infer question pillar from question_id prefix ─────────────────────

function inferPillar(qid: string): QuestionInput['pillar'] {
  if (/_(SRT|SOR)_/i.test(qid))  return 'SORT';
  if (/_(ORD|SIN)_/i.test(qid))  return 'SET_IN_ORDER';
  if (/_SHN_/i.test(qid))        return 'SHINE';
  if (/_STD_/i.test(qid))        return 'STANDARDIZE';
  if (/_SST_/i.test(qid))        return 'SUSTAIN';
  return 'SORT'; // default
}

/** Infer category from question_id (best-effort for gold standard tests). */
function inferCategory(qid: string): string {
  if (/_ORD_0[12]/i.test(qid))    return 'Tool Organization';
  if (/_ORD_0[34]/i.test(qid))    return 'Labels';
  if (/_ORD_0[56]/i.test(qid))    return 'Floor Markings';
  if (/_SHN_0[12]/i.test(qid))    return 'Cleanliness';
  if (/_SST_0[123]/i.test(qid))   return 'PPE Compliance';
  if (/_SRT_/i.test(qid))         return 'Clutter';
  return 'General';
}

// ── Gold Standard Validation loop ─────────────────────────────────────────────

describe('Gold Standard Validation', () => {
  for (const testCase of ALL_CASES) {
    describe(`[${testCase.id}] ${testCase.scenario_type} — ${testCase.scenario_description}`, () => {

      const cache   = new ObservationCache(testCase.observations);
      const qids    = Object.keys(testCase.expected_rule_answers);
      const qInputs = qids.map((qid): QuestionInput => ({
        id:            qid,
        question_id:   qid,
        question_text: `Gold Standard: ${qid}`,
        category:      inferCategory(qid),
        pillar:        inferPillar(qid),
      }));

      // ── Rule answer assertions ─────────────────────────────────────────

      if (qids.length > 0) {
        it(`Rule Engine produces correct deterministic answers`, () => {
          const { answers } = applyBuiltinRules(qInputs, cache);

          for (const [qid, expected] of Object.entries(testCase.expected_rule_answers)) {
            const got = answers.get(qid)?.ai_answer;
            expect(got, `[${testCase.id}] Rule answer for ${qid}: expected ${expected}, got ${got ?? 'NONE (not answered by rule)'}`).toBe(expected);
          }
        });

        it(`All rule-answered questions have answeredByRule=true`, () => {
          const { answers } = applyBuiltinRules(qInputs, cache);
          for (const qid of qids) {
            if (answers.has(qid)) {
              expect(answers.get(qid)?.answeredByRule).toBe(true);
            }
          }
        });
      }

      // ── Reliability classification assertion ───────────────────────────

      it(`classifyReliability() returns expected level: ${testCase.expected_reliability}`, () => {
        const result = classifyReliability({
          audit_confidence:           testCase.test_audit_confidence,
          not_visible_pct:            testCase.test_not_visible_pct,
          high_consistency_warnings:  testCase.test_high_warnings,
        });
        expect(result.level, `[${testCase.id}] Reliability: expected ${testCase.expected_reliability}, got ${result.level}`).toBe(testCase.expected_reliability);
      });

      // ── Observation cache query sanity checks ─────────────────────────

      it(`ObservationCache populated with ${testCase.observations.length} observations`, () => {
        expect(cache.size()).toBe(testCase.observations.length);
      });

      it(`averageConfidence() is between 0 and 1`, () => {
        const conf = cache.averageConfidence();
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      });
    });
  }
});

// ── Cross-case sanity checks ───────────────────────────────────────────────────

describe('Gold Standard — cross-case sanity', () => {
  it('IDEAL cases all expect reliability of EXCELLENT or HIGH', () => {
    const idealCases = ALL_CASES.filter((c) => c.scenario_type === 'IDEAL');
    for (const c of idealCases) {
      expect(['EXCELLENT', 'HIGH'], `${c.id} expected EXCELLENT or HIGH`).toContain(c.expected_reliability);
    }
  });

  it('EDGE cases all expect reliability of MEDIUM, LOW, or REJECTED', () => {
    const edgeCases = ALL_CASES.filter((c) => c.scenario_type === 'EDGE');
    for (const c of edgeCases) {
      expect(['MEDIUM', 'LOW', 'REJECTED'], `${c.id} expected MEDIUM, LOW, or REJECTED`).toContain(c.expected_reliability);
    }
  });

  it('IDEAL cases have higher confidence than their EDGE counterparts', () => {
    const pairs = [
      [caseManufacturingIdeal, caseManufacturingEdge],
      [caseWarehouseIdeal,     caseWarehouseEdge],
      [caseOfficeIdeal,        caseOfficeEdge],
      [caseLaboratoryIdeal,    caseLaboratoryEdge],
      [caseMaintenanceIdeal,   caseMaintenanceEdge],
    ];
    pairs.forEach(([ideal, edge]) => {
      expect(ideal.test_audit_confidence, `${ideal.id} confidence should be > ${edge.id}`).toBeGreaterThan(edge.test_audit_confidence);
    });
  });

  it('IDEAL cases have lower not_visible_pct than their EDGE counterparts', () => {
    const pairs = [
      [caseManufacturingIdeal, caseManufacturingEdge],
      [caseWarehouseIdeal,     caseWarehouseEdge],
      [caseOfficeIdeal,        caseOfficeEdge],
      [caseLaboratoryIdeal,    caseLaboratoryEdge],
      [caseMaintenanceIdeal,   caseMaintenanceEdge],
    ];
    pairs.forEach(([ideal, edge]) => {
      expect(ideal.test_not_visible_pct, `${ideal.id} not_visible should be < ${edge.id}`).toBeLessThan(edge.test_not_visible_pct);
    });
  });
});
