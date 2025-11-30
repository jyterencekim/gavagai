import { describe, it, expect } from 'vitest';
import { validate, shouldAutoExecute, parseResponse, safeParseResponse } from '../src/validate.js';
import type { GavagaiResponse, IntentionProposition, Ontology } from '../src/types/index.js';
import { ErrorCode } from '../src/types/index.js';

const sampleOntology: Ontology = {
  schema: {
    Transaction: { fields: ['date', 'description', 'counterparty'] },
  },
  verbs: {
    InsertTransaction: { description: 'Create a new transaction' },
    UpdateEntry: { description: 'Update an existing entry' },
  },
  nouns: {
    accounts: [
      { id: 'expense:food:coffee', aliases: ['coffee', 'starbucks'] },
    ],
  },
};

const validResponse: GavagaiResponse = {
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

describe('validate', () => {
  it('should return valid for a correct response', () => {
    const result = validate(validResponse, sampleOntology);
    expect(result.valid).toBe(true);
    expect(result.schemaErrors).toHaveLength(0);
    expect(result.constraintErrors).toHaveLength(0);
  });

  it('should detect unknown operations', () => {
    const response: GavagaiResponse = {
      ...validResponse,
      propositions: [
        {
          operation: 'UnknownOperation',
          needs_review: false,
          record: { originalRaw: 'test' },
        },
      ],
    };

    const result = validate(response, sampleOntology);
    expect(result.valid).toBe(false);
    expect(result.constraintErrors).toHaveLength(1);
    expect(result.constraintErrors[0]?.code).toBe(ErrorCode.UNKNOWN_OPERATION);
  });

  it('should validate alternative_propositions operations too', () => {
    const response: GavagaiResponse = {
      ...validResponse,
      alternative_propositions: [
        {
          operation: 'BadOperation',
          needs_review: true,
          record: { originalRaw: 'test' },
        },
      ],
    };

    const result = validate(response, sampleOntology);
    expect(result.valid).toBe(false);
    expect(result.constraintErrors.some((e) => e.code === ErrorCode.UNKNOWN_OPERATION)).toBe(true);
  });
});

describe('shouldAutoExecute', () => {
  it('should return true when needs_review is false and no ambiguities', () => {
    const prop: IntentionProposition = {
      operation: 'InsertTransaction',
      needs_review: false,
      record: { originalRaw: 'test' },
    };
    expect(shouldAutoExecute(prop)).toBe(true);
  });

  it('should return false when needs_review is true', () => {
    const prop: IntentionProposition = {
      operation: 'InsertTransaction',
      needs_review: true,
      record: { originalRaw: 'test' },
    };
    expect(shouldAutoExecute(prop)).toBe(false);
  });

  it('should return false when there are ambiguities', () => {
    const prop: IntentionProposition = {
      operation: 'InsertTransaction',
      needs_review: false,
      record: { originalRaw: 'test' },
      ambiguities: [
        { field: 'amount', reason: 'Unclear', alternatives: ['10', '100'] },
      ],
    };
    expect(shouldAutoExecute(prop)).toBe(false);
  });

  it('should return true with empty ambiguities array', () => {
    const prop: IntentionProposition = {
      operation: 'InsertTransaction',
      needs_review: false,
      record: { originalRaw: 'test' },
      ambiguities: [],
    };
    expect(shouldAutoExecute(prop)).toBe(true);
  });
});

describe('parseResponse', () => {
  it('should parse valid JSON response', () => {
    const json = JSON.stringify(validResponse);
    const result = parseResponse(json);
    expect(result.propositions).toHaveLength(1);
    expect(result.meta.inferredIntent).toBe('action');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseResponse('not json')).toThrow();
  });

  it('should throw on schema violation', () => {
    const invalid = JSON.stringify({ propositions: 'not an array' });
    expect(() => parseResponse(invalid)).toThrow();
  });
});

describe('safeParseResponse', () => {
  it('should return parsed response for valid JSON', () => {
    const json = JSON.stringify(validResponse);
    const result = safeParseResponse(json);
    expect(result).not.toBeNull();
    expect(result?.propositions).toHaveLength(1);
  });

  it('should return null for invalid JSON', () => {
    const result = safeParseResponse('not json');
    expect(result).toBeNull();
  });

  it('should return null for schema violation', () => {
    const invalid = JSON.stringify({ propositions: 'not an array' });
    const result = safeParseResponse(invalid);
    expect(result).toBeNull();
  });
});
