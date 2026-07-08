/**
 * src/modules/audit/constants/pillars.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for 5S pillar constants, answer state metadata,
 * and severity display configuration.
 */

// ── Pillars ───────────────────────────────────────────────────────────────────

export const AUDIT_PILLARS = [
  'SORT',
  'SET_IN_ORDER',
  'SHINE',
  'STANDARDIZE',
  'SUSTAIN',
] as const;

export type AuditPillar = (typeof AUDIT_PILLARS)[number];

export interface PillarMeta {
  key:         AuditPillar;
  label:       string;
  jp:          string;
  shortLabel:  string;
  color:       string;
  bgColor:     string;
  borderColor: string;
  icon:        string;
  description: string;
}

export const PILLAR_META: Record<AuditPillar, PillarMeta> = {
  SORT: {
    key:         'SORT',
    label:       'Sort',
    jp:          'Seiri',
    shortLabel:  'S1',
    color:       'text-red-400',
    bgColor:     'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon:        '🗂️',
    description: 'Remove unnecessary items from the workspace',
  },
  SET_IN_ORDER: {
    key:         'SET_IN_ORDER',
    label:       'Set in Order',
    jp:          'Seiton',
    shortLabel:  'S2',
    color:       'text-orange-400',
    bgColor:     'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon:        '📐',
    description: 'Organise all remaining items systematically',
  },
  SHINE: {
    key:         'SHINE',
    label:       'Shine',
    jp:          'Seiso',
    shortLabel:  'S3',
    color:       'text-yellow-400',
    bgColor:     'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon:        '✨',
    description: 'Clean and maintain the workspace',
  },
  STANDARDIZE: {
    key:         'STANDARDIZE',
    label:       'Standardize',
    jp:          'Seiketsu',
    shortLabel:  'S4',
    color:       'text-green-400',
    bgColor:     'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon:        '📋',
    description: 'Create and enforce workplace standards',
  },
  SUSTAIN: {
    key:         'SUSTAIN',
    label:       'Sustain',
    jp:          'Shitsuke',
    shortLabel:  'S5',
    color:       'text-blue-400',
    bgColor:     'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon:        '🔄',
    description: 'Maintain discipline and continuous improvement',
  },
};

export const PILLAR_META_LIST: PillarMeta[] = AUDIT_PILLARS.map((p) => PILLAR_META[p]);

// ── Score options (Phase 1 manual scoring) ────────────────────────────────────

/** Allowed score values per checklist item (industrial 5S standard 0–4) */
export const SCORE_OPTIONS = [0, 1, 2, 3, 4] as const;
export type ScoreOption = (typeof SCORE_OPTIONS)[number];

export const SCORE_LABELS: Record<ScoreOption, string> = {
  0: '0 – Not Implemented',
  1: '1 – Initial / Reactive',
  2: '2 – Partial',
  3: '3 – Mostly Compliant',
  4: '4 – Fully Compliant',
};

// ── Audit session status lifecycle ────────────────────────────────────────────

export const AUDIT_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'COMPLETED',
  'ARCHIVED',
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

// ── Answer States (Refinement #1) ─────────────────────────────────────────────

export const AUDIT_ANSWER_STATES = [
  'YES',
  'NO',
  'PARTIAL',
  'NOT_VISIBLE',
  'NOT_APPLICABLE',
] as const;

export type AuditAnswerState = (typeof AUDIT_ANSWER_STATES)[number];

export interface AnswerStateMeta {
  value:       AuditAnswerState;
  label:       string;
  shortLabel:  string;
  color:       string;
  bgColor:     string;
  borderColor: string;
  icon:        string;
  /** If true, this answer state is excluded from score denominator */
  excluded:    boolean;
  /** Points multiplier: 1 = full, 0.5 = partial, 0 = none */
  multiplier:  number;
}

export const ANSWER_STATE_META: Record<AuditAnswerState, AnswerStateMeta> = {
  YES: {
    value:       'YES',
    label:       'Yes — Compliant',
    shortLabel:  'Yes',
    color:       'text-emerald-400',
    bgColor:     'bg-emerald-500/10',
    borderColor: 'border-emerald-500/40',
    icon:        '✅',
    excluded:    false,
    multiplier:  1,
  },
  PARTIAL: {
    value:       'PARTIAL',
    label:       'Partial — Partially Compliant',
    shortLabel:  'Partial',
    color:       'text-yellow-400',
    bgColor:     'bg-yellow-500/10',
    borderColor: 'border-yellow-500/40',
    icon:        '⚠️',
    excluded:    false,
    multiplier:  0.5,
  },
  NO: {
    value:       'NO',
    label:       'No — Non-Compliant',
    shortLabel:  'No',
    color:       'text-red-400',
    bgColor:     'bg-red-500/10',
    borderColor: 'border-red-500/40',
    icon:        '❌',
    excluded:    false,
    multiplier:  0,
  },
  NOT_VISIBLE: {
    value:       'NOT_VISIBLE',
    label:       'Not Visible — Outside Camera Frame',
    shortLabel:  'N/V',
    color:       'text-slate-400',
    bgColor:     'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    icon:        '👁️‍🗨️',
    excluded:    true,
    multiplier:  0,
  },
  NOT_APPLICABLE: {
    value:       'NOT_APPLICABLE',
    label:       'N/A — Not Applicable to This Area',
    shortLabel:  'N/A',
    color:       'text-muted-foreground',
    bgColor:     'bg-muted/20',
    borderColor: 'border-border/40',
    icon:        '—',
    excluded:    true,
    multiplier:  0,
  },
};

// ── Severity (Refinement #4) ──────────────────────────────────────────────────

export const SEVERITY_LEVELS = ['CRITICAL', 'MAJOR', 'MINOR'] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export interface SeverityMeta {
  value:       Severity;
  label:       string;
  color:       string;
  bgColor:     string;
  borderColor: string;
  icon:        string;
  badge:       string;   // short pill text
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  CRITICAL: {
    value:       'CRITICAL',
    label:       'Critical',
    color:       'text-red-400',
    bgColor:     'bg-red-500/10',
    borderColor: 'border-red-500/40',
    icon:        '🚨',
    badge:       'CRITICAL',
  },
  MAJOR: {
    value:       'MAJOR',
    label:       'Major',
    color:       'text-orange-400',
    bgColor:     'bg-orange-500/10',
    borderColor: 'border-orange-500/40',
    icon:        '⚠️',
    badge:       'MAJOR',
  },
  MINOR: {
    value:       'MINOR',
    label:       'Minor',
    color:       'text-yellow-400',
    bgColor:     'bg-yellow-500/10',
    borderColor: 'border-yellow-500/40',
    icon:        '💡',
    badge:       'MINOR',
  },
};
