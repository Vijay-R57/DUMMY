/**
 * src/test/performance/auditPerformance.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Performance baseline validation tests (Phase 2A.3).
 *
 * Verifies that all pure-TS pipeline modules execute efficiently within generous
 * millisecond targets, ensuring there are no hidden performance bottlenecks.
 */

import { describe, it, expect } from 'vitest';
import { ObservationCache, defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';
import { applyAllRules } from '../../../gemini/ai-engines/RuleEngine';
import { validateConsistency } from '../../../gemini/ai-engines/ConsistencyValidator';
import { classifyReliability } from '../../../gemini/ai-engines/ReliabilityClassifier';
import { scoreSession } from '../../../backend/supabase/functions/analyze-5s/scoring/ScoringService';
import type { QuestionInput } from '../../../gemini/ai-engines/RuleEngine';
import type { QuestionItem, ScoredResponse } from '../../../backend/supabase/functions/analyze-5s/scoring/types';

// ── Mock Data Generation ──────────────────────────────────────────────────────

const MOCK_OBSERVATIONS = Array.from({ length: 50 }, (_, i) => ({
  category:           i % 2 === 0 ? 'Cleanliness' : 'Labels',
  finding:            `Observation ${i}`,
  status:             i % 5 === 0 ? 'NON_COMPLIANT' as const : 'COMPLIANT' as const,
  evidence:           `Evidence for observation ${i}`,
  detected_objects:   [`object_${i}_a`, `object_${i}_b`],
  safety_equipment:   i % 4 === 0 ? ['fire extinguisher'] : [],
  hazards:            i % 10 === 0 ? ['slip hazard'] : [],
  obstructions:       i % 12 === 0 ? ['blocked walkway'] : [],
  cleanliness_rating: i % 3 === 0 ? 'CLEAN' as const : 'DIRTY' as const,
  floor_markings:     i % 4 === 0 ? true : false,
  storage_present:    true,
  labels_visible:     i % 5 === 0 ? false : true,
  confidence:         0.9,
}));

const MOCK_QUESTIONS = Array.from({ length: 25 }, (_, i): QuestionInput => ({
  id:            `Q${i}`,
  question_id:   `Q${i}`,
  question_text: `Is item ${i} compliant?`,
  category:      i % 2 === 0 ? 'Cleanliness' : 'Labels',
  pillar:        ['SORT', 'SET_IN_ORDER', 'SHINE', 'STANDARDIZE', 'SUSTAIN'][i % 5] as 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN',
}));

const MOCK_QUESTION_ITEMS = MOCK_QUESTIONS.map((q): QuestionItem => ({
  ...q,
  max_points:   4,
  weight:       1.0,
  severity:     'MINOR',
  is_mandatory: true,
}));

const MOCK_RESPONSES = MOCK_QUESTIONS.map((q): ScoredResponse => ({
  session_item_id: q.id,
  question_id:     q.question_id,
  ai_answer:       'YES',
  evidence:        'compliant',
}));

// ── Performance Tests ─────────────────────────────────────────────────────────

describe('Rule Engine Performance', () => {
  it('evaluates 25 questions in under 5ms', () => {
    const cache = new ObservationCache(MOCK_OBSERVATIONS);
    const start = performance.now();

    applyAllRules(MOCK_QUESTIONS, cache, []);

    const duration = performance.now() - start;
    console.log(`[Rule Engine Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });
});

describe('Scoring Engine Performance', () => {
  it('scores 125 responses in under 2ms', () => {
    // Generate 125 responses (25 questions x 5 pillars = 125 items)
    const largeQuestions = Array.from({ length: 125 }, (_, i): QuestionItem => ({
      id:            `Q${i}`,
      question_id:   `Q${i}`,
      question_text: `Text ${i}`,
      category:      'General',
      pillar:        ['SORT', 'SET_IN_ORDER', 'SHINE', 'STANDARDIZE', 'SUSTAIN'][i % 5] as 'SORT' | 'SET_IN_ORDER' | 'SHINE' | 'STANDARDIZE' | 'SUSTAIN',
      max_points:    4,
      weight:        1.0,
      severity:      'MINOR',
      is_mandatory:  true,
    }));
    const largeResponses = largeQuestions.map((q, idx): ScoredResponse => ({
      session_item_id: q.id,
      question_id:     q.question_id,
      ai_answer:       idx % 2 === 0 ? 'YES' : 'PARTIAL',
      evidence:        'check',
    }));

    const start = performance.now();
    scoreSession(largeQuestions, largeResponses, []);
    const duration = performance.now() - start;

    console.log(`[Scoring Engine Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(2);
  });
});

describe('Consistency Validator Performance', () => {
  it('validates 25 responses against 10 rules in under 3ms', () => {
    const cache = new ObservationCache(MOCK_OBSERVATIONS);
    const responses = MOCK_QUESTION_ITEMS.map((q) => ({
      question_id:    q.question_id,
      ai_answer:      'YES' as const,
      confidence:     0.9,
      evidence:       'test',
      reasoning:      'test',
      answeredByRule: false,
    }));

    const start = performance.now();
    validateConsistency(responses, cache, MOCK_QUESTION_ITEMS);
    const duration = performance.now() - start;

    console.log(`[Consistency Validator Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(3);
  });
});

describe('Reliability Classifier Performance', () => {
  it('classifies in under 1ms', () => {
    const start = performance.now();

    classifyReliability({
      audit_confidence:          90,
      not_visible_pct:           12,
      high_consistency_warnings: 1,
    });

    const duration = performance.now() - start;
    console.log(`[Reliability Classifier Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(1);
  });
});

describe('ObservationCache Performance', () => {
  it('queries 100 observations by category in under 2ms', () => {
    const doubleObs = [...MOCK_OBSERVATIONS, ...MOCK_OBSERVATIONS];
    const cache = new ObservationCache(doubleObs);

    const start = performance.now();
    cache.getByCategory('Cleanliness');
    cache.getByCategory('Labels');
    const duration = performance.now() - start;

    console.log(`[ObservationCache Category Query Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(2);
  });

  it('getDetectedObjects() on 100 observations in under 1ms', () => {
    const doubleObs = [...MOCK_OBSERVATIONS, ...MOCK_OBSERVATIONS];
    const cache = new ObservationCache(doubleObs);

    const start = performance.now();
    cache.getDetectedObjects();
    const duration = performance.now() - start;

    console.log(`[ObservationCache Object Aggregation Performance] Duration: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(1);
  });
});
