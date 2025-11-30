/**
 * Error types and codes for Gavagai
 * Based on README Section 3.2 (Standard Error Codes)
 */

/**
 * Standard error codes returned by Gavagai
 */
export enum ErrorCode {
  /** Output doesn't match schema */
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',
  /** Operation not in verbs */
  UNKNOWN_OPERATION = 'UNKNOWN_OPERATION',
  /** Referenced entity not in nouns */
  UNKNOWN_ENTITY = 'UNKNOWN_ENTITY',
  /** Custom validation rule failed */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  /** Domain-specific balance constraint violated */
  BALANCE_MISMATCH = 'BALANCE_MISMATCH',
  /** Date format is invalid */
  INVALID_DATE = 'INVALID_DATE',
  /** Amount format is invalid */
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  /** Cannot extract meaningful structure */
  UNPARSEABLE = 'UNPARSEABLE',
  /** Utterance doesn't express a desired action or state */
  NOT_AN_INTENTION = 'NOT_AN_INTENTION',
  /** Operation blocked by validation rules */
  DISALLOWED_OP = 'DISALLOWED_OP',
}

/**
 * Error returned by Gavagai
 */
export interface GavagaiError {
  code: ErrorCode | string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Custom error class for Gavagai errors
 */
export class GavagaiException extends Error {
  readonly code: ErrorCode | string;
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode | string, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'GavagaiException';
    this.code = code;
    this.context = context;
  }

  toGavagaiError(): GavagaiError {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}
