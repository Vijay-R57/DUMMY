import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import AnalysisResults from "../../frontend/src/components/AnalysisResults";
import type { AuditAnalysisResult, SessionScoreResult } from "../../frontend/src/types/analysis";

const mockScore: SessionScoreResult = {
  pillar_scores: [
    {
      pillar: "SORT",
      score: 16,
      maximum: 20,
      percentage: 80,
      raw_percentage: 80,
      passed: 4,
      partial: 0,
      failed: 1,
      not_visible: 0,
      not_applicable: 0,
      critical: 0,
      cap_applied: false,
      top_deductions: [
        {
          question_id: "SORT_001",
          question_text: "Are unused items removed?",
          severity: "MINOR",
          evidence: "Some clutter observed",
          points_lost: 4,
        },
      ],
    },
    {
      pillar: "SET_IN_ORDER",
      score: 16,
      maximum: 20,
      percentage: 80,
      raw_percentage: 80,
      passed: 4,
      partial: 0,
      failed: 1,
      not_visible: 0,
      not_applicable: 0,
      critical: 0,
      cap_applied: false,
      top_deductions: [],
    },
    {
      pillar: "SHINE",
      score: 16,
      maximum: 20,
      percentage: 80,
      raw_percentage: 80,
      passed: 4,
      partial: 0,
      failed: 1,
      not_visible: 0,
      not_applicable: 0,
      critical: 0,
      cap_applied: false,
      top_deductions: [],
    },
    {
      pillar: "STANDARDIZE",
      score: 16,
      maximum: 20,
      percentage: 80,
      raw_percentage: 80,
      passed: 4,
      partial: 0,
      failed: 1,
      not_visible: 0,
      not_applicable: 0,
      critical: 0,
      cap_applied: false,
      top_deductions: [],
    },
    {
      pillar: "SUSTAIN",
      score: 16,
      maximum: 20,
      percentage: 80,
      raw_percentage: 80,
      passed: 4,
      partial: 0,
      failed: 1,
      not_visible: 0,
      not_applicable: 0,
      critical: 0,
      cap_applied: false,
      top_deductions: [],
    },
  ],
  overall_score: 80,
  overall_maximum: 100,
  overall_percentage: 80,
  grade: "Very Good",
  grade_color: "text-green-400",
  total_answered: 25,
  total_questions: 25,
  critical_failures: 0,
  computed_at: new Date().toISOString(),
};

const mockData: AuditAnalysisResult = {
  template: {
    id: "tmpl-123",
    name: "Standard 5S Template",
    version: "1.0",
  },
  prompt_version: "1.0",
  vision_model: "gemini-1.5-pro",
  schema_version: "1.0",
  audit_confidence: 0.9,
  before: {
    score: mockScore,
    responses: [],
  },
  after: {
    image_base64: "data:image/jpeg;base64,456",
    score: {
      ...mockScore,
      overall_percentage: 90,
    },
    responses: [],
  },
  recommendations: [
    {
      pillar: "SORT",
      severity: "MINOR",
      priority: 3,
      title: "Remove clutter",
      description: "Remove cardboard boxes from the aisle",
      root_cause: "No regular cleaning schedule",
      corrective_action: "Store in warehouse immediately",
      linked_question_id: "SORT_001",
    },
  ],
  improvement_prompt: "A neat workspace",
  scoringMethod: "AI Audit (Structured Questionnaire)",
};

describe("AnalysisResults deterministic validation", () => {
  it("should throw error if scoringMethod contains 'gemini'", () => {
    const dataWithGemini = {
      ...mockData,
      scoringMethod: "Gemini Vision Fallback",
    };

    expect(() => {
      render(React.createElement(AnalysisResults, {
        data: dataWithGemini,
        workplaceImage: "data:image/jpeg;base64,123",
      }));
    }).toThrow("Deterministic scoring violation detected.");
  });

  it("should throw error if scoringMethod contains 'fallback'", () => {
    const dataWithFallback = {
      ...mockData,
      scoringMethod: "mathematical-fallback",
    };

    expect(() => {
      render(React.createElement(AnalysisResults, {
        data: dataWithFallback,
        workplaceImage: "data:image/jpeg;base64,123",
      }));
    }).toThrow("Deterministic scoring violation detected.");
  });

  it("should NOT throw error if scoringMethod is 'AI Audit (Structured Questionnaire)'", () => {
    const dataOk = {
      ...mockData,
      scoringMethod: "AI Audit (Structured Questionnaire)",
    };

    expect(() => {
      render(React.createElement(AnalysisResults, {
        data: dataOk,
        workplaceImage: "data:image/jpeg;base64,123",
      }));
    }).not.toThrow();
  });
});

