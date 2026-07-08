/**
 * src/modules/audit/components/AuditTemplateCard.tsx
 * ─────────────────────────────────────────────────────────────
 * Displays a single audit template with metadata and pillar breakdown.
 */

import { CheckCircle2, FileText, Shield } from 'lucide-react';
import { PILLAR_META_LIST } from '../constants/pillars';
import type { AuditTemplate } from '../types';

interface Props {
  template: AuditTemplate;
  selected?: boolean;
  onSelect?: (t: AuditTemplate) => void;
}

export default function AuditTemplateCard({ template, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(template)}
      className={`w-full text-left rounded-xl border p-5 transition-all duration-200 ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground leading-tight">
                {template.name}
              </h3>
              {template.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Shield className="h-3 w-3" /> Default
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">v{template.version}</p>
          </div>
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
      </div>

      {template.description && (
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {template.description}
        </p>
      )}

      {/* Pillar badges */}
      <div className="flex flex-wrap gap-1.5">
        {PILLAR_META_LIST.map((p) => (
          <span
            key={p.key}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border ${p.bgColor} ${p.color} ${p.borderColor}`}
          >
            {p.icon} {p.shortLabel}
          </span>
        ))}
      </div>
    </button>
  );
}
