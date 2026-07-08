/**
 * supabase/functions/analyze-5s/audit-engine/audit-config/setInOrder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SET IN ORDER pillar declarative configuration (Phase 3C — active).
 *
 * Question text taken verbatim from the ARCOLAB 5S industrial audit sheet.
 * Do not paraphrase or abbreviate — must match the physical checklist exactly.
 *
 * The AuditEngine requires zero changes to execute this pillar.
 * Engine invocation: engine.runPillar(SET_IN_ORDER_CONFIG, SET_IN_ORDER_PROMPT_TEMPLATE, image, context)
 */

import type { PillarConfig } from '../types.ts';

export const SET_IN_ORDER_CONFIG: PillarConfig = {
  pillar:         'SET_IN_ORDER',
  label:          'Set in Order',
  jpLabel:        'Seiton',
  displayOrder:   2,
  benchmarkScore: 4, // Very Good = 4 points per question; max pillar score = 16

  questions: [
    {
      questionId:   'SIO-01',
      displayOrder: 1,
      question:
        'Are production units, workshops, machines, piping, production lines and processes clearly identified and visually displayed?',
    },
    {
      questionId:   'SIO-02',
      displayOrder: 2,
      question:
        'Are accessories, jigs and tools arranged and ordered rationally so that they can be easily taken and returned depending on frequency of use?',
    },
    {
      questionId:   'SIO-03',
      displayOrder: 3,
      question:
        'Are floor areas, aisles, walkways, storage locations and shelves clearly identified with markings and labels?',
    },
    {
      questionId:   'SIO-04',
      displayOrder: 4,
      question:
        'Are all documents essential to the activity well arranged, properly identified and easily accessible?',
    },
  ],
};
