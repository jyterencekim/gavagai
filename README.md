# Gavagai v0.2 — LLM Configuration + Thin Execution Layer for Fuzzy Utterances

**Gavagai** takes its name from Quine’s thought experiment on radical translation: when a native speaker points at a rabbit and says *“gavagai,”* does it mean “rabbit,” “undetached rabbit parts,” or “rabbithood”? Even with perfect behavioral evidence, there is no uniquely correct answer; reference is fixed only within a total scheme of interpretation.

Gavagai embodies that insight for LLM systems: **fuzzy utterances do not determine a unique meaning until they are interpreted against a framework of interpretation**. Here, that framework is a **user-supplied ontology** — a configuration of schema, verbs, nouns, and validation rules that shapes how an LLM understands intent.

On top of this ontology, a **thin execution layer** (prompt assembly, model invocation, response validation) applies the configuration to raw text and returns structured intention propositions. In practice, Gavagai is an **opinionated, reusable intent interpreter** that any agent — including MCP-based ones — can call before deciding what to actually do.

---

## Core Assumption: Utterances as Intentions

Gavagai assumes that **all utterances express intentions** — desired states, goals, commands, or requests. The configuration shapes how an LLM translates these fuzzy intention-expressions into structured `IntentionProposition` objects that can be executed, queued, or reviewed.

This framing excludes purely descriptive or factual statements. If an utterance doesn't express a desired action or state change, Gavagai returns an empty response or routes to `unresolved[]`.

---

## 1. What Gavagai Is (and Isn't)

Gavagai has two parts:

1. **Configuration** — User-supplied settings that define the interpretation framework (ontology: schema, verbs, nouns, validation rules)
2. **Thin Execution Layer** — Minimal code that assembles prompts, invokes an LLM, and validates the response

### The Execution Layer Owns

| Responsibility | Description |
|----------------|-------------|
| **Input contract** | `Utterance \| UtteranceBatch` — raw text + optional metadata |
| **Output contract** | `GavagaiResponse` — intention propositions, alternatives, unresolved items, errors, new entities |
| **Prompt assembly** | Inject configuration into a structured prompt |
| **LLM invocation** | Call any model via adapter pattern |
| **Validation** | Schema conformance + optional domain rules (balance, consistency) |
| **Uncertainty surface** | `needs_review`, `ambiguities[]`, `unresolved[]`, `alternative_propositions[]` — structural, not numeric |
| **Audit trail** | Always preserve `originalRaw` |

### What Gavagai Does NOT Own

- Database writes or persistence
- Business logic or domain rules beyond validation
- Provider-specific integrations (user supplies adapters)
- Execution of intention propositions (caller-owned)
- Schema design (user-supplied configuration)
- Confidence calibration (LLMs cannot provide meaningful probability estimates)

---

## 2. Configuration (User-Supplied)

The configuration is where domain knowledge lives. Users define what exists, what can be done, and what entities are known. The execution layer is generic; the configuration makes it domain-specific.

```typescript
interface Ontology {
  // Domain entities and their fields (what things exist)
  schema: object;

  // Allowed actions (what can be done)
  verbs: object;

  // Canonical entities with aliases (known instances)
  nouns: object;

  // Optional: format rules, constraints, blocked patterns
  validation?: object;
}

interface ModelSpec {
  provider: "anthropic" | "openai" | "google" | "local";
  model: string;
  params?: Record<string, unknown>;
}

interface KnowledgeBase {
  // Current context in which utterances are made
  context?: object;

  // General know-hows, facts, and domain knowledge
  knowledge?: object;
}
```

### Knowledge Base

The `KnowledgeBase` provides contextual and background information to improve interpretation accuracy:

**`context`** — Situational information about the current state:

- Temporal information (current date, time, timezone)
- Active conversation or session details
- Recent transactions or operations
- Current user location or environment
- Temporary state that changes frequently

**`knowledge`** — Stable domain knowledge and rules:

- Business rules and constraints
- Common patterns and heuristics
- User preferences and defaults
- Historical facts and reference data
- Domain-specific know-hows

**Example:**

```typescript
const kb: KnowledgeBase = {
  context: {
    currentDate: "2024-01-15",
    currentAccount: "asset:checking",
    recentTransactions: [
      { counterparty: "Starbucks", amount: 12.50, date: "2024-01-14" }
    ],
    activeSession: "reviewing January expenses"
  },
  knowledge: {
    businessRules: [
      "Transactions over $1000 require manual review",
      "Weekend Starbucks purchases are usually personal"
    ],
    userPreferences: {
      defaultExpenseCategory: "expense:misc",
      preferredCurrency: "USD"
    }
  }
};
```

### Example Ontologies by Domain

| Domain | schema | verbs | nouns |
|--------|--------|-------|-------|
| **Finance** | Transaction, Entry, Account | InsertTransaction, UpdateEntry, SplitItem | Accounts, Counterparties |
| **Support** | Ticket, Comment, Agent | ClassifyIntent, AssignOwner, TagTopic | Categories, Agents, Products |
| **Catalog** | Product, Attribute, Category | NormalizeProduct, MergeDuplicate, UpsertAlias | Brands, Categories |
| **Clinical** | Diagnosis, Medication, Procedure | ExtractDiagnosis, NormalizeMedication, MapToCodeSystem | ICD-10 codes, Drugs |
| **Logistics** | Shipment, Address, Carrier | NormalizeAddress, MapCarrier, SplitShipment | Carriers, Regions |

---

## 3. Core Interfaces

### 3.1 Input

```typescript
interface Utterance {
  kind: "Utterance";
  source: string;           // origin identifier
  raw: string;              // the fuzzy input
  metadata?: Record<string, unknown>;
}

interface UtteranceBatch {
  kind: "UtteranceBatch";
  source: string;
  utterances: Array<{
    raw: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

### 3.2 Output

```typescript
interface GavagaiResponse {
  // Structured intention propositions ready for execution
  propositions: IntentionProposition[];

  // Additional plausible interpretations (same shape as propositions[])
  alternative_propositions: IntentionProposition[];

  // Items that cannot be interpreted — require human decision
  unresolved: UnresolvedItem[];

  // Suggested new canonical mappings (alias → entity)
  new_entities: NewEntityProposal[];

  // Query responses (when intent is question, not action)
  answer?: string;

  // Errors that prevent processing
  errors: GavagaiError[];

  // Interpretation metadata
  meta: {
    inferredIntent: "action" | "query" | "mixed";
  };
}

interface IntentionProposition {
  operation: string;              // from user's verbs
  needs_review: boolean;          // true = queue for HITL; false = safe to auto-execute

  // Domain-specific record (shape from user's schema)
  record: Record<string, unknown> & {
    originalRaw: string;          // always preserved for audit
  };

  // Optional structured sub-items (entries, line items, postings, etc.)
  items?: Array<Record<string, unknown>>;

  // Field-level uncertainties — which fields are the LLM unsure about?
  ambiguities?: Ambiguity[];

  // Optional: LLM's reasoning (useful for debugging, not for decisions)
  reasoning?: string;
}

interface Ambiguity {
  field: string;
  reason: string;
  alternatives: string[];
}

interface UnresolvedItem {
  originalRaw: string;
  reason: string;
  suggestedOptions?: Array<{
    value: string;
    label: string;
  }>;
}

interface NewEntityProposal {
  alias: string;
  canonicalId?: string;
  entityType: string;             // from user's nouns
  rationale: string;
}

interface GavagaiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
```

**Note on Confidence Scores:** Earlier versions included numeric `confidence` fields. These have been removed because LLMs cannot provide calibrated probability estimates. The structural signals (`needs_review`, `ambiguities[]`, `unresolved[]`, `alternative_propositions[]`) are more actionable.

**Standard Error Codes:**

| Code | Meaning |
|------|---------|
| `SCHEMA_VIOLATION` | Output doesn't match schema |
| `UNKNOWN_OPERATION` | Operation not in verbs |
| `UNKNOWN_ENTITY` | Referenced entity not in nouns |
| `VALIDATION_FAILED` | Custom validation rule failed |
| `BALANCE_MISMATCH` | Domain-specific balance constraint violated |
| `INVALID_DATE` | Date format is invalid |
| `INVALID_AMOUNT` | Amount format is invalid |
| `UNPARSEABLE` | Cannot extract meaningful structure |
| `NOT_AN_INTENTION` | Utterance doesn't express a desired action or state |
| `DISALLOWED_OP` | Operation blocked by validation rules |

---

## 4. The Gavagai API

```typescript
// Core interpretation function
async function interpret(
  input: Utterance | UtteranceBatch,
  ontology: Ontology,
  model: ModelSpec,
  opts?: {
    fewShot?: Example[];
    currentDate?: string;          // Optional: can also be provided in knowledgeBase
    knowledgeBase?: KnowledgeBase; // Optional: context and domain knowledge
  }
): Promise<GavagaiResponse>;

// Validation (can be called separately)
function validate(
  response: GavagaiResponse,
  ontology: Ontology
): ValidationResult;

interface ValidationResult {
  valid: boolean;
  schemaErrors: SchemaError[];
  constraintErrors: ConstraintError[];
}

// Caller decides execution based on structural signals
function shouldAutoExecute(prop: IntentionProposition): boolean {
  return !prop.needs_review && (!prop.ambiguities || prop.ambiguities.length === 0);
}
```

**Notes:**
- No provider lock-in; `ModelSpec` is passed to the adapter.
- `Ontology` is hot-swappable; update schemas/verbs/nouns without code changes.

### Prompt-Only Mode

Since Gavagai is fundamentally a prompt engineering system, you can generate prompts without calling the LLM. This is useful for debugging, manual review, cost estimation, or integration with external tools.

```typescript
import { buildPrompt, buildSystemPrompt, buildUserMessage } from 'gavagai';

// Generate complete prompt
const { system, user } = buildPrompt(
  input,
  ontology,
  currentDate,
  fewShot,
  knowledgeBase
);

// Use with any LLM:
// - Copy to Claude.ai or ChatGPT
// - Send to your own LLM endpoint
// - Save for review or optimization
console.log('System:', system);
console.log('User:', user);

// Or build components separately
const systemPrompt = buildSystemPrompt(ontology, currentDate, fewShot, knowledgeBase);
const userMessage = buildUserMessage(input);
```

**Use cases:**

- Debug what prompt is sent to the LLM
- Manual review before committing to API calls
- Cost estimation and prompt optimization
- Integration with non-standard LLM providers
- Prompt versioning and A/B testing
- Using engineered prompts in other tools

See `examples/ledger-prompt-only.ts` for complete examples.

---

## 5. Prompt Assembly

The execution layer constructs a prompt by injecting the user-supplied configuration. The LLM sees:

```markdown
# Role: Gavagai Interpretation Engine

You are a semantic translation engine that converts fuzzy utterances into
structured IntentionPropositions. Assume every utterance expresses an intention:
a desired state, goal, command, or request. Map it to the allowed operations.

Your output MUST be valid JSON conforming to the GavagaiResponse schema.

## Core Principles

1. **Intentions Only**: If the utterance doesn't express a desired action or state,
   return it in `unresolved[]` with reason "NOT_AN_INTENTION"
2. **Schema Conformance**: Only emit operations from the allowed set
3. **Entity Resolution**: Match against the provided ontology; never hallucinate IDs
4. **Preserve Original**: Always include originalRaw in every proposition
5. **Explicit Uncertainty**: Set needs_review=true when you are uncertain about
   any field; use ambiguities[] to specify which fields and why
6. **Surface Alternatives**: Include additional plausible interpretations in
   alternative_propositions[] for HITL resolution
7. **Propose Learnings**: Suggest new_entities[] for unknown aliases

## Domain Schema
{schema}

## Allowed Verbs
{verbs}

## Known Entities (with aliases)
{nouns}

## Validation Rules
{validation}

## Current Date
{currentDate}

## Few-Shot Examples
{fewShotExamples}

## Uncertainty Signals

Use structural signals, NOT numeric confidence:

| Signal | When to Use |
|--------|-------------|
| `needs_review: false` | All fields are unambiguous; safe to auto-execute |
| `needs_review: true` | Any uncertainty exists; queue for human review |
| `ambiguities: [...]` | Specify which fields are uncertain and alternatives |
| `alternative_propositions: [...]` | Other plausible interpretations |
| `unresolved: [...]` | Cannot form any proposition; needs human interpretation |

Respond ONLY with valid JSON. No explanations outside the JSON structure.
```

---

## 6. Model Adapters

The execution layer is provider-agnostic. Users supply a `ModelSpec` and the layer routes to the appropriate adapter.

### Claude (Anthropic)

```typescript
const claudeSpec: ModelSpec = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  params: {
    temperature: 0,
    max_tokens: 4096,
  }
};
```

**Claude-specific guidance:**
- Use low temperature (0-0.3) for deterministic outputs
- Leverage extended thinking for complex multi-step interpretations
- Tool use can enforce structured output when needed
- Batch requests to reduce latency for high-volume scenarios
- Cap `max_tokens` to bound latency/cost

### OpenAI

```typescript
const openaiSpec: ModelSpec = {
  provider: "openai",
  model: "gpt-4o-mini",
  params: {
    temperature: 0,
    response_format: { type: "json_object" }
  }
};
```

**OpenAI-specific guidance:**
- JSON mode or function calling for structured output
- Low temperature for deterministic results
- Batch unique utterances for cost optimization

### Google Gemini

```typescript
const geminiSpec: ModelSpec = {
  provider: "google",
  model: "gemini-1.5-pro",
  params: {
    temperature: 0,
  }
};
```

**Gemini-specific guidance:**
- Use structured output if available
- Otherwise embed schema in prompt and parse robustly

### Local (Ollama/vLLM)

```typescript
const localSpec: ModelSpec = {
  provider: "local",
  model: "llama-3.1-8b-instruct",
  params: {
    temperature: 0,
    grammar: schemaToGrammar(ontology.schema), // Outlines/Guidance
  }
};
```

**Local-specific guidance:**
- Use grammar-constrained decoding (Outlines/Guidance) when possible
- Keep schema small to fit context

---

## 7. Validation Layer

```typescript
import { z } from "zod";

// Base IntentionProposition schema (extended by domain-specific fields)
const IntentionPropositionSchema = z.object({
  operation: z.string(),
  needs_review: z.boolean(),
  record: z.object({
    originalRaw: z.string(),
  }).passthrough(),
  items: z.array(z.record(z.unknown())).optional(),
  ambiguities: z.array(z.object({
    field: z.string(),
    reason: z.string(),
    alternatives: z.array(z.string()),
  })).optional(),
  reasoning: z.string().optional(),
});

const GavagaiResponseSchema = z.object({
  propositions: z.array(IntentionPropositionSchema),
  alternative_propositions: z.array(IntentionPropositionSchema),
  unresolved: z.array(z.object({
    originalRaw: z.string(),
    reason: z.string(),
    suggestedOptions: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).optional(),
  })),
  new_entities: z.array(z.object({
    alias: z.string(),
    canonicalId: z.string().optional(),
    entityType: z.string(),
    rationale: z.string(),
  })),
  answer: z.string().optional(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    context: z.record(z.unknown()).optional(),
  })),
  meta: z.object({
    inferredIntent: z.enum(["action", "query", "mixed"]),
  }),
});

// Domain-specific validation (user-supplied)
function validateDomainRules(
  response: GavagaiResponse,
  rules: ValidationRule[]
): ConstraintError[] {
  // Example: balance check for double-entry accounting
  // Example: required fields for clinical records
  // Example: valid state transitions for tickets
  return rules.flatMap(rule => rule.check(response));
}
```

---

## 8. Flow

```
┌─────────────────┐
│  Configuration  │
│  (Ontology) +   │
│  ModelSpec      │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Execution Layer │
│ interpret()     │
│                 │
│ 1. Assemble prompt from config
│ 2. Call LLM adapter
│ 3. Parse JSON response
│ 4. Validate schema
└────────┬────────┘
         ▼
┌─────────────────┐
│ GavagaiResponse │
│                 │
│ propositions[]  │  → Primary IntentionProposition objects
│ alternative_    │  → Other plausible interpretations
│   propositions[]│
│ unresolved[]    │  → Items needing human interpretation
│ new_entities[]  │  → Suggested ontology updates
│ errors[]        │  → Validation failures
└────────┬────────┘
         ▼
┌─────────────────┐
│  Caller decides │
│                 │
│ • Auto-execute if needs_review=false and no ambiguities
│ • Queue for HITL if needs_review=true
│ • Consult alternative_propositions for disambiguation
│ • Handle errors
│ • Apply new_entities to ontology
└─────────────────┘
```

---

## 9. Cost Optimization

These strategies are user-controlled, not owned by the execution layer:

| Strategy | Description |
|----------|-------------|
| **Deduplication** | Cluster unique utterances before batching (1k rows → ~150 unique) |
| **Model tiering** | Use cheap models (gpt-4o-mini, Haiku) for simple lookups; expensive models for complex inference |
| **Caching** | Cache responses by normalized utterance hash |
| **Cascading** | Try exact/fuzzy alias match before LLM call |
| **Batching** | Use UtteranceBatch to amortize prompt overhead |

---

## 10. Quickstart

```typescript
const ontology: Ontology = loadOntology("schema.json", "verbs.json", "nouns.json");
const model: ModelSpec = { provider: "openai", model: "gpt-4o-mini", params: { temperature: 0 } };
const input: Utterance = { kind: "Utterance", source: "bank-statement", raw: "Starbucks 12.50" };

// Optional: provide contextual information
const knowledgeBase: KnowledgeBase = {
  context: {
    currentDate: "2024-01-15",
    currentAccount: "asset:checking",
    recentTransactions: [/* recent activity */]
  },
  knowledge: {
    userPreferences: { defaultCategory: "expense:misc" }
  }
};

const resp = await interpret(input, ontology, model, { knowledgeBase });
const validated = validate(resp, ontology);
// Your logic: auto-apply if policy allows, or queue `needs_review`/`unresolved`
// and consult `alternative_propositions` for HITL resolution.
```

---

## 11. Example: Transaction Entry

```typescript
// User-supplied Ontology
const ledgerOntology: Ontology = {
  schema: {
    Transaction: {
      fields: ["date", "description", "counterparty"]
    },
    Entry: {
      fields: ["accountId", "amount", "type"]  // type: debit | credit
    }
  },
  verbs: {
    InsertTransaction: { description: "Create a new transaction with balanced entries" },
    SplitTransaction: { description: "Split an amount across multiple categories" },
    UpdateEntry: { description: "Modify an existing entry" }
  },
  nouns: {
    accounts: [
      { id: "expense:food:coffee", aliases: ["coffee", "starbucks", "cafe"] },
      { id: "expense:food:groceries", aliases: ["groceries", "whole foods", "trader joes"] },
      { id: "expense:transport", aliases: ["uber", "lyft", "gas", "transit"] },
      { id: "asset:checking", aliases: ["checking", "debit card", "bank"] }
    ],
    counterparties: [
      { id: "starbucks", aliases: ["Starbucks", "STARBUCKS CORP"] },
      { id: "whole-foods", aliases: ["Whole Foods", "WHOLE FOODS MARKET"] }
    ]
  }
};

// Interpretation — clear case
const input: Utterance = {
  kind: "Utterance",
  source: "bank-statement",
  raw: "STARBUCKS CORP 12.50"
};

const response = await interpret(input, ledgerOntology, claudeSpec);

// Expected output — no ambiguity, safe to auto-execute
{
  propositions: [{
    operation: "InsertTransaction",
    needs_review: false,
    record: {
      date: "2024-01-15",
      description: "Starbucks",
      counterparty: "starbucks",
      originalRaw: "STARBUCKS CORP 12.50"
    },
    items: [
      { accountId: "expense:food:coffee", amount: "12.50", type: "debit" },
      { accountId: "asset:checking", amount: "12.50", type: "credit" }
    ]
  }],
  alternative_propositions: [],
  unresolved: [],
  new_entities: [],
  errors: [],
  meta: {
    inferredIntent: "action"
  }
}
```

### Example with Ambiguity

```typescript
const input2: Utterance = {
  kind: "Utterance",
  source: "bank-statement",
  raw: "AMAZON 85.00"
};

// Expected output — ambiguous category, needs review
{
  propositions: [{
    operation: "InsertTransaction",
    needs_review: true,
    record: {
      date: "2024-01-15",
      description: "Amazon",
      counterparty: "amazon",
      originalRaw: "AMAZON 85.00"
    },
    items: [
      { accountId: "expense:shopping", amount: "85.00", type: "debit" },
      { accountId: "asset:checking", amount: "85.00", type: "credit" }
    ],
    ambiguities: [{
      field: "items[0].accountId",
      reason: "Amazon sells many categories; could be groceries, electronics, household, etc.",
      alternatives: ["expense:shopping", "expense:food:groceries", "expense:household"]
    }]
  }],
  alternative_propositions: [{
    operation: "InsertTransaction",
    needs_review: true,
    record: {
      date: "2024-01-15",
      description: "Amazon",
      counterparty: "amazon",
      originalRaw: "AMAZON 85.00"
    },
    items: [
      { accountId: "expense:food:groceries", amount: "85.00", type: "debit" },
      { accountId: "asset:checking", amount: "85.00", type: "credit" }
    ]
  }],
  unresolved: [],
  new_entities: [{
    alias: "AMAZON",
    canonicalId: "amazon",
    entityType: "counterparty",
    rationale: "New counterparty pattern; suggest adding to nouns"
  }],
  errors: [],
  meta: {
    inferredIntent: "action"
  }
}
```

---

## 12. Thinness Checklist

Before adding anything to the execution layer, ask:

- [ ] Is this domain-agnostic? (If not, put it in Configuration/Ontology)
- [ ] Is this provider-agnostic? (If not, put it in ModelSpec adapter)
- [ ] Is this execution logic? (If so, it belongs to the caller)
- [ ] Does this preserve the uncertainty surface? (needs_review, ambiguities, alternative_propositions)
- [ ] Does this preserve originalRaw? (always yes)

If any answer is "no," it doesn't belong in the execution layer.

**The execution layer owns (and nothing else):**
- Input/output contracts
- Prompt assembly from configuration
- Validation (shape + optional balance)
- Original text preservation
- Uncertainty surface

**The configuration owns:**

- Domain schema (what things exist)
- Verbs (what actions are allowed)
- Nouns (what entities are known, with aliases)
- Validation rules (constraints, blocked patterns)

---

## 13. The Gavagai Philosophy

The name reminds us that **translation is underdetermined**. We cannot know what an utterance "really means" — only what it means *relative to a framework of interpretation*.

Gavagai makes this explicit:

1. **Utterances are intentions** — we assume every input expresses a desired state or action
2. **Configuration supplies the framework** — schema, verbs, nouns define the interpretation space
3. **LLM performs the interpretation** — mapping fuzzy intention to structured proposition
4. **Execution layer is thin** — just prompt assembly, invocation, and validation
5. **Uncertainty is structural, not numeric** — `needs_review`, `ambiguities[]`, `unresolved[]`, `alternative_propositions[]` rather than fake confidence scores
6. **Original is preserved** — the raw utterance is always recoverable
7. **Execution is deferred** — Gavagai proposes, the caller disposes

This separation of concerns enables:

- **Auditability** — trace any IntentionProposition back to its source utterance
- **Iteration** — refine the configuration without changing the execution layer
- **Composability** — use Gavagai as a building block in larger systems
- **Honest uncertainty** — structural signals instead of pseudo-probabilistic confidence
- **Hot-swappability** — update configuration (schema, verbs, nouns) without code changes

> *Gavagai* turns the underdetermination of translation from a problem into a feature: by making interpretation explicit (configuration) and execution thin (layer), we can build systems that are both powerful and epistemically honest.
