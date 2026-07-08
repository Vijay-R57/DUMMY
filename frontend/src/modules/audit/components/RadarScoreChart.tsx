import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { FuturePillar } from '../types';

interface Props {
  pillars: FuturePillar[];
}

export default function RadarScoreChart({ pillars }: Props) {
  // Map pillars for recharts format
  const data = pillars.map((p) => ({
    subject: p.label,
    score: p.score,
    percentage: p.percentage,
    fullMark: p.maxScore,
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        subject: string;
        score: number;
        percentage: number;
        fullMark: number;
      };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const node = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md text-xs font-semibold text-foreground space-y-1 font-sans">
          <p className="text-primary font-bold">{node.subject.toUpperCase()}</p>
          <p>Score: {node.score} / {node.fullMark}</p>
          <p className="text-muted-foreground">Compliance: {node.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col items-center justify-center print:break-inside-avoid print:shadow-none">
      <div className="w-full text-center mb-3">
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
          5S Pillar Compliance Mapping
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Standardized visual radar plot based on actual point assignment
        </p>
      </div>

      <div className="w-full h-80 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-border/40" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 16]}
              tick={{ fill: '#94a3b8', fontSize: 9 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Audit Score"
              dataKey="score"
              stroke="hsl(152, 45%, 28%)"
              fill="hsl(152, 45%, 28%)"
              fillOpacity={0.25}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
