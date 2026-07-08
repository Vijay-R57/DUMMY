/**
 * src/modules/audit/components/AuditProgressStepper.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3A: 7-step audit wizard stepper.
 * Step progression is driven by AuditSessionState via SESSION_STATE_TO_STEP.
 */

import React from 'react';
import { User, MapPin, Camera, ShieldCheck, ClipboardCheck, FileText, Download, ArrowRight } from 'lucide-react';

interface Props {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

const STEPS = [
  { num: 1 as const, label: 'Session Info',     Icon: User          },
  { num: 2 as const, label: 'Workplace Context', Icon: MapPin        },
  { num: 3 as const, label: 'Upload Image',      Icon: Camera        },
  { num: 4 as const, label: 'Validation',        Icon: ShieldCheck   },
  { num: 5 as const, label: '5S Audit',          Icon: ClipboardCheck },
  { num: 6 as const, label: 'Audit Report',      Icon: FileText      },
  { num: 7 as const, label: 'Export',            Icon: Download      },
];

export default function AuditProgressStepper({ currentStep }: Props) {
  return (
    <div className="w-full bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm mb-6 no-print">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-1 overflow-x-auto">
        {STEPS.map((step, idx) => {
          const { Icon } = step;
          const isActive    = currentStep === step.num;
          const isCompleted = currentStep > step.num;

          return (
            <React.Fragment key={step.num}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 scale-110'
                      : isCompleted
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      isActive ? 'text-primary' : isCompleted ? 'text-primary/60' : 'text-muted-foreground/40'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                      isActive
                        ? 'text-foreground font-bold'
                        : isCompleted
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/40'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <ArrowRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/25 mx-1 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
