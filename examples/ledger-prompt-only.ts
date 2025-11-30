/**
 * Ledger Example - Prompt-Only Mode
 *
 * This example demonstrates how to use Gavagai's prompt assembly
 * WITHOUT calling the LLM. This is useful for:
 * - Debugging and understanding what prompt is sent to the LLM
 * - Using the engineered prompt with other tools/systems
 * - Manual review and editing before LLM calls
 * - Cost estimation and prompt optimization
 * - Integration with non-standard LLM providers
 *
 * Usage:
 *   npm run example:prompt
 */

import { buildPrompt, buildSystemPrompt, buildUserMessage } from '../src/index.js';
import type { Ontology, Utterance, UtteranceBatch, KnowledgeBase } from '../src/index.js';

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
 * Example utterances
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
 * Display a prompt with formatting
 */
function displayPrompt(title: string, system: string, user: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));

  console.log('\n--- SYSTEM PROMPT ---');
  console.log(system);

  console.log('\n--- USER PROMPT ---');
  console.log(user);

  console.log('\n--- STATISTICS ---');
  console.log(`System prompt: ${system.length} characters, ~${Math.ceil(system.length / 4)} tokens`);
  console.log(`User prompt: ${user.length} characters, ~${Math.ceil(user.length / 4)} tokens`);
  console.log(`Total: ${system.length + user.length} characters, ~${Math.ceil((system.length + user.length) / 4)} tokens`);
}

/**
 * Example 1: Single utterance prompt
 */
function example1_SingleUtterance() {
  const utterance = sampleUtterances[0];

  const { system, user } = buildPrompt(utterance, ledgerOntology, '2024-01-15');

  displayPrompt('EXAMPLE 1: Single Utterance Prompt', system, user);
}

/**
 * Example 2: Batch processing prompt
 */
function example2_Batch() {
  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-batch',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  const { system, user } = buildPrompt(batch, ledgerOntology, '2024-01-17');

  displayPrompt('EXAMPLE 2: Batch Processing Prompt', system, user);
}

/**
 * Example 3: With KnowledgeBase
 */
function example3_WithKnowledgeBase() {
  const knowledgeBase: KnowledgeBase = {
    context: {
      currentDate: '2024-01-17',
      currentAccount: 'asset:checking',
      recentTransactions: [
        { counterparty: 'Starbucks', amount: 12.5, date: '2024-01-14' },
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

  const utterance = sampleUtterances[1]; // AMAZON.COM 85.00

  const { system, user } = buildPrompt(utterance, ledgerOntology, undefined, undefined, knowledgeBase);

  displayPrompt('EXAMPLE 3: Prompt with KnowledgeBase', system, user);
}

/**
 * Example 4: Building components separately
 */
function example4_ComponentsOnly() {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 4: Building Prompt Components Separately');
  console.log('='.repeat(80));

  const knowledgeBase: KnowledgeBase = {
    context: {
      currentDate: '2024-01-17',
    },
    knowledge: {
      businessRules: ['Transactions over $100 require manual review'],
    },
  };

  // Build just the system prompt
  const systemPrompt = buildSystemPrompt(ledgerOntology, undefined, undefined, knowledgeBase);

  console.log('\n--- SYSTEM PROMPT ONLY ---');
  console.log(systemPrompt);
  console.log(`\nLength: ${systemPrompt.length} characters`);

  // Build just the user message
  const userMessage = buildUserMessage(sampleUtterances[0]);

  console.log('\n--- USER MESSAGE ONLY ---');
  console.log(userMessage);
  console.log(`\nLength: ${userMessage.length} characters`);
}

/**
 * Example 5: Save prompt to file
 */
function example5_SaveToFile() {
  console.log('\n' + '='.repeat(80));
  console.log('EXAMPLE 5: Saving Prompt to File');
  console.log('='.repeat(80));

  const batch: UtteranceBatch = {
    kind: 'UtteranceBatch',
    source: 'bank-statement-batch',
    utterances: sampleUtterances.map((u) => ({
      raw: u.raw,
      metadata: u.metadata,
    })),
  };

  const knowledgeBase: KnowledgeBase = {
    context: { currentDate: '2024-01-17' },
    knowledge: {
      businessRules: ['Transactions over $100 require manual review'],
    },
  };

  const { system, user } = buildPrompt(batch, ledgerOntology, undefined, undefined, knowledgeBase);

  // Format as a complete prompt for external use
  const fullPrompt = `# SYSTEM PROMPT

${system}

# USER PROMPT

${user}

---

Generated by Gavagai v0.2
This prompt can be used with any LLM that supports JSON output.
`;

  // In real usage, you would write to a file:
  // fs.writeFileSync('./prompt.txt', fullPrompt);

  console.log('\nFull prompt generated. In production, you could save this to a file:');
  console.log('```');
  console.log(fullPrompt.substring(0, 500) + '...\n[truncated]');
  console.log('```');
  console.log(`\nTotal length: ${fullPrompt.length} characters`);
  console.log('\nUse case: Copy this prompt to Claude.ai, ChatGPT, or your own LLM interface.');
}

async function main() {
  console.log('Gavagai - Prompt-Only Mode Examples\n');
  console.log('These examples show how to generate prompts without calling the LLM.');
  console.log('This is useful for debugging, manual review, or using with external tools.\n');

  // Run all examples
  example1_SingleUtterance();
  example2_Batch();
  example3_WithKnowledgeBase();
  example4_ComponentsOnly();
  example5_SaveToFile();

  console.log('\n' + '='.repeat(80));
  console.log('Done!');
  console.log('\nNext steps:');
  console.log('- Copy any of these prompts to test with Claude.ai or ChatGPT');
  console.log('- Use buildPrompt() in your code to generate prompts programmatically');
  console.log('- Integrate with custom LLM providers or tools');
  console.log('- Review and optimize prompts before production deployment');
}

main().catch(console.error);
