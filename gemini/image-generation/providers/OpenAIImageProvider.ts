/**
 * supabase/functions/analyze-5s/image-generation/providers/OpenAIImageProvider.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * OpenAI DALL-E 3 image generation provider.
 */

import type { ImageGenerationProvider, ImageGenOptions, ImageGenResult } from '../types.ts';

export class OpenAIImageProvider implements ImageGenerationProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'dall-e-3',
        prompt:          options.prompt,
        n:               1,
        size:            options.size ?? '1024x1024',
        quality:         options.quality ?? 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI image generation failed: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const imageData = data?.data?.[0];

    if (!imageData?.b64_json) {
      throw new Error('OpenAI returned no image data');
    }

    return {
      imageBase64:    imageData.b64_json,
      provider:       'openai',
      model:          'dall-e-3',
      revised_prompt: imageData.revised_prompt,
    };
  }
}
