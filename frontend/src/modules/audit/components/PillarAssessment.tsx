import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Eye, Info } from 'lucide-react';
import { PILLAR_META } from '../constants/pillars';
import type { AuditPillar } from '../constants/pillars';
import type { FutureAuditQuestion } from '../types';

interface Props {
  pillarKey: AuditPillar;
  label: string;
  jpName: string;
  score: number;
  maxScore: number;
  percentage: number;
  rating: string;
  questions: FutureAuditQuestion[];
}

export default function PillarAssessment({
  pillarKey,
  label,
  jpName,
  score,
  maxScore,
  percentage,
  rating,
  questions,
}: Props) {
  const meta = PILLAR_META[pillarKey] || PILLAR_META.SORT;
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  const toggleExpand = (qId: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const getRatingStyle = (rat: FutureAuditQuestion['rating']) => {
    switch (rat) {
      case 'Very Good':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      case 'Good':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30';
      case 'Average':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      case 'Bad':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30';
      case 'Very Bad':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const elementId = `pillar-detail-${pillarKey.toLowerCase().replace(/_/g, '-')}`;

  return (
    <div
      id={elementId}
      className="bg-card border border-border rounded-xl shadow-sm overflow-hidden scroll-mt-20 print:break-inside-avoid print:mb-8"
    >
      {/* 8. Live Score Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h3 className="text-base font-black tracking-tight text-foreground flex items-baseline gap-2">
              <span>{label.toUpperCase()}</span>
              <span className="text-xs text-muted-foreground uppercase">({jpName})</span>
            </h3>
          </div>
        </div>

        {/* Live Score Display */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${meta.bgColor} ${meta.color} border ${meta.borderColor}`}>
            {rating.toUpperCase()}
          </span>
          <div className="text-sm font-semibold flex items-baseline gap-1.5">
            <span className="text-lg font-black text-foreground">{score}</span>
            <span className="text-xs text-muted-foreground">/ {maxScore}</span>
            <span className="text-xs text-primary font-bold">({percentage}%)</span>
          </div>
        </div>
      </div>

      {/* Checklist items list */}
      <div className="divide-y divide-border/60">
        {questions.map((q) => {
          const isExpanded = !!expandedQuestions[q.id];

          return (
            <div
              key={q.id}
              id={`question-${q.id}`}
              className="scroll-mt-24 p-4 hover:bg-muted/5 transition-colors"
            >
              {/* Question Row layout: Question -> Rating -> Score -> Expand */}
              <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {q.question}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    ID: {q.id}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRatingStyle(q.rating)}`}>
                    {q.rating}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono font-bold text-foreground">
                      {q.score} <span className="text-muted-foreground font-normal">/ 4</span>
                    </div>

                    <button
                      onClick={() => toggleExpand(q.id)}
                      className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors no-print"
                      aria-label={isExpanded ? 'Collapse question detail' : 'Expand question detail'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Collapsible details section */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fade-in print:grid">
                  {/* Evidence Card */}
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider font-bold text-[9px]">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      <span>Evidence</span>
                    </div>
                    <p className="text-foreground leading-relaxed italic">
                      "{q.evidence}"
                    </p>
                  </div>

                  {/* Reason Card */}
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider font-bold text-[9px]">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span>Reason</span>
                    </div>
                    <p className="text-foreground leading-relaxed">
                      {q.reason}
                    </p>
                  </div>

                  {/* Supporting Observation Card */}
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider font-bold text-[9px]">
                      <Info className="h-3.5 w-3.5 text-blue-500" />
                      <span>Supporting Observation (Benchmark)</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {q.benchmark}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
