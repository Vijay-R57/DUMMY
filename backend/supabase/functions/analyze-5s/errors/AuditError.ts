/**
 * supabase/functions/analyze-5s/errors/AuditError.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured Audit Error Classes (Phase 2A.3).
 *
 * Implements strict structured error categorization allowing clear differentiation
 * between critical errors (which abort execution) and non-critical stage errors
 * (which are logged, recovered from, and recorded in the audit trace).
 */

export enum AuditErrorCode {
  IMAGE_QUALITY_FAILED    = 'IMAGE_QUALITY_FAILED',
  TEMPLATE_NOT_FOUND      = 'TEMPLATE_NOT_FOUND',
  OBSERVATION_FAILED      = 'OBSERVATION_FAILED',    // CRITICAL
  MAPPING_FAILED          = 'MAPPING_FAILED',        // CRITICAL
  RECOMMENDATION_FAILED   = 'RECOMMENDATION_FAILED',  // NON-CRITICAL
  CONSISTENCY_FAILED      = 'CONSISTENCY_FAILED',    // NON-CRITICAL
  PERSISTENCE_FAILED      = 'PERSISTENCE_FAILED',    // NON-CRITICAL
  ENRICHMENT_FAILED       = 'ENRICHMENT_FAILED',     // NON-CRITICAL
  UNKNOWN                 = 'UNKNOWN',
}

export class AuditError extends Error {
  constructor(
    public code:        AuditErrorCode,
    public stage:       string,
    public recoverable: boolean,
    message:            string,
    public details?:    unknown,
  ) {
    super(message);
    this.name = 'AuditError';
  }

  public toJSON() {
    return {
      error:       this.message,
      code:        this.code,
      stage:       this.stage,
      recoverable: this.recoverable,
      details:     this.details,
    };
  }
}
