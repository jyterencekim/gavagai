/**
 * OpenAI adapter
 * Based on README Section 6
 */

import type { IModelAdapter } from './index.js';
import type { ModelSpec } from '../types/index.js';
import { GavagaiException, ErrorCode } from '../types/index.js';

/**
 * Adapter for OpenAI models
 */
export class OpenAIAdapter implements IModelAdapter {
  readonly providerId = 'openai';

  private client: unknown;

  constructor(apiKey?: string) {
    this.initClient(apiKey);
  }

  private async initClient(apiKey?: string): Promise<void> {
    try {
      const OpenAI = await import('openai').then((m) => m.default);
      this.client = new OpenAI({
        apiKey: apiKey ?? process.env['OPENAI_API_KEY'],
      });
    } catch {
      // Client will be initialized lazily on first use
    }
  }

  private async getClient(): Promise<unknown> {
    if (!this.client) {
      try {
        const OpenAI = await import('openai').then((m) => m.default);
        this.client = new OpenAI({
          apiKey: process.env['OPENAI_API_KEY'],
        });
      } catch (error) {
        throw new GavagaiException(
          ErrorCode.VALIDATION_FAILED,
          'OpenAI SDK not installed. Run: npm install openai',
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
      chat: {
        completions: {
          create: (params: unknown) => Promise<{
            choices: Array<{ message?: { content?: string | null } }>;
          }>;
        };
      };
    };

    try {
      const response = await client.chat.completions.create({
        model: spec.model,
        temperature: (spec.params?.['temperature'] as number) ?? 0,
        max_tokens: (spec.params?.['max_tokens'] as number) ?? 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new GavagaiException(
          ErrorCode.UNPARSEABLE,
          'Unexpected response format from OpenAI API',
          { response }
        );
      }

      return content;
    } catch (error) {
      if (error instanceof GavagaiException) {
        throw error;
      }

      const err = error as { status?: number; message?: string };
      if (err.status === 429) {
        throw new GavagaiException(
          ErrorCode.VALIDATION_FAILED,
          'Rate limited by OpenAI API',
          { status: err.status }
        );
      }

      throw new GavagaiException(
        ErrorCode.VALIDATION_FAILED,
        `OpenAI API error: ${err.message ?? 'Unknown error'}`,
        { originalError: String(error) }
      );
    }
  }
}
