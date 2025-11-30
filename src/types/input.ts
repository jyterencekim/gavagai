/**
 * Input types for Gavagai interpretation
 * Based on README Section 3.1
 */

/**
 * A single fuzzy utterance to be interpreted
 */
export interface Utterance {
  kind: 'Utterance';
  /** Origin identifier (e.g., 'bank-statement', 'user-input') */
  source: string;
  /** The raw fuzzy input text */
  raw: string;
  /** Optional metadata about the utterance */
  metadata?: Record<string, unknown>;
}

/**
 * A batch of utterances for bulk processing
 */
export interface UtteranceBatch {
  kind: 'UtteranceBatch';
  /** Origin identifier for the batch */
  source: string;
  /** Array of utterances to process */
  utterances: Array<{
    raw: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Union type for interpret() input
 */
export type GavagaiInput = Utterance | UtteranceBatch;
