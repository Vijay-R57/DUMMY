/**
 * src/test/unit/parseAuditAnswers.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for parseAuditAnswers (Phase 2A.2).
 * Verifies that answer parsing, confidence bounding, and malformed inputs
 * are correctly handled.
 */

import { describe, it, expect } from 'vitest';
import { parseAuditAnswers } from '../../../gemini/ai-engines/VisionAnalyzer';

const mockAnswersJson = `[
  {
    "question_id": "ASM_SRT_01",
    "answer": "YES",
    "confidence": 0.95,
    "evidence": "Clean and sorted.",
    "reasoning": "Standard compliant."
  },
  {
    "question_id": "ASM_ORD_01",
    "answer": "PARTIAL",
    "confidence": 0.70,
    "evidence": "Some tools out of place.",
    "reasoning": "Partially organized."
  }
]`;

describe('parseAuditAnswers', () => {
  it('parses valid answers into a Map', () => {
    const map = parseAuditAnswers(mockAnswersJson);
    expect(map.size).toBe(2);
    expect(map.has('ASM_SRT_01')).toBe(true);
    expect(map.get('ASM_SRT_01')?.ai_answer).toBe('YES');
    expect(map.get('ASM_ORD_01')?.ai_answer).toBe('PARTIAL');
    expect(map.get('ASM_SRT_01')?.confidence).toBe(0.95);
  });

  it('correctly handles code fences', () => {
    const wrapped = '```json\n' + mockAnswersJson + '\n```';
    const map = parseAuditAnswers(wrapped);
    expect(map.size).toBe(2);
  });

  it('bounds confidence between 0.0 and 1.0', () => {
    const raw = `[
      { "question_id": "Q1", "answer": "YES", "confidence": 1.5 },
      { "question_id": "Q2", "answer": "NO", "confidence": -0.2 }
    ]`;
    const map = parseAuditAnswers(raw);
    expect(map.get('Q1')?.confidence).toBe(1.0);
    expect(map.get('Q2')?.confidence).toBe(0.0);
  });

  it('handles invalid answer values by falling back to NOT_VISIBLE', () => {
    const raw = `[
      { "question_id": "Q1", "answer": "TOTALLY_COMPLIANT" }
    ]`;
    const map = parseAuditAnswers(raw);
    expect(map.get('Q1')?.ai_answer).toBe('NOT_VISIBLE');
  });

  it('ignores items with missing question_id', () => {
    const raw = `[
      { "answer": "YES" }
    ]`;
    const map = parseAuditAnswers(raw);
    expect(map.size).toBe(0);
  });

  it('safely handles non-JSON and malformed inputs', () => {
    const map = parseAuditAnswers('Not JSON text');
    expect(map.size).toBe(0);
  });
});
