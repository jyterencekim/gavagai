/**
 * Output types for Gavagai interpretation
 * Based on README Section 3.2
 */

import type { GavagaiError } from './errors.js';

/**
 * Field-level uncertainty information
 */
export interface Ambiguity {
  /** The field that is ambiguous */
  field: string;
  /** Why the field is ambiguous */
  reason: string;
  /** Possible alternative values (defaults to empty array) */
  alternatives?: string[];
}

/**
 * An item that could not be interpreted
 */
export interface UnresolvedItem {
  /** The original raw text */
  originalRaw: string;
  /** Why it could not be resolved */
  reason: string;
  /** Suggested options for resolution */
  suggestedOptions?: Array<{
    value: string;
    label: string;
  }>;
}

/**
 * A proposed new entity to add to the ontology
 */
export interface NewEntityProposal {
  /** The alias that was encountered */
  alias: string;
  /** Suggested canonical ID */
  canonicalId?: string;
  /** The entity type from user's nouns */
  entityType: string;
  /** Why this entity should be added */
  rationale: string;
}

/**
 * A structured intention proposition ready for execution
 */
export interface IntentionProposition {
  /** The operation to perform (from user's verbs) */
  operation: string;
  /** Whether this requires human review before execution */
  needs_review: boolean;
  /** Domain-specific record with preserved original */
  record: Record<string, unknown> & {
    /** Always preserved for audit trail */
    originalRaw: string;
  };
  /** Optional structured sub-items (entries, line items, etc.) */
  items?: Array<Record<string, unknown>>;
  /** Field-level uncertainties */
  ambiguities?: Ambiguity[];
  /** Optional LLM reasoning (for debugging) */
  reasoning?: string;
}

/**
 * Metadata about the interpretation
 */
export interface ResponseMeta {
  /** What type of intent was inferred */
  inferredIntent: 'action' | 'query' | 'mixed';
}

/**
 * The complete response from Gavagai interpretation
 */
export interface GavagaiResponse {
  /** Primary intention propositions ready for execution */
  propositions: IntentionProposition[];
  /** Additional plausible interpretations */
  alternative_propositions: IntentionProposition[];
  /** Items that cannot be interpreted */
  unresolved: UnresolvedItem[];
  /** Suggested new canonical mappings */
  new_entities: NewEntityProposal[];
  /** Query response (when intent is question, not action) */
  answer?: string | null;
  /** Errors that prevent processing */
  errors: GavagaiError[];
  /** Interpretation metadata */
  meta: ResponseMeta;
}

/**
 * Schema validation error
 */
export interface SchemaError {
  path: string;
  message: string;
}

/**
 * Constraint validation error
 */
export interface ConstraintError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  schemaErrors: SchemaError[];
  constraintErrors: ConstraintError[];
}
