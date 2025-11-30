/**
 * Prompt assembly for Gavagai
 * Based on README Section 5
 */

import type { Ontology, FewShotExample, GavagaiInput, KnowledgeBase } from './types/index.js';

/**
 * Serialize an object to a readable string format for prompts
 */
function serializeForPrompt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Format few-shot examples for the prompt
 */
function formatFewShotExamples(examples?: FewShotExample[]): string {
  if (!examples || examples.length === 0) {
    return 'No examples provided.';
  }

  return examples
    .map((ex, i) => {
      let exampleStr = `### Example ${i + 1}\n`;
      exampleStr += `**Input:** ${ex.input}\n`;
      exampleStr += `**Output:**\n\`\`\`json\n${JSON.stringify(ex.output, null, 2)}\n\`\`\``;
      if (ex.rationale) {
        exampleStr += `\n**Rationale:** ${ex.rationale}`;
      }
      return exampleStr;
    })
    .join('\n\n');
}

/**
 * Format knowledge base information for the prompt
 */
function formatKnowledgeBase(knowledgeBase?: KnowledgeBase): string {
  if (!knowledgeBase) {
    return '';
  }

  let kbSection = '';

  if (knowledgeBase.context && Object.keys(knowledgeBase.context).length > 0) {
    kbSection += `## Current Context

The following context describes the current situation in which utterances are being interpreted.
Use this information to better understand the intent and resolve ambiguities.

\`\`\`json
${serializeForPrompt(knowledgeBase.context)}
\`\`\`

`;
  }

  if (knowledgeBase.knowledge && Object.keys(knowledgeBase.knowledge).length > 0) {
    kbSection += `## Domain Knowledge

The following knowledge provides general know-hows, facts, rules, and patterns
that should inform your interpretation.

\`\`\`json
${serializeForPrompt(knowledgeBase.knowledge)}
\`\`\`

`;
  }

  return kbSection;
}

/**
 * Build the system prompt for interpretation
 */
export function buildSystemPrompt(
  ontology: Ontology,
  currentDate?: string,
  fewShot?: FewShotExample[],
  knowledgeBase?: KnowledgeBase
): string {
  // Priority: knowledgeBase.context.currentDate > currentDate param > today's date
  const date =
    (knowledgeBase?.context?.['currentDate'] as string | undefined) ??
    (knowledgeBase?.knowledge?.['currentDate'] as string | undefined) ??
    currentDate ??
    new Date().toISOString().split('T')[0];

  return `# Role: Gavagai Interpretation Engine

You are a semantic translation engine that converts fuzzy utterances into
structured IntentionPropositions. Assume every utterance expresses an intention:
a desired state, goal, command, or request. Map it to the allowed operations.

Your output MUST be valid JSON conforming to the GavagaiResponse schema.

## Core Principles

1. **Intentions Only**: If the utterance doesn't express a desired action or state,
   return it in \`unresolved[]\` with reason "NOT_AN_INTENTION"
2. **Schema Conformance**: Only emit operations from the allowed set
3. **Entity Resolution**: Match against the provided ontology; never hallucinate IDs
4. **Preserve Original**: Always include originalRaw in every proposition
5. **Explicit Uncertainty**: Set needs_review=true when you are uncertain about
   any field; use ambiguities[] to specify which fields and why
6. **Surface Alternatives**: Include additional plausible interpretations in
   alternative_propositions[] for HITL resolution
7. **Propose Learnings**: Suggest new_entities[] for unknown aliases

## Domain Schema
\`\`\`json
${serializeForPrompt(ontology.schema)}
\`\`\`

## Allowed Verbs
\`\`\`json
${serializeForPrompt(ontology.verbs)}
\`\`\`

## Known Entities (with aliases)
\`\`\`json
${serializeForPrompt(ontology.nouns)}
\`\`\`

## Validation Rules
\`\`\`json
${serializeForPrompt(ontology.validation ?? {})}
\`\`\`

## Current Date
${date}

${formatKnowledgeBase(knowledgeBase)}## Few-Shot Examples
${formatFewShotExamples(fewShot)}

## Uncertainty Signals

Use structural signals, NOT numeric confidence:

| Signal | When to Use |
|--------|-------------|
| \`needs_review: false\` | All fields are unambiguous; safe to auto-execute |
| \`needs_review: true\` | Any uncertainty exists; queue for human review |
| \`ambiguities: [...]\` | Specify which fields are uncertain and alternatives |
| \`alternative_propositions: [...]\` | Other plausible interpretations |
| \`unresolved: [...]\` | Cannot form any proposition; needs human interpretation |

## Output Schema

Your response must be a JSON object with this structure:
\`\`\`json
{
  "propositions": [
    {
      "operation": "string (from allowed verbs)",
      "needs_review": boolean,
      "record": {
        "originalRaw": "string (the original input)",
        ...domain-specific fields
      },
      "items": [...optional sub-items],
      "ambiguities": [...optional field uncertainties],
      "reasoning": "optional string explaining interpretation"
    }
  ],
  "alternative_propositions": [...same structure as propositions],
  "unresolved": [
    {
      "originalRaw": "string",
      "reason": "string",
      "suggestedOptions": [...optional]
    }
  ],
  "new_entities": [
    {
      "alias": "string",
      "canonicalId": "optional string",
      "entityType": "string",
      "rationale": "string"
    }
  ],
  "answer": "optional string for query responses",
  "errors": [],
  "meta": {
    "inferredIntent": "action" | "query" | "mixed"
  }
}
\`\`\`

Respond ONLY with valid JSON. No explanations outside the JSON structure.`;
}

/**
 * Build the user message from input
 */
export function buildUserMessage(input: GavagaiInput): string {
  if (input.kind === 'Utterance') {
    let message = `Interpret the following utterance:\n\n${input.raw}`;
    if (input.metadata && Object.keys(input.metadata).length > 0) {
      message += `\n\nMetadata:\n${JSON.stringify(input.metadata, null, 2)}`;
    }
    return message;
  }

  // UtteranceBatch
  const utterances = input.utterances
    .map((u, i) => {
      let str = `${i + 1}. ${u.raw}`;
      if (u.metadata && Object.keys(u.metadata).length > 0) {
        str += `\n   Metadata: ${JSON.stringify(u.metadata)}`;
      }
      return str;
    })
    .join('\n');

  return `Interpret the following batch of utterances:\n\n${utterances}`;
}

/**
 * Build the complete prompt (system + user)
 */
export function buildPrompt(
  input: GavagaiInput,
  ontology: Ontology,
  currentDate?: string,
  fewShot?: FewShotExample[],
  knowledgeBase?: KnowledgeBase
): { system: string; user: string } {
  return {
    system: buildSystemPrompt(ontology, currentDate, fewShot, knowledgeBase),
    user: buildUserMessage(input),
  };
}
