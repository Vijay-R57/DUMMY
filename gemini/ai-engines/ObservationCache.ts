/**
 * supabase/functions/analyze-5s/ai/ObservationCache.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured Observation Knowledge Model (Phase 2A.1).
 *
 * Each observation is a rich typed entity — not just a free-form text record.
 * The Rule Engine and Consistency Validator consume typed fields directly,
 * reducing re-interpretation of natural language and improving determinism.
 */

export type ObservationStatus =
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'PARTIAL'
  | 'NOT_VISIBLE'
  | 'NOT_APPLICABLE';

export type CleanlinessRating =
  | 'CLEAN'
  | 'DIRTY'
  | 'PARTIAL'
  | 'NOT_VISIBLE';

export interface StructuredObservation {
  // ── Core fields (Phase 2A) ──────────────────────────────────────────────────
  category:  string;           // e.g. 'Clutter', 'Labels', 'Cleanliness'
  finding:   string;           // What was observed (short summary)
  status:    ObservationStatus;
  evidence:  string;           // Concrete detail justifying the status
  location?: string;           // e.g. 'Left side near machine 2'

  // ── Typed knowledge fields (Phase 2A.1) ─────────────────────────────────────
  detected_objects:   string[];          // Physically seen items e.g. ["hammer", "shadow board"]
  safety_equipment:   string[];          // PPE, extinguishers, signage, emergency equipment
  hazards:            string[];          // Free-text hazard descriptions e.g. ["oil spill", "exposed wire"]
  obstructions:       string[];          // e.g. ["blocked emergency exit", "pallet in aisle"]
  cleanliness_rating: CleanlinessRating; // Typed cleanliness assessment for this observation
  floor_markings:     boolean | null;    // true=present, false=absent, null=not assessed
  storage_present:    boolean | null;    // true=storage visible, false=absent, null=not assessed
  labels_visible:     boolean | null;    // true=labels present, false=absent, null=not assessed
  confidence:         number;            // 0.0–1.0 AI confidence for this specific observation
}

// ── Safe defaults for optional fields ────────────────────────────────────────

export function defaultObservationFields(): Pick<
  StructuredObservation,
  | 'detected_objects'
  | 'safety_equipment'
  | 'hazards'
  | 'obstructions'
  | 'cleanliness_rating'
  | 'floor_markings'
  | 'storage_present'
  | 'labels_visible'
  | 'confidence'
> {
  return {
    detected_objects:   [],
    safety_equipment:   [],
    hazards:            [],
    obstructions:       [],
    cleanliness_rating: 'NOT_VISIBLE',
    floor_markings:     null,
    storage_present:    null,
    labels_visible:     null,
    confidence:         0.8,
  };
}

// ── Observation Cache ────────────────────────────────────────────────────────

export class ObservationCache {
  private cache: StructuredObservation[] = [];

  constructor(initialObservations: StructuredObservation[] = []) {
    this.cache = initialObservations;
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  public setObservations(observations: StructuredObservation[]): void {
    this.cache = observations;
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  public getObservations(): StructuredObservation[] {
    return this.cache;
  }

  public size(): number {
    return this.cache.length;
  }

  // ── Category queries ──────────────────────────────────────────────────────

  /** Find all observations for a given category (case-insensitive). */
  public getByCategory(category: string): StructuredObservation[] {
    return this.cache.filter(
      (obs) => obs.category.toLowerCase() === category.toLowerCase(),
    );
  }

  /** Alias for backwards compatibility. */
  public findByCategory(category: string): StructuredObservation[] {
    return this.getByCategory(category);
  }

  /** Find all observations with a specific status. */
  public findByStatus(status: ObservationStatus): StructuredObservation[] {
    return this.cache.filter((obs) => obs.status === status);
  }

  // ── Typed knowledge queries ───────────────────────────────────────────────

  /** Returns true if any observation contains a detected hazard. */
  public hasHazards(): boolean {
    return this.cache.some((obs) => obs.hazards.length > 0);
  }

  /** Returns true if any observation records an obstruction. */
  public hasObstructions(): boolean {
    return this.cache.some((obs) => obs.obstructions.length > 0);
  }

  /** Aggregated list of all detected objects across all observations. */
  public getDetectedObjects(): string[] {
    return [...new Set(this.cache.flatMap((obs) => obs.detected_objects))];
  }

  /** Aggregated list of all safety equipment observed. */
  public getSafetyEquipment(): string[] {
    return [...new Set(this.cache.flatMap((obs) => obs.safety_equipment))];
  }

  /** Aggregated list of all hazards observed. */
  public getAllHazards(): string[] {
    return [...new Set(this.cache.flatMap((obs) => obs.hazards))];
  }

  /** Aggregated list of all obstructions observed. */
  public getAllObstructions(): string[] {
    return [...new Set(this.cache.flatMap((obs) => obs.obstructions))];
  }

  /**
   * Returns the dominant cleanliness rating across observations for a category.
   * Priority: DIRTY > PARTIAL > CLEAN > NOT_VISIBLE
   */
  public getCleanliness(category?: string): CleanlinessRating {
    const obs = category ? this.getByCategory(category) : this.cache;
    if (obs.some((o) => o.cleanliness_rating === 'DIRTY'))    return 'DIRTY';
    if (obs.some((o) => o.cleanliness_rating === 'PARTIAL'))  return 'PARTIAL';
    if (obs.some((o) => o.cleanliness_rating === 'CLEAN'))    return 'CLEAN';
    return 'NOT_VISIBLE';
  }

  /**
   * Returns true only if floor_markings is explicitly false in any observation.
   * Returns null if no observation assessed floor markings.
   */
  public getFloorMarkings(): boolean | null {
    const assessed = this.cache.filter((o) => o.floor_markings !== null);
    if (assessed.length === 0) return null;
    return assessed.some((o) => o.floor_markings === true)
      ? !assessed.some((o) => o.floor_markings === false)
      : false;
  }

  /**
   * Returns true if labels are visible in any relevant observation,
   * false if any observation explicitly marks them absent, null if unassessed.
   */
  public getLabelsVisible(): boolean | null {
    const assessed = this.cache.filter((o) => o.labels_visible !== null);
    if (assessed.length === 0) return null;
    if (assessed.some((o) => o.labels_visible === false)) return false;
    return assessed.some((o) => o.labels_visible === true) ? true : null;
  }

  /** Returns true if any observation saw storage, false if none, null if unassessed. */
  public getStoragePresent(): boolean | null {
    const assessed = this.cache.filter((o) => o.storage_present !== null);
    if (assessed.length === 0) return null;
    return assessed.some((o) => o.storage_present === true);
  }

  /** Average confidence across all observations in the cache. */
  public averageConfidence(): number {
    if (this.cache.length === 0) return 1.0;
    const sum = this.cache.reduce((s, o) => s + o.confidence, 0);
    return Math.round((sum / this.cache.length) * 1000) / 1000;
  }

  /** Count of NON_COMPLIANT observations. */
  public nonCompliantCount(): number {
    return this.cache.filter((o) => o.status === 'NON_COMPLIANT').length;
  }

  /** Count of observations in a given status. */
  public countByStatus(status: ObservationStatus): number {
    return this.cache.filter((o) => o.status === status).length;
  }
}
