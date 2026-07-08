/**
 * supabase/functions/analyze-5s/image-generation/providers/GeminiImageProvider.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Gemini Imagen 3 image generation provider.
 */

import type { ImageGenerationProvider, ImageGenOptions, ImageGenResult } from '../types.ts';

export class GeminiImageProvider implements ImageGenerationProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: options.prompt }],
        parameters: {
          sampleCount:       1,
          aspectRatio:       '1:1',
          safetyFilterLevel: 'block_few',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Imagen generation failed: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const prediction = data?.predictions?.[0];

    if (!prediction?.bytesBase64Encoded) {
      throw new Error('Gemini Imagen returned no image data');
    }

    return {
      imageBase64: prediction.bytesBase64Encoded,
      provider:    'gemini',
      model:       'imagen-3.0-generate-001',
    };
  }
}
