/**
 * src/hooks/useAnalysisPipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-Driven 5S Audit analysis pipeline hook (Phase 2).
 *
 * What changed from Phase 1:
 *  - All CV Engine, YOLO, local engine logic removed
 *  - Calls the rewritten analyze-5s edge function
 *  - Returns AuditAnalysisResult instead of old AnalysisData
 *  - Stage-aware progress tracks the per-pillar audit steps
 *  - Response validation checks for PillarScoreResult[] structure
 */

import { useCallback, useRef, useState } from 'react';
import { supabase }   from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useToast }   from '@/hooks/use-toast';
import { useAuth }    from '@/contexts/AuthContext';
import type {
  AuditAnalysisResult,
  AnalysisPipelineState,
  AnalysisStage,
} from '@/types/analysis';

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_RETRIES   = 2;
const RETRY_DELAY   = 1500;

// ── Image utilities ───────────────────────────────────────────────────────────
export const resizeImage = (base64: string, maxDim = 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.round(img.naturalWidth  * scale);
      const ch = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = cw;
      canvas.height = ch;
      canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Failed to load image for resizing'));
    img.src = base64;
  });

// ── Response validator ────────────────────────────────────────────────────────
function validateAuditResponse(data: unknown): data is AuditAnalysisResult {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.template === 'object' &&
    typeof d.before   === 'object' &&
    d.before !== null &&
    typeof (d.before as Record<string, unknown>).score === 'object' &&
    Array.isArray(((d.before as Record<string, unknown>).score as Record<string, unknown>)?.pillar_scores)
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAnalysisPipeline(officeName: string) {
  const [pipeline, setPipeline] = useState<AnalysisPipelineState>({
    stage:      'idle',
    progress:   0,
    message:    '',
    retryCount: 0,
  });
  const [results, setResults]               = useState<AuditAnalysisResult | null>(null);
  const [analysisTimestamp, setTimestamp]   = useState<string | null>(null);
  const abortRef = useRef(false);

  const { toast }    = useToast();
  const { employee } = useAuth();

  const setStage = useCallback(
    (stage: AnalysisStage, progress: number, message: string, retryCount = 0) => {
      setPipeline({ stage, progress, message, retryCount });
    },
    [],
  );

  const runAnalysis = useCallback(
    async (
      beforeImage: string,
      sessionId?: string,  // optional: persist results to existing audit session
      templateId?: string, // optional: override default template
      workspaceContext?: Record<string, unknown>, // optional: workspace metadata context
    ) => {
      abortRef.current = false;
      setResults(null);

      try {
        // Stage 1 — Compress
        setStage('compressing', 8, 'Compressing image…');
        const compBefore = await resizeImage(beforeImage, 1024);
        if (abortRef.current) return;

        // Stage 2 — Load template (handled server-side, show progress)
        setStage('loading-template', 15, 'Loading audit template…');
        await delay(200); // brief pause for UX

        // Stages 3–7 — Per-pillar AI analysis (shown via polling-style stages)
        const pillarStages: AnalysisStage[] = [
          'analyzing-sort',
          'analyzing-set-in-order',
          'analyzing-shine',
          'analyzing-standardize',
          'analyzing-sustain',
        ];
        const pillarLabels = ['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain'];

        // Start the actual edge function call in the background
        // then advance the stage display every ~3s to show progress
        let stageIdx = 0;
        const stageInterval = setInterval(() => {
          if (stageIdx < pillarStages.length) {
            const pct = 20 + stageIdx * 10;
            setStage(
              pillarStages[stageIdx],
              pct,
              `Auditing ${pillarLabels[stageIdx]} (${stageIdx + 1}/5)…`,
            );
            stageIdx++;
          }
        }, 3000);

        let data: AuditAnalysisResult;
        try {
          data = await invokeWithRetry(compBefore, sessionId, templateId, workspaceContext);
        } finally {
          clearInterval(stageInterval);
        }

        if (abortRef.current) return;

        // Stage — Scoring
        setStage('scoring', 85, 'Calculating deterministic scores…');
        await delay(200);

        // Stage — Recommendations
        setStage('recommendations', 92, 'Generating improvement recommendations…');
        await delay(200);

        // Stage — Save log
        setStage('saving', 97, 'Saving audit record…');
        if (employee) {
          supabase.functions
            .invoke('save-analysis-log', {
              body: {
                employeeId:     employee.employeeId,
                employeeName:   employee.name,
                department:     employee.department,
                officeName,
                beforeImage,
                analysisResult: data,
                scoringMethod:  'AI Audit (Structured Questionnaire)',
                capturedAt:     new Date().toISOString(),
              },
            })
            .then(({ error: logErr }) => {
              if (logErr) console.error('[useAnalysisPipeline] Log save failed:', logErr);
            })
            .catch((e) => console.error('[useAnalysisPipeline] Log save error:', e));
        }

        setResults(data);
        setTimestamp(new Date().toISOString());
        setStage('complete', 100, 'Analysis complete');

        toast({
          title:       'Analysis Complete',
          description: `${data.before.score.grade} — ${data.before.score.overall_percentage.toFixed(1)}% overall score`,
        });
      } catch (err: unknown) {
        if (abortRef.current) return;
        const errObj = err as Record<string, unknown>;
        const validationErrors = errObj.validationErrors;
        const message = validationErrors && Array.isArray(validationErrors)
          ? `Quality Check Failed:\n• ${validationErrors.join('\n• ')}`
          : (err as Error).message || 'Something went wrong.';
        console.error('[useAnalysisPipeline] Error:', err);
        setStage('error', 0, message);
        toast({
          title:       'Analysis Failed',
          description: validationErrors ? 'Image quality is insufficient for auditing.' : message,
          variant:     'destructive',
        });
      }
    },
    [employee, officeName, setStage, toast],
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setResults(null);
    setTimestamp(null);
    setPipeline({ stage: 'idle', progress: 0, message: '', retryCount: 0 });
  }, []);

  return { pipeline, results, analysisTimestamp, runAnalysis, reset };
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function invokeWithRetry(
  beforeImage: string,
  sessionId?:  string,
  templateId?: string,
  workspaceContext?: Record<string, unknown>,
  attempt = 0,
): Promise<AuditAnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-5s', {
      body: {
        beforeImage,
        sessionId:        sessionId  ?? undefined,
        templateId:       templateId ?? undefined,
        workspaceContext: workspaceContext ?? undefined,
        skipImageGen:     true,
      },
    });

    if (error) {
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * (attempt + 1));
        return invokeWithRetry(beforeImage, sessionId, templateId, workspaceContext, attempt + 1);
      }
      
      let errorMsg = error.message ?? 'Edge function returned an error';
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.json();
          if (body && body.error) {
            errorMsg = body.error;
          }
        } catch (_) {
          // fallback
        }
      }
      throw new Error(errorMsg);
    }

    if (data?.error) {
      if (data.validationErrors) {
        const customErr = new Error(data.error) as Error & { validationErrors?: string[] };
        customErr.validationErrors = data.validationErrors;
        throw customErr;
      }
      throw new Error(String(data.error));
    }

    if (!validateAuditResponse(data)) {
      throw new Error(
        'The analysis service returned an unexpected response format. Please try again.',
      );
    }

    return data as AuditAnalysisResult;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'validationErrors' in err) {
      throw err;
    }
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY * (attempt + 1));
      return invokeWithRetry(beforeImage, sessionId, templateId, workspaceContext, attempt + 1);
    }
    throw err;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
