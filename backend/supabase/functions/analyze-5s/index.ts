/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * supabase/functions/analyze-5s/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-Driven 5S Audit Orchestrator (Phase 2A.3 — Operational Readiness).
 *
 * Implements full stage recovery, audit versioning, performance stage timing,
 * and structured error classification using AuditError.
 *
 * Stage failure recovery policy:
 *   - CRITICAL (Image quality, DB Load, Observations, Mapping, Scoring):
 *     Throws AuditError. Non-recoverable, terminates audit immediately, returns 400/404/500 structured JSON.
 *   - NON-CRITICAL (Rule Engine, Consistency, Recommendations, Reliability, Persistence):
 *     Logs error, records stage status as RECOVERED/FAILED in trace, falls back to safe defaults, continues audit.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { validateImageQuality }                             from '../../../../gemini/validation/ImageQualityValidator.ts';
import { generateObservations, mapObservationsToChecklist } from '../../../../gemini/ai-engines/VisionAnalyzer.ts';
import { ObservationCache }                                 from '../../../../gemini/ai-engines/ObservationCache.ts';
import { applyAllRules }                                    from '../../../../gemini/ai-engines/RuleEngine.ts';
import type { DbCustomRule, QuestionInput, RuleEvaluation } from '../../../../gemini/ai-engines/RuleEngine.ts';
import { validateConsistency, countHighWarnings }           from '../../../../gemini/ai-engines/ConsistencyValidator.ts';
import type { ConsistencyWarning }                          from '../../../../gemini/ai-engines/ConsistencyValidator.ts';
import { classifyReliability }                              from '../../../../gemini/ai-engines/ReliabilityClassifier.ts';
import type { ReliabilityResult }                           from '../../../../gemini/ai-engines/ReliabilityClassifier.ts';
import { generateRecommendations }                          from '../../../../gemini/ai-engines/RecommendationEngine.ts';
import { scoreSession }                                     from './scoring/ScoringService.ts';
import { buildImagePrompt }                                 from '../../../../gemini/prompts/ImagePromptGenerator.ts';
import { ImageGenerationFactory }                           from '../../../../gemini/image-generation/ImageGenerationFactory.ts';
import type {
  QuestionItem,
  ScoredResponse,
  CriticalRule,
  SessionScoreResult,
} from './scoring/types.ts';

// Phase 2A.3 Additions
import { ENGINE_VERSIONS }           from './versions.ts';
import { AuditError, AuditErrorCode } from './errors/AuditError.ts';

// ── Phase 4: Shared Audit Evidence Architecture ───────────────────────────────
import { AuditEngine }                from './audit-engine/AuditEngine.ts';
import { LLMProvider }               from '../../../../gemini/LLMProvider.ts';
// Pillar configs
import { SORT_CONFIG }               from './audit-engine/audit-config/sort.ts';
import { SET_IN_ORDER_CONFIG }        from './audit-engine/audit-config/setInOrder.ts';
import { SHINE_CONFIG }              from './audit-engine/audit-config/shine.ts';
import { STANDARDIZE_CONFIG }        from './audit-engine/audit-config/standardize.ts';
import { SUSTAIN_CONFIG }            from './audit-engine/audit-config/sustain.ts';
// Prompt templates
import { SORT_PROMPT_TEMPLATE }          from '../../../../gemini/prompt-templates/sortPrompt.ts';
import { SET_IN_ORDER_PROMPT_TEMPLATE }  from '../../../../gemini/prompt-templates/setInOrderPrompt.ts';
import { SHINE_PROMPT_TEMPLATE }         from '../../../../gemini/prompt-templates/shinePrompt.ts';
import { STANDARDIZE_PROMPT_TEMPLATE }   from '../../../../gemini/prompt-templates/standardizePrompt.ts';
import { SUSTAIN_PROMPT_TEMPLATE }       from '../../../../gemini/prompt-templates/sustainPrompt.ts';
import type { WorkspaceContext as AuditWorkspaceContext } from './audit-engine/types.ts';

interface PipelineStageResult {
  stage:       string;
  duration_ms: number;
  status:      'OK' | 'RECOVERED' | 'FAILED';
  error?:      string;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const stageResults: PipelineStageResult[] = [];
  const pipelineStart = Date.now();

  try {
    const payload = await req.json();
    const action  = payload.action ?? 'audit';

    // ── Environment ─────────────────────────────────────────────────────────
    const GEMINI_API_KEY    = Deno.env.get('GEMINI_API_KEY')     ?? '';
    const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY')     ?? '';
    const PROVIDER_IMG      = Deno.env.get('PROVIDER_IMAGE_GEN') ?? 'gemini';
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')       ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const VISION_MODEL              = Deno.env.get('VISION_MODEL')              ?? 'gemini-1.5-pro';

    if (!GEMINI_API_KEY) {
      throw new AuditError(AuditErrorCode.UNKNOWN, 'setup', false, 'GEMINI_API_KEY not configured');
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── ACTION: VISUALIZE ──────────────────────────────────────────────────
    if (action === 'visualize') {
      const { sessionId } = payload;
      if (!sessionId) return json({ error: 'sessionId is required' }, 400);

      console.log(`[analyze-5s] Visualize action for session ${sessionId}`);

      const { data: session, error: sErr } = await sb
        .from('audit_sessions')
        .select('explainability_report, template_name')
        .eq('id', sessionId)
        .single();

      if (sErr || !session) return json({ error: `Session not found: ${sErr?.message}` }, 404);

      const report = session.explainability_report;
      if (!report?.pillar_scores) {
        return json({ error: 'No audit report scores found on this session.' }, 400);
      }

      const { data: imgPromptVersion } = await sb
        .from('audit_prompt_versions')
        .select('prompt_text')
        .eq('prompt_type', 'IMAGE_PROMPT')
        .eq('is_active', true)
        .limit(1)
        .single();

      const imgPromptTemplate = imgPromptVersion?.prompt_text
        ?? 'You are a 5S expert. Generate an image of an optimized, clean industrial workspace.';

      const improvementPrompt = buildImagePrompt({
        pillarScores:   report.pillar_scores,
        promptTemplate: imgPromptTemplate,
      });

      const imgProvider = ImageGenerationFactory.create(PROVIDER_IMG, OPENAI_API_KEY, GEMINI_API_KEY);
      const imgResult   = await imgProvider.generateImage({ prompt: improvementPrompt, size: '1024x1024' });
      const afterImage  = `data:image/png;base64,${imgResult.imageBase64}`;

      await sb.from('audit_sessions').update({
        generated_after_image_url: afterImage,
        improvement_prompt:        improvementPrompt,
        updated_at:                new Date().toISOString(),
      }).eq('id', sessionId);

      return json({ success: true, image_base64: afterImage, prompt: improvementPrompt }, 200);
    }

    // ── ACTION: AUDIT-V4 (Phase 4 — Two-Stage Evidence Architecture) ──────────
    if (action === 'audit-v4') {
      const { beforeImage, sessionId, workspaceContext } = payload;
      if (!beforeImage) {
        return json({ error: 'beforeImage is required for audit-v4' }, 400);
      }

      // Build typed WorkspaceContext (selected_zone maps to workspace_type)
      const ctx: AuditWorkspaceContext = {
        industry:               workspaceContext?.industry               ?? 'Manufacturing',
        department:             workspaceContext?.department             ?? 'General',
        selected_zone:          workspaceContext?.selected_zone          ??
                                workspaceContext?.workspace_type         ?? 'General',
        area_name:              workspaceContext?.area_name              ?? 'Main workstation',
        workspace_type:         workspaceContext?.workspace_type         ?? 'General',
        expected_equipment:     workspaceContext?.expected_equipment     ?? '',
        expected_safety_assets: workspaceContext?.expected_safety_assets ?? '',
      };

      // Initialise engine
      const provider = new LLMProvider({
        provider: 'gemini',
        apiKey:   GEMINI_API_KEY,
        model:    VISION_MODEL,
      });
      const engine = new AuditEngine(provider);

      const v4Stages: PipelineStageResult[] = [];

      // ── Stage A: Evidence Generation (1 vision call) ─────────────────────
      console.log('[analyze-5s v4] Stage A: Evidence generation…');
      const tA = Date.now();
      let evidenceResult: Awaited<ReturnType<typeof engine['generateEvidence']>>;
      try {
        evidenceResult = await engine.generateEvidence(beforeImage, ctx);
        v4Stages.push({ stage: 'evidence_generation', duration_ms: Date.now() - tA, status: 'OK' });
      } catch (e: any) {
        v4Stages.push({ stage: 'evidence_generation', duration_ms: Date.now() - tA, status: 'FAILED', error: e.message });
        return json({ error: `Stage A failed: ${e.message}`, stages: v4Stages }, 500);
      }
      const evidence = evidenceResult.evidence;

      // ── Stage B: Pillar Evaluations (5 text-only calls) ───────────────────
      const PILLARS = [
        { config: SORT_CONFIG,          template: SORT_PROMPT_TEMPLATE },
        { config: SET_IN_ORDER_CONFIG,   template: SET_IN_ORDER_PROMPT_TEMPLATE },
        { config: SHINE_CONFIG,          template: SHINE_PROMPT_TEMPLATE },
        { config: STANDARDIZE_CONFIG,    template: STANDARDIZE_PROMPT_TEMPLATE },
        { config: SUSTAIN_CONFIG,        template: SUSTAIN_PROMPT_TEMPLATE },
      ];

      const pillarResults = [];
      const allMetrics    = [];
      const allCoverages  = [];   // Phase 4.1: accumulated per-question coverage
      const allBalances   = [];   // Phase 4.1: accumulated per-question balance
      const allTraces     = [];   // Phase 4.2: accumulated per-question traces

      for (const { config, template } of PILLARS) {
        console.log(`[analyze-5s v4] Stage B: ${config.label}…`);
        const tB = Date.now();
        try {
          const { result, metrics, coverages, balances, traces } = await engine.runPillar(config, template, evidence, ctx);
          pillarResults.push(result);
          allMetrics.push(metrics);
          allCoverages.push(...coverages);
          allBalances.push(...balances);
          allTraces.push(traces);
          v4Stages.push({ stage: `pillar_${config.pillar.toLowerCase()}`, duration_ms: Date.now() - tB, status: 'OK' });
        } catch (e: any) {
          v4Stages.push({ stage: `pillar_${config.pillar.toLowerCase()}`, duration_ms: Date.now() - tB, status: 'FAILED', error: e.message });
          console.error(`[analyze-5s v4] Pillar ${config.pillar} failed:`, e.message);
          // Continue with remaining pillars — non-critical
        }
      }

      // ── Assemble session result (Phase 4.2: with calibration and trace data) ─────────
      const sessionResult = AuditEngine.buildSessionResult(
        ctx,
        pillarResults,
        allMetrics,
        VISION_MODEL,
        evidence,
        allCoverages,
        allBalances,
        allTraces,
      );

      v4Stages.push({ stage: 'total_pipeline', duration_ms: Date.now() - pipelineStart, status: 'OK' });

      // ── Optional: persist to DB ────────────────────────────────────────────
      if (sessionId) {
        try {
          await sb.from('audit_sessions').update({
            explainability_report: { ...sessionResult, pipeline_stages: v4Stages },
            total_score:           sessionResult.overallScore,
            max_score:             sessionResult.overallMaxScore,
            engine_version:        sessionResult.versions.engineVersion,
            vision_model_used:     VISION_MODEL,
            updated_at:            new Date().toISOString(),
          }).eq('id', sessionId);
        } catch (e: any) {
          console.warn('[analyze-5s v4] DB persistence failed (non-critical):', e.message);
        }
      }

      return json({
        ...sessionResult,
        pipeline_stages: v4Stages,
        stageA: {
          parseFailure:     evidenceResult.parseFailure,
          droppedViolations: evidenceResult.dropped,
          tokensUsed:       evidenceResult.tokensUsed,
          objectsInventoried: evidence.visibleObjects.length,
          positiveFindings:   evidence.positiveCompliance.length,
          violations:         evidence.violations.length,
        },
      }, 200);
    }

    // ── ACTION: AUDIT ──────────────────────────────────────────────────────
    const { beforeImage, sessionId, templateId, workspaceContext } = payload;
    if (!beforeImage) {
      throw new AuditError(AuditErrorCode.IMAGE_QUALITY_FAILED, 'validation', false, 'beforeImage is required');
    }

    const context = {
      industry:               workspaceContext?.industry               ?? 'Manufacturing',
      department:             workspaceContext?.department             ?? 'General',
      workspace_type:         workspaceContext?.workspace_type         ?? 'Assembly Line',
      area_name:              workspaceContext?.area_name              ?? 'Main workstation',
      expected_equipment:     workspaceContext?.expected_equipment     ?? 'Workbenches, hand tools',
      expected_safety_assets: workspaceContext?.expected_safety_assets ?? 'Fire extinguishers, safety markings',
      applicable_regulations: workspaceContext?.applicable_regulations || undefined,
    };

    // ── 1. Image Quality Validation (CRITICAL) ────────────────────────
    console.log('[analyze-5s] Running image quality checks…');
    const t_qual = Date.now();
    const qualityCheck = validateImageQuality(beforeImage);
    if (!qualityCheck.isValid) {
      throw new AuditError(
        AuditErrorCode.IMAGE_QUALITY_FAILED,
        'image_validation',
        false,
        'Image quality validation failed',
        qualityCheck.errors,
      );
    }
    stageResults.push({ stage: 'image_validation', duration_ms: Date.now() - t_qual, status: 'OK' });

    // ── 2. Load template + DB parameters (CRITICAL) ───────────────────
    console.log('[analyze-5s] Loading template…');
    const t_load = Date.now();
    const templateQuery = sb
      .from('audit_templates')
      .select('id, name, version, status, industry, department, workspace_type')
      .eq('status', 'ACTIVE');

    if (templateId) templateQuery.eq('id', templateId);
    else            templateQuery.eq('is_default', true);

    const { data: template, error: tErr } = await templateQuery.limit(1).single();
    if (tErr || !template) {
      throw new AuditError(
        AuditErrorCode.TEMPLATE_NOT_FOUND,
        'db_load',
        false,
        `Active template not found: ${tErr?.message ?? 'No templates exist'}`,
      );
    }

    const { data: rawItems, error: iErr } = await sb
      .from('audit_checklist_items')
      .select('id, question_id, question_text, description, category, pillar, max_points, weight, severity, is_mandatory')
      .eq('template_id', template.id)
      .order('pillar', { ascending: true })
      .order('display_order', { ascending: true });

    if (iErr || !rawItems?.length) {
      throw new AuditError(
        AuditErrorCode.TEMPLATE_NOT_FOUND,
        'db_load',
        false,
        `No checklist items found for template: ${template.id}`,
      );
    }

    const { data: rawRules } = await sb
      .from('audit_critical_rules')
      .select('id, checklist_item_id, pillar, trigger_answer, score_cap, description')
      .eq('template_id', template.id)
      .eq('is_active', true);

    // Load DB custom rules (NON-CRITICAL - fallback to empty rule list on error)
    let customRules: DbCustomRule[] = [];
    try {
      const { data: rawCustomRules } = await sb
        .from('audit_custom_rules')
        .select('id, rule_id, template_id, pillar, category, condition_json, answer, confidence, rationale, is_active')
        .eq('template_id', template.id)
        .eq('is_active', true);

      customRules = (rawCustomRules ?? []).map((r: any) => ({
        id:             r.id,
        rule_id:        r.rule_id,
        template_id:    r.template_id,
        pillar:         r.pillar ?? null,
        category:       r.category ?? null,
        condition_json: r.condition_json,
        answer:         r.answer,
        confidence:     Number(r.confidence),
        rationale:      r.rationale ?? null,
        is_active:      Boolean(r.is_active),
      }));
    } catch (e: any) {
      console.warn('[analyze-5s] Custom rules load failed (non-critical):', e.message);
    }

    // Load active prompts (NON-CRITICAL - fallbacks will be used on error)
    let promptVersion: any = null;
    try {
      const { data: pData } = await sb
        .from('audit_prompt_versions')
        .select('id, prompt_text, version, schema_version')
        .eq('prompt_type', 'VISION_AUDIT')
        .eq('is_active', true)
        .limit(1)
        .single();
      promptVersion = pData;
    } catch (e: any) {
      console.warn('[analyze-5s] Active audit prompt load failed (non-critical):', e.message);
    }

    let recPromptVersion: any = null;
    try {
      const { data: rData } = await sb
        .from('audit_prompt_versions')
        .select('prompt_text')
        .eq('prompt_type', 'RECOMMENDATIONS')
        .eq('is_active', true)
        .limit(1)
        .single();
      recPromptVersion = rData;
    } catch (e: any) {
      console.warn('[analyze-5s] Active recommendations prompt load failed (non-critical):', e.message);
    }

    // Map DB checklist structures
    const questionItems: QuestionItem[] = rawItems.map((i: any) => ({
      id:            i.id,
      question_id:   i.question_id,
      question_text: i.question_text,
      category:      i.category ?? 'General',
      pillar:        i.pillar,
      max_points:    Number(i.max_points),
      weight:        Number(i.weight),
      severity:      i.severity ?? 'MINOR',
      is_mandatory:  Boolean(i.is_mandatory),
    }));

    const questionInputs: QuestionInput[] = questionItems.map((q) => ({
      id:            q.id,
      question_id:   q.question_id,
      question_text: q.question_text,
      category:      q.category,
      pillar:        q.pillar,
    }));

    const criticalRules: CriticalRule[] = (rawRules ?? []).map((r: any) => ({
      id:                r.id,
      checklist_item_id: r.checklist_item_id,
      pillar:            r.pillar,
      trigger_answer:    r.trigger_answer,
      score_cap:         Number(r.score_cap),
      description:       r.description ?? '',
    }));

    stageResults.push({ stage: 'db_load', duration_ms: Date.now() - t_load, status: 'OK' });

    // ── 3. Pass 1: Vision Observation (CRITICAL) ──────────────────────
    console.log('[analyze-5s] Pass 1: Generating observations…');
    const t_obs = Date.now();
    let observations: any[];
    try {
      observations = await generateObservations(beforeImage, context, GEMINI_API_KEY, VISION_MODEL);
    } catch (e: any) {
      throw new AuditError(
        AuditErrorCode.OBSERVATION_FAILED,
        'observations',
        false,
        `Vision observation extraction failed: ${e.message}`,
      );
    }
    const obsCache = new ObservationCache(observations);
    stageResults.push({ stage: 'observations', duration_ms: Date.now() - t_obs, status: 'OK' });

    // ── 4. Rule Engine: Hybrid rules (NON-CRITICAL) ───────────────────
    console.log('[analyze-5s] Rule Engine: Evaluating rules…');
    const t_rules = Date.now();
    let ruleAnswers = new Map();
    let ruleEvaluations: RuleEvaluation[] = [];

    try {
      const res = applyAllRules(questionInputs, obsCache, customRules);
      ruleAnswers     = res.answers;
      ruleEvaluations = res.evaluations;
      stageResults.push({ stage: 'rule_engine', duration_ms: Date.now() - t_rules, status: 'OK' });
    } catch (e: any) {
      console.error('[analyze-5s] Rule engine evaluation failed (recovered):', e.message);
      stageResults.push({
        stage:       'rule_engine',
        duration_ms: Date.now() - t_rules,
        status:      'RECOVERED',
        error:       e.message,
      });
    }

    // ── 5. Pass 2: Checklist Mapping (CRITICAL) ───────────────────────
    console.log('[analyze-5s] Pass 2: Mapping to checklist…');
    const t_map = Date.now();
    let auditResponses: any[];
    try {
      auditResponses = await mapObservationsToChecklist(
        questionItems,
        obsCache,
        GEMINI_API_KEY,
        VISION_MODEL,
        ruleAnswers,
      );
    } catch (e: any) {
      throw new AuditError(
        AuditErrorCode.MAPPING_FAILED,
        'checklist_mapping',
        false,
        `Checklist mapping failed: ${e.message}`,
      );
    }
    stageResults.push({ stage: 'checklist_mapping', duration_ms: Date.now() - t_map, status: 'OK' });

    // ── 6. Consistency Validation (NON-CRITICAL) ─────────────────────
    console.log('[analyze-5s] Validating consistency…');
    const t_cons = Date.now();
    let consistencyWarnings: ConsistencyWarning[] = [];
    let highWarnings = 0;

    try {
      const questionMeta = questionItems.map((q) => ({
        question_id: q.question_id,
        category:    q.category,
        pillar:      q.pillar,
      }));
      consistencyWarnings = validateConsistency(auditResponses, obsCache, questionMeta);
      highWarnings        = countHighWarnings(consistencyWarnings);
      stageResults.push({ stage: 'consistency_validation', duration_ms: Date.now() - t_cons, status: 'OK' });
    } catch (e: any) {
      console.warn('[analyze-5s] Consistency validation failed (recovered):', e.message);
      stageResults.push({
        stage:       'consistency_validation',
        duration_ms: Date.now() - t_cons,
        status:      'RECOVERED',
        error:       e.message,
      });
    }

    // ── 7. Deterministic Scoring (CRITICAL) ──────────────────────────
    console.log('[analyze-5s] Calculating score…');
    const t_score = Date.now();
    let scoreResult: SessionScoreResult;
    try {
      const scoredResponses: ScoredResponse[] = auditResponses.map((r) => {
        const item = questionItems.find((q) => q.question_id === r.question_id);
        return {
          session_item_id: item?.id ?? r.question_id,
          question_id:     r.question_id,
          ai_answer:       r.ai_answer,
          evidence:        r.evidence,
        };
      });

      scoreResult = scoreSession(questionItems, scoredResponses, criticalRules);
    } catch (e: any) {
      throw new AuditError(
        AuditErrorCode.UNKNOWN,
        'scoring',
        false,
        `Deterministic score calculation failed: ${e.message}`,
      );
    }
    stageResults.push({ stage: 'scoring', duration_ms: Date.now() - t_score, status: 'OK' });

    // ── 8. Reliability Classification (NON-CRITICAL) ──────────────────
    const t_rel = Date.now();
    let reliabilityResult: ReliabilityResult = {
      level:   'MEDIUM',
      label:   'Medium Reliability',
      score:   50,
      reasons: ['Reliability classifier bypassed due to error recovery.'],
    };

    let finalConfidence = 80;
    let notVisibleCount = 0;
    let notApplicableCount = 0;
    let sumAiConfidence = 0;

    auditResponses.forEach((r) => {
      sumAiConfidence += r.confidence;
      if (r.ai_answer === 'NOT_VISIBLE')   notVisibleCount++;
      if (r.ai_answer === 'NOT_APPLICABLE') notApplicableCount++;
    });

    try {
      let confidenceBase = 100;
      confidenceBase -= notVisibleCount   * 3.5;
      confidenceBase -= notApplicableCount * 2.0;

      if (qualityCheck.brightnessScore && (qualityCheck.brightnessScore < 25 || qualityCheck.brightnessScore > 80)) {
        confidenceBase -= 10;
      }
      if (qualityCheck.contrastScore && qualityCheck.contrastScore < 15) {
        confidenceBase -= 10;
      }

      const avgAiConfidence = auditResponses.length > 0
        ? sumAiConfidence / auditResponses.length
        : 1.0;
      finalConfidence = Math.max(10, Math.min(100, Math.round(confidenceBase * avgAiConfidence)));

      const notVisiblePct = auditResponses.length > 0
        ? (notVisibleCount / auditResponses.length) * 100
        : 0;

      reliabilityResult = classifyReliability({
        audit_confidence:           finalConfidence,
        not_visible_pct:            notVisiblePct,
        high_consistency_warnings:  highWarnings,
        image_brightness_score:     qualityCheck.brightnessScore
          ? qualityCheck.brightnessScore / 100
          : undefined,
        image_contrast_score:       qualityCheck.contrastScore
          ? qualityCheck.contrastScore / 100
          : undefined,
      });

      stageResults.push({ stage: 'reliability_classification', duration_ms: Date.now() - t_rel, status: 'OK' });
    } catch (e: any) {
      console.warn('[analyze-5s] Reliability classification failed (recovered):', e.message);
      stageResults.push({
        stage:       'reliability_classification',
        duration_ms: Date.now() - t_rel,
        status:      'RECOVERED',
        error:       e.message,
      });
    }

    // ── 9. Recommendation Engine (NON-CRITICAL) ───────────────────────
    console.log('[analyze-5s] Generating recommendations…');
    const t_rec = Date.now();
    let recommendations: any[] = [];
    try {
      const recPrompt = recPromptVersion?.prompt_text ?? '';
      recommendations = await generateRecommendations(scoreResult.pillar_scores, recPrompt, GEMINI_API_KEY, VISION_MODEL);
      stageResults.push({ stage: 'recommendations', duration_ms: Date.now() - t_rec, status: 'OK' });
    } catch (e: any) {
      console.warn('[analyze-5s] Recommendation engine failed (recovered):', e.message);
      stageResults.push({
        stage:       'recommendations',
        duration_ms: Date.now() - t_rec,
        status:      'RECOVERED',
        error:       e.message,
      });
    }

    // ── 10. Explainability Report compilation (Phase 2A.3 complete) ───
    const explainabilityReport = {
      executive_summary:  `5S Workplace Audit — Overall: ${scoreResult.overall_percentage}%, Grade: ${scoreResult.grade}.`,
      template_info: {
        id:        template.id,
        name:      template.name,
        version:   template.version,
        hierarchy: `${template.industry} > ${template.department} > ${template.workspace_type}`,
      },
      prompt_version:     promptVersion?.version     ?? '1.0',
      vision_model:       VISION_MODEL,
      timestamp:          new Date().toISOString(),
      audit_confidence:   finalConfidence,
      overall_score:      scoreResult.overall_score,
      overall_maximum:    scoreResult.overall_maximum,
      overall_percentage: scoreResult.overall_percentage,
      grade:              scoreResult.grade,
      critical_failures:  scoreResult.critical_failures,
      pillar_scores:      scoreResult.pillar_scores,
      recommendations,
      workspace_context:  context,
      quality_checks: {
        width:           qualityCheck.resolution?.width  ?? 0,
        height:          qualityCheck.resolution?.height ?? 0,
        brightnessScore: qualityCheck.brightnessScore,
        contrastScore:   qualityCheck.contrastScore,
      },

      // Phase 2A.1 Additions
      observation_cache:     obsCache.getObservations(),
      rule_evaluations:      ruleEvaluations,
      consistency_warnings:  consistencyWarnings,
      reliability_result:    reliabilityResult,

      // Phase 2A.3 Additions
      engine_versions:       ENGINE_VERSIONS,
      pipeline_stages:       stageResults,
    };

    // Complete the duration calculation for currently succeeded stages
    const t_persist = Date.now();

    // ── 11. Database Persistence (NON-CRITICAL) ───────────────────────
    if (sessionId) {
      try {
        // Update session header with version metadata
        await sb.from('audit_sessions').update({
          score_breakdown:          scoreResult,
          explainability_report:    explainabilityReport,
          total_score:              scoreResult.overall_score,
          max_score:                scoreResult.overall_maximum,
          audit_confidence:         finalConfidence,
          audit_reliability_level:  reliabilityResult.level,

          // Version Metadata
          engine_version:               ENGINE_VERSIONS.engine,
          observation_schema_version:   ENGINE_VERSIONS.observation_schema,
          scoring_engine_version:       ENGINE_VERSIONS.scoring_engine,
          rule_engine_version:          ENGINE_VERSIONS.rule_engine,
          recommendation_engine_version: ENGINE_VERSIONS.recommendation_engine,

          industry:                 context.industry,
          department:               context.department,
          workspace_type:           context.workspace_type,
          expected_equipment:       context.expected_equipment,
          expected_safety_assets:   context.expected_safety_assets,
          prompt_version_id:        promptVersion?.id ?? null,
          vision_model_used:        VISION_MODEL,
          prompt_schema_version:    promptVersion?.schema_version ?? '1.0',
          analysis_mode:            'FULL_AI',
          updated_at:               new Date().toISOString(),
        }).eq('id', sessionId);

        // Save responses
        const responseRows = auditResponses.map((r) => {
          const item = questionItems.find((q) => q.question_id === r.question_id);
          return {
            audit_session_id: sessionId,
            session_item_id:  item?.id ?? '',
            ai_answer:        r.ai_answer,
            evidence:         r.evidence,
            ai_question_id:   r.question_id,
            confidence:       r.confidence,
            reasoning:        r.reasoning,
            observation:      r.evidence,
            final_score:      answerToScore(r.ai_answer, item?.max_points ?? 0),
            notes:            r.evidence,
          };
        }).filter((r) => r.session_item_id);

        if (responseRows.length) {
          await sb.from('audit_item_responses')
            .upsert(responseRows, { onConflict: 'audit_session_id,session_item_id' });
        }

        // Save recommendations
        if (recommendations.length) {
          await sb.from('audit_recommendations').delete().eq('audit_session_id', sessionId);
          const recRows = recommendations.map((r) => ({
            audit_session_id:   sessionId,
            pillar:             r.pillar,
            severity:           r.severity,
            priority:           r.priority,
            title:              r.title,
            description:        `Problem: ${r.problem}\nExpected Benefit: ${r.expected_benefit}\nScore Impact: ${r.estimated_impact}`,
            root_cause:         r.root_cause,
            corrective_action:  r.corrective_action,
            linked_question_id: r.linked_question_id,
          }));
          await sb.from('audit_recommendations').insert(recRows);
        }

        stageResults.push({ stage: 'persistence', duration_ms: Date.now() - t_persist, status: 'OK' });
      } catch (e: any) {
        console.error('[analyze-5s] DB Persistence failed (recovered):', e.message);
        stageResults.push({
          stage:       'persistence',
          duration_ms: Date.now() - t_persist,
          status:      'FAILED',
          error:       e.message,
        });
      }
    }

    // Record total pipeline stage duration
    explainabilityReport.pipeline_stages = [
      ...stageResults,
      { stage: 'total_pipeline', duration_ms: Date.now() - pipelineStart, status: 'OK' },
    ];

    return json({
      template: {
        id:      template.id,
        name:    template.name,
        version: template.version,
      },
      prompt_version:        promptVersion?.version     ?? '1.0',
      vision_model:          VISION_MODEL,
      schema_version:        promptVersion?.schema_version ?? '1.0',
      audit_confidence:      finalConfidence,
      audit_reliability:     reliabilityResult,
      before: {
        score:     scoreResult,
        responses: auditResponses,
      },
      after:                 null,
      recommendations,
      rule_evaluations:      ruleEvaluations,
      consistency_warnings:  consistencyWarnings,
      explainability_report: explainabilityReport,
    }, 200);

  } catch (err) {
    console.error('[analyze-5s] Pipeline failed:', err);

    // Map unhandled errors or AuditErrors to structured JSON error response
    if (err instanceof AuditError) {
      return json(err.toJSON(), err.code === AuditErrorCode.TEMPLATE_NOT_FOUND ? 404 : 500);
    }

    const wrapped = new AuditError(
      AuditErrorCode.UNKNOWN,
      'orchestrator',
      false,
      err instanceof Error ? err.message : 'Unknown orchestrator error',
    );
    return json(wrapped.toJSON(), 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function answerToScore(answer: string, maxPoints: number): number {
  switch (answer) {
    case 'YES':     return maxPoints;
    case 'PARTIAL': return maxPoints * 0.5;
    default:        return 0;
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
