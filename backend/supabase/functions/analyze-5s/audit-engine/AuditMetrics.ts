/**
 * supabase/functions/analyze-5s/audit-engine/AuditMetrics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight execution telemetry collector (Phase 4).
 *
 * Captures per-pillar Stage B runtime metrics for observability and prompt
 * quality monitoring. Stage A metrics (evidence generation) are tracked
 * directly in AuditEngine.generateEvidence().
 * Metrics are internal only — never surfaced to the audit UI.
 *
 * One AuditMetricsCollector instance is created per pillar run (Stage B)
 * inside AuditEngine.runPillar() and finalized into an AuditMetrics record.
 *
 * Design invariants:
 *  - Zero prompt content
 *  - Zero business logic
 *  - Zero pillar-specific logic
 */

import type { AuditMetrics } from './types.ts';

export class AuditMetricsCollector {
  private pillar:                string  = '';
  private responseTimeMs:        number  = 0;
  private modelUsed:             string  = '';
  private promptSections:        number  = 0;
  private promptLengthChars:     number  = 0;
  private tokensUsed:            number | null = null;
  private parseFailures:         number  = 0;
  private validationCorrections: number  = 0;
  private reflectionCorrections: number  = 0;
  private notVisibleCount:       number  = 0;
  private startedAt:             number  = 0;

  /**
   * Begin tracking a pillar run.
   * Must be called once before any other method.
   */
  public start(pillar: string): void {
    this.pillar    = pillar;
    this.startedAt = Date.now();
  }

  public recordResponseTime(ms: number): void {
    this.responseTimeMs = ms;
  }

  public recordModel(model: string): void {
    this.modelUsed = model;
  }

  public recordPromptStats(sections: number, chars: number): void {
    this.promptSections    = sections;
    this.promptLengthChars = chars;
  }

  public recordTokens(count: number | null): void {
    this.tokensUsed = count;
  }

  /** Call once per JSON.parse() failure before recovery. */
  public recordParseFailure(): void {
    this.parseFailures++;
  }

  /** Call once per question whose rating was normalized to NOT_VISIBLE by AuditValidator. */
  public recordValidationCorrection(): void {
    this.validationCorrections++;
  }

  /**
   * Call once per question where the reflection pass changed an answer.
   * Detected by comparing raw AI ratings vs final validated ratings.
   */
  public recordReflectionCorrection(): void {
    this.reflectionCorrections++;
  }

  public recordNotVisible(count: number): void {
    this.notVisibleCount = count;
  }

  /**
   * Seal the collector and return the completed AuditMetrics record.
   * Calling finalize() more than once is safe — it re-uses the same data.
   */
  public finalize(): AuditMetrics {
    return {
      pillar:                this.pillar,
      responseTimeMs:        this.responseTimeMs,
      modelUsed:             this.modelUsed,
      promptSections:        this.promptSections,
      promptLengthChars:     this.promptLengthChars,
      tokensUsed:            this.tokensUsed,
      parseFailures:         this.parseFailures,
      validationCorrections: this.validationCorrections,
      reflectionCorrections: this.reflectionCorrections,
      notVisibleCount:       this.notVisibleCount,
      recordedAt:            new Date().toISOString(),
    };
  }
}
