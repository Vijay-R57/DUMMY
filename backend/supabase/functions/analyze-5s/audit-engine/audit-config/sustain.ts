/**
 * supabase/functions/analyze-5s/audit-engine/audit-config/sustain.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SUSTAIN pillar declarative configuration (Phase 4 — active).
 *
 * Four questions evaluating visible indicators of sustained 5S activity.
 * SUS-01 and SUS-04 are Type 2 (Visual + Context).
 * SUS-02 and SUS-03 are Type 1 (Direct Visual — presence of physical boards).
 *
 * Question text taken from the ARCOLAB 5S industrial audit sheet (Phase 4).
 */

import type { PillarConfig } from '../types.ts';

export const SUSTAIN_CONFIG: PillarConfig = {
  pillar:         'SUSTAIN',
  label:          'Sustain',
  jpLabel:        'Shitsuke',
  displayOrder:   5,
  benchmarkScore: 4,

  questions: [
    {
      questionId:   'SUS-01',
      displayOrder: 1,
      question:
        'Is there visible evidence that workplace organisation and cleanliness are consistently maintained?',
    },
    {
      questionId:   'SUS-02',
      displayOrder: 2,
      question:
        'Are 5S audit boards, improvement boards or audit score displays visibly maintained?',
    },
    {
      questionId:   'SUS-03',
      displayOrder: 3,
      question:
        'Is there visible evidence of continuous improvement activities such as Kaizen boards, improvement tracking or action boards?',
    },
    {
      questionId:   'SUS-04',
      displayOrder: 4,
      question:
        'Does the workplace demonstrate visual ownership through maintained standards, housekeeping and consistent visual management?',
    },
  ],
};
