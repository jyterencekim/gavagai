/**
 * Zod schemas for Gavagai response validation
 * Based on README Section 7
 */

import { z } from 'zod';

/**
 * Schema for field-level ambiguity
 */
export const AmbiguitySchema = z.object({
  field: z.string(),
  reason: z.string(),
  alternatives: z.array(z.string()).optional().default([]),
});

/**
 * Schema for unresolved items
 */
export const UnresolvedItemSchema = z.object({
  originalRaw: z.string(),
  reason: z.string(),
  suggestedOptions: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .optional(),
});

/**
 * Schema for new entity proposals
 */
export const NewEntityProposalSchema = z.object({
  alias: z.string(),
  canonicalId: z.string().optional(),
  entityType: z.string(),
  rationale: z.string(),
});

/**
 * Schema for Gavagai errors
 */
export const GavagaiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
});

/**
 * Schema for intention propositions
 */
export const IntentionPropositionSchema = z.object({
  operation: z.string(),
  needs_review: z.boolean(),
  record: z
    .object({
      originalRaw: z.string(),
    })
    .passthrough(),
  items: z.array(z.record(z.unknown())).optional(),
  ambiguities: z.array(AmbiguitySchema).optional(),
  reasoning: z.string().optional(),
});

/**
 * Schema for response metadata
 */
export const ResponseMetaSchema = z.object({
  inferredIntent: z.enum(['action', 'query', 'mixed']),
});

/**
 * Schema for the complete Gavagai response
 */
export const GavagaiResponseSchema = z.object({
  propositions: z.array(IntentionPropositionSchema),
  alternative_propositions: z.array(IntentionPropositionSchema),
  unresolved: z.array(UnresolvedItemSchema),
  new_entities: z.array(NewEntityProposalSchema),
  answer: z.string().nullish(),
  errors: z.array(GavagaiErrorSchema),
  meta: ResponseMetaSchema,
});

/**
 * Type inference from schemas
 */
export type AmbiguityFromSchema = z.infer<typeof AmbiguitySchema>;
export type UnresolvedItemFromSchema = z.infer<typeof UnresolvedItemSchema>;
export type NewEntityProposalFromSchema = z.infer<typeof NewEntityProposalSchema>;
export type GavagaiErrorFromSchema = z.infer<typeof GavagaiErrorSchema>;
export type IntentionPropositionFromSchema = z.infer<typeof IntentionPropositionSchema>;
export type GavagaiResponseFromSchema = z.infer<typeof GavagaiResponseSchema>;
