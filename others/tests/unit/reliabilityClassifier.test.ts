/**
 * src/test/unit/reliabilityClassifier.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for ReliabilityClassifier.
 * Tests all threshold boundaries, penalty deductions, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyReliability,
  reliabilityColor,
  shouldShowReliabilityWarning,
} from '../../../gemini/ai-engines/ReliabilityClassifier';

// ── EXCELLENT threshold ───────────────────────────────────────────────────────

describe('EXCELLENT reliability', () => {
  it('classifies as EXCELLENT when confidence>=90, not_visible<10, 0 HIGH warnings', () => {
    const result = classifyReliability({
      audit_confidence:          90,
      not_visible_pct:           5,
      high_consistency_warnings: 0,
    });
    expect(result.level).toBe('EXCELLENT');
  });

  it('EXCELLENT includes positive reason when no degradation factors', () => {
    const result = classifyReliability({
      audit_confidence:          95,
      not_visible_pct:           3,
      high_consistency_warnings: 0,
    });
    expect(result.reasons.some((r) => r.includes('confidence') || r.includes('coverage'))).toBe(true);
  });
});

// ── HIGH threshold ────────────────────────────────────────────────────────────

describe('HIGH reliability', () => {
  it('classifies as HIGH at boundary (confidence=85, not_visible=15, 0 warnings)', () => {
    const result = classifyReliability({
      audit_confidence:          85,
      not_visible_pct:           15,
      high_consistency_warnings: 0,
    });
    expect(result.level).toBe('HIGH');
  });

  it('drops from EXCELLENT to HIGH when 1 HIGH warning exists', () => {
    const result = classifyReliability({
      audit_confidence:          92,
      not_visible_pct:           5,
      high_consistency_warnings: 1,
    });
    // Penalty from 1 HIGH warning should prevent EXCELLENT
    expect(['HIGH', 'MEDIUM']).toContain(result.level);
    expect(result.reasons.some((r) => r.includes('consistency') || r.includes('contradiction'))).toBe(true);
  });
});

// ── MEDIUM threshold ──────────────────────────────────────────────────────────

describe('MEDIUM reliability', () => {
  it('classifies as MEDIUM at boundary conditions (confidence=75, not_visible=20, 1 warning)', () => {
    const result = classifyReliability({
      audit_confidence:          75,
      not_visible_pct:           20,
      high_consistency_warnings: 1,
    });
    expect(result.level).toBe('MEDIUM');
  });

  it('reasons include not_visible degradation factor', () => {
    const result = classifyReliability({
      audit_confidence:          70,
      not_visible_pct:           25,
      high_consistency_warnings: 0,
    });
    expect(result.reasons.some((r) => r.includes('NOT_VISIBLE') || r.includes('unanswered'))).toBe(true);
  });
});

// ── LOW threshold ─────────────────────────────────────────────────────────────

describe('LOW reliability', () => {
  it('classifies as LOW at minimum passing conditions', () => {
    const result = classifyReliability({
      audit_confidence:          35,
      not_visible_pct:           40,
      high_consistency_warnings: 4,
    });
    expect(['LOW', 'REJECTED']).toContain(result.level);
  });
});

// ── REJECTED — hard conditions ────────────────────────────────────────────────

describe('REJECTED reliability', () => {
  it('REJECTED when not_visible_pct > 60 (hard threshold)', () => {
    const result = classifyReliability({
      audit_confidence:          85,
      not_visible_pct:           65,
      high_consistency_warnings: 0,
    });
    expect(result.level).toBe('REJECTED');
    expect(result.reasons.some((r) => r.includes('NOT_VISIBLE') || r.includes('60%'))).toBe(true);
  });

  it('REJECTED when audit_confidence < 35', () => {
    const result = classifyReliability({
      audit_confidence:          30,
      not_visible_pct:           10,
      high_consistency_warnings: 0,
    });
    expect(result.level).toBe('REJECTED');
  });

  it('REJECTED has a human-readable label', () => {
    const result = classifyReliability({
      audit_confidence:          20,
      not_visible_pct:           0,
      high_consistency_warnings: 0,
    });
    expect(result.label).toBeTruthy();
    expect(result.label.length).toBeGreaterThan(5);
  });
});

// ── Image quality penalties ───────────────────────────────────────────────────

describe('Image quality penalties', () => {
  it('low brightness reduces reliability score', () => {
    const withGoodBrightness = classifyReliability({
      audit_confidence: 85, not_visible_pct: 5, high_consistency_warnings: 0,
      image_brightness_score: 0.7,
    });
    const withLowBrightness = classifyReliability({
      audit_confidence: 85, not_visible_pct: 5, high_consistency_warnings: 0,
      image_brightness_score: 0.1,
    });
    expect(withLowBrightness.score).toBeLessThan(withGoodBrightness.score);
    expect(withLowBrightness.reasons.some((r) => r.includes('brightness'))).toBe(true);
  });

  it('low contrast reduces reliability score', () => {
    const withGoodContrast = classifyReliability({
      audit_confidence: 85, not_visible_pct: 5, high_consistency_warnings: 0,
      image_contrast_score: 0.5,
    });
    const withLowContrast = classifyReliability({
      audit_confidence: 85, not_visible_pct: 5, high_consistency_warnings: 0,
      image_contrast_score: 0.05,
    });
    expect(withLowContrast.score).toBeLessThan(withGoodContrast.score);
    expect(withLowContrast.reasons.some((r) => r.includes('contrast'))).toBe(true);
  });
});

// ── Score field ────────────────────────────────────────────────────────────────

describe('Reliability score field', () => {
  it('reliability score is always between 0 and 100', () => {
    const cases = [
      { audit_confidence: 100, not_visible_pct: 0,  high_consistency_warnings: 0 },
      { audit_confidence: 50,  not_visible_pct: 30, high_consistency_warnings: 3 },
      { audit_confidence: 10,  not_visible_pct: 80, high_consistency_warnings: 5 },
    ];
    cases.forEach((input) => {
      const { score } = classifyReliability(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ── Display helpers ───────────────────────────────────────────────────────────

describe('Display helpers', () => {
  it('reliabilityColor returns a hex colour for each level', () => {
    const levels = ['EXCELLENT', 'HIGH', 'MEDIUM', 'LOW', 'REJECTED'] as const;
    levels.forEach((level) => {
      const color = reliabilityColor(level);
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('shouldShowReliabilityWarning returns true for LOW and REJECTED only', () => {
    expect(shouldShowReliabilityWarning('LOW')).toBe(true);
    expect(shouldShowReliabilityWarning('REJECTED')).toBe(true);
    expect(shouldShowReliabilityWarning('EXCELLENT')).toBe(false);
    expect(shouldShowReliabilityWarning('HIGH')).toBe(false);
    expect(shouldShowReliabilityWarning('MEDIUM')).toBe(false);
  });
});
