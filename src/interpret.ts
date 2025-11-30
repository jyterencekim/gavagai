/**
 * Core interpret function
 * Based on README Section 4 and Section 8
 */

import { buildPrompt } from './prompt.js';
import { parseResponse } from './validate.js';
import { getAdapter, hasAdapter } from './adapters/index.js';
import type {
  GavagaiInput,
  GavagaiResponse,
  Ontology,
  ModelSpec,
  InterpretOptions,
} from './types/index.js';
import { GavagaiException, ErrorCode } from './types/index.js';

/**
 * Logger interface for debug output
 */
export interface Logger {
  debug: (message: string, data?: unknown) => void;
}

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  debug: (message: string, data?: unknown) => {
    console.log(`[gavagai] ${message}`);
    if (data !== undefined) {
      console.log(JSON.stringify(data, null, 2));
    }
  },
};

/**
 * Extended options including debug settings
 */
export interface InterpretOptionsWithDebug extends InterpretOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger (defaults to console) */
  logger?: Logger;
}

/**
 * Extract JSON from a potentially messy LLM response
 * Handles markdown code blocks and leading/trailing text
 */
function extractJson(raw: string): string {
  // Try to find JSON in markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    return jsonMatch[0];
  }

  // Return as-is, let JSON.parse handle it
  return raw.trim();
}

/**
 * Interpret an utterance or batch using an LLM
 *
 * @param input - The utterance or batch to interpret
 * @param ontology - User-supplied configuration (schema, verbs, nouns)
 * @param model - LLM provider specification
 * @param opts - Optional parameters (few-shot examples, current date)
 * @returns Structured GavagaiResponse with intention propositions
 *
 * @example
 * ```typescript
 * const response = await interpret(
 *   { kind: 'Utterance', source: 'bank', raw: 'STARBUCKS 12.50' },
 *   ontology,
 *   { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
 * );
 * ```
 */
export async function interpret(
  input: GavagaiInput,
  ontology: Ontology,
  model: ModelSpec,
  opts?: InterpretOptionsWithDebug
): Promise<GavagaiResponse> {
  const log = opts?.debug ? (opts.logger ?? defaultLogger) : null;

  // 1. Get the adapter for the provider
  if (!hasAdapter(model.provider)) {
    throw new GavagaiException(
      ErrorCode.VALIDATION_FAILED,
      `No adapter registered for provider: ${model.provider}. ` +
        `Call registerAdapter() with an adapter for this provider.`,
      { provider: model.provider }
    );
  }

  const adapter = getAdapter(model.provider)!;

  // 2. Build the prompt
  const { system, user } = buildPrompt(
    input,
    ontology,
    opts?.currentDate,
    opts?.fewShot,
    opts?.knowledgeBase
  );

  log?.debug('Built prompt', { systemLength: system.length, user });

  // 3. Call the LLM
  let rawResponse: string;
  try {
    log?.debug(`Calling ${model.provider} / ${model.model}...`);
    rawResponse = await adapter.complete(system, user, model);
    log?.debug('Raw LLM response:', rawResponse);
  } catch (error) {
    if (error instanceof GavagaiException) {
      throw error;
    }
    throw new GavagaiException(
      ErrorCode.VALIDATION_FAILED,
      `LLM invocation failed: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: String(error) }
    );
  }

  // 4. Extract and parse JSON
  let response: GavagaiResponse;
  try {
    const json = extractJson(rawResponse);
    log?.debug('Extracted JSON:', json);
    response = parseResponse(json);
  } catch (error) {
    throw new GavagaiException(
      ErrorCode.UNPARSEABLE,
      `Failed to parse LLM response as valid GavagaiResponse: ${error instanceof Error ? error.message : String(error)}`,
      { rawResponse }
    );
  }

  log?.debug('Parsed GavagaiResponse:', response);

  return response;
}
