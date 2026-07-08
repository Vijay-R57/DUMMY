/**
 * src/modules/audit/components/AuditChecklistForm.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Checklist form for manual audit scoring (Phase 1 mode).
 * In AI-assisted mode, displays AI answers + evidence inline with
 * the option for the auditor to override with a manual score.
 *
 * Supports both:
 *  • Phase 1: manual 0–4 score per item
 *  • Phase 2: AI-populated AuditAnswerState with evidence display
 */

import { useState, useCallback } from 'react';
import { Save, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Eye, Bot } from 'lucide-react';
import {
  AUDIT_PILLARS,
  PILLAR_META,
  SCORE_OPTIONS,
  SCORE_LABELS,
  ANSWER_STATE_META,
  SEVERITY_META,
} from '../constants/pillars';
import type { AuditPillar, AuditAnswerState } from '../constants/pillars';
import type { AuditSessionItem, AuditItemResponse, ResponseDraft } from '../types';
import { calculateCategoryScore } from '../services/auditScoreCalculator';

interface Props {
  items:          AuditSessionItem[];
  initialDraft?:  ResponseDraft;
  /** Existing AI-populated responses (Phase 2 mode) */
  aiResponses?:   AuditItemResponse[];
  onSave:         (draft: ResponseDraft, finalize: boolean) => Promise<void>;
  saving?:        boolean;
  readonly?:      boolean;
}

export default function AuditChecklistForm({
  items,
  initialDraft = {},
  aiResponses  = [],
  onSave,
  saving   = false,
  readonly = false,
}: Props) {
  const [draft, setDraft] = useState<ResponseDraft>(initialDraft);
  const [expandedPillars, setExpandedPillars] = useState<Set<AuditPillar>>(
    new Set(AUDIT_PILLARS),
  );

  const aiResponseMap = new Map(aiResponses.map((r) => [r.session_item_id, r]));
  const hasAiResponses = aiResponses.length > 0;

  const togglePillar = useCallback((pillar: AuditPillar) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(pillar)) {
        next.delete(pillar);
      } else {
        next.add(pillar);
      }
      return next;
    });
  }, []);

  const setScore = useCallback((itemId: string, score: number) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { score, notes: prev[itemId]?.notes ?? '' },
    }));
  }, []);

  const setNotes = useCallback((itemId: string, notes: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { score: prev[itemId]?.score ?? null, notes },
    }));
  }, []);

  const answeredCount = hasAiResponses
    ? aiResponses.length
    : Object.values(draft).filter((v) => v.score !== null).length;
  const totalCount = items.length;

  // Build fake responses for per-pillar score preview
  const draftResponses: AuditItemResponse[] = hasAiResponses
    ? aiResponses
    : Object.entries(draft)
        .filter(([, v]) => v.score !== null)
        .map(([session_item_id, v]) => ({
          id:               session_item_id,
          audit_session_id: '',
          session_item_id,
          manual_score:     v.score as number,
          ai_answer:        null,
          evidence:         null,
          ai_question_id:   null,
          confidence:       null,
          final_score:      v.score as number,
          reasoning:        null,
          observation:      null,
          reviewer_comment: null,
          notes:            v.notes || null,
          created_at:       '',
          updated_at:       '',
        }));

  const handleSubmit = (finalize: boolean) => onSave(draft, finalize);

  return (
    <div className="space-y-4">
      {/* AI mode banner */}
      {hasAiResponses && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
          <Bot className="h-5 w-5 text-purple-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-purple-400">AI Audit Completed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Responses below are AI-generated. Evidence is shown for each answer.
              You may override individual scores using the manual scoring controls.
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Progress</span>
          <span className="text-sm font-semibold text-primary">{answeredCount} / {totalCount}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Pillars */}
      {AUDIT_PILLARS.map((pillar) => {
        const meta       = PILLAR_META[pillar];
        const pillarItems = items.filter((i) => i.pillar === pillar);
        if (pillarItems.length === 0) return null;

        const isExpanded  = expandedPillars.has(pillar);
        const pillarScore = calculateCategoryScore(pillar, items, draftResponses);
        const answered    = hasAiResponses
          ? pillarItems.filter((i) => aiResponseMap.has(i.id)).length
          : pillarItems.filter((i) => draft[i.id]?.score !== null && draft[i.id]?.score !== undefined).length;

        return (
          <div key={pillar} className={`rounded-xl border ${meta.borderColor} bg-card overflow-hidden`}>
            {/* Pillar header */}
            <button
              type="button"
              onClick={() => togglePillar(pillar)}
              className={`w-full flex items-center justify-between px-5 py-4 ${meta.bgColor} transition-colors hover:brightness-110`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">({meta.jp})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {answered}/{pillarItems.length} answered
                    {pillarScore.max > 0 && (
                      <span className="ml-2 font-medium text-foreground">
                        · {pillarScore.total.toFixed(1)}/{pillarScore.max.toFixed(1)} pts ({pillarScore.percentage}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {answered === pillarItems.length && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                {isExpanded
                  ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                }
              </div>
            </button>

            {/* Items */}
            {isExpanded && (
              <div className="divide-y divide-border/50">
                {pillarItems.map((item, idx) => {
                  const aiResp       = aiResponseMap.get(item.id);
                  const currentScore = draft[item.id]?.score ?? null;
                  const currentNotes = draft[item.id]?.notes ?? '';
                  const hasScore     = currentScore !== null;
                  const sevMeta      = SEVERITY_META[item.severity];

                  return (
                    <div key={item.id} className="px-5 py-4 space-y-3">
                      {/* Question */}
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${meta.bgColor} ${meta.color}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium text-foreground leading-snug">
                              {item.question_text}
                              {item.is_mandatory && (
                                <span className="ml-1 text-red-400 text-xs">*</span>
                              )}
                            </p>
                            {/* Severity badge */}
                            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border ${sevMeta.borderColor} ${sevMeta.bgColor} ${sevMeta.color}`}>
                              {sevMeta.icon} {sevMeta.badge}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Max: {item.max_points} pts · Weight: {item.weight}× · ID: {item.question_id}
                          </p>
                        </div>
                        {hasScore && (
                          <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-1 ${meta.bgColor} ${meta.color}`}>
                            {currentScore}/{item.max_points}
                          </span>
                        )}
                      </div>

                      {/* AI Answer display (Phase 2) */}
                      {aiResp?.ai_answer && (
                        <AIAnswerCard response={aiResp} />
                      )}

                      {/* Manual score selector */}
                      {!readonly && (
                        <div className="ml-9 space-y-3">
                          {hasAiResponses && (
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              Override Score (optional)
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {SCORE_OPTIONS.map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setScore(item.id, score)}
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                                  currentScore === score
                                    ? `${meta.bgColor} ${meta.color} ${meta.borderColor} ring-1 ring-inset ${meta.borderColor}`
                                    : 'border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:text-foreground'
                                }`}
                              >
                                <span className="font-bold">{score}</span>
                              </button>
                            ))}
                          </div>
                          {currentScore !== null && (
                            <p className="text-[10px] text-muted-foreground italic">
                              {SCORE_LABELS[currentScore as keyof typeof SCORE_LABELS]}
                            </p>
                          )}

                          {/* Notes */}
                          <textarea
                            rows={1}
                            placeholder="Observation / notes (optional)"
                            value={currentNotes}
                            onChange={(e) => setNotes(item.id, e.target.value)}
                            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                          />
                        </div>
                      )}

                      {/* Read-only score display */}
                      {readonly && hasScore && (
                        <div className="ml-9">
                          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                            Score: {currentScore}/{item.max_points}
                          </div>
                          {currentNotes && (
                            <p className="mt-1 text-xs text-muted-foreground italic">{currentNotes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Save / Submit buttons */}
      {!readonly && !hasAiResponses && (
        <div className="sticky bottom-4 flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Progress'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving || answeredCount < totalCount}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Submitting…' : 'Complete Audit'}
          </button>
        </div>
      )}

      {!readonly && !hasAiResponses && answeredCount < totalCount && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
          <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
          <p className="text-xs text-orange-300">
            {totalCount - answeredCount} question{totalCount - answeredCount !== 1 ? 's' : ''} still need{totalCount - answeredCount === 1 ? 's' : ''} a score.
          </p>
        </div>
      )}
    </div>
  );
}

// ── AI Answer Card ─────────────────────────────────────────────────────────────

function AIAnswerCard({ response }: { response: AuditItemResponse }) {
  if (!response.ai_answer) return null;
  const meta = ANSWER_STATE_META[response.ai_answer as AuditAnswerState];
  if (!meta) return null;

  return (
    <div className={`ml-9 rounded-lg border ${meta.borderColor} ${meta.bgColor} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
        </div>
        {response.confidence !== null && (
          <span className="text-[10px] text-muted-foreground">
            Confidence: {Math.round((response.confidence ?? 0) * 100)}%
          </span>
        )}
      </div>
      {response.evidence && (
        <div className="flex items-start gap-1.5">
          <Eye className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed italic">
            "{response.evidence}"
          </p>
        </div>
      )}
    </div>
  );
}
