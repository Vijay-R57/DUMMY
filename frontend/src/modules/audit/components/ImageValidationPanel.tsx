/**
 * src/modules/audit/components/ImageValidationPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side image quality validation.
 * Runs entirely in-browser via canvas — no API call.
 * Produces an ImageValidationResult with a 0–100 quality score.
 * CRITICAL failures disable the "Start 5S Audit" button.
 * WARNING failures show a caution but allow the audit to proceed.
 */

import { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Loader2, ImageIcon,
} from 'lucide-react';
import type { ImageValidationResult, ImageQualityLevel } from '@/types/analysis';

interface Props {
  /** Base64 image string (may include data URI prefix) */
  imageBase64: string;
  onValidation: (result: ImageValidationResult) => void;
}

// ── Canvas utilities ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function estimateBrightness(img: HTMLImageElement): number {
  const canvas = document.createElement('canvas');
  const SAMPLE = 200;
  canvas.width  = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  return total / (SAMPLE * SAMPLE); // 0–255
}

function estimateSharpness(img: HTMLImageElement): number {
  // Laplacian variance approximation via canvas
  const canvas = document.createElement('canvas');
  const SAMPLE = 200;
  canvas.width  = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const data   = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const gray   = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  let variance = 0;
  for (let y = 1; y < SAMPLE - 1; y++) {
    for (let x = 1; x < SAMPLE - 1; x++) {
      const lap =
        -gray[(y - 1) * SAMPLE + x] -
        gray[(y + 1) * SAMPLE + x] -
        gray[y * SAMPLE + (x - 1)] -
        gray[y * SAMPLE + (x + 1)] +
        4 * gray[y * SAMPLE + x];
      variance += lap * lap;
    }
  }
  return variance / ((SAMPLE - 2) * (SAMPLE - 2));
}

function detectMimeType(base64: string): string {
  if (base64.startsWith('data:image/jpeg')) return 'image/jpeg';
  if (base64.startsWith('data:image/jpg'))  return 'image/jpeg';
  if (base64.startsWith('data:image/png'))  return 'image/png';
  if (base64.startsWith('data:image/webp')) return 'image/webp';
  return 'image/jpeg'; // fallback — most camera captures are JPEG
}

function estimateSizeKb(base64: string): number {
  const b64 = base64.split(',')[1] ?? base64;
  return Math.round((b64.length * 3) / 4 / 1024);
}

function qualityLevelFromScore(score: number): ImageQualityLevel {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

// ── Validation runner ─────────────────────────────────────────────────────────

async function runValidation(imageBase64: string): Promise<ImageValidationResult> {
  const img       = await loadImage(imageBase64);
  const width     = img.naturalWidth;
  const height    = img.naturalHeight;
  const mimeType  = detectMimeType(imageBase64);
  const sizeKb    = estimateSizeKb(imageBase64);
  const brightness = estimateBrightness(img);        // 0–255
  const sharpness  = estimateSharpness(img);          // variance

  // ── Individual checks ────────────────────────────────────────────────────────
  const resolutionPass = width >= 640 && height >= 480;
  const resolutionHD   = width >= 1280 && height >= 720;
  const brightnessNorm = brightness / 255;            // 0–1
  const brightnessPass = brightnessNorm >= 0.12 && brightnessNorm <= 0.90;
  const sharpnessPass  = sharpness >= 50;             // empirical threshold
  const sizeMb         = sizeKb / 1024;
  const sizePass       = sizeMb <= 10;
  const formatPass     = ['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType);

  // ── Point scoring ────────────────────────────────────────────────────────────
  const resolutionPts = resolutionHD ? 25 : resolutionPass ? 15 : 0;
  const brightnessPts = brightnessPass ? 25 : brightnessNorm >= 0.06 ? 12 : 0;
  const sharpnessPts  = sharpnessPass ? 25 : sharpness >= 20 ? 12 : 0;
  const sizePts       = sizeMb <= 5 ? 15 : sizePass ? 8 : 0;
  const formatPts     = formatPass ? 10 : 0;

  const qualityScore = resolutionPts + brightnessPts + sharpnessPts + sizePts + formatPts;

  // ── Failures and warnings ────────────────────────────────────────────────────
  const criticalFailures: string[] = [];
  const warnings: string[]         = [];

  if (!resolutionPass) criticalFailures.push(`Resolution too low (${width}×${height}). Minimum: 640×480.`);
  if (!formatPass)     criticalFailures.push(`Unsupported format: ${mimeType}. Use JPEG or PNG.`);
  if (!sizePass)       criticalFailures.push(`File too large (${sizeMb.toFixed(1)} MB). Maximum: 10 MB.`);

  if (resolutionPass && !resolutionHD) warnings.push('HD resolution (1280×720+) improves audit accuracy.');
  if (!brightnessPass) {
    warnings.push(
      brightnessNorm < 0.12
        ? 'Image is very dark. Use better lighting for accurate results.'
        : 'Image is very bright / overexposed. This may reduce AI accuracy.'
    );
  }
  if (!sharpnessPass) warnings.push('Image appears blurry. Ensure the camera is steady when capturing.');

  return {
    passed: criticalFailures.length === 0,
    qualityScore: Math.min(100, qualityScore),
    qualityLevel: qualityLevelFromScore(qualityScore),
    checks: {
      resolution: {
        pass:   resolutionPass,
        points: resolutionPts,
        detail: `${width} × ${height}${resolutionHD ? ' (HD)' : resolutionPass ? '' : ' — too low'}`,
        width,
        height,
      },
      brightness: {
        pass:   brightnessPass,
        points: brightnessPts,
        detail: brightnessPass ? 'Optimal' : brightnessNorm < 0.12 ? 'Too dark' : 'Overexposed',
        value:  Math.round(brightnessNorm * 100),
      },
      sharpness: {
        pass:   sharpnessPass,
        points: sharpnessPts,
        detail: sharpnessPass ? 'Sharp' : sharpness >= 20 ? 'Moderate' : 'Blurry',
        value:  Math.round(sharpness),
      },
      fileSize: {
        pass:   sizePass,
        points: sizePts,
        detail: `${sizeMb < 1 ? sizeKb + ' KB' : sizeMb.toFixed(1) + ' MB'}`,
        sizeKb,
      },
      format: {
        pass:     formatPass,
        points:   formatPts,
        detail:   mimeType.split('/')[1].toUpperCase(),
        mimeType,
      },
    },
    criticalFailures,
    warnings,
  };
}

// ── Quality level badge config ────────────────────────────────────────────────

const QUALITY_CONFIG: Record<ImageQualityLevel, { text: string; bg: string; border: string }> = {
  Excellent: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Good:      { text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    border: 'border-blue-500/30'    },
  Fair:      { text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  Poor:      { text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImageValidationPanel({ imageBase64, onValidation }: Props) {
  const [result,  setResult]  = useState<ImageValidationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    runValidation(imageBase64)
      .then((r) => {
        setResult(r);
        onValidation(r);
      })
      .catch(() => {
        // On any canvas error, pass with a minimal result so the audit is not blocked
        const fallback: ImageValidationResult = {
          passed: true, qualityScore: 60, qualityLevel: 'Fair',
          checks: {
            resolution: { pass: true, points: 15, detail: 'Unknown', width: 0, height: 0 },
            brightness: { pass: true, points: 25, detail: 'Unknown', value: 50 },
            sharpness:  { pass: true, points: 20, detail: 'Unknown', value: 0 },
            fileSize:   { pass: true, points: 15, detail: 'Unknown', sizeKb: 0 },
            format:     { pass: true, points: 10, detail: 'JPEG',    mimeType: 'image/jpeg' },
          },
          criticalFailures: [],
          warnings: ['Could not fully validate image. Proceeding with caution.'],
        };
        setResult(fallback);
        onValidation(fallback);
      })
      .finally(() => setLoading(false));
  }, [imageBase64]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3 animate-pulse">
        <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Validating image…</p>
          <p className="text-xs text-muted-foreground">Checking resolution, brightness, and sharpness</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const cfg      = QUALITY_CONFIG[result.qualityLevel];
  const barWidth = result.qualityScore;

  const CHECK_ROWS: Array<{ key: keyof typeof result.checks; label: string }> = [
    { key: 'resolution', label: 'Resolution' },
    { key: 'brightness', label: 'Brightness' },
    { key: 'sharpness',  label: 'Sharpness'  },
    { key: 'fileSize',   label: 'File Size'   },
    { key: 'format',     label: 'Format'      },
  ];

  return (
    <div className={`rounded-xl border p-5 space-y-4 animate-fade-in ${
      result.passed ? 'bg-card border-border' : 'bg-destructive/5 border-destructive/30'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {result.passed
            ? <ShieldCheck className="h-5 w-5 text-emerald-500" />
            : <XCircle     className="h-5 w-5 text-destructive" />
          }
          <span className="text-sm font-black text-foreground uppercase tracking-wide">
            Image Quality Validation
          </span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          {result.qualityLevel.toUpperCase()}
        </span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-semibold">Quality Score</span>
          <span className={`font-black tabular-nums ${cfg.text}`}>{result.qualityScore}/100</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              result.qualityLevel === 'Excellent' ? 'bg-emerald-500' :
              result.qualityLevel === 'Good'      ? 'bg-blue-500' :
              result.qualityLevel === 'Fair'      ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Check rows */}
      <div className="space-y-2">
        {CHECK_ROWS.map(({ key, label }) => {
          const check = result.checks[key];
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {check.pass
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <XCircle      className="h-3.5 w-3.5 text-destructive shrink-0"  />
                }
                <span className="font-semibold text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-muted-foreground">{check.detail}</span>
                <span className={`font-mono font-bold w-12 ${check.pass ? 'text-emerald-500' : 'text-destructive'}`}>
                  {check.points}/{
                    key === 'resolution' ? 25 :
                    key === 'brightness' ? 25 :
                    key === 'sharpness'  ? 25 :
                    key === 'fileSize'   ? 15 : 10
                  } pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical failures */}
      {result.criticalFailures.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
          <p className="text-xs font-bold text-destructive uppercase tracking-wide flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Critical Issues — Audit Blocked
          </p>
          {result.criticalFailures.map((f, i) => (
            <p key={i} className="text-xs text-destructive/80 ml-5">{f}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && result.passed && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Advisory — Audit Allowed
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600/80 dark:text-amber-400/80 ml-5">{w}</p>
          ))}
        </div>
      )}

      {/* Pass state */}
      {result.passed && result.criticalFailures.length === 0 && result.warnings.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          <ImageIcon className="h-3.5 w-3.5" />
          Image is ready for 5S Audit.
        </div>
      )}
      {result.passed && result.warnings.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Image has advisory warnings. Audit will proceed with reduced confidence.
        </div>
      )}
    </div>
  );
}
