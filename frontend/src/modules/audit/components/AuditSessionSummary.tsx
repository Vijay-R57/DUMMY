/**
 * src/modules/audit/components/AuditSessionSummary.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Redesigned past session audit report dashboard (Phase 3A Redesign).
 * Provides the same layout, workflow, and aesthetic styling as AnalysisResults.tsx.
 */

import React, { useState } from 'react';
import { Download, ShieldCheck, Printer, Terminal, Eye, Sparkles, ArrowLeft } from 'lucide-react';
import { mapSessionToAuditResult } from '../utils/auditMapper';
import type { AuditPillar } from '../constants/pillars';
import AuditProgressStepper from './AuditProgressStepper';
import AuditScoreCard from './AuditScoreCard';
import PillarCard from './PillarCard';
import PillarAssessment from './PillarAssessment';
import RecommendationCard from './RecommendationCard';
import RadarScoreChart from './RadarScoreChart';
import AuditSummaryCard from './AuditSummaryCard';
import type { AuditSession, AuditSessionItem, AuditItemResponse, AuditScoreSummary } from '../types';

interface Props {
  session: AuditSession & { items?: AuditSessionItem[]; responses?: AuditItemResponse[] };
  summary: AuditScoreSummary;
}

export default function AuditSessionSummary({ session, summary: legacySummary }: Props) {
  const [devMode, setDevMode] = useState(false);

  // Map database session responses to future-compatible AuditResult contract
  const auditResult = mapSessionToAuditResult(session);
  const { overallScore, overallMaxScore, overallPercentage, overallRating, pillars, recommendations, summary, areaInfo } = auditResult;

  // The primary workplace image for the audit is the post-improvement 'after' image, falling back to 'before'
  const primaryImage = session.generated_after_image_url || session.before_image_url || '';

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 font-sans w-full">
      {/* 11. Audit Progress Stepper */}
      <AuditProgressStepper currentStep={3} />

      {/* Industrial Audit Header */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm print:border-none print:shadow-none">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
              AL
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase">
                ARCOLAB 5S Workplace Audit
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
                Digital Auditor Compliance Report
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={triggerPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Export
            </button>
            <button
              onClick={() => setDevMode(!devMode)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                devMode
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Dev Mode
            </button>
          </div>
        </div>

        {/* Area Information Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Company</p>
            <p className="font-bold text-foreground mt-0.5 truncate">{areaInfo.companyName}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date Conducted</p>
            <p className="font-bold text-foreground mt-0.5">{areaInfo.auditDate}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Area / Workstation</p>
            <p className="font-bold text-foreground mt-0.5 truncate">{areaInfo.areaName}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Auditor</p>
            <p className="font-bold text-foreground mt-0.5 truncate">{areaInfo.auditor}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/40 mt-4 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Department</p>
            <p className="font-semibold text-foreground mt-0.5">{areaInfo.department}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Industry</p>
            <p className="font-semibold text-foreground mt-0.5">{areaInfo.industry}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Workspace Type</p>
            <p className="font-semibold text-foreground mt-0.5">{areaInfo.workspaceType}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Scoring Standard</p>
            <p className="font-semibold text-foreground mt-0.5">Physical Audit 5S (0-4 Rating)</p>
          </div>
        </div>
      </div>

      {/* 3. Interactive Pillar Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
        {pillars.map((pillar) => (
          <PillarCard
            key={pillar.name}
            pillarKey={pillar.name as AuditPillar}
            label={pillar.label}
            jpName={pillar.jpName}
            score={pillar.score}
            maxScore={pillar.maxScore}
            percentage={pillar.percentage}
            rating={pillar.rating}
          />
        ))}
      </div>

      {/* Split layout: Sticky Image Preview + Detailed Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 4. Display the Uploaded Image During Assessment */}
        {primaryImage && (
          <div className="lg:col-span-1 lg:sticky lg:top-24 space-y-4 print:hidden">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Workplace Audit Evidence
                </h4>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Audited State
                </span>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={primaryImage}
                  alt="Audited Workspace"
                  className="w-full h-auto max-h-96 object-contain rounded-lg"
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic text-center">
                Verify questions below against this active visual record.
              </p>
            </div>
          </div>
        )}

        {/* Detailed Assessments */}
        <div className={primaryImage ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print">
              <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Detailed Pillar Checklist
              </h3>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Click any row below to review observations
              </span>
            </div>
            {pillars.map((pillar) => (
              <PillarAssessment
                key={pillar.name}
                pillarKey={pillar.name as AuditPillar}
                label={pillar.label}
                jpName={pillar.jpName}
                score={pillar.score}
                maxScore={pillar.maxScore}
                percentage={pillar.percentage}
                rating={pillar.rating}
                questions={pillar.questions}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Print-only layout for Workplace Image */}
      {primaryImage && (
        <div className="hidden print:block space-y-3 my-8">
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-1">
            Workplace Image Audit Evidence
          </h4>
          <img
            src={primaryImage}
            alt="Audited Workspace Evidence"
            className="w-full h-auto max-h-[400px] object-contain rounded-lg border border-border"
          />
        </div>
      )}

      {/* Overall score section (appears AFTER assessments) */}
      <div className="print:break-inside-avoid">
        <AuditScoreCard
          score={overallScore}
          maxScore={overallMaxScore}
          percentage={overallPercentage}
          rating={overallRating}
        />
      </div>

      {/* Radar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch print:break-inside-avoid">
        <div className="md:col-span-1 flex flex-col justify-between space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex-1 flex flex-col justify-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border pb-2 mb-3">
              Score Breakdown
            </h4>
            <div className="space-y-3 text-xs">
              {pillars.map((p) => (
                <div key={p.name} className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">{p.label}</span>
                  <span className="font-mono font-bold text-foreground">{p.score} / 16</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <RadarScoreChart pillars={pillars} />
        </div>
      </div>

      {/* Centralized Improvement Recommendations */}
      <div className="space-y-3 print:break-inside-avoid">
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Improvement Recommendations
        </h3>
        <RecommendationCard recommendations={recommendations} />
      </div>

      {/* Executive Summary */}
      <div className="print:break-inside-avoid">
        <AuditSummaryCard summary={summary} />
      </div>

      {/* PDF Download Button */}
      <div className="flex gap-3 no-print">
        <button
          onClick={triggerPrint}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/10 cursor-pointer"
        >
          <Printer className="h-5 w-5" />
          Print Audit Report
        </button>
      </div>

      {/* Developer Mode widgets */}
      {devMode && (
        <div className="bg-card border border-destructive/20 rounded-xl p-5 space-y-4 font-mono text-xs no-print">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="font-bold text-destructive flex items-center gap-1.5">
              <Terminal className="h-4 w-4" />
              Developer Audit Session Logs
            </h4>
            <span className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded font-bold">
              DEV ONLY
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Vision Model Used</p>
              <p className="text-foreground mt-0.5 font-mono">{session.vision_model_used || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Prompt Version ID</p>
              <p className="text-foreground mt-0.5 font-mono">{session.prompt_version_id || 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Full Database Session Record</p>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto max-h-60 text-[10px] border border-border">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
