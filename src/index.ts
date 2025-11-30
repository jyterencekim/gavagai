/**
 * Gavagai - LLM Configuration + Thin Execution Layer for Fuzzy Utterances
 *
 * @packageDocumentation
 */

// Core function
export { interpret } from './interpret.js';
export type { Logger, InterpretOptionsWithDebug } from './interpret.js';

// Validation
export { validate, shouldAutoExecute, parseResponse, safeParseResponse } from './validate.js';

// Prompt building
export { buildPrompt, buildSystemPrompt, buildUserMessage } from './prompt.js';

// Adapters
export {
  registerAdapter,
  unregisterAdapter,
  getAdapter,
  hasAdapter,
  getProviderIds,
  AnthropicAdapter,
  OpenAIAdapter,
} from './adapters/index.js';
export type { IModelAdapter } from './adapters/index.js';

// Schemas
export {
  GavagaiResponseSchema,
  IntentionPropositionSchema,
  AmbiguitySchema,
  UnresolvedItemSchema,
  NewEntityProposalSchema,
  GavagaiErrorSchema,
  ResponseMetaSchema,
} from './schemas/index.js';

// Types
export type {
  // Input
  Utterance,
  UtteranceBatch,
  GavagaiInput,
  // Output
  GavagaiResponse,
  IntentionProposition,
  Ambiguity,
  UnresolvedItem,
  NewEntityProposal,
  ResponseMeta,
  // Configuration
  Ontology,
  ModelSpec,
  FewShotExample,
  InterpretOptions,
  KnowledgeBase,
  // Validation
  ValidationResult,
  SchemaError,
  ConstraintError,
  // Errors
  GavagaiError,
} from './types/index.js';

export { ErrorCode, GavagaiException } from './types/index.js';
