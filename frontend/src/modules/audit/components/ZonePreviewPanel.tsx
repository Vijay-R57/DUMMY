/**
 * src/modules/audit/components/ZonePreviewPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displayed after zone selection. Shows what the 5S audit will focus on
 * for the selected zone, derived from local ZONE_KNOWLEDGE — no API call.
 */

import { MapPin, AlertTriangle } from 'lucide-react';
import { ZONE_KNOWLEDGE } from '../constants/zoneKnowledge';

interface Props {
  zone: string;
}

export default function ZonePreviewPanel({ zone }: Props) {
  const profile = ZONE_KNOWLEDGE[zone];
  if (!profile) return null;

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none shrink-0 mt-0.5" role="img" aria-label={profile.label}>
          {profile.icon}
        </span>
        <div>
          <p className="text-sm font-black text-foreground">{profile.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {profile.auditFocus}
          </p>
        </div>
      </div>

      {/* Expected inspection items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Expected Inspection Items
          </p>
          <ul className="space-y-1.5">
            {profile.expectedItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Key concerns */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Key Audit Concerns
          </p>
          <ul className="space-y-1.5">
            {profile.keyConcerns.map((concern, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                {concern}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
