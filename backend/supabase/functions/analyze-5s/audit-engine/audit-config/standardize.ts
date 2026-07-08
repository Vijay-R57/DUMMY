/**
 * supabase/functions/analyze-5s/audit-engine/audit-config/standardize.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * STANDARDIZE pillar declarative configuration (Phase 4 — active).
 *
 * Four questions — all Type 1 (Direct Visual). All evaluate the visible
 * presence of standardized visual management systems in the workplace.
 *
 * Question text taken from the ARCOLAB 5S industrial audit sheet (Phase 4).
 */

import type { PillarConfig } from '../types.ts';

export const STANDARDIZE_CONFIG: PillarConfig = {
  pillar:         'STANDARDIZE',
  label:          'Standardize',
  jpLabel:        'Seiketsu',
  displayOrder:   4,
  benchmarkScore: 4,

  questions: [
    {
      questionId:   'STD-01',
      displayOrder: 1,
      question:
        'Are standard visual identification systems (labels, colour coding, equipment identification and area markings) consistently implemented throughout the workplace?',
    },
    {
      questionId:   'STD-02',
      displayOrder: 2,
      question:
        'Are work instructions, SOPs or visual operating standards displayed at the point of use where applicable?',
    },
    {
      questionId:   'STD-03',
      displayOrder: 3,
      question:
        'Are storage locations, equipment positions and designated areas standardized using visual controls?',
    },
    {
      questionId:   'STD-04',
      displayOrder: 4,
      question:
        'Are cleaning, inspection or maintenance standards visibly displayed within the workplace?',
    },
  ],
};
