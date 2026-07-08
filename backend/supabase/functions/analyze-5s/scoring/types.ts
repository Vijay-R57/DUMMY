/**
 * supabase/functions/analyze-5s/scoring/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared types for the deterministic ScoringService.
 * Confidence is intentionally ABSENT from ScoredResponse to prevent
 * accidental use in score calculations (Refinement #3).
 */

export type AuditAnswerState =
  | 'YES'
  | 'NO'
  | 'PARTIAL'
  | 'NOT_VISIBLE'
  | 'NOT_APPLICABLE';

export type AuditPillar =
  | 'SORT'
  | 'SET_IN_ORDER'
  | 'SHINE'
  | 'STANDARDIZE'
  | 'SUSTAIN';

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';

// ── Input types (from DB) ─────────────────────────────────────────────────────

export interface QuestionItem {
  id: string;             // audit_session_items.id
  question_id: string;    // e.g. 'SORT_001'
  question_text: string;
  category?: string;      // Phase 2A — observation category (optional for backwards compat)
  pillar: AuditPillar;
  max_points: number;
  weight: number;
  severity: Severity;
  is_mandatory: boolean;
}

/**
 * ScoredResponse — confidence stripped to make scoring violation impossible.
 * The AI's confidence value is stored separately in the DB as metadata.
 */
export interface ScoredResponse {
  session_item_id: string;
  question_id: string;
  ai_answer: AuditAnswerState;
  evidence: string;
}

export interface CriticalRule {
  id: string;
  checklist_item_id: string;
  pillar: AuditPillar;
  trigger_answer: AuditAnswerState;
  score_cap: number;  // 0–100 percentage cap
  description: string;
}

// ── Output types (returned to frontend + stored in DB) ────────────────────────

export interface DeductionDetail {
  question_id: string;
  question_text: string;
  severity: Severity;
  evidence: string;
  points_lost: number;
}

export interface PillarScoreResult {
  pillar: AuditPillar;
  score: number;          // weighted points earned
  maximum: number;        // weighted points possible (excl. NOT_VISIBLE / NOT_APPLICABLE)
  percentage: number;     // score/maximum * 100, capped if rule triggered
  raw_percentage: number; // score/maximum * 100, before cap
  passed: number;         // count of YES answers
  partial: number;        // count of PARTIAL answers
  failed: number;         // count of NO answers
  not_visible: number;    // count of NOT_VISIBLE answers
  not_applicable: number; // count of NOT_APPLICABLE answers
  critical: number;       // count of CRITICAL severity failures (NO/PARTIAL on CRITICAL items)
  cap_applied: boolean;   // true if a critical rule capped the score
  cap_value?: number;     // the cap percentage that was applied
  cap_reason?: string;    // description of the rule that triggered
  top_deductions: DeductionDetail[];
}

export interface SessionScoreResult {
  pillar_scores: PillarScoreResult[];
  overall_score: number;    // sum of pillar weighted scores
  overall_maximum: number;  // sum of pillar maximums
  overall_percentage: number;
  grade: string;
  grade_color: string;      // Tailwind CSS class
  total_answered: number;
  total_questions: number;
  critical_failures: number;
  computed_at: string;      // ISO timestamp
}
