/**
 * Validation functions for Gavagai responses
 * Based on README Section 4 and Section 7
 */

import { ZodError } from 'zod';
import { GavagaiResponseSchema } from './schemas/index.js';
import type {
  GavagaiResponse,
  IntentionProposition,
  ValidationResult,
  SchemaError,
  ConstraintError,
  Ontology,
} from './types/index.js';
import { ErrorCode } from './types/index.js';

/**
 * Parse and validate a raw JSON response against the GavagaiResponse schema
 */
export function parseResponse(raw: string): GavagaiResponse {
  const parsed = JSON.parse(raw);
  return GavagaiResponseSchema.parse(parsed);
}

/**
 * Safely parse a response, returning null on failure
 */
export function safeParseResponse(raw: string): GavagaiResponse | null {
  try {
    const parsed = JSON.parse(raw);
    const result = GavagaiResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Convert Zod errors to SchemaError format
 */
function zodErrorsToSchemaErrors(error: ZodError): SchemaError[] {
  return error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * Validate that operations in propositions are in the ontology's verbs
 */
function validateOperations(
  response: GavagaiResponse,
  ontology: Ontology
): ConstraintError[] {
  const errors: ConstraintError[] = [];
  const verbs = Object.keys(ontology.verbs);

  const allPropositions = [
    ...response.propositions,
    ...response.alternative_propositions,
  ];

  for (const prop of allPropositions) {
    if (!verbs.includes(prop.operation)) {
      errors.push({
        code: ErrorCode.UNKNOWN_OPERATION,
        message: `Operation "${prop.operation}" is not defined in ontology verbs`,
        context: { operation: prop.operation, allowedVerbs: verbs },
      });
    }
  }

  return errors;
}

/**
 * Validate that originalRaw is preserved in all propositions
 */
function validateOriginalRawPreserved(
  response: GavagaiResponse
): ConstraintError[] {
  const errors: ConstraintError[] = [];

  const allPropositions = [
    ...response.propositions,
    ...response.alternative_propositions,
  ];

  for (let i = 0; i < allPropositions.length; i++) {
    const prop = allPropositions[i];
    if (!prop?.record.originalRaw) {
      errors.push({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Proposition at index ${i} is missing originalRaw in record`,
        context: { propositionIndex: i },
      });
    }
  }

  return errors;
}

/**
 * Validate a GavagaiResponse against the schema and ontology
 */
export function validate(
  response: GavagaiResponse,
  ontology: Ontology
): ValidationResult {
  const schemaErrors: SchemaError[] = [];
  const constraintErrors: ConstraintError[] = [];

  // Schema validation (already passed if we have a GavagaiResponse type)
  const schemaResult = GavagaiResponseSchema.safeParse(response);
  if (!schemaResult.success) {
    schemaErrors.push(...zodErrorsToSchemaErrors(schemaResult.error));
  }

  // Constraint validation
  constraintErrors.push(...validateOperations(response, ontology));
  constraintErrors.push(...validateOriginalRawPreserved(response));

  return {
    valid: schemaErrors.length === 0 && constraintErrors.length === 0,
    schemaErrors,
    constraintErrors,
  };
}

/**
 * Determine if a proposition can be auto-executed
 * Based on README Section 4 - shouldAutoExecute helper
 */
export function shouldAutoExecute(prop: IntentionProposition): boolean {
  return !prop.needs_review && (!prop.ambiguities || prop.ambiguities.length === 0);
}
