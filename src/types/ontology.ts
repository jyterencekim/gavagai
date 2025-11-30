/**
 * Configuration types for Gavagai
 * Based on README Section 2
 */

/**
 * User-supplied ontology that defines the interpretation framework
 */
export interface Ontology {
  /** Domain entities and their fields (what things exist) */
  schema: Record<string, unknown>;
  /** Allowed actions (what can be done) */
  verbs: Record<string, unknown>;
  /** Canonical entities with aliases (known instances) */
  nouns: Record<string, unknown>;
  /** Optional: format rules, constraints, blocked patterns */
  validation?: Record<string, unknown>;
}

/**
 * Model specification for LLM provider
 */
export interface ModelSpec {
  provider: 'anthropic' | 'openai' | 'google' | 'local';
  model: string;
  params?: Record<string, unknown>;
}

/**
 * Few-shot example for prompt enrichment
 */
export interface FewShotExample {
  /** The input utterance */
  input: string;
  /** The expected output */
  output: Record<string, unknown>;
  /** Optional explanation */
  rationale?: string;
}

/**
 * Knowledge base for contextual interpretation
 */
export interface KnowledgeBase {
  /**
   * Current context in which utterances are made.
   * This provides situational information that helps interpret the intent.
   * Use this for temporary, changing state.
   *
   * @example
   * ```typescript
   * context: {
   *   currentDate: "2024-01-15",
   *   currentAccount: "asset:checking",
   *   recentTransactions: [...],
   *   activeConversation: "discussing monthly budget"
   * }
   * ```
   */
  context?: Record<string, unknown>;

  /**
   * General know-hows, facts, and domain knowledge that help with interpretation.
   * This provides stable background information, rules, or patterns that don't change frequently.
   *
   * @example
   * ```typescript
   * knowledge: {
   *   businessRules: ["Transactions over $1000 require review"],
   *   commonPatterns: ["Weekend purchases are usually groceries"],
   *   userPreferences: { defaultCategory: "expense:misc" }
   * }
   * ```
   */
  knowledge?: Record<string, unknown>;
}

/**
 * Options for the interpret function
 */
export interface InterpretOptions {
  /** Few-shot examples to include in the prompt */
  fewShot?: FewShotExample[];
  /** Current date for date-relative interpretations */
  currentDate?: string;
  /** Optional knowledge base with context and domain knowledge */
  knowledgeBase?: KnowledgeBase;
}
