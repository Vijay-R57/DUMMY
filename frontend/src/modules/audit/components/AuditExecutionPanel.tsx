/**
 * src/modules/audit/components/AuditExecutionPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displayed during the audit run (AUDIT_RUNNING state).
 * Shows pillar-by-pillar progress with per-question status transparency.
 * Question text comes from STANDARD_5S_QUESTIONS — no API call.
 * Ratings are populated from results.before.responses once AUDIT_COMPLETE.
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import type { AnalysisPipelineState, AuditAnalysisResult } from '@/types/analysis';
import { AUDIT_PILLARS, PILLAR_META } from '../constants/pillars';
import { STANDARD_5S_QUESTIONS } from '../utils/auditMapper';

type QuestionStatus = 'pending' | 'running' | 'completed';

interface QuestionProgress {
  id:      string;
  text:    string;
  status:  QuestionStatus;
  rating?: string;
}

interface PillarProgress {
  pillar:     (typeof AUDIT_PILLARS)[number];
  status:     'pending' | 'active' | 'completed';
  score?:     number;
  maximum?:   number;
  questions:  QuestionProgress[];
  expanded:   boolean;
}

const STAGE_TO_PILLAR: Partial<Record<string, (typeof AUDIT_PILLARS)[number]>> = {
  'analyzing-sort':         'SORT',
  'analyzing-set-in-order': 'SET_IN_ORDER',
  'analyzing-shine':        'SHINE',
  'analyzing-standardize':  'STANDARDIZE',
  'analyzing-sustain':      'SUSTAIN',
};

const PILLAR_STAGE_ORDER = [
  'analyzing-sort',
  'analyzing-set-in-order',
  'analyzing-shine',
  'analyzing-standardize',
  'analyzing-sustain',
];

function initialPillarProgress(): PillarProgress[] {
  return AUDIT_PILLARS.map((p) => ({
    pillar:    p,
    status:    'pending',
    questions: (STANDARD_5S_QUESTIONS[p] ?? []).map((q) => ({
      id:     q.id,
      text:   q.question,
      status: 'pending',
    })),
    expanded: false,
  }));
}

function answerToRating(answer: string): string {
  switch (answer) {
    case 'YES':            return 'Compliant';
    case 'PARTIAL':        return 'Partial';
    case 'NO':             return 'Non-Compliant';
    case 'NOT_VISIBLE':    return 'Not Visible';
    case 'NOT_APPLICABLE': return 'N/A';
    default:               return answer;
  }
}

interface Props {
  pipeline: AnalysisPipelineState;
  results?: AuditAnalysisResult | null;
}

export default function AuditExecutionPanel({ pipeline, results }: Props) {
  const [pillars, setPillars] = useState<PillarProgress[]>(initialPillarProgress);
  const qTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStageRef = useRef<string>('');

  const { stage, progress, message } = pipeline;

  // Track stage transitions
  useEffect(() => {
    const prevStage  = prevStageRef.current;
    const activePillar = STAGE_TO_PILLAR[stage];
    const prevPillar   = STAGE_TO_PILLAR[prevStage];

    if (stage === prevStage) return;
    prevStageRef.current = stage;

    // Clear any running question timer
    if (qTimerRef.current) { clearInterval(qTimerRef.current); qTimerRef.current = null; }

    setPillars((prev) => {
      const next = prev.map((p) => ({ ...p, questions: p.questions.map((q) => ({ ...q })) }));

      // Mark the previous active pillar as completed
      if (prevPillar) {
        const pp = next.find((p) => p.pillar === prevPillar);
        if (pp) {
          pp.status    = 'completed';
          pp.expanded  = false;
          pp.questions = pp.questions.map((q) => ({ ...q, status: 'completed' as QuestionStatus }));
        }
      }

      // Mark stages before the current one as completed
      const currentIdx = PILLAR_STAGE_ORDER.indexOf(stage);
      PILLAR_STAGE_ORDER.forEach((s, i) => {
        if (i < currentIdx) {
          const pKey = STAGE_TO_PILLAR[s];
          if (pKey) {
            const pp = next.find((p) => p.pillar === pKey);
            if (pp && pp.status !== 'completed') {
              pp.status    = 'completed';
              pp.questions = pp.questions.map((q) => ({ ...q, status: 'completed' as QuestionStatus }));
            }
          }
        }
      });

      // Activate the current pillar
      if (activePillar) {
        const ap = next.find((p) => p.pillar === activePillar);
        if (ap) {
          ap.status   = 'active';
          ap.expanded = true;
          ap.questions = ap.questions.map((q) => ({ ...q, status: 'pending' as QuestionStatus }));
        }
      }

      return next;
    });

    // Animate through questions of the active pillar
    if (activePillar) {
      let qIdx = 0;
      qTimerRef.current = setInterval(() => {
        setPillars((prev) => {
          const next = prev.map((p) => ({ ...p, questions: p.questions.map((q) => ({ ...q })) }));
          const ap   = next.find((p) => p.pillar === activePillar);
          if (!ap) return next;
          if (qIdx > 0 && qIdx - 1 < ap.questions.length) {
            ap.questions[qIdx - 1].status = 'completed';
          }
          if (qIdx < ap.questions.length) {
            ap.questions[qIdx].status = 'running';
            qIdx++;
          } else {
            if (qTimerRef.current) clearInterval(qTimerRef.current);
          }
          return next;
        });
      }, 1800);
    }

    return () => { if (qTimerRef.current) clearInterval(qTimerRef.current); };
  }, [stage]);

  // Populate ratings from results when audit completes
  useEffect(() => {
    if (!results) return;
    const responses = results.before.responses;
    const scores    = results.before.score.pillar_scores;
    setPillars((prev) =>
      prev.map((p) => {
        const pillarScore = scores.find((s) => s.pillar === p.pillar);
        return {
          ...p,
          status:  'completed',
          score:   pillarScore?.score,
          maximum: pillarScore?.maximum,
          questions: p.questions.map((q) => {
            const resp = responses.find((r) => r.question_id === q.id);
            return {
              ...q,
              status: 'completed' as QuestionStatus,
              rating: resp ? answerToRating(resp.ai_answer) : undefined,
            };
          }),
        };
      })
    );
  }, [results]);

  const toggleExpand = (pillar: (typeof AUDIT_PILLARS)[number]) => {
    setPillars((prev) =>
      prev.map((p) => (p.pillar === pillar ? { ...p, expanded: !p.expanded } : p))
    );
  };

  const isPostAudit = stage === 'scoring' || stage === 'recommendations' ||
                      stage === 'saving'   || stage === 'preparing-report' || stage === 'complete';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stage === 'complete'
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            : <Loader2      className="h-4 w-4 text-primary animate-spin" />
          }
          <span className="text-sm font-black text-foreground uppercase tracking-wide">
            5S Audit in Progress
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Pillar list */}
      <div className="divide-y divide-border/50">
        {pillars.map((p) => {
          const meta = PILLAR_META[p.pillar];
          return (
            <div key={p.pillar} className="px-5 py-3">
              {/* Pillar row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : p.status === 'active' ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <div>
                    <span className={`text-sm font-bold ${
                      p.status === 'active'    ? 'text-foreground' :
                      p.status === 'completed' ? 'text-muted-foreground' :
                      'text-muted-foreground/50'
                    }`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="ml-2 text-[10px] text-muted-foreground font-mono">({meta.jp})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {p.status === 'completed' && p.score !== undefined && (
                    <span className="text-xs font-bold text-emerald-500 font-mono">
                      {p.score}/{p.maximum}
                    </span>
                  )}
                  {p.status === 'active' && (
                    <span className="text-[10px] font-semibold text-primary animate-pulse">Auditing…</span>
                  )}
                  {(p.status === 'active' || p.status === 'completed') && (
                    <button
                      onClick={() => toggleExpand(p.pillar)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={p.expanded ? 'Collapse' : 'Expand'}
                    >
                      {p.expanded
                        ? <ChevronUp   className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Question details */}
              {p.expanded && (
                <div className="mt-3 ml-7 space-y-2 animate-fade-in">
                  {p.questions.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {q.status === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : q.status === 'running' ? (
                          <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        )}
                        <span className={`font-medium ${
                          q.status === 'running'   ? 'text-foreground' :
                          q.status === 'completed' ? 'text-muted-foreground' :
                          'text-muted-foreground/40'
                        }`}>
                          {q.text}
                        </span>
                      </div>
                      {q.rating && (
                        <span className={`font-bold ml-4 shrink-0 ${
                          q.rating === 'Compliant'     ? 'text-emerald-500' :
                          q.rating === 'Partial'        ? 'text-amber-500'   :
                          q.rating === 'Non-Compliant'  ? 'text-red-500'     :
                          'text-muted-foreground'
                        }`}>
                          {q.rating}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Post-pillar stages */}
      {isPostAudit && (
        <div className="px-5 py-3 border-t border-border bg-muted/10 space-y-1.5">
          {[
            { s: 'scoring',          label: 'Calculating Score…'           },
            { s: 'recommendations',  label: 'Generating Recommendations…'  },
            { s: 'saving',           label: 'Saving Audit Record…'         },
            { s: 'preparing-report', label: 'Preparing Audit Report…'      },
          ].map(({ s, label }) => {
            const STAGE_ORDER = ['scoring','recommendations','saving','preparing-report','complete'];
            const sIdx = STAGE_ORDER.indexOf(s);
            const cIdx = STAGE_ORDER.indexOf(stage);
            const done = cIdx > sIdx || stage === 'complete';
            const active = stage === s;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                {done   ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                : active ? <Loader2     className="h-3 w-3 text-primary animate-spin shrink-0" />
                :          <Circle      className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                }
                <span className={done ? 'text-muted-foreground' : active ? 'text-foreground font-semibold' : 'text-muted-foreground/40'}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom message */}
      {message && stage !== 'complete' && (
        <div className="px-5 py-3 border-t border-border bg-muted/5">
          <p className="text-[11px] text-muted-foreground italic">{message}</p>
        </div>
      )}
    </div>
  );
}
