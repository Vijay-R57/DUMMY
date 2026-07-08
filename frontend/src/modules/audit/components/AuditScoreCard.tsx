import React from 'react';
import { Star, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  score: number;
  maxScore: number;
  percentage: number;
  rating: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Poor';
}

export default function AuditScoreCard({ score, maxScore, percentage, rating }: Props) {
  // Map rating to color schemes (Industrial HSL tailored colors)
  const colorMap: Record<
    typeof rating,
    { text: string; bg: string; border: string; stars: number; desc: string }
  > = {
    Excellent: {
      text: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/5',
      border: 'border-emerald-500/30 dark:border-emerald-500/20',
      stars: 5,
      desc: 'Outstanding performance. Area exceeds industrial standard compliance.',
    },
    Good: {
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-500/5',
      border: 'border-blue-500/30 dark:border-blue-500/20',
      stars: 4,
      desc: 'Solid execution. Minor adjustments needed to reach benchmark levels.',
    },
    Average: {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-500/5',
      border: 'border-amber-500/30 dark:border-amber-500/20',
      stars: 3,
      desc: 'Acceptable but improvable. Moderate clutter or order violations detected.',
    },
    'Needs Improvement': {
      text: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/10 dark:bg-orange-500/5',
      border: 'border-orange-500/30 dark:border-orange-500/20',
      stars: 2,
      desc: 'Action required. Critical gaps in cleaning and standardization.',
    },
    Poor: {
      text: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10 dark:bg-red-500/5',
      border: 'border-red-500/30 dark:border-red-500/20',
      stars: 1,
      desc: 'Immediate remediation required. High safety and compliance risk.',
    },
  };

  const currentCfg = colorMap[rating] || colorMap.Good;

  // Star generation
  const starsArray = Array.from({ length: 5 }, (_, i) => i < currentCfg.stars);

  return (
    <div className="space-y-4">
      {/* 9. Overall Audit Status Banner */}
      <div
        className={`w-full rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 ${currentCfg.bg} ${currentCfg.border}`}
      >
        <div className="flex items-center gap-3">
          {rating === 'Excellent' || rating === 'Good' ? (
            <ShieldCheck className={`h-8 w-8 ${currentCfg.text}`} />
          ) : (
            <ShieldAlert className={`h-8 w-8 ${currentCfg.text}`} />
          )}
          <div className="text-center sm:text-left">
            <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
              Overall Audit Status
            </p>
            <h2 className={`text-2xl font-black ${currentCfg.text} tracking-tight mt-0.5`}>
              {rating.toUpperCase()}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {starsArray.map((filled, idx) => (
            <Star
              key={idx}
              className={`h-6 w-6 ${
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted/30 dark:text-muted/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Numerical score details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Score Ratio */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Total Points Assigned
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extrabold text-foreground">{score}</span>
            <span className="text-lg text-muted-foreground font-semibold">/ {maxScore}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Based on standard physical checklist scoring (0-4 points per item)
          </p>
        </div>

        {/* Percentage Card */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-1 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Compliance Percentage
          </p>
          <div className="text-4xl font-extrabold text-primary mt-1">
            {percentage.toFixed(1)}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {currentCfg.desc}
          </p>
        </div>
      </div>
    </div>
  );
}
