/**
 * supabase/functions/analyze-5s/audit-engine/audit-config/shine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SHINE pillar declarative configuration (Phase 3D — active).
 *
 * Question text taken verbatim from the ARCOLAB 5S industrial audit sheet.
 * Do not paraphrase or abbreviate — must match the physical checklist exactly.
 *
 * The AuditEngine requires zero changes to execute this pillar.
 * Engine invocation: engine.runPillar(SHINE_CONFIG, SHINE_PROMPT_TEMPLATE, image, context)
 */

import type { PillarConfig } from '../types.ts';

export const SHINE_CONFIG: PillarConfig = {
  pillar:         'SHINE',
  label:          'Shine',
  jpLabel:        'Seiso',
  displayOrder:   3,
  benchmarkScore: 4, // Very Good = 4 points per question; max pillar score = 16

  questions: [
    {
      questionId:   'SHN-01',
      displayOrder: 1,
      question:
        'Are cleaning tools and cleaning equipment available, accessible and suitable for the workplace?',
    },
    {
      questionId:   'SHN-02',
      displayOrder: 2,
      question:
        'Are machines, workstations, piping, cabinets and shelves cleaned according to the cleaning schedule? Has contamination, oil, dust or residue been identified and treated?',
    },
    {
      questionId:   'SHN-03',
      displayOrder: 3,
      question:
        'Are floors, walls, aisles, mezzanines and surrounding work areas visibly clean and free from dust, waste and contamination?',
    },
    {
      questionId:   'SHN-04',
      displayOrder: 4,
      question:
        'Does the workplace demonstrate routine cleanliness indicating that cleaning is an ongoing activity rather than a one-time effort?',
    },
  ],
};
