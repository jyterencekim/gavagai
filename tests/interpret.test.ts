import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  interpret,
  registerAdapter,
  unregisterAdapter,
  hasAdapter,
  GavagaiException,
  ErrorCode,
} from '../src/index.js';
import type { IModelAdapter, Ontology, Utterance, GavagaiResponse } from '../src/index.js';

// Mock adapter for testing
class MockAdapter implements IModelAdapter {
  readonly providerId = 'mock';
  private response: string;

  constructor(response: string | GavagaiResponse) {
    this.response = typeof response === 'string' ? response : JSON.stringify(response);
  }

  async complete(): Promise<string> {
    return this.response;
  }
}

// Mock adapter that throws errors
class ErrorAdapter implements IModelAdapter {
  readonly providerId = 'error';
  private error: Error;

  constructor(error: Error) {
    this.error = error;
  }

  async complete(): Promise<string> {
    throw this.error;
  }
}

const sampleOntology: Ontology = {
  schema: {
    Transaction: { fields: ['date', 'description', 'counterparty'] },
  },
  verbs: {
    InsertTransaction: { description: 'Create a new transaction' },
  },
  nouns: {
    accounts: [
      { id: 'expense:food:coffee', aliases: ['coffee', 'starbucks'] },
    ],
  },
};

const sampleInput: Utterance = {
  kind: 'Utterance',
  source: 'test',
  raw: 'STARBUCKS 12.50',
};

const validResponse: GavagaiResponse = {
  propositions: [
    {
      operation: 'InsertTransaction',
      needs_review: false,
      record: {
        originalRaw: 'STARBUCKS 12.50',
        date: '2024-01-15',
        description: 'Starbucks',
      },
      items: [
        { accountId: 'expense:food:coffee', amount: '12.50', type: 'debit' },
      ],
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

describe('interpret', () => {
  beforeEach(() => {
    // Register mock adapter before each test
    registerAdapter(new MockAdapter(validResponse));
  });

  afterEach(() => {
    // Clean up mock adapter after each test
    unregisterAdapter('mock');
    unregisterAdapter('error');
  });

  it('should interpret a simple utterance', async () => {
    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'mock-model',
    });

    expect(result.propositions).toHaveLength(1);
    expect(result.propositions[0]?.operation).toBe('InsertTransaction');
    expect(result.meta.inferredIntent).toBe('action');
  });

  it('should throw when no adapter is registered', async () => {
    await expect(
      interpret(sampleInput, sampleOntology, {
        provider: 'nonexistent' as 'anthropic',
        model: 'test',
      })
    ).rejects.toThrow(GavagaiException);
  });

  it('should handle LLM errors', async () => {
    registerAdapter(new ErrorAdapter(new Error('API Error')));

    await expect(
      interpret(sampleInput, sampleOntology, {
        provider: 'error' as 'anthropic',
        model: 'test',
      })
    ).rejects.toThrow(GavagaiException);
  });

  it('should handle malformed JSON responses', async () => {
    unregisterAdapter('mock');
    registerAdapter(new MockAdapter('not valid json'));

    await expect(
      interpret(sampleInput, sampleOntology, {
        provider: 'mock' as 'anthropic',
        model: 'test',
      })
    ).rejects.toThrow(GavagaiException);
  });

  it('should extract JSON from markdown code blocks', async () => {
    unregisterAdapter('mock');
    const markdownResponse = '```json\n' + JSON.stringify(validResponse) + '\n```';
    registerAdapter(new MockAdapter(markdownResponse));

    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'test',
    });

    expect(result.propositions).toHaveLength(1);
  });

  it('should extract JSON from plain text with surrounding content', async () => {
    unregisterAdapter('mock');
    const messyResponse = 'Here is the response:\n' + JSON.stringify(validResponse) + '\n\nDone!';
    registerAdapter(new MockAdapter(messyResponse));

    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'test',
    });

    expect(result.propositions).toHaveLength(1);
  });

  it('should pass through options', async () => {
    const result = await interpret(
      sampleInput,
      sampleOntology,
      { provider: 'mock' as 'anthropic', model: 'test' },
      {
        currentDate: '2024-01-15',
        fewShot: [{ input: 'test', output: {} }],
      }
    );

    expect(result).toBeDefined();
  });
});

describe('adapter registration', () => {
  afterEach(() => {
    unregisterAdapter('test');
  });

  it('should register and unregister adapters', () => {
    expect(hasAdapter('test')).toBe(false);

    registerAdapter(new MockAdapter(validResponse));
    // Note: The mock adapter has providerId 'mock', not 'test'
    expect(hasAdapter('mock')).toBe(true);

    unregisterAdapter('mock');
    expect(hasAdapter('mock')).toBe(false);
  });
});

describe('response with ambiguities', () => {
  afterEach(() => {
    unregisterAdapter('mock');
  });

  it('should handle responses with ambiguities', async () => {
    const ambiguousResponse: GavagaiResponse = {
      propositions: [
        {
          operation: 'InsertTransaction',
          needs_review: true,
          record: {
            originalRaw: 'AMAZON 85.00',
            description: 'Amazon',
          },
          ambiguities: [
            {
              field: 'items[0].accountId',
              reason: 'Amazon sells many categories',
              alternatives: ['expense:shopping', 'expense:groceries'],
            },
          ],
        },
      ],
      alternative_propositions: [],
      unresolved: [],
      new_entities: [],
      errors: [],
      meta: { inferredIntent: 'action' },
    };

    registerAdapter(new MockAdapter(ambiguousResponse));

    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'test',
    });

    expect(result.propositions[0]?.needs_review).toBe(true);
    expect(result.propositions[0]?.ambiguities).toHaveLength(1);
  });
});

describe('response with unresolved items', () => {
  afterEach(() => {
    unregisterAdapter('mock');
  });

  it('should handle responses with unresolved items', async () => {
    const unresolvedResponse: GavagaiResponse = {
      propositions: [],
      alternative_propositions: [],
      unresolved: [
        {
          originalRaw: 'gibberish text 123',
          reason: 'NOT_AN_INTENTION',
        },
      ],
      new_entities: [],
      errors: [],
      meta: { inferredIntent: 'action' },
    };

    registerAdapter(new MockAdapter(unresolvedResponse));

    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'test',
    });

    expect(result.propositions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]?.reason).toBe('NOT_AN_INTENTION');
  });
});

describe('response with new entities', () => {
  afterEach(() => {
    unregisterAdapter('mock');
  });

  it('should handle responses with new entity proposals', async () => {
    const newEntityResponse: GavagaiResponse = {
      propositions: [
        {
          operation: 'InsertTransaction',
          needs_review: false,
          record: { originalRaw: 'NEW MERCHANT 50.00' },
        },
      ],
      alternative_propositions: [],
      unresolved: [],
      new_entities: [
        {
          alias: 'NEW MERCHANT',
          entityType: 'counterparty',
          rationale: 'Unknown merchant, suggest adding to nouns',
        },
      ],
      errors: [],
      meta: { inferredIntent: 'action' },
    };

    registerAdapter(new MockAdapter(newEntityResponse));

    const result = await interpret(sampleInput, sampleOntology, {
      provider: 'mock' as 'anthropic',
      model: 'test',
    });

    expect(result.new_entities).toHaveLength(1);
    expect(result.new_entities[0]?.alias).toBe('NEW MERCHANT');
  });
});
