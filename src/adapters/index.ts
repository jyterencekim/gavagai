/**
 * LLM Adapter interface and registry
 * Based on README Section 6
 */

import type { ModelSpec } from '../types/index.js';

/**
 * Interface for LLM provider adapters
 */
export interface IModelAdapter {
  /** Unique identifier for this adapter */
  readonly providerId: string;

  /**
   * Send a prompt to the LLM and get a response
   * @param systemPrompt The system/instruction prompt
   * @param userMessage The user's message
   * @param spec Model specification with provider-specific params
   * @returns The raw text response from the LLM
   */
  complete(
    systemPrompt: string,
    userMessage: string,
    spec: ModelSpec
  ): Promise<string>;
}

/**
 * Registry for model adapters
 */
const adapters = new Map<string, IModelAdapter>();

/**
 * Register a custom adapter
 */
export function registerAdapter(adapter: IModelAdapter): void {
  adapters.set(adapter.providerId, adapter);
}

/**
 * Unregister an adapter
 */
export function unregisterAdapter(providerId: string): void {
  adapters.delete(providerId);
}

/**
 * Get an adapter by provider ID
 */
export function getAdapter(providerId: string): IModelAdapter | undefined {
  return adapters.get(providerId);
}

/**
 * List all registered provider IDs
 */
export function getProviderIds(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Check if an adapter is registered for a provider
 */
export function hasAdapter(providerId: string): boolean {
  return adapters.has(providerId);
}

// Re-export adapter implementations
export { AnthropicAdapter } from './anthropic.js';
export { OpenAIAdapter } from './openai.js';
