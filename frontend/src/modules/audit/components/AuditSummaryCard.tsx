import { Award, AlertTriangle, TrendingUp, Sparkles, Compass, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { FutureAuditSummary } from '../types';

interface Props {
  summary: FutureAuditSummary;
}

export default function AuditSummaryCard({ summary }: Props) {
  const overallRating = summary.overallRating || 'Good';
  
  // Rating to color helpers
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'text-emerald-500';
      case 'Good':      return 'text-blue-500';
      case 'Average':   return 'text-amber-500';
      case 'Needs Improvement': return 'text-orange-500';
      case 'Poor':      return 'text-red-500';
      default:          return 'text-primary';
    }
  };

  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'Good':      return 'bg-blue-500/10 border-blue-500/20';
      case 'Average':   return 'bg-amber-500/10 border-amber-500/20';
      case 'Needs Improvement': return 'bg-orange-500/10 border-orange-500/20';
      case 'Poor':      return 'bg-red-500/10 border-red-500/20';
      default:          return 'bg-primary/10 border-primary/20';
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden print:break-inside-avoid print:shadow-none">
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          Audit Executive Summary
        </h3>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${getRatingBg(overallRating)} ${getRatingColor(overallRating)}`}>
          {overallRating.toUpperCase()}
        </span>
      </div>

      <div className="p-5 space-y-6">
        {/* Core Metrics Grid - 9-field display */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* 1. Overall Score */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Overall Score
            </p>
            <p className="text-xl font-extrabold text-foreground mt-1">
              {summary.overallScore} <span className="text-xs text-muted-foreground font-normal">/ {summary.overallMaxScore}</span>
            </p>
          </div>

          {/* 2. Compliance Percentage */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Compliance Percentage
            </p>
            <p className={`text-xl font-extrabold mt-1 ${getRatingColor(overallRating)}`}>
              {summary.overallPercentage}%
            </p>
          </div>

          {/* 3. Highest Pillar */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Highest Pillar
            </p>
            <p className="text-sm font-extrabold text-primary mt-1.5 truncate">
              {summary.highestPillar}
            </p>
          </div>

          {/* 4. Lowest Pillar */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Lowest Pillar
            </p>
            <p className="text-sm font-extrabold text-destructive mt-1.5 truncate">
              {summary.lowestPillar}
            </p>
          </div>

          {/* 5. Critical Findings */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Critical Findings
            </p>
            <p className={`text-xl font-extrabold mt-1 ${summary.criticalFindings > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {summary.criticalFindings}
            </p>
          </div>

          {/* 6. Recommendations Count */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Corrective Actions
            </p>
            <p className="text-xl font-extrabold text-foreground mt-1">
              {summary.totalRecommendations}
            </p>
          </div>

          {/* 7. Potential Score Improvement */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Potential Gain
            </p>
            <p className="text-sm font-extrabold text-emerald-500 mt-1.5 flex items-center justify-center gap-0.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              +{summary.potentialImprovement} Points
            </p>
          </div>

          {/* 8. Image Quality Score */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Image Quality Score
            </p>
            <p className="text-sm font-extrabold text-foreground mt-1.5">
              {summary.imageQualityScore !== null ? (
                <span>
                  {summary.imageQualityScore}/100 <span className="text-[9px] text-muted-foreground font-normal">({summary.imageQualityLevel})</span>
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">N/A</span>
              )}
            </p>
          </div>

          {/* 9. Audit Confidence */}
          <div className="bg-muted/10 border border-border/50 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Audit Confidence
            </p>
            <p className="text-xl font-extrabold text-foreground mt-1">
              {summary.auditConfidence !== null ? `${summary.auditConfidence}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Strengths and Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Strengths */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-border/30 pb-2">
              <Award className="h-4 w-4" />
              Overall Strengths
            </h4>
            <ul className="space-y-2">
              {summary.strengths.map((str, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-start gap-2 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5 border-b border-border/30 pb-2">
              <AlertTriangle className="h-4 w-4" />
              Areas of Concern
            </h4>
            <ul className="space-y-2">
              {summary.weaknesses.map((weak, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-start gap-2 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <span>{weak}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
