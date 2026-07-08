/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/modules/audit/components/AuditSessionCard.tsx
 * ─────────────────────────────────────────────────────────────
 * Card for a past audit session in the sessions list.
 */

import { Calendar, MapPin, User, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { calculateGrade } from '../services/auditScoreCalculator';
import type { AuditSession } from '../types';

interface Props {
  session: AuditSession;
  onClick: (session: AuditSession) => void;
}

const STATUS_CONFIG: Record<string, { label: string; colorClass: string; Icon: React.ComponentType<any> }> = {
  DRAFT:        { label: 'Draft',        colorClass: 'text-muted-foreground', Icon: Clock },
  IN_PROGRESS:  { label: 'In Progress',  colorClass: 'text-yellow-400',       Icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', colorClass: 'text-orange-400',       Icon: AlertCircle },
  COMPLETED:    { label: 'Completed',    colorClass: 'text-emerald-400',       Icon: CheckCircle2 },
  ARCHIVED:     { label: 'Archived',     colorClass: 'text-muted-foreground', Icon: CheckCircle2 },
};

export default function AuditSessionCard({ session, onClick }: Props) {
  const { grade, color: gradeColor } = calculateGrade(session.percentage);
  const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.DRAFT;
  const { Icon: StatusIcon } = statusCfg;

  return (
    <button
      type="button"
      onClick={() => onClick(session)}
      className="w-full text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-accent/20 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{session.audit_number}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusCfg.colorClass}`}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground leading-tight truncate">
            {session.template_name}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {session.area_name && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {session.area_name}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" /> {session.auditor_name}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> {session.audit_date}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`text-xl font-black ${gradeColor}`}>
              {session.percentage.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{grade}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
