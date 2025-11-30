import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage, buildPrompt } from '../src/prompt.js';
import type { Ontology, Utterance, UtteranceBatch, FewShotExample } from '../src/types/index.js';

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

describe('buildSystemPrompt', () => {
  it('should include the role description', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('Role: Gavagai Interpretation Engine');
  });

  it('should include the ontology schema', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('Domain Schema');
    expect(prompt).toContain('Transaction');
  });

  it('should include the verbs', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('Allowed Verbs');
    expect(prompt).toContain('InsertTransaction');
  });

  it('should include the nouns', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('Known Entities');
    expect(prompt).toContain('expense:food:coffee');
  });

  it('should include the current date', () => {
    const prompt = buildSystemPrompt(sampleOntology, '2024-01-15');
    expect(prompt).toContain('2024-01-15');
  });

  it('should use today\'s date if not provided', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    const today = new Date().toISOString().split('T')[0];
    expect(prompt).toContain(today);
  });

  it('should include few-shot examples', () => {
    const examples: FewShotExample[] = [
      {
        input: 'STARBUCKS 12.50',
        output: { operation: 'InsertTransaction' },
        rationale: 'Coffee purchase',
      },
    ];
    const prompt = buildSystemPrompt(sampleOntology, undefined, examples);
    expect(prompt).toContain('STARBUCKS 12.50');
    expect(prompt).toContain('Coffee purchase');
    expect(prompt).toContain('Example 1');
  });

  it('should include core principles', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('Intentions Only');
    expect(prompt).toContain('Schema Conformance');
    expect(prompt).toContain('Entity Resolution');
    expect(prompt).toContain('Preserve Original');
    expect(prompt).toContain('Explicit Uncertainty');
  });

  it('should include uncertainty signals table', () => {
    const prompt = buildSystemPrompt(sampleOntology);
    expect(prompt).toContain('needs_review: false');
    expect(prompt).toContain('needs_review: true');
    expect(prompt).toContain('ambiguities');
    expect(prompt).toContain('alternative_propositions');
  });
});

describe('buildUserMessage', () => {
  it('should format a single utterance', () => {
    const input: Utterance = {
      kind: 'Utterance',
      source: 'test',
      raw: 'STARBUCKS 12.50',
    };
    const message = buildUserMessage(input);
    expect(message).toContain('Interpret the following utterance');
    expect(message).toContain('STARBUCKS 12.50');
  });

  it('should include metadata if present', () => {
    const input: Utterance = {
      kind: 'Utterance',
      source: 'test',
      raw: 'STARBUCKS 12.50',
      metadata: { date: '2024-01-15' },
    };
    const message = buildUserMessage(input);
    expect(message).toContain('Metadata');
    expect(message).toContain('2024-01-15');
  });

  it('should format a batch of utterances', () => {
    const input: UtteranceBatch = {
      kind: 'UtteranceBatch',
      source: 'test',
      utterances: [
        { raw: 'STARBUCKS 12.50' },
        { raw: 'AMAZON 85.00' },
      ],
    };
    const message = buildUserMessage(input);
    expect(message).toContain('batch of utterances');
    expect(message).toContain('1. STARBUCKS 12.50');
    expect(message).toContain('2. AMAZON 85.00');
  });

  it('should include metadata in batch items', () => {
    const input: UtteranceBatch = {
      kind: 'UtteranceBatch',
      source: 'test',
      utterances: [
        { raw: 'STARBUCKS 12.50', metadata: { category: 'food' } },
      ],
    };
    const message = buildUserMessage(input);
    expect(message).toContain('food');
  });
});

describe('buildPrompt', () => {
  it('should return both system and user prompts', () => {
    const input: Utterance = {
      kind: 'Utterance',
      source: 'test',
      raw: 'STARBUCKS 12.50',
    };
    const { system, user } = buildPrompt(input, sampleOntology);

    expect(system).toContain('Role: Gavagai');
    expect(user).toContain('STARBUCKS 12.50');
  });

  it('should pass through currentDate and fewShot', () => {
    const input: Utterance = {
      kind: 'Utterance',
      source: 'test',
      raw: 'test',
    };
    const examples: FewShotExample[] = [
      { input: 'example', output: {} },
    ];
    const { system } = buildPrompt(input, sampleOntology, '2024-01-15', examples);

    expect(system).toContain('2024-01-15');
    expect(system).toContain('Example 1');
  });
});
