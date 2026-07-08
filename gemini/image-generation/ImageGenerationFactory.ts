/**
 * supabase/functions/analyze-5s/image-generation/ImageGenerationFactory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Factory that selects the image generation provider from environment config.
 * Switching providers = change PROVIDER_IMAGE_GEN env var only.
 */

import type { ImageGenerationProvider } from './types.ts';
import { OpenAIImageProvider }  from './providers/OpenAIImageProvider.ts';
import { GeminiImageProvider }  from './providers/GeminiImageProvider.ts';

export type ImageGenProviderName = 'openai' | 'gemini';

export class ImageGenerationFactory {
  static create(
    provider: string,
    openaiApiKey?: string,
    geminiApiKey?: string,
  ): ImageGenerationProvider {
    const name = (provider ?? 'openai').toLowerCase() as ImageGenProviderName;

    switch (name) {
      case 'openai': {
        if (!openaiApiKey) throw new Error('OPENAI_API_KEY is required for provider=openai');
        return new OpenAIImageProvider(openaiApiKey);
      }
      case 'gemini': {
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is required for provider=gemini');
        return new GeminiImageProvider(geminiApiKey);
      }
      default:
        throw new Error(`Unknown image generation provider: "${provider}". Valid: openai | gemini`);
    }
  }
}
