import { describe, it, expect } from 'vitest';
import {
  GavagaiResponseSchema,
  IntentionPropositionSchema,
  AmbiguitySchema,
  UnresolvedItemSchema,
  NewEntityProposalSchema,
} from '../src/schemas/index.js';

describe('AmbiguitySchema', () => {
  it('should validate a correct ambiguity', () => {
    const valid = {
      field: 'accountId',
      reason: 'Multiple accounts match',
      alternatives: ['expense:food', 'expense:coffee'],
    };
    expect(() => AmbiguitySchema.parse(valid)).not.toThrow();
  });

  it('should reject missing fields', () => {
    const invalid = { field: 'test' };
    expect(() => AmbiguitySchema.parse(invalid)).toThrow();
  });
});

describe('UnresolvedItemSchema', () => {
  it('should validate without suggestedOptions', () => {
    const valid = {
      originalRaw: 'Unknown text',
      reason: 'Cannot parse',
    };
    expect(() => UnresolvedItemSchema.parse(valid)).not.toThrow();
  });

  it('should validate with suggestedOptions', () => {
    const valid = {
      originalRaw: 'Ambiguous text',
      reason: 'Multiple interpretations',
      suggestedOptions: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ],
    };
    expect(() => UnresolvedItemSchema.parse(valid)).not.toThrow();
  });
});

describe('NewEntityProposalSchema', () => {
  it('should validate without canonicalId', () => {
    const valid = {
      alias: 'STARBUCKS CORP',
      entityType: 'counterparty',
      rationale: 'New merchant',
    };
    expect(() => NewEntityProposalSchema.parse(valid)).not.toThrow();
  });

  it('should validate with canonicalId', () => {
    const valid = {
      alias: 'STARBUCKS CORP',
      canonicalId: 'starbucks',
      entityType: 'counterparty',
      rationale: 'New merchant',
    };
    expect(() => NewEntityProposalSchema.parse(valid)).not.toThrow();
  });
});

describe('IntentionPropositionSchema', () => {
  it('should validate a minimal proposition', () => {
    const valid = {
      operation: 'InsertTransaction',
      needs_review: false,
      record: {
        originalRaw: 'STARBUCKS 12.50',
        description: 'Coffee',
      },
    };
    expect(() => IntentionPropositionSchema.parse(valid)).not.toThrow();
  });

  it('should validate a proposition with all optional fields', () => {
    const valid = {
      operation: 'InsertTransaction',
      needs_review: true,
      record: {
        originalRaw: 'AMAZON 85.00',
        description: 'Amazon purchase',
      },
      items: [
        { accountId: 'expense:shopping', amount: '85.00' },
      ],
      ambiguities: [
        {
          field: 'items[0].accountId',
          reason: 'Amazon sells many categories',
          alternatives: ['expense:shopping', 'expense:groceries'],
        },
      ],
      reasoning: 'Defaulted to shopping category',
    };
    expect(() => IntentionPropositionSchema.parse(valid)).not.toThrow();
  });

  it('should reject missing originalRaw', () => {
    const invalid = {
      operation: 'InsertTransaction',
      needs_review: false,
      record: {
        description: 'Missing originalRaw',
      },
    };
    expect(() => IntentionPropositionSchema.parse(invalid)).toThrow();
  });
});

describe('GavagaiResponseSchema', () => {
  it('should validate a complete response', () => {
    const valid = {
      propositions: [
        {
          operation: 'InsertTransaction',
          needs_review: false,
          record: {
            originalRaw: 'STARBUCKS 12.50',
            date: '2024-01-15',
          },
        },
      ],
      alternative_propositions: [],
      unresolved: [],
      new_entities: [],
      errors: [],
      meta: {
        inferredIntent: 'action',
      },
    };
    expect(() => GavagaiResponseSchema.parse(valid)).not.toThrow();
  });

  it('should validate a response with all fields', () => {
    const valid = {
      propositions: [],
      alternative_propositions: [],
      unresolved: [
        {
          originalRaw: 'gibberish text',
          reason: 'Cannot parse',
        },
      ],
      new_entities: [
        {
          alias: 'NEW MERCHANT',
          entityType: 'counterparty',
          rationale: 'Unknown merchant',
        },
      ],
      answer: 'Your balance is $100',
      errors: [
        {
          code: 'VALIDATION_FAILED',
          message: 'Custom rule failed',
        },
      ],
      meta: {
        inferredIntent: 'query',
      },
    };
    expect(() => GavagaiResponseSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid inferredIntent', () => {
    const invalid = {
      propositions: [],
      alternative_propositions: [],
      unresolved: [],
      new_entities: [],
      errors: [],
      meta: {
        inferredIntent: 'invalid',
      },
    };
    expect(() => GavagaiResponseSchema.parse(invalid)).toThrow();
  });

  it('should reject missing required arrays', () => {
    const invalid = {
      propositions: [],
      meta: { inferredIntent: 'action' },
    };
    expect(() => GavagaiResponseSchema.parse(invalid)).toThrow();
  });
});
