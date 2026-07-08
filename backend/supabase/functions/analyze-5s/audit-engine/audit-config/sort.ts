/**
 * supabase/functions/analyze-5s/audit-engine/audit-config/sort.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SORT pillar declarative configuration (Phase 3B — active).
 *
 * This is the ONLY SORT-specific file in the audit engine.
 * All engine logic (prompting, parsing, scoring, validation) is generic.
 *
 * Question text is taken verbatim from the ARCOLAB 5S industrial audit sheet.
 * Do not paraphrase or abbreviate question text — it must match the physical
 * audit checklist exactly for auditability and human review.
 */

import type { PillarConfig } from '../types.ts';

export const SORT_CONFIG: PillarConfig = {
  pillar:         'SORT',
  label:          'Sort',
  jpLabel:        'Seiri',
  displayOrder:   1,
  benchmarkScore: 4, // Very Good = 4 points per question; max pillar score = 16

  questions: [
    {
      questionId:   'SORT-01',
      displayOrder: 1,
      question:
        'Is the workplace cluttered with unnecessary raw materials, drums, inventory, laboratory items, documents or finished products?',
    },
    {
      questionId:   'SORT-02',
      displayOrder: 2,
      question:
        'Are unnecessary trays, tools, moulds, accessories or unused materials present?',
    },
    {
      questionId:   'SORT-03',
      displayOrder: 3,
      question:
        'Are unused machines or unnecessary equipment occupying valuable workspace?',
    },
    {
      questionId:   'SORT-04',
      displayOrder: 4,
      question:
        'Are obsolete instructions, documents or visual displays still present?',
    },
  ],
};
