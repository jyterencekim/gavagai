/**
 * Ledger Example - Transaction Entry
 * Based on README Section 11
 *
 * This example demonstrates:
 * 1. Single utterance processing
 * 2. Batch processing with UtteranceBatch (recommended for efficiency)
 * 3. Using KnowledgeBase for context-aware interpretation
 *
 * Usage:
 *   npm run example              # Normal mode
 *   npm run example -- --debug   # Debug mode (shows raw LLM responses)
 *   DEBUG=1 npm run example      # Debug mode via env var
 *
 * Note: Requires ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable
 */

import {
  interpret,
  validate,
  shouldAutoExecute,
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
    // Entries must balance (debits = credits)
    balanceRequired: true,
    // Date format
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
 * Model specification - uses Anthropic Claude by default
 */
const modelSpec: ModelSpec = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  params: {
    temperature: 0,
    max_tokens: 4096,
  },
};

/**
 * Alternative: Use OpenAI
 */
const openaiSpec: ModelSpec = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  params: {
    temperature: 0,
  },
};

/**
 * Process a single utterance
 */
async function processSingleUtterance(debug: boolean, spec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 1: Single Utterance Processing');
  console.log('='.repeat(50));

  const utterance = sampleUtterances[0];
  console.log(`\nProcessing: "${utterance.raw}"`);
  console.log('-'.repeat(40));

  const response = await interpret(utterance, ledgerOntology, spec, {
    currentDate: utterance.metadata?.['date'] as string,
    debug,
  });

  displayResults(response);
}

/**
 * Process multiple utterances as a batch (more efficient!)
 */
async function processBatch(debug: boolean, spec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 2: Batch Processing (Recommended)');
  console.log('='.repeat(50));
  console.log('\nBatching multiple utterances into a single LLM call');
  console.log('reduces latency and cost compared to individual calls.\n');

  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-batch',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  console.log(`Processing ${batch.utterances.length} utterances in one batch...`);
  console.log('-'.repeat(40));

  const response = await interpret(batch, ledgerOntology, spec, {
    currentDate: '2024-01-17', // Current date for the batch
    debug,
  });

  displayResults(response);
}

/**
 * Process with KnowledgeBase (context + domain knowledge)
 */
async function processWithKnowledgeBase(debug: boolean, spec: ModelSpec) {
  console.log('\n' + '='.repeat(50));
  console.log('EXAMPLE 3: Using KnowledgeBase');
  console.log('='.repeat(50));
  console.log('\nKnowledgeBase provides context and domain knowledge');
  console.log('to improve interpretation accuracy.\n');

  const knowledgeBase: KnowledgeBase = {
    context: {
      currentDate: '2024-01-17',
      currentAccount: 'asset:checking',
      recentTransactions: [
        { counterparty: 'Starbucks', amount: 12.50, date: '2024-01-14' },
        { counterparty: 'Starbucks', amount: 8.75, date: '2024-01-15' },
      ],
      userLocation: 'San Francisco',
      dayOfWeek: 'Wednesday',
    },
    knowledge: {
      businessRules: [
        'Transactions over $100 require manual review',
        'Weekday morning Starbucks purchases are work-related',
      ],
      userPreferences: {
        defaultExpenseCategory: 'expense:misc',
        preferredCurrency: 'USD',
        autoCategorizeCoffee: true,
      },
      patterns: {
        'Starbucks + morning + weekday': 'expense:food:coffee',
        'Amazon + under $50': 'likely household items',
      },
    },
  };

  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-with-context',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  console.log('Knowledge Base:');
  console.log('  Context:', Object.keys(knowledgeBase.context!).join(', '));
  console.log('  Knowledge:', Object.keys(knowledgeBase.knowledge!).join(', '));
  console.log();
  console.log(`Processing ${batch.utterances.length} utterances with knowledge base...`);
  console.log('-'.repeat(40));

  const response = await interpret(batch, ledgerOntology, spec, {
    knowledgeBase,
    debug,
  });

  displayResults(response);
}

/**
 * Display interpretation results
 */
function displayResults(response: ReturnType<typeof interpret> extends Promise<infer R> ? R : never) {
  const validation = validate(response, ledgerOntology);

  if (!validation.valid) {
    console.log('\nValidation errors:');
    validation.constraintErrors.forEach((e) => console.log(`  - ${e.code}: ${e.message}`));
    return;
  }

  // Process propositions
  console.log(`\nFound ${response.propositions.length} proposition(s):`);
  for (const prop of response.propositions) {
    console.log(`\n  Operation: ${prop.operation}`);
    console.log(`  Needs Review: ${prop.needs_review}`);
    console.log(`  Auto-Execute: ${shouldAutoExecute(prop)}`);
    console.log(`  Record: ${JSON.stringify(prop.record, null, 2)}`);

    if (prop.items) {
      console.log('  Items:');
      prop.items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${JSON.stringify(item)}`);
      });
    }

    if (prop.ambiguities && prop.ambiguities.length > 0) {
      console.log('  Ambiguities:');
      prop.ambiguities.forEach((a) => {
        console.log(`    - ${a.field}: ${a.reason}`);
        console.log(`      Alternatives: ${a.alternatives.join(', ')}`);
      });
    }
  }

  // Show alternative propositions
  if (response.alternative_propositions.length > 0) {
    console.log(`\nAlternative Interpretations (${response.alternative_propositions.length}):`);
    response.alternative_propositions.forEach((alt, i) => {
      console.log(`  ${i + 1}. ${alt.operation} - ${JSON.stringify(alt.record)}`);
    });
  }

  // Show new entity proposals
  if (response.new_entities.length > 0) {
    console.log(`\nNew Entity Proposals (${response.new_entities.length}):`);
    response.new_entities.forEach((e) => {
      console.log(`  - ${e.alias} -> ${e.entityType}: ${e.rationale}`);
    });
  }

  // Show unresolved items
  if (response.unresolved.length > 0) {
    console.log(`\nUnresolved (${response.unresolved.length}):`);
    response.unresolved.forEach((u) => {
      console.log(`  - "${u.originalRaw}": ${u.reason}`);
    });
  }
}

async function main() {
  // Enable debug mode with --debug flag or DEBUG=1 env var
  const debug = process.argv.includes('--debug') || process.env['DEBUG'] === '1';

  console.log('Gavagai Ledger Example\n');
  if (debug) {
    console.log('DEBUG MODE ENABLED\n');
  }

  // Determine which model to use based on available API key
  const useOpenAI = !process.env['ANTHROPIC_API_KEY'] && process.env['OPENAI_API_KEY'];
  const spec = useOpenAI ? openaiSpec : modelSpec;
  console.log(`Using ${spec.provider} / ${spec.model}`);

  try {
    // Example 1: Single utterance
    await processSingleUtterance(debug, spec);

    // Example 2: Batch processing (recommended)
    await processBatch(debug, spec);

    // Example 3: With KnowledgeBase
    await processWithKnowledgeBase(debug, spec);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    if (debug && error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Done!');
}

// Run the example
main().catch(console.error);
