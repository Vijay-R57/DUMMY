import { describe, it, expect } from 'vitest';
import { getPillarConfigs } from '../../../backend/supabase/functions/analyze-5s/audit-engine/AuditDecisionMatrix';
import { getAllCalibrationConfigs } from '../../../backend/supabase/functions/analyze-5s/audit-engine/AuditCalibrationMatrix';
import type { PillarKey } from '../../../backend/supabase/functions/analyze-5s/audit-engine/types';

describe('Audit Question Registry Validation', () => {
  const PILLARS: PillarKey[] = ['SORT', 'SET_IN_ORDER', 'SHINE', 'STANDARDIZE', 'SUSTAIN'];

  it('should have exactly 20 registered questions in total', () => {
    let totalQuestions = 0;
    for (const p of PILLARS) {
      const configs = getPillarConfigs(p);
      totalQuestions += configs.length;
    }
    expect(totalQuestions).toBe(20);
  });

  it('should have exactly 4 questions registered per pillar', () => {
    for (const p of PILLARS) {
      const configs = getPillarConfigs(p);
      expect(configs.length, `Pillar ${p} must have exactly 4 questions`).toBe(4);
    }
  });

  it('should not have duplicate or missing question IDs', () => {
    const ids = new Set<string>();
    const expectedPrefixes: Record<PillarKey, string> = {
      SORT: 'SORT-',
      SET_IN_ORDER: 'SIO-',
      SHINE: 'SHN-',
      STANDARDIZE: 'STD-',
      SUSTAIN: 'SUS-',
    };

    for (const p of PILLARS) {
      const configs = getPillarConfigs(p);
      const prefix = expectedPrefixes[p];
      for (const q of configs) {
        expect(q.questionId).toBeTruthy();
        expect(q.questionId.startsWith(prefix), `Question ID ${q.questionId} must start with ${prefix}`).toBe(true);
        expect(ids.has(q.questionId), `Duplicate question ID detected: ${q.questionId}`).toBe(false);
        ids.add(q.questionId);
      }
    }
    expect(ids.size).toBe(20);
  });

  it('should ensure all 20 questions are present and mapped in the Calibration Matrix', () => {
    const calibConfigs = getAllCalibrationConfigs();
    expect(calibConfigs.length).toBe(20);

    const calibIds = new Set(calibConfigs.map((c) => c.questionId));
    expect(calibIds.size).toBe(20);

    for (const p of PILLARS) {
      const configs = getPillarConfigs(p);
      for (const q of configs) {
        expect(calibIds.has(q.questionId), `Question ID ${q.questionId} is missing from calibration config registry`).toBe(true);
      }
    }
  });
});
