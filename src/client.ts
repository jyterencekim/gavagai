/**
 * GavagaiClient - Instance Pattern for Configuration Wrapper
 * Based on README Section 13 - Instance Pattern
 */

import { interpret as interpretFn } from './interpret.js';
import { buildPrompt as buildPromptFn } from './prompt.js';
import { validate as validateFn, shouldAutoExecute as shouldAutoExecuteFn } from './validate.js';
import type {
  GavagaiInput,
  GavagaiResponse,
  Ontology,
  ModelSpec,
  InterpretOptions,
  ValidationResult,
  IntentionProposition,
} from './types/index.js';
import type { InterpretOptionsWithDebug } from './interpret.js';

/**
 * GavagaiClient wraps configuration (ontology, model, default options) to avoid
 * repetition and enable future state management (caching, metrics).
 *
 * @example
 * ```typescript
 * const client = new GavagaiClient(ontology, model, {
 *   currentDate: '2024-01-17',
 *   knowledgeBase: { context: { userLocation: 'SF' } }
 * });
 *
 * // Use with per-call overrides
 * const response = await client.interpret(input, {
 *   debug: true  // Override or add per-call options
 * });
 * ```
 */
export class GavagaiClient {
  /**
   * Create a new GavagaiClient instance
   *
   * @param ontology - User-supplied configuration (schema, verbs, nouns)
   * @param model - LLM provider specification
   * @param defaultOptions - Optional default options for all interpret calls
   */
  constructor(
    private ontology: Ontology,
    private model: ModelSpec,
    private defaultOptions?: InterpretOptions
  ) {}

  /**
   * Interpret an utterance or batch using the configured ontology and model
   *
   * @param input - The utterance or batch to interpret
   * @param opts - Optional per-call options (merged with defaults, per-call overrides default)
   * @returns Structured GavagaiResponse with intention propositions
   *
   * @example
   * ```typescript
   * const response = await client.interpret(
   *   { kind: 'Utterance', source: 'user', raw: 'STARBUCKS 12.50' }
   * );
   * ```
   */
  async interpret(
    input: GavagaiInput,
    opts?: InterpretOptionsWithDebug
  ): Promise<GavagaiResponse> {
    // Merge default options with per-call options
    // Per-call options override defaults
    const mergedOptions: InterpretOptionsWithDebug = {
      ...this.defaultOptions,
      ...opts,
      // Handle nested knowledgeBase merge
      knowledgeBase: opts?.knowledgeBase
        ? {
            context: {
              ...this.defaultOptions?.knowledgeBase?.context,
              ...opts.knowledgeBase.context,
            },
            knowledge: {
              ...this.defaultOptions?.knowledgeBase?.knowledge,
              ...opts.knowledgeBase.knowledge,
            },
          }
        : this.defaultOptions?.knowledgeBase,
    };

    return interpretFn(input, this.ontology, this.model, mergedOptions);
  }

  /**
   * Build the prompt without calling the LLM
   * Useful for debugging, cost estimation, and manual review
   *
   * @param input - The utterance or batch to build prompt for
   * @param opts - Optional per-call options (merged with defaults)
   * @returns Object with system and user prompts
   *
   * @example
   * ```typescript
   * const { system, user } = client.buildPrompt(input);
   * console.log('System prompt:', system.length, 'chars');
   * console.log('User prompt:', user);
   * ```
   */
  buildPrompt(
    input: GavagaiInput,
    opts?: InterpretOptions
  ): { system: string; user: string } {
    // Merge default options with per-call options
    const mergedOptions: InterpretOptions = {
      ...this.defaultOptions,
      ...opts,
      knowledgeBase: opts?.knowledgeBase
        ? {
            context: {
              ...this.defaultOptions?.knowledgeBase?.context,
              ...opts.knowledgeBase.context,
            },
            knowledge: {
              ...this.defaultOptions?.knowledgeBase?.knowledge,
              ...opts.knowledgeBase.knowledge,
            },
          }
        : this.defaultOptions?.knowledgeBase,
    };

    return buildPromptFn(
      input,
      this.ontology,
      mergedOptions.currentDate,
      mergedOptions.fewShot,
      mergedOptions.knowledgeBase
    );
  }

  /**
   * Validate a GavagaiResponse against the client's ontology
   * Convenience wrapper that binds the ontology
   *
   * @param response - The response to validate
   * @returns ValidationResult with schema and constraint errors
   *
   * @example
   * ```typescript
   * const validation = client.validate(response);
   * if (!validation.valid) {
   *   console.error('Validation errors:', validation.schemaErrors, validation.constraintErrors);
   * }
   * ```
   */
  validate(response: GavagaiResponse): ValidationResult {
    return validateFn(response, this.ontology);
  }

  /**
   * Determine if a proposition can be auto-executed
   * Based on needs_review flag and presence of ambiguities
   *
   * @param prop - The intention proposition to check
   * @returns True if safe to auto-execute, false if needs human review
   *
   * @example
   * ```typescript
   * for (const prop of response.propositions) {
   *   if (client.shouldAutoExecute(prop)) {
   *     await executeProposition(prop);
   *   } else {
   *     await queueForReview(prop);
   *   }
   * }
   * ```
   */
  shouldAutoExecute(prop: IntentionProposition): boolean {
    return shouldAutoExecuteFn(prop);
  }

  /**
   * Get the client's ontology
   * Useful for introspection or building custom validators
   */
  getOntology(): Ontology {
    return this.ontology;
  }

  /**
   * Get the client's model specification
   * Useful for logging or debugging
   */
  getModel(): ModelSpec {
    return this.model;
  }

  /**
   * Get the client's default options
   * Useful for introspection
   */
  getDefaultOptions(): InterpretOptions | undefined {
    return this.defaultOptions;
  }
}
