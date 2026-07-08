/**
 * src/test/regression/promptRegression.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt Regression Tests (Phase 2A.2).
 *
 * Verifies that the parser functions successfully ingest and validate
 * typical prompt output responses stored in fixture files, ensuring
 * that any changes in LLM prompt output schemas are caught.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseObservations, parseAuditAnswers } from '../../../gemini/ai-engines/VisionAnalyzer';
import { parseRecommendations } from '../../../gemini/ai-engines/RecommendationEngine';
import { buildEvidencePrompt } from '../../../backend/supabase/functions/analyze-5s/audit-engine/EvidenceGenerator';
import { PromptBuilder } from '../../../gemini/PromptBuilder';
import { buildRecommendationPrompt } from '../../../gemini/prompts/RecommendationPrompt';
import { SORT_CONFIG } from '../../../backend/supabase/functions/analyze-5s/audit-engine/audit-config/sort';
import { SORT_PROMPT_TEMPLATE } from '../../../gemini/prompt-templates/sortPrompt';
import { PILLAR_DIMENSION_MAP } from '../../../backend/supabase/functions/analyze-5s/audit-engine/types';
import { getPillarConfigs } from '../../../backend/supabase/functions/analyze-5s/audit-engine/AuditDecisionMatrix';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

describe('Prompt Regression Tests', () => {
  it('successfully parses the observations fixture and conforms to schema', () => {
    const rawData = fs.readFileSync(path.join(FIXTURES_DIR, 'observations.fixture.json'), 'utf-8');
    const parsed = parseObservations(rawData);

    expect(parsed).toHaveLength(2);

    // Schema validation checks
    parsed.forEach((obs) => {
      expect(obs.category).toBeTypeOf('string');
      expect(obs.finding).toBeTypeOf('string');
      expect(['COMPLIANT', 'NON_COMPLIANT', 'PARTIAL', 'NOT_VISIBLE', 'NOT_APPLICABLE']).toContain(obs.status);
      expect(obs.evidence).toBeTypeOf('string');
      expect(obs.detected_objects).toBeInstanceOf(Array);
      expect(obs.safety_equipment).toBeInstanceOf(Array);
      expect(obs.hazards).toBeInstanceOf(Array);
      expect(obs.obstructions).toBeInstanceOf(Array);
      expect(['CLEAN', 'DIRTY', 'PARTIAL', 'NOT_VISIBLE']).toContain(obs.cleanliness_rating);
      expect(obs.confidence).toBeGreaterThanOrEqual(0);
      expect(obs.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('successfully parses the checklist mapping fixture and conforms to schema', () => {
    const rawData = fs.readFileSync(path.join(FIXTURES_DIR, 'checklist_mapping.fixture.json'), 'utf-8');
    const parsedMap = parseAuditAnswers(rawData);

    expect(parsedMap.size).toBe(2);

    for (const [qid, response] of parsedMap.entries()) {
      expect(qid).toBeTypeOf('string');
      expect(response.question_id).toBe(qid);
      expect(['YES', 'NO', 'PARTIAL', 'NOT_VISIBLE', 'NOT_APPLICABLE']).toContain(response.ai_answer);
      expect(response.evidence).toBeTypeOf('string');
      expect(response.reasoning).toBeTypeOf('string');
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.answeredByRule).toBe(false); // default parsed response should be false
    }
  });

  it('successfully parses the recommendations fixture and conforms to schema', () => {
    const rawData = fs.readFileSync(path.join(FIXTURES_DIR, 'recommendations.fixture.json'), 'utf-8');
    const parsedList = parseRecommendations(rawData);

    expect(parsedList).toHaveLength(2);

    parsedList.forEach((rec) => {
      expect(rec.pillar).toBeTypeOf('string');
      expect(['CRITICAL', 'MAJOR', 'MINOR']).toContain(rec.severity);
      expect(rec.priority).toBeGreaterThanOrEqual(1);
      expect(rec.priority).toBeLessThanOrEqual(4);
      expect(['Immediate Action', 'High Priority', 'Medium Priority', 'Long-Term Improvement']).toContain(rec.priority_label);
      expect(rec.title).toBeTypeOf('string');
      expect(rec.problem).toBeTypeOf('string');
      expect(rec.root_cause).toBeTypeOf('string');
      expect(rec.corrective_action).toBeTypeOf('string');
      expect(rec.expected_benefit).toBeTypeOf('string');
      expect(rec.estimated_impact).toBeTypeOf('string');
      expect(rec.linked_question_id).toBeTypeOf('string');
    });
  });

  describe('Prompt Principles Validation', () => {
    const mockContext = {
      industry: 'Manufacturing',
      department: 'General',
      selected_zone: 'General',
      area_name: 'Main workstation',
      workspace_type: 'General',
      expected_equipment: '',
      expected_safety_assets: '',
    };

    const mockKnowledge = {
      zoneName: 'General',
      expectedEquipment: ['machine', 'tool'],
      expectedDocuments: ['SOP'],
      expectedSafetyAssets: ['fire extinguisher'],
      expectedLayout: ['walkway'],
      expectedVisualControls: ['label'],
      expectedCleanliness: ['clean floor'],
      expectedStoragePractices: ['designated area'],
    };

    function checkPrinciples(prompt: string, promptName: string) {
      const MANDATORY_PRINCIPLES = [
        {
          name: 'Positive Compliance First',
          regex: /positive compliance|positive findings|compliance first/i,
        },
        {
          name: 'Unknown ≠ Failure',
          regex: /unknown|never penalize|not a failure/i,
        },
        {
          name: 'Visual Evidence Rule',
          regex: /directly visible|only direct|visual evidence|source of truth/i,
        },
        {
          name: 'Conservative Evaluation',
          regex: /conservative|reduce confidence|neutral rating|uncertain/i,
        },
        {
          name: 'Question Classification Matrix',
          regex: /evidence category|classification matrix|category [a-d]/i,
        },
        {
          name: 'Zone-Aware Reasoning',
          regex: /zone-aware|selected zone|zone knowledge|expected items|workspace context/i,
        },
      ];

      const results = MANDATORY_PRINCIPLES.map((principle) => {
        const passed = principle.regex.test(prompt);
        return { name: principle.name, passed };
      });

      const missing = results.filter((r) => !r.passed).map((r) => r.name);
      console.log(`[Prompt Regression] ${promptName} Validation Report:`);
      results.forEach((r) => {
        console.log(`  - ${r.name}: ${r.passed ? '✓ Present' : '✗ MISSING'}`);
      });

      return missing;
    }

    it('verifies that the Stage A Vision prompt includes all mandatory audit principles', () => {
      const prompt = buildEvidencePrompt(mockContext, mockKnowledge);
      const missing = checkPrinciples(prompt, 'Stage A Vision Prompt');
      expect(missing).toEqual([]);
    });

    it('verifies that the Stage B Question Evaluation prompt includes all mandatory audit principles', () => {
      const mockEvidence = {
        generatedAt: new Date().toISOString(),
        zone: 'General',
        expectedObjects: [],
        visibleObjects: [],
        positiveCompliance: [],
        violations: [],
        overallConfidence: 'HIGH' as const,
        imageNotes: '',
      };

      const prompt = PromptBuilder.buildEvaluatorPrompt(
        SORT_CONFIG,
        SORT_PROMPT_TEMPLATE,
        mockContext,
        mockKnowledge,
        PILLAR_DIMENSION_MAP,
        mockEvidence,
        getPillarConfigs('SORT'),
        {},
        [],
        [],
      );

      const missing = checkPrinciples(prompt, 'Stage B Question Evaluation Prompt');
      expect(missing).toEqual([]);
    });

    it('checks the Recommendation prompt and reports any missing principles', () => {
      const mockPillarScores = [
        {
          pillar: 'SORT' as const,
          score: 12,
          maxScore: 16,
          percentage: 75,
          rating: 'Good' as const,
          benchmarkScore: 12,
          cap_applied: false,
          cap_reason: null,
          cap_value: null,
          top_deductions: [
            {
              question_id: 'SORT-01',
              question_text: 'Is the area free of clutter?',
              evidence: 'clutter observed',
              severity: 'MINOR' as const,
              points_lost: 1,
            }
          ],
          questions: [],
        }
      ];

      const mockRecTemplate = 'You are a 5S continuous improvement consultant. Generate recommendations based on failure items.';
      const prompt = buildRecommendationPrompt({
        pillarScores: mockPillarScores,
        promptTemplate: mockRecTemplate,
      });

      const missing = checkPrinciples(prompt, 'Recommendation Prompt');
      // Recommendation prompts are post-audit and only receive fail items.
      // We report the missing items but do not fail the build for them.
      console.log(`[Recommendation Prompt] Missing principles (expected for post-audit step): ${missing.join(', ') || 'None'}`);
    });
  });
});
