# Gavagai Setup Guide

This guide covers how to set up and run Gavagai locally.

## Prerequisites

- **Node.js** 20.6.0 or higher (for built-in `.env` file support)
- **npm** or **pnpm**
- An API key from at least one LLM provider:
  - [Anthropic](https://console.anthropic.com/) (Claude)
  - [OpenAI](https://platform.openai.com/) (GPT-4)

---

## 1. Install Dependencies

```bash
cd gavagai
npm install
```

---

## 2. Configure API Keys

Gavagai supports multiple LLM providers. You need to set up at least one.

### Option A: .env File (Recommended)

Copy the example file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OPENAI_API_KEY=sk-your-key-here
```

The `npm run example` script automatically loads `.env` using Node.js's built-in `--env-file` flag (no extra packages needed!).

> **Note:** The `.env` file is in `.gitignore` and won't be committed.

### Option B: Environment Variables

Set environment variables directly in your shell:

**For Anthropic (Claude):**
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
```

**For OpenAI:**
```bash
export OPENAI_API_KEY="sk-your-key-here"
```

To make these permanent, add them to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.).

### Option C: Pass API Key Programmatically

You can also pass the API key when creating the adapter:

```typescript
import { registerAdapter, AnthropicAdapter, OpenAIAdapter } from 'gavagai';

// Pass API key directly
registerAdapter(new AnthropicAdapter('sk-ant-api03-your-key-here'));
registerAdapter(new OpenAIAdapter('sk-your-key-here'));
```

---

## 3. Verify Setup

### Run Tests (No API Key Required)

```bash
npm test
```

Expected output:
```
 ✓ tests/prompt.test.ts (15 tests)
 ✓ tests/schemas.test.ts (13 tests)
 ✓ tests/validate.test.ts (13 tests)
 ✓ tests/interpret.test.ts (11 tests)

 Test Files  4 passed (4)
      Tests  52 passed (52)
```

### Run the Example (Requires API Key)

```bash
npm run example
```

This runs `examples/ledger.ts` which interprets sample bank statement entries.

Expected output (with valid API key):
```
Gavagai Ledger Example

==================================================
Using anthropic / claude-sonnet-4-20250514

Processing: "STARBUCKS CORP 12.50"
----------------------------------------

Operation: InsertTransaction
Needs Review: false
Auto-Execute: true
Record: {
  "originalRaw": "STARBUCKS CORP 12.50",
  "date": "2024-01-15",
  "description": "Starbucks",
  "counterparty": "starbucks"
}
Items:
  1. {"accountId":"expense:food:coffee","amount":"12.50","type":"debit"}
  2. {"accountId":"asset:checking","amount":"12.50","type":"credit"}
...
```

---

## 4. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

---

## 5. Type Check

```bash
npm run typecheck
```

Runs TypeScript compiler in check-only mode.

---

## 6. Using in Your Project

### Install Gavagai

```bash
npm install gavagai
```

### Install LLM Provider SDK

Install the SDK for your chosen provider:

```bash
# For Anthropic
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai
```

### Basic Usage

```typescript
import {
  interpret,
  registerAdapter,
  AnthropicAdapter,
  validate,
  shouldAutoExecute,
} from 'gavagai';
import type { Ontology, Utterance } from 'gavagai';

// 1. Register adapter (uses ANTHROPIC_API_KEY env var)
registerAdapter(new AnthropicAdapter());

// 2. Define your ontology
const ontology: Ontology = {
  schema: {
    Transaction: { fields: ['date', 'description', 'amount'] },
  },
  verbs: {
    InsertTransaction: { description: 'Create a new transaction' },
  },
  nouns: {
    accounts: [
      { id: 'expense:food', aliases: ['food', 'restaurant', 'grocery'] },
    ],
  },
};

// 3. Create an utterance
const input: Utterance = {
  kind: 'Utterance',
  source: 'user-input',
  raw: 'Lunch at Chipotle $15.50',
};

// 4. Interpret
const response = await interpret(input, ontology, {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
});

// 5. Validate
const validation = validate(response, ontology);

// 6. Process results
for (const prop of response.propositions) {
  if (shouldAutoExecute(prop)) {
    console.log('Auto-executing:', prop.operation);
    // Execute the proposition...
  } else {
    console.log('Needs review:', prop.operation);
    // Queue for human review...
  }
}
```

---

## Troubleshooting

### "Anthropic SDK not installed"

```bash
npm install @anthropic-ai/sdk
```

### "OpenAI SDK not installed"

```bash
npm install openai
```

### "No adapter registered for provider"

Make sure you register an adapter before calling `interpret()`:

```typescript
import { registerAdapter, AnthropicAdapter } from 'gavagai';
registerAdapter(new AnthropicAdapter());
```

### "Rate limited by API"

You've hit the provider's rate limit. Wait a moment and try again, or upgrade your API plan.

### "ANTHROPIC_API_KEY not set"

Set the environment variable:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

---

## Getting API Keys

### Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-api03-`)

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** in settings
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)

---

## Model Recommendations

| Provider | Model | Use Case |
|----------|-------|----------|
| Anthropic | `claude-sonnet-4-20250514` | Best balance of quality and speed |
| Anthropic | `claude-opus-4-20250514` | Highest quality, slower |
| Anthropic | `claude-haiku-3-20240307` | Fastest, lower cost |
| OpenAI | `gpt-4o` | High quality |
| OpenAI | `gpt-4o-mini` | Fast and cheap |

---

## Next Steps

- Read the [README.md](README.md) for the full API documentation
- Check [examples/ledger.ts](examples/ledger.ts) for a complete example
- Explore the source code in [src/](src/)
