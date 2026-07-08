/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/modules/audit/pages/AuditPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Main Audit Module page. Three views:
 *  1. Templates — browse and select a template to start
 *  2. Checklist — fill in scores for active session
 *  3. Summary  — view completed session results
 *  4. Sessions  — history of past sessions
 */

import { useState, useCallback } from 'react';
import { ClipboardList, Plus, List, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { useAuditTemplates } from '../hooks/useAuditTemplates';
import { useAuditSessions, useAuditSessionDetail, useCreateAuditSession, useSubmitAuditResponses } from '../hooks/useAuditSessions';
import { calculateOverallScore } from '../services/auditScoreCalculator';

import AuditTemplateCard from '../components/AuditTemplateCard';
import AuditChecklistForm from '../components/AuditChecklistForm';
import AuditSessionSummary from '../components/AuditSessionSummary';
import AuditSessionCard from '../components/AuditSessionCard';

import type { AuditTemplate, AuditSession, ResponseDraft } from '../types';

// ── View state machine ────────────────────────────────────────────────────────

type View =
  | { name: 'templates' }
  | { name: 'sessions' }
  | { name: 'new-session'; template: AuditTemplate }
  | { name: 'checklist'; sessionId: string }
  | { name: 'summary'; sessionId: string };

// ── Main Component ────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { employee } = useAuth();
  const [view, setView] = useState<View>({ name: 'templates' });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container-max px-4 sm:px-6 lg:px-8 py-8">
        <Header view={view} onBack={() => setView({ name: 'templates' })} />

        <div className="mt-6">
          {view.name === 'templates' && (
            <TemplatesView
              onStartSession={(template) => setView({ name: 'new-session', template })}
              onViewSessions={() => setView({ name: 'sessions' })}
            />
          )}
          {view.name === 'sessions' && (
            <SessionsView
              onBack={() => setView({ name: 'templates' })}
              onOpen={(s) => setView({ name: 'summary', sessionId: s.id })}
              onNewAudit={() => setView({ name: 'templates' })}
            />
          )}
          {view.name === 'new-session' && employee && (
            <NewSessionView
              template={view.template}
              employee={employee}
              onCreated={(sessionId) => setView({ name: 'checklist', sessionId })}
              onCancel={() => setView({ name: 'templates' })}
            />
          )}
          {view.name === 'checklist' && (
            <ChecklistView
              sessionId={view.sessionId}
              onCompleted={() => setView({ name: 'summary', sessionId: view.sessionId })}
              onSaved={() => setView({ name: 'summary', sessionId: view.sessionId })}
            />
          )}
          {view.name === 'summary' && (
            <SummaryView
              sessionId={view.sessionId}
              onBack={() => setView({ name: 'sessions' })}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ view, onBack }: { view: View; onBack: () => void }) {
  const titles: Record<string, string> = {
    'templates':   '5S Audit Module',
    'sessions':    'Audit History',
    'new-session': 'Start New Audit',
    'checklist':   'Audit Checklist',
    'summary':     'Audit Summary',
  };

  return (
    <div className="flex items-center gap-4">
      {view.name !== 'templates' && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          {titles[view.name]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Industrial Standard 5S Audit System
        </p>
      </div>
    </div>
  );
}

// ── Templates View ────────────────────────────────────────────────────────────

function TemplatesView({
  onStartSession,
  onViewSessions,
}: {
  onStartSession: (t: AuditTemplate) => void;
  onViewSessions: () => void;
}) {
  const { templates, loading, error, refetch } = useAuditTemplates();
  const [selected, setSelected] = useState<AuditTemplate | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');

  if (loading) return <CenteredLoader label="Loading templates…" />;
  if (error)   return <ErrorState message={error} onRetry={refetch} />;

  // Get unique industries from template data (including hierarchy)
  const industries = ['All', ...Array.from(new Set(templates.map((t) => t.industry).filter(Boolean)))];

  const filteredTemplates = templates.filter((t) => {
    if (selectedIndustry === 'All') return true;
    return t.industry === selectedIndustry;
  });

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Filter by industry and select a template to begin a new 5S audit.
          </p>
          {/* Industry hierarchy filter */}
          <div className="flex flex-wrap gap-2 mt-3">
            {industries.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => {
                  setSelectedIndustry(ind);
                  setSelected(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  selectedIndustry === ind
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onViewSessions}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors self-start sm:self-center"
        >
          <List className="h-4 w-4" />
          View History
        </button>
      </div>

      {/* Template grid */}
      {filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No templates available for this category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((t) => (
            <AuditTemplateCard
              key={t.id}
              template={t}
              selected={selected?.id === t.id}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {/* Start button */}
      {selected && (
        <div className="flex justify-end">
          <button
            onClick={() => onStartSession(selected)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Configure Session with "{selected.name}"
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Session Setup View ────────────────────────────────────────────────────

function NewSessionView({
  template,
  employee,
  onCreated,
  onCancel,
}: {
  template: AuditTemplate;
  employee: any;
  onCreated: (sessionId: string) => void;
  onCancel: () => void;
}) {
  const { createSession, creating } = useCreateAuditSession();
  const [form, setForm] = useState({
    area_name:              '',
    department_name:        template.department ?? employee.department ?? '',
    plant_name:             '',
    industry:               template.industry ?? 'Manufacturing',
    workspace_type:         template.workspace_type ?? 'Assembly Line',
    expected_equipment:     template.name.toLowerCase().includes('warehouse') 
                              ? 'Storage racks, pallet staging, forklifts, packaging tables'
                              : template.name.toLowerCase().includes('lab')
                              ? 'Fume hoods, chemicals, scales, microscope'
                              : 'Assembly workbenches, hand tools, parts bins',
    expected_safety_assets: template.name.toLowerCase().includes('lab')
                              ? 'Safety shower, eyewash station, chemical spill kit'
                              : 'Fire extinguishers, safety walkways, PPE guidelines',
    notes:                  '',
  });

  const handleCreate = async () => {
    const session = await createSession({
      template_id:            template.id,
      template_name:          template.name,
      template_version:       template.version,
      auditor_id:             employee.employeeId,
      auditor_name:           employee.name,
      area_name:              form.area_name || null,
      department_name:        form.department_name || null,
      plant_name:             form.plant_name || null,
      industry:               form.industry || null,
      workspace_type:         form.workspace_type || null,
      expected_equipment:     form.expected_equipment || null,
      expected_safety_assets: form.expected_safety_assets || null,
      notes:                  form.notes || undefined,
    });
    if (session) onCreated(session.id);
  };

  const field = (label: string, key: keyof typeof form, placeholder: string) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </div>
  );

  return (
    <div className="max-w-xl space-y-6">
      {/* Selected template */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Selected Template</p>
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <p className="text-xs text-muted-foreground">v{template.version}</p>
        </div>
        {template.industry && (
          <span className="text-[10px] bg-primary/10 border border-primary/20 rounded px-2.5 py-1 text-primary font-bold">
            {template.industry} &gt; {template.workspace_type}
          </span>
        )}
      </div>

      {/* Auditor info (readonly) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Auditor Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Auditor Name</label>
            <input readOnly value={employee.name} className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee ID</label>
            <input readOnly value={employee.employeeId} className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Workspace Context (Requirement #5 & #2) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Structured Workspace Context</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Supply workstation details to Vision AI to increase observation accuracy and consistency.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field('Industry Sector', 'industry', 'e.g. Manufacturing')}
          {field('Workspace Type', 'workspace_type', 'e.g. Assembly Line')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Area / Workstation', 'area_name', 'e.g. Assembly Line A')}
          {field('Department', 'department_name', 'e.g. Production')}
        </div>
        {field('Expected Equipment', 'expected_equipment', 'e.g. Benches, power tools, jigs')}
        {field('Expected Safety Equipment', 'expected_safety_assets', 'e.g. Eyewash, fire extinguisher')}
        {field('Plant / Facility Name', 'plant_name', 'e.g. Chennai Plant 1')}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes (optional)</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Any pre-audit observations…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? 'Creating…' : 'Begin Audit'}
        </button>
      </div>
    </div>
  );
}

// ── Checklist View ────────────────────────────────────────────────────────────

function ChecklistView({
  sessionId,
  onCompleted,
  onSaved,
}: {
  sessionId: string;
  onCompleted: () => void;
  onSaved: () => void;
}) {
  const { session, loading, error } = useAuditSessionDetail(sessionId);
  const { submitResponses, submitting } = useSubmitAuditResponses();

  const handleSave = useCallback(async (draft: ResponseDraft, finalize: boolean) => {
    if (!session) return;
    const responses = Object.entries(draft)
      .filter(([, v]) => v.score !== null)
      .map(([session_item_id, v]) => ({
        session_item_id,
        manual_score: v.score as number,
        notes: v.notes,
      }));

    const ok = await submitResponses({ audit_session_id: sessionId, responses }, finalize);
    if (ok) {
      if (finalize) onCompleted();
      else onSaved();
    }
  }, [session, sessionId, submitResponses, onCompleted, onSaved]);

  if (loading) return <CenteredLoader label="Loading checklist…" />;
  if (error || !session) return <ErrorState message={error ?? 'Session not found'} />;

  // Build initial draft from existing responses
  const initialDraft: ResponseDraft = {};
  session.responses.forEach((r) => {
    initialDraft[r.session_item_id] = {
      score: r.manual_score,
      notes: r.notes ?? '',
    };
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{session.audit_number}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{session.template_name}</p>
        <p className="text-xs text-muted-foreground">{session.area_name ?? 'No area'} · {session.audit_date}</p>
      </div>

      <AuditChecklistForm
        items={session.items}
        initialDraft={initialDraft}
        onSave={handleSave}
        saving={submitting}
      />
    </div>
  );
}

// ── Summary View ──────────────────────────────────────────────────────────────

function SummaryView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { session, loading, error, refetch } = useAuditSessionDetail(sessionId);

  if (loading) return <CenteredLoader label="Loading summary…" />;
  if (error || !session) return <ErrorState message={error ?? 'Session not found'} onRetry={() => refetch()} />;

  const summary = calculateOverallScore(session.items, session.responses);

  return (
    <div className="w-full">
      <AuditSessionSummary session={session} summary={summary} />
      <div className="mt-6 flex gap-3 no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <List className="h-4 w-4" />
          View All Sessions
        </button>
      </div>
    </div>
  );
}

// ── Sessions History View ─────────────────────────────────────────────────────

function SessionsView({
  onBack,
  onOpen,
  onNewAudit,
}: {
  onBack: () => void;
  onOpen: (s: AuditSession) => void;
  onNewAudit: () => void;
}) {
  const { sessions, loading, error, refetch } = useAuditSessions();

  if (loading) return <CenteredLoader label="Loading sessions…" />;
  if (error)   return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sessions.length} audit session{sessions.length !== 1 ? 's' : ''} found
        </p>
        <div className="flex gap-2">
          <button onClick={refetch} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={onNewAudit} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Audit
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No audit sessions yet.</p>
          <button onClick={onNewAudit} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Start First Audit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <AuditSessionCard key={s.id} session={s} onClick={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center max-w-md">
        <p className="text-sm font-medium text-red-400">Something went wrong</p>
        <p className="text-xs text-muted-foreground mt-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
