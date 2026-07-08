/**
 * supabase/functions/analyze-5s/audit-engine/EvidenceValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stage A response validator — Phase 4.
 *
 * Receives raw LLM text from EvidenceGenerator and returns a fully-typed,
 * validated AuditEvidenceModel safe for consumption by Stage B evaluators.
 *
 * Validation rules:
 *  1. Response must be parseable JSON — otherwise returns a safe empty model.
 *  2. visibleObjects: each entry must have description, category, observationType.
 *     Invalid category/observationType values are normalized to UNKNOWN/INFERENCE.
 *  3. positiveCompliance: entries with empty observation are dropped.
 *  4. violations: each entry must pass ALL of:
 *       a. observationType === 'DIRECT'
 *       b. evidence is a non-empty specific object reference
 *       c. imageLocation is non-empty
 *       d. evidence does not match banned violation patterns (from EvidencePolicies)
 *     Non-conforming violations are silently dropped.
 *  5. overallConfidence is normalized to HIGH/MEDIUM/LOW; defaults to MEDIUM.
 *
 * Design invariants:
 *  - Never throws — always returns a complete AuditEvidenceModel
 *  - Zero pillar-specific logic
 *  - Zero question text
 *  - Zero score values
 */

import type {
  AuditEvidenceModel,
  WorkspaceContext,
  VisibleObject,
  PositiveObservation,
  ViolationObservation,
  ObjectCategory,
  ObservationType,
  EvidenceConfidence,
  ViolationSeverity,
} from './types.ts';
import { BANNED_VIOLATION_PATTERNS } from './policies/EvidencePolicies.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES:        readonly ObjectCategory[]     = ['A', 'B', 'C', 'D', 'UNKNOWN'];
const VALID_OBS_TYPES:         readonly ObservationType[]    = ['DIRECT', 'INFERENCE', 'UNKNOWN'];
const VALID_CONFIDENCE:        readonly EvidenceConfidence[] = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_SEVERITY:          readonly ViolationSeverity[]  = ['MINOR', 'MODERATE', 'MAJOR'];

// ── Validation result ──────────────────────────────────────────────────────────

export interface EvidenceValidationResult {
  model:        AuditEvidenceModel;
  parseFailure: boolean;
  droppedViolations: number;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export class EvidenceValidator {

  /**
   * Validates raw Stage A LLM output and returns a safe AuditEvidenceModel.
   * Never throws. On parse failure, returns a safe empty model.
   */
  static validate(
    rawText: string,
    context: WorkspaceContext,
  ): EvidenceValidationResult {

    // ── 1. Parse JSON ──────────────────────────────────────────────────────────
    let parsed: Record<string, unknown>;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const candidate = JSON.parse(cleaned);
      if (typeof candidate !== 'object' || Array.isArray(candidate) || candidate === null) {
        throw new Error('Not a JSON object');
      }
      parsed = candidate as Record<string, unknown>;
    } catch {
      return {
        model:             buildEmptyModel(context),
        parseFailure:      true,
        droppedViolations: 0,
      };
    }

    // ── 2. Normalize visibleObjects ────────────────────────────────────────────
    const visibleObjects = normalizeVisibleObjects(parsed.visibleObjects);

    // ── 3. Normalize positiveCompliance ───────────────────────────────────────
    const positiveCompliance = normalizePositiveCompliance(parsed.positiveCompliance);

    // ── 4. Normalize and filter violations ────────────────────────────────────
    const { violations, droppedViolations } = normalizeViolations(parsed.violations);

    // ── 5. Normalize confidence ────────────────────────────────────────────────
    const rawConf = String(parsed.overallConfidence ?? '').toUpperCase();
    const overallConfidence: EvidenceConfidence =
      (VALID_CONFIDENCE as readonly string[]).includes(rawConf)
        ? (rawConf as EvidenceConfidence)
        : 'MEDIUM';

    // ── 6. Expected objects ────────────────────────────────────────────────────
    const expectedObjects = Array.isArray(parsed.expectedObjects)
      ? (parsed.expectedObjects as unknown[])
          .map((e) => String(e ?? '').trim())
          .filter(Boolean)
      : [];

    // ── 7. Image notes ────────────────────────────────────────────────────────
    const imageNotes = String(parsed.imageNotes ?? '').trim();

    const model: AuditEvidenceModel = {
      generatedAt:        new Date().toISOString(),
      zone:               context.selected_zone,
      expectedObjects,
      visibleObjects,
      positiveCompliance,
      violations,
      overallConfidence,
      imageNotes,
    };

    return { model, parseFailure: false, droppedViolations };
  }
}

// ── Internal normalization helpers ─────────────────────────────────────────────

function normalizeVisibleObjects(raw: unknown): VisibleObject[] {
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[]).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const entry = item as Record<string, unknown>;

    const description = String(entry.description ?? '').trim();
    if (!description) return [];

    const rawCat = String(entry.category ?? '').toUpperCase() as ObjectCategory;
    const category: ObjectCategory = (VALID_CATEGORIES as readonly string[]).includes(rawCat)
      ? rawCat
      : 'UNKNOWN';

    const rawObs = String(entry.observationType ?? '').toUpperCase() as ObservationType;
    const observationType: ObservationType = (VALID_OBS_TYPES as readonly string[]).includes(rawObs)
      ? rawObs
      : 'UNKNOWN';

    const obj: VisibleObject = {
      description,
      category,
      observationType,
    };

    const qty = String(entry.quantity ?? '').trim();
    if (qty) obj.quantity = qty;

    const loc = String(entry.location ?? '').trim();
    if (loc) obj.location = loc;

    return [obj];
  });
}

function normalizePositiveCompliance(raw: unknown): PositiveObservation[] {
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[]).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const entry = item as Record<string, unknown>;

    const dimension   = String(entry.dimension   ?? '').trim();
    const observation = String(entry.observation ?? '').trim();
    if (!dimension || !observation) return [];

    const rawObs = String(entry.observationType ?? '').toUpperCase();
    const observationType: 'DIRECT' | 'INFERENCE' =
      rawObs === 'DIRECT' ? 'DIRECT' : 'INFERENCE';

    const rawConf = String(entry.confidence ?? '').toUpperCase();
    const confidence: EvidenceConfidence =
      (VALID_CONFIDENCE as readonly string[]).includes(rawConf)
        ? (rawConf as EvidenceConfidence)
        : 'MEDIUM';

    return [{ dimension, observation, observationType, confidence }];
  });
}

function normalizeViolations(raw: unknown): {
  violations: ViolationObservation[];
  droppedViolations: number;
} {
  if (!Array.isArray(raw)) return { violations: [], droppedViolations: 0 };

  let dropped = 0;
  const violations: ViolationObservation[] = [];

  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) { dropped++; continue; }
    const entry = item as Record<string, unknown>;

    const dimension     = String(entry.dimension     ?? '').trim();
    const observation   = String(entry.observation   ?? '').trim();
    const evidence      = String(entry.evidence      ?? '').trim();
    const imageLocation = String(entry.imageLocation ?? '').trim();

    // Rule 1: Must have required fields
    if (!dimension || !observation || !evidence || !imageLocation) {
      dropped++;
      continue;
    }

    // Rule 2: observationType must be DIRECT
    const rawObs = String(entry.observationType ?? '').toUpperCase();
    if (rawObs !== 'DIRECT') {
      dropped++;
      continue;
    }

    // Rule 3: evidence must not contain banned patterns
    if (containsBannedPattern(evidence)) {
      dropped++;
      continue;
    }

    // Rule 4: evidence must not be generic/vague
    if (isGenericEvidence(evidence)) {
      dropped++;
      continue;
    }

    const rawSev = String(entry.severity ?? '').toUpperCase() as ViolationSeverity;
    const severity: ViolationSeverity = (VALID_SEVERITY as readonly string[]).includes(rawSev)
      ? rawSev
      : 'MINOR';

    const rawConf = String(entry.confidence ?? '').toUpperCase();
    const confidence: EvidenceConfidence =
      (VALID_CONFIDENCE as readonly string[]).includes(rawConf)
        ? (rawConf as EvidenceConfidence)
        : 'MEDIUM';

    violations.push({
      dimension,
      observation,
      severity,
      evidence,
      imageLocation,
      observationType: 'DIRECT',
      confidence,
    });
  }

  return { violations, droppedViolations: dropped };
}

// ── Evidence quality checks ────────────────────────────────────────────────────

function containsBannedPattern(evidence: string): boolean {
  const lower = evidence.toLowerCase();
  return BANNED_VIOLATION_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Rejects generic/vague evidence phrases that don't reference specific objects.
 * These are common LLM hallucinations masquerading as evidence.
 */
const GENERIC_EVIDENCE_PATTERNS: readonly string[] = [
  'the area appears',
  'the workplace appears',
  'items appear',
  'generally',
  'in general',
  'overall the',
  'the workspace appears',
  'it appears that',
  'this suggests',
  'evidence suggests',
  'no evidence of',
  'lack of',
  'absence of',
];

function isGenericEvidence(evidence: string): boolean {
  const lower = evidence.toLowerCase();
  // Must be at least 15 characters and not purely generic
  if (evidence.length < 15) return true;
  return GENERIC_EVIDENCE_PATTERNS.some((pattern) => lower.startsWith(pattern));
}

// ── Safe empty model ───────────────────────────────────────────────────────────

function buildEmptyModel(context: WorkspaceContext): AuditEvidenceModel {
  return {
    generatedAt:        new Date().toISOString(),
    zone:               context.selected_zone,
    expectedObjects:    [],
    visibleObjects:     [],
    positiveCompliance: [],
    violations:         [],
    overallConfidence:  'LOW',
    imageNotes:         'Evidence extraction failed — Stage A parse error. All questions will use conservative evaluation.',
  };
}
