/**
 * src/modules/audit/types/sessionState.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single enum driving all wizard progression in Analysis.tsx.
 * All component visibility and stepper position derive from this state.
 * No freestanding boolean guards allowed.
 */

export const AuditSessionState = {
  /** Page load: employee + office shown, context not yet selected */
  SESSION_SETUP:   'SESSION_SETUP',
  /** Zone + workspace type selected, image uploader revealed */
  CONTEXT_READY:   'CONTEXT_READY',
  /** Workplace image uploaded, validation panel active */
  IMAGE_READY:     'IMAGE_READY',
  /** Validation panel has run — pass (or warn) enables Start button */
  IMAGE_VALIDATED: 'IMAGE_VALIDATED',
  /** Edge function in flight — execution panel visible */
  AUDIT_RUNNING:   'AUDIT_RUNNING',
  /** Results received from API */
  AUDIT_COMPLETE:  'AUDIT_COMPLETE',
  /** User has triggered print/export */
  REPORT_READY:    'REPORT_READY',
} as const;

export type AuditSessionState =
  (typeof AuditSessionState)[keyof typeof AuditSessionState];

/** Maps each session state to the 1-indexed stepper step (1–7) */
export const SESSION_STATE_TO_STEP: Record<AuditSessionState, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  SESSION_SETUP:   1,
  CONTEXT_READY:   2,
  IMAGE_READY:     3,
  IMAGE_VALIDATED: 4,
  AUDIT_RUNNING:   5,
  AUDIT_COMPLETE:  6,
  REPORT_READY:    7,
};

/** Returns true when the given state is at least as advanced as the target */
export function sessionStateAtLeast(
  current: AuditSessionState,
  target:  AuditSessionState,
): boolean {
  const ORDER: AuditSessionState[] = [
    'SESSION_SETUP',
    'CONTEXT_READY',
    'IMAGE_READY',
    'IMAGE_VALIDATED',
    'AUDIT_RUNNING',
    'AUDIT_COMPLETE',
    'REPORT_READY',
  ];
  return ORDER.indexOf(current) >= ORDER.indexOf(target);
}
