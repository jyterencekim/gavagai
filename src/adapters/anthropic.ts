/**
 * Anthropic Claude adapter
 * Based on README Section 6
 */

import type { IModelAdapter } from './index.js';
import type { ModelSpec } from '../types/index.js';
import { GavagaiException, ErrorCode } from '../types/index.js';

/**
 * Adapter for Anthropic Claude models
 */
export class AnthropicAdapter implements IModelAdapter {
  readonly providerId = 'anthropic';

  private client: unknown;

  constructor(apiKey?: string) {
    // Dynamically import to handle optional peer dependency
    this.initClient(apiKey);
  }

  private async initClient(apiKey?: string): Promise<void> {
    try {
      const Anthropic = await import('@anthropic-ai/sdk').then((m) => m.default);
      this.client = new Anthropic({
        apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
      });
    } catch {
      // Client will be initialized lazily on first use
    }
  }

  private async getClient(): Promise<unknown> {
    if (!this.client) {
      try {
        const Anthropic = await import('@anthropic-ai/sdk').then((m) => m.default);
        this.client = new Anthropic({
          apiKey: process.env['ANTHROPIC_API_KEY'],
        });
      } catch (error) {
        throw new GavagaiException(
          ErrorCode.VALIDATION_FAILED,
          'Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk',
          { originalError: String(error) }
        );
      }
    }
    return this.client;
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    spec: ModelSpec
  ): Promise<string> {
    const client = (await this.getClient()) as {
      messages: {
        create: (params: unknown) => Promise<{
          content: Array<{ type: string; text?: string }>;
        }>;
      };
    };

    try {
      const response = await client.messages.create({
        model: spec.model,
        max_tokens: (spec.params?.['max_tokens'] as number) ?? 4096,
        temperature: (spec.params?.['temperature'] as number) ?? 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text' || !content.text) {
        throw new GavagaiException(
          ErrorCode.UNPARSEABLE,
          'Unexpected response format from Anthropic API',
          { response }
        );
      }

      return content.text;
    } catch (error) {
      if (error instanceof GavagaiException) {
        throw error;
      }

      const err = error as { status?: number; message?: string };
      if (err.status === 429) {
        throw new GavagaiException(
          ErrorCode.VALIDATION_FAILED,
          'Rate limited by Anthropic API',
          { status: err.status }
        );
      }

      throw new GavagaiException(
        ErrorCode.VALIDATION_FAILED,
        `Anthropic API error: ${err.message ?? 'Unknown error'}`,
        { originalError: String(error) }
      );
    }
  }
}
