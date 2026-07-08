import { PILLAR_META } from '../constants/pillars';
import type { AuditPillar } from '../constants/pillars';

interface Props {
  pillarKey: AuditPillar;
  label: string;
  jpName: string;
  score: number;
  maxScore: number;
  percentage: number;
  rating: string;
}

export default function PillarCard({
  pillarKey,
  label,
  jpName,
  score,
  maxScore,
  percentage,
  rating,
}: Props) {
  const meta = PILLAR_META[pillarKey] || PILLAR_META.SORT;

  // Custom colors for rating chips inside the card
  const getRatingStyle = (rat: string) => {
    const norm = rat.toLowerCase();
    if (norm.includes('very good') || norm.includes('excellent')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
    if (norm.includes('good')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    }
    if (norm.includes('average')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    }
    return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
  };

  const handleScrollToDetail = () => {
    const elementId = `pillar-detail-${pillarKey.toLowerCase().replace(/_/g, '-')}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <button
      onClick={handleScrollToDetail}
      className="w-full text-left bg-card hover:bg-muted/30 border border-border hover:border-primary/40 rounded-xl p-4 transition-all duration-300 shadow-sm flex flex-col justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 no-print"
    >
      <div className="w-full space-y-3">
        {/* Title and Icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform duration-300">{meta.icon}</span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                {label}
              </h4>
              <p className="text-[10px] text-muted-foreground uppercase">
                {jpName}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRatingStyle(rating)}`}>
            {rating.toUpperCase()}
          </span>
        </div>

        {/* Score Ratio */}
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-xs text-muted-foreground font-medium">Points</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-extrabold text-foreground">{score}</span>
            <span className="text-xs text-muted-foreground">/ {maxScore}</span>
          </div>
        </div>

        {/* Progress Bar (Visual status indicator) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span className="font-semibold">{percentage}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${meta.color.replace('text-', 'bg-')}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
