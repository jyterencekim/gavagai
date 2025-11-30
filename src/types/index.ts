/**
 * Re-export all types
 */

export type { Utterance, UtteranceBatch, GavagaiInput } from './input.js';

export type {
  GavagaiResponse,
  IntentionProposition,
  Ambiguity,
  UnresolvedItem,
  NewEntityProposal,
  ResponseMeta,
  ValidationResult,
  SchemaError,
  ConstraintError,
} from './output.js';

export type {
  Ontology,
  ModelSpec,
  FewShotExample,
  InterpretOptions,
  KnowledgeBase,
} from './ontology.js';

export { ErrorCode, GavagaiException } from './errors.js';
export type { GavagaiError } from './errors.js';
