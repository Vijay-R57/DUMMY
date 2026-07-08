/**
 * src/modules/audit/components/AuditTimeline.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the 5-point audit timeline in the report footer.
 * Calculates and shows total audit duration.
 */

import { Camera, ShieldCheck, Play, Flag, FileText, Clock } from 'lucide-react';
import type { AuditTimeline as AuditTimelineType } from '@/types/analysis';

interface Props {
  timeline: AuditTimelineType;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function calcDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return null;
  const totalSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec`;
}

const TIMELINE_EVENTS = [
  { key: 'imageUploaded',      label: 'Image Uploaded',       Icon: Camera      },
  { key: 'validationComplete', label: 'Validation Complete',  Icon: ShieldCheck },
  { key: 'auditStarted',       label: 'Audit Started',        Icon: Play        },
  { key: 'auditCompleted',     label: 'Audit Completed',      Icon: Flag        },
  { key: 'reportGenerated',    label: 'Report Generated',     Icon: FileText    },
] as const;

export default function AuditTimeline({ timeline }: Props) {
  const duration = calcDuration(timeline.auditStarted, timeline.auditCompleted);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm print:break-inside-avoid">
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Audit Timeline
        </h4>
        {duration && (
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded border border-border">
            Audit Duration: {duration}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="space-y-0">
          {TIMELINE_EVENTS.map(({ key, label, Icon }, idx) => {
            const ts = timeline[key as keyof AuditTimelineType];
            const isLast = idx === TIMELINE_EVENTS.length - 1;
            return (
              <div key={key} className="flex items-start gap-4">
                {/* Icon + connector line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
                    ts
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground/40'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {!isLast && (
                    <div className={`w-px flex-1 my-1 ${ts ? 'bg-primary/30' : 'bg-border/50'}`}
                         style={{ minHeight: '20px' }}
                    />
                  )}
                </div>

                {/* Label + timestamp */}
                <div className={`pb-4 ${isLast ? '' : ''}`}>
                  <p className={`text-xs font-bold ${ts ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {label}
                  </p>
                  <p className={`text-xs font-mono mt-0.5 ${ts ? 'text-muted-foreground' : 'text-muted-foreground/30'}`}>
                    {formatTimestamp(ts)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
