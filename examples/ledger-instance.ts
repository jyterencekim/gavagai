/**
 * Ledger Instance Example - Using GavagaiClient
 * Based on README Section 13 - Instance Pattern
 *
 * This example demonstrates the Instance Pattern with GavagaiClient:
 * - Pre-configure ontology, model, and default options once
 * - Reuse the client instance for multiple interpret calls
 * - Override options per-call as needed
 * - Use convenience methods (validate, shouldAutoExecute, buildPrompt)
 *
 * Usage:
 *   npm run example:instance              # Normal mode
 *   npm run example:instance -- --debug   # Debug mode
 *
 * Note: Requires ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable
 */

import {
  GavagaiClient,
  registerAdapter,
  AnthropicAdapter,
  OpenAIAdapter,
} from '../src/index.js';
import type { Ontology, Utterance, UtteranceBatch, ModelSpec, KnowledgeBase } from '../src/index.js';

// Register adapters
registerAdapter(new AnthropicAdapter());
registerAdapter(new OpenAIAdapter());

/**
 * User-supplied Ontology for ledger/accounting domain
 */
const ledgerOntology: Ontology = {
  schema: {
    Transaction: {
      fields: ['date', 'description', 'counterparty'],
    },
    Entry: {
      fields: ['accountId', 'amount', 'type'], // type: debit | credit
    },
  },
  verbs: {
    InsertTransaction: { description: 'Create a new transaction with balanced entries' },
    SplitTransaction: { description: 'Split an amount across multiple categories' },
    UpdateEntry: { description: 'Modify an existing entry' },
  },
  nouns: {
    accounts: [
      { id: 'expense:food:coffee', aliases: ['coffee', 'starbucks', 'cafe', 'peets'] },
      { id: 'expense:food:groceries', aliases: ['groceries', 'whole foods', 'trader joes', 'safeway'] },
      { id: 'expense:food:restaurants', aliases: ['restaurant', 'dining', 'uber eats', 'doordash'] },
      { id: 'expense:transport', aliases: ['uber', 'lyft', 'gas', 'transit', 'bart'] },
      { id: 'expense:shopping', aliases: ['amazon', 'target', 'walmart'] },
      { id: 'expense:utilities', aliases: ['electric', 'gas', 'water', 'internet', 'phone'] },
      { id: 'asset:checking', aliases: ['checking', 'debit card', 'bank'] },
    ],
    counterparties: [
      { id: 'starbucks', aliases: ['Starbucks', 'STARBUCKS CORP', 'STARBUCKS STORE'] },
      { id: 'whole-foods', aliases: ['Whole Foods', 'WHOLE FOODS MARKET', 'WFM'] },
      { id: 'amazon', aliases: ['Amazon', 'AMAZON.COM', 'AMZN MKTP'] },
      { id: 'uber', aliases: ['Uber', 'UBER TRIP', 'UBER *TRIP'] },
    ],
  },
  validation: {
    balanceRequired: true,
    dateFormat: 'YYYY-MM-DD',
  },
};

/**
 * Example utterances from a bank statement
 */
const sampleUtterances: Utterance[] = [
  {
    kind: 'Utterance',
    source: 'bank-statement',
    raw: 'STARBUCKS CORP 12.50',
    metadata: { date: '2024-01-15' },
  },
  {
    kind: 'Utterance',
    source: 'bank-statement',
    raw: 'AMAZON.COM 85.00',
    metadata: { date: '2024-01-16' },
  },
  {
    kind: 'Utterance',
    source: 'bank-statement',
    raw: 'WHOLE FOODS MARKET 127.43',
    metadata: { date: '2024-01-17' },
  },
];

/**
 * EXAMPLE 1: Basic Instance Pattern
 * Create a client with pre-configured ontology and model
 */
async function example1BasicInstance(debug: boolean, modelSpec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 1: Basic Instance Pattern');
  console.log('='.repeat(50));

  // Create client with ontology and model
  const client = new GavagaiClient(ledgerOntology, modelSpec);

  console.log('\nCreated GavagaiClient with:');
  console.log(`  Provider: ${client.getModel().provider}`);
  console.log(`  Model: ${client.getModel().model}`);
  console.log(`  Ontology verbs: ${Object.keys(client.getOntology().verbs).join(', ')}`);

  console.log('\n' + '-'.repeat(40));
  console.log(`Processing: "${sampleUtterances[0].raw}"`);
  console.log('-'.repeat(40));

  // Use client to interpret
  const response = await client.interpret(sampleUtterances[0], {
    currentDate: sampleUtterances[0].metadata?.['date'] as string,
    debug,
  });

  // Use client's helper methods
  const validation = client.validate(response);

  if (!validation.valid) {
    console.log('\nValidation errors:', validation.constraintErrors);
    return;
  }

  console.log(`\nFound ${response.propositions.length} proposition(s):`);
  for (const prop of response.propositions) {
    console.log(`\n  Operation: ${prop.operation}`);
    console.log(`  Needs Review: ${prop.needs_review}`);
    console.log(`  Auto-Execute: ${client.shouldAutoExecute(prop)}`); // Using client's method
    console.log(`  Record: ${JSON.stringify(prop.record, null, 2)}`);
  }
}

/**
 * EXAMPLE 2: Client with Default Options
 * Pre-configure default options that apply to all calls
 */
async function example2DefaultOptions(debug: boolean, modelSpec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 2: Client with Default Options');
  console.log('='.repeat(50));

  const defaultKnowledgeBase: KnowledgeBase = {
    context: {
      currentAccount: 'asset:checking',
      userLocation: 'San Francisco',
    },
    knowledge: {
      businessRules: [
        'Transactions over $100 require manual review',
      ],
      userPreferences: {
        defaultExpenseCategory: 'expense:misc',
        preferredCurrency: 'USD',
      },
    },
  };

  // Create client with default options
  const client = new GavagaiClient(ledgerOntology, modelSpec, {
    currentDate: '2024-01-17',
    knowledgeBase: defaultKnowledgeBase,
  });

  console.log('\nCreated client with default options:');
  console.log(`  Current Date: ${client.getDefaultOptions()?.currentDate}`);
  console.log(`  Knowledge Base context: ${Object.keys(defaultKnowledgeBase.context!).join(', ')}`);
  console.log(`  Knowledge Base knowledge: ${Object.keys(defaultKnowledgeBase.knowledge!).join(', ')}`);

  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-batch',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  console.log('\n' + '-'.repeat(40));
  console.log(`Processing ${batch.utterances.length} utterances with default options...`);
  console.log('-'.repeat(40));

  // Interpret uses default options automatically
  const response = await client.interpret(batch, { debug });

  displayResults(client, response);
}

/**
 * EXAMPLE 3: Per-Call Option Overrides
 * Override default options for specific calls
 */
async function example3OptionOverrides(debug: boolean, modelSpec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 3: Per-Call Option Overrides');
  console.log('='.repeat(50));

  // Client with defaults
  const client = new GavagaiClient(ledgerOntology, modelSpec, {
    currentDate: '2024-01-17',
    knowledgeBase: {
      context: { userLocation: 'San Francisco' },
    },
  });

  console.log('\nDefault context: { userLocation: "San Francisco" }');
  console.log('Override context: { userLocation: "New York", timezone: "EST" }');

  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-batch',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  console.log('\n' + '-'.repeat(40));
  console.log('Processing with overridden context...');
  console.log('-'.repeat(40));

  // Override default options for this call
  const response = await client.interpret(batch, {
    debug,
    knowledgeBase: {
      context: {
        userLocation: 'New York', // Overrides "San Francisco"
        timezone: 'EST',          // Adds new field
      },
    },
  });

  displayResults(client, response);
}

/**
 * EXAMPLE 4: Prompt-Only Mode with Instance
 * Use client to generate prompts without calling LLM
 */
async function example4PromptOnly(modelSpec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 4: Prompt-Only Mode with Instance');
  console.log('='.repeat(50));

  const client = new GavagaiClient(ledgerOntology, modelSpec, {
    currentDate: '2024-01-17',
  });

  const utterance = sampleUtterances[0];

  console.log('\n' + '-'.repeat(40));
  console.log(`Building prompt for: "${utterance.raw}"`);
  console.log('-'.repeat(40));

  // Build prompt without calling LLM
  const { system, user } = client.buildPrompt(utterance);

  console.log('\nPrompt Statistics:');
  console.log(`  System prompt: ${system.length} characters`);
  console.log(`  User prompt: ${user.length} characters`);
  console.log(`  Total: ${system.length + user.length} characters`);

  console.log('\nUser prompt content:');
  console.log(user);
}

/**
 * Display interpretation results using client methods
 */
function displayResults(client: GavagaiClient, response: any) {
  const validation = client.validate(response);

  if (!validation.valid) {
    console.log('\nValidation errors:');
    validation.constraintErrors.forEach((e) => console.log(`  - ${e.code}: ${e.message}`));
    return;
  }

  console.log(`\nFound ${response.propositions.length} proposition(s):`);
  for (const prop of response.propositions) {
    console.log(`\n  Operation: ${prop.operation}`);
    console.log(`  Needs Review: ${prop.needs_review}`);
    console.log(`  Auto-Execute: ${client.shouldAutoExecute(prop)}`);
    console.log(`  Original: "${prop.record.originalRaw}"`);

    if (prop.items && prop.items.length > 0) {
      console.log('  Items:');
      prop.items.forEach((item: any, i: number) => {
        console.log(`    ${i + 1}. ${JSON.stringify(item)}`);
      });
    }

    if (prop.ambiguities && prop.ambiguities.length > 0) {
      console.log('  Ambiguities:');
      prop.ambiguities.forEach((a: any) => {
        console.log(`    - ${a.field}: ${a.reason}`);
      });
    }
  }

  if (response.alternative_propositions.length > 0) {
    console.log(`\nAlternative Interpretations: ${response.alternative_propositions.length}`);
  }

  if (response.new_entities.length > 0) {
    console.log(`\nNew Entity Proposals: ${response.new_entities.length}`);
  }

  if (response.unresolved.length > 0) {
    console.log(`\nUnresolved Items: ${response.unresolved.length}`);
  }
}

async function main() {
  const debug = process.argv.includes('--debug') || process.env['DEBUG'] === '1';

  console.log('Gavagai Instance Pattern Example\n');
  if (debug) {
    console.log('DEBUG MODE ENABLED\n');
  }

  // Determine which model to use
  const useOpenAI = !process.env['ANTHROPIC_API_KEY'] && process.env['OPENAI_API_KEY'];
  const modelSpec: ModelSpec = useOpenAI
    ? {
        provider: 'openai',
        model: 'gpt-4o-mini',
        params: { temperature: 0 },
      }
    : {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        params: { temperature: 0, max_tokens: 4096 },
      };

  console.log(`Using ${modelSpec.provider} / ${modelSpec.model}`);

  try {
    // Example 1: Basic instance
    await example1BasicInstance(debug, modelSpec);

    // Example 2: Default options
    await example2DefaultOptions(debug, modelSpec);

    // Example 3: Option overrides
    await example3OptionOverrides(debug, modelSpec);

    // Example 4: Prompt-only mode
    await example4PromptOnly(modelSpec);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    if (debug && error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Done!');
  console.log('\nKey Takeaways:');
  console.log('  1. Create client once with ontology, model, and defaults');
  console.log('  2. Reuse client for multiple interpret calls (DRY)');
  console.log('  3. Override options per-call as needed');
  console.log('  4. Use client methods: validate(), shouldAutoExecute(), buildPrompt()');
}

// Run the example
main().catch(console.error);
