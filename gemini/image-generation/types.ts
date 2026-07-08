/**
 * supabase/functions/analyze-5s/image-generation/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Provider-independent image generation interface (Refinement #10).
 * Switching providers = 1 env var change, zero code changes.
 */

export interface ImageGenOptions {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageGenResult {
  imageBase64: string;       // base64-encoded image data
  imageUrl?: string;         // CDN URL if provider returns one directly
  provider: string;          // e.g. 'openai' | 'gemini' | 'stability'
  model: string;             // e.g. 'dall-e-3' | 'imagen-3'
  revised_prompt?: string;   // provider may return a revised/expanded prompt
}

/**
 * Every image generation provider must implement this interface.
 * The orchestrator only ever depends on this abstraction.
 */
export interface ImageGenerationProvider {
  generateImage(options: ImageGenOptions): Promise<ImageGenResult>;
}
