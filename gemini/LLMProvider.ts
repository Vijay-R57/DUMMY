/**
 * supabase/functions/analyze-5s/audit-engine/LLMProvider.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Provider-agnostic AI interface (Phase 4).
 *
 * Phase 4: When imageBase64 is empty (''), the Gemini call omits inline_data
 * entirely, producing a text-only request (used for Stage B pillar evaluators).
 *
 * AuditEngine never calls Gemini (or any other AI API) directly.
 * All AI calls are routed through LLMProvider.complete().
 *
 * Adding a new provider (OpenAI, Azure) requires only:
 *  1. Adding the new provider type to LLMProviderType in types.ts
 *  2. Implementing the private _callNewProvider() method here
 *  3. Adding the routing case in complete()
 *
 * Design invariants:
 *  - Zero prompt content (prompt is always in LLMRequest.systemPrompt)
 *  - Zero pillar logic
 *  - Zero zone logic
 *  - Zero business logic
 */

import type {
  LLMProviderConfig,
  LLMRequest,
  LLMResponse,
} from '../backend/supabase/functions/analyze-5s/audit-engine/types.ts';

export class LLMProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  /**
   * Execute a single AI request and return the raw text response.
   * Routes to the correct provider implementation based on config.provider.
   *
   * @throws Error if the provider API returns a non-2xx status
   */
  public async complete(request: LLMRequest): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'gemini':
        return this._callGeminiVision(request);
      default:
        throw new Error(`[LLMProvider] Unsupported provider: ${this.config.provider}`);
    }
  }

  // ── Gemini Vision ────────────────────────────────────────────────────────────

  private async _callGeminiVision(request: LLMRequest): Promise<LLMResponse> {
    const { apiKey, model } = this.config;

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Build parts array — omit image part for Stage B text-only calls
    const parts: unknown[] = [{ text: request.systemPrompt }];

    if (request.imageBase64 && request.imageBase64.length > 0) {
      // Stage A: vision call — extract base64 payload and MIME type
      const base64Data = request.imageBase64.includes(',')
        ? request.imageBase64.split(',')[1]
        : request.imageBase64;
      const mimeType = request.imageBase64.startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg';
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }
    // Stage B: imageBase64 is '' — parts contains only the text prompt

    const body = JSON.stringify({
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature:      request.temperature,
        responseMimeType: 'application/json',
      },
    });

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `[LLMProvider] Gemini API error ${response.status}: ${errText}`,
      );
    }

    const data     = await response.json();
    const rawText  = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokensIn = data?.usageMetadata?.promptTokenCount   ?? null;
    const tokensOut= data?.usageMetadata?.candidatesTokenCount ?? null;
    const tokensUsed = (tokensIn !== null && tokensOut !== null)
      ? (tokensIn as number) + (tokensOut as number)
      : null;

    return {
      rawText,
      model,
      tokensUsed,
    };
  }

  // ── Future providers ─────────────────────────────────────────────────────────
  // private async _callOpenAI(request: LLMRequest): Promise<LLMResponse> { ... }
  // private async _callAzureOpenAI(request: LLMRequest): Promise<LLMResponse> { ... }
}
