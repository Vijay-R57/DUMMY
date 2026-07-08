/**
 * supabase/functions/analyze-5s/audit-engine/AuditValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Response validation and normalization layer (Phase 3B).
 *
 * Receives raw LLM text output and returns a fully-typed, validated
 * QuestionResult[] that is always safe to consume downstream.
 *
 * Rules:
 *  1. Response must be parseable JSON array — otherwise all questions
 *     are padded with NOT_VISIBLE fallback entries.
 *  2. Array must contain exactly N entries (N = config.questions.length).
 *     Missing entries are padded with NOT_VISIBLE fallbacks.
 *  3. Each entry must have questionId, rating, evidence, assessment.
 *  4. Rating must be in VALID_RATINGS — else normalized to NOT_VISIBLE.
 *  5. Evidence must be a non-empty string — else replaced with fallback.
 *  6. Assessment must be non-empty — else replaced with fallback.
 *  7. Confidence is optional — defaults to 'N/A' if absent.
 *  8. score is always calculated from RATING_TO_SCORE — AI value ignored.
 *  9. improvementHint is always null (Phase 3G reserved field).
 *
 * Design invariants:
 *  - Never throws — always returns a full-length array
 *  - Zero prompt content
 *  - Zero zone names
 *  - Zero pillar-specific logic
 *  - AI score field is always ignored — backend calculates from rating
 */

import type { PillarConfig, QuestionResult, AuditRating } from './types.ts';
import { VALID_RATINGS, RATING_TO_SCORE } from './types.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const FALLBACK_EVIDENCE   = 'No visible evidence recorded. Evidence was absent or insufficient.';
const FALLBACK_ASSESSMENT = 'Insufficient visible information to provide an assessment.';
const FALLBACK_CONFIDENCE = 'N/A';

// ── Validation result ──────────────────────────────────────────────────────────

export interface ValidationResult {
  questions:    QuestionResult[];
  corrections:  number;  // Total number of fields normalized
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Validate and normalize raw LLM output against the pillar config.
 *
 * Never throws. Always returns exactly config.questions.length entries.
 * Each correction (rating normalization, evidence replacement, etc.)
 * increments the corrections counter.
 */
export class AuditValidator {
  static validate(rawText: string, config: PillarConfig): ValidationResult {
    const corrections = { count: 0 };
    const expectedIds = config.questions.map((q) => q.questionId);

    // ── Step 1: Parse JSON ─────────────────────────────────────────────────────
    let parsed: unknown[];
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const candidate = JSON.parse(cleaned);
      if (!Array.isArray(candidate)) throw new Error('Not an array');
      parsed = candidate;
    } catch {
      corrections.count += config.questions.length;
      return {
        questions: buildAllFallbacks(config),
        corrections: corrections.count,
      };
    }

    // ── Step 2: Build a lookup map from parsed entries ─────────────────────────
    const parsedMap = new Map<string, Record<string, unknown>>();
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const entry = item as Record<string, unknown>;
        const id    = String(entry.questionId ?? entry.question_id ?? '').trim();
        if (id) parsedMap.set(id, entry);
      }
    }

    // ── Step 3: Validate each expected question in config order ────────────────
    const questions: QuestionResult[] = expectedIds.map((qid, idx) => {
      const configQuestion = config.questions[idx];
      const raw            = parsedMap.get(qid);

      if (!raw) {
        // Question entirely missing from AI response
        corrections.count++;
        return buildFallbackEntry(configQuestion.questionId, configQuestion.question, config.benchmarkScore);
      }

      return normalizeEntry(raw, configQuestion.questionId, configQuestion.question, config.benchmarkScore, corrections);
    });

    return { questions, corrections: corrections.count };
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function normalizeEntry(
  raw:            Record<string, unknown>,
  questionId:     string,
  questionText:   string,
  benchmarkScore: number,
  corrections:    { count: number },
): QuestionResult {
  // Rating
  const rawRating = String(raw.rating ?? '').trim();
  let rating: AuditRating;
  if ((VALID_RATINGS as readonly string[]).includes(rawRating)) {
    rating = rawRating as AuditRating;
  } else {
    rating = 'NOT_VISIBLE';
    corrections.count++;
  }

  // Score — always computed from rating, AI value ignored
  const score = RATING_TO_SCORE[rating];

  // Evidence
  const rawEvidence = String(raw.evidence ?? '').trim();
  const evidence    = rawEvidence.length > 0 ? rawEvidence : (corrections.count++, FALLBACK_EVIDENCE);

  // Assessment — truncated to single sentence at first period + space if multiple
  const rawAssessment = String(raw.assessment ?? '').trim();
  let assessment: string;
  if (rawAssessment.length === 0) {
    assessment = FALLBACK_ASSESSMENT;
    corrections.count++;
  } else {
    // Ensure single sentence (truncate at second sentence boundary)
    assessment = toSingleSentence(rawAssessment);
  }

  // Confidence — optional, debug-only
  const rawConfidence = String(raw.confidence ?? '').trim();
  const confidence    = rawConfidence.length > 0 ? rawConfidence : FALLBACK_CONFIDENCE;

  return {
    questionId,
    question:        questionText,
    rating,
    score,
    benchmarkScore,
    evidence,
    assessment,
    confidence,
    improvementHint: null,
  };
}

function buildFallbackEntry(
  questionId:     string,
  questionText:   string,
  benchmarkScore: number,
): QuestionResult {
  return {
    questionId,
    question:        questionText,
    rating:          'NOT_VISIBLE',
    score:           RATING_TO_SCORE['NOT_VISIBLE'],
    benchmarkScore,
    evidence:        FALLBACK_EVIDENCE,
    assessment:      FALLBACK_ASSESSMENT,
    confidence:      FALLBACK_CONFIDENCE,
    improvementHint: null,
  };
}

function buildAllFallbacks(config: PillarConfig): QuestionResult[] {
  return config.questions.map((q) =>
    buildFallbackEntry(q.questionId, q.question, config.benchmarkScore),
  );
}

/**
 * Truncates a multi-sentence string to the first complete sentence.
 * Preserves the full string if it naturally contains only one sentence.
 */
function toSingleSentence(text: string): string {
  // Match end of first sentence: period / exclamation / question mark followed by space or end
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : text.trim();
}

// ── Reflection correction detection ───────────────────────────────────────────

/**
 * Detects how many ratings changed between raw LLM output and final
 * validated output. Used by AuditEngine to record reflectionCorrections
 * in AuditMetrics.
 *
 * "Reflection correction" is defined as a rating that was valid in the
 * raw response but changed during validation (not a parse failure or
 * missing entry — those are validationCorrections).
 */
export function detectReflectionCorrections(
  rawText:        string,
  finalQuestions: QuestionResult[],
): number {
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return 0;

    let count = 0;
    for (const final of finalQuestions) {
      const rawEntry = parsed.find(
        (p) => String(p.questionId ?? p.question_id ?? '').trim() === final.questionId,
      );
      if (!rawEntry) continue;

      const rawRating = String(rawEntry.rating ?? '').trim();
      // Count only cases where the raw rating was valid but changed during validation
      if (
        (VALID_RATINGS as readonly string[]).includes(rawRating) &&
        rawRating !== final.rating
      ) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}
