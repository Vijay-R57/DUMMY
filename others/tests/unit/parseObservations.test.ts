/**
 * src/test/unit/parseObservations.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for StructuredObservation parsing and ObservationCache typed queries.
 * No AI calls — all pure TypeScript logic.
 */

import { describe, it, expect } from 'vitest';
import { ObservationCache, defaultObservationFields } from '../../../gemini/ai-engines/ObservationCache';
import type { StructuredObservation } from '../../../gemini/ai-engines/ObservationCache';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeObs(overrides: Partial<StructuredObservation> = {}): StructuredObservation {
  return {
    category:           'Cleanliness',
    finding:            'Test finding',
    status:             'COMPLIANT',
    evidence:           'Test evidence',
    location:           'top-left',
    ...defaultObservationFields(),
    ...overrides,
  };
}

// ── defaultObservationFields ──────────────────────────────────────────────────

describe('defaultObservationFields', () => {
  it('returns safe defaults for all typed fields', () => {
    const defaults = defaultObservationFields();
    expect(defaults.detected_objects).toEqual([]);
    expect(defaults.safety_equipment).toEqual([]);
    expect(defaults.hazards).toEqual([]);
    expect(defaults.obstructions).toEqual([]);
    expect(defaults.cleanliness_rating).toBe('NOT_VISIBLE');
    expect(defaults.floor_markings).toBeNull();
    expect(defaults.storage_present).toBeNull();
    expect(defaults.labels_visible).toBeNull();
    expect(defaults.confidence).toBe(0.8);
  });
});

// ── ObservationCache construction ─────────────────────────────────────────────

describe('ObservationCache — construction', () => {
  it('initialises empty with no arguments', () => {
    const cache = new ObservationCache();
    expect(cache.size()).toBe(0);
    expect(cache.getObservations()).toEqual([]);
  });

  it('stores initial observations', () => {
    const obs = [makeObs(), makeObs({ category: 'Labels' })];
    const cache = new ObservationCache(obs);
    expect(cache.size()).toBe(2);
  });

  it('setObservations replaces all observations', () => {
    const cache = new ObservationCache([makeObs()]);
    cache.setObservations([makeObs({ category: 'Dust' }), makeObs({ category: 'Waste' })]);
    expect(cache.size()).toBe(2);
    expect(cache.getByCategory('Cleanliness')).toHaveLength(0);
    expect(cache.getByCategory('Dust')).toHaveLength(1);
  });
});

// ── Category queries ──────────────────────────────────────────────────────────

describe('ObservationCache — category queries', () => {
  it('getByCategory filters case-insensitively', () => {
    const cache = new ObservationCache([
      makeObs({ category: 'Cleanliness' }),
      makeObs({ category: 'Labels' }),
      makeObs({ category: 'cleanliness' }),
    ]);
    expect(cache.getByCategory('Cleanliness')).toHaveLength(2);
    expect(cache.getByCategory('LABELS')).toHaveLength(1);
  });

  it('findByCategory is an alias for getByCategory', () => {
    const cache = new ObservationCache([makeObs({ category: 'Dust' })]);
    expect(cache.findByCategory('Dust')).toHaveLength(1);
  });

  it('findByStatus returns matching observations only', () => {
    const cache = new ObservationCache([
      makeObs({ status: 'COMPLIANT' }),
      makeObs({ status: 'NON_COMPLIANT' }),
      makeObs({ status: 'COMPLIANT' }),
    ]);
    expect(cache.findByStatus('COMPLIANT')).toHaveLength(2);
    expect(cache.findByStatus('NON_COMPLIANT')).toHaveLength(1);
    expect(cache.findByStatus('NOT_VISIBLE')).toHaveLength(0);
  });
});

// ── Knowledge queries ─────────────────────────────────────────────────────────

describe('ObservationCache — typed knowledge queries', () => {
  it('hasHazards returns true when any observation has hazards', () => {
    const cache = new ObservationCache([
      makeObs({ hazards: [] }),
      makeObs({ hazards: ['oil spill'] }),
    ]);
    expect(cache.hasHazards()).toBe(true);
  });

  it('hasHazards returns false when all hazard arrays are empty', () => {
    const cache = new ObservationCache([makeObs({ hazards: [] }), makeObs({ hazards: [] })]);
    expect(cache.hasHazards()).toBe(false);
  });

  it('hasObstructions returns true when any obstruction present', () => {
    const cache = new ObservationCache([makeObs({ obstructions: ['blocked exit'] })]);
    expect(cache.hasObstructions()).toBe(true);
  });

  it('getDetectedObjects deduplicates and flattens', () => {
    const cache = new ObservationCache([
      makeObs({ detected_objects: ['hammer', 'pallet'] }),
      makeObs({ detected_objects: ['pallet', 'barrel'] }),
    ]);
    const objs = cache.getDetectedObjects();
    expect(objs).toContain('hammer');
    expect(objs).toContain('pallet');
    expect(objs).toContain('barrel');
    expect(objs.filter((o) => o === 'pallet')).toHaveLength(1); // deduplicated
  });

  it('getSafetyEquipment aggregates all observations', () => {
    const cache = new ObservationCache([
      makeObs({ safety_equipment: ['fire extinguisher'] }),
      makeObs({ safety_equipment: ['safety goggles'] }),
    ]);
    expect(cache.getSafetyEquipment()).toContain('fire extinguisher');
    expect(cache.getSafetyEquipment()).toContain('safety goggles');
  });

  it('getCleanliness returns DIRTY when any observation is DIRTY', () => {
    const cache = new ObservationCache([
      makeObs({ cleanliness_rating: 'CLEAN' }),
      makeObs({ cleanliness_rating: 'DIRTY' }),
    ]);
    expect(cache.getCleanliness()).toBe('DIRTY');
  });

  it('getCleanliness returns CLEAN when all are CLEAN', () => {
    const cache = new ObservationCache([
      makeObs({ cleanliness_rating: 'CLEAN' }),
      makeObs({ cleanliness_rating: 'CLEAN' }),
    ]);
    expect(cache.getCleanliness()).toBe('CLEAN');
  });

  it('getFloorMarkings returns null when no assessments', () => {
    const cache = new ObservationCache([makeObs({ floor_markings: null })]);
    expect(cache.getFloorMarkings()).toBeNull();
  });

  it('getFloorMarkings returns false when any observation marks them absent', () => {
    const cache = new ObservationCache([
      makeObs({ floor_markings: true }),
      makeObs({ floor_markings: false }),
    ]);
    expect(cache.getFloorMarkings()).toBe(false);
  });

  it('getLabelsVisible returns false when any observation marks labels absent', () => {
    const cache = new ObservationCache([
      makeObs({ labels_visible: true }),
      makeObs({ labels_visible: false }),
    ]);
    expect(cache.getLabelsVisible()).toBe(false);
  });

  it('averageConfidence computes correctly', () => {
    const cache = new ObservationCache([
      makeObs({ confidence: 0.9 }),
      makeObs({ confidence: 0.7 }),
    ]);
    expect(cache.averageConfidence()).toBeCloseTo(0.8, 2);
  });

  it('averageConfidence returns 1.0 on empty cache', () => {
    expect(new ObservationCache().averageConfidence()).toBe(1.0);
  });

  it('countByStatus returns correct count', () => {
    const cache = new ObservationCache([
      makeObs({ status: 'NON_COMPLIANT' }),
      makeObs({ status: 'NON_COMPLIANT' }),
      makeObs({ status: 'COMPLIANT' }),
    ]);
    expect(cache.countByStatus('NON_COMPLIANT')).toBe(2);
    expect(cache.countByStatus('COMPLIANT')).toBe(1);
  });
});
