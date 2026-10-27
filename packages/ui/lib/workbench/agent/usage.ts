/**
 * What a conversation with the agent has used (goal-controller#485): its
 * context (the last model call's tokens: what the next request starts
 * from), its tokens in all, and what they cost at the prices set in the
 * drawer's settings (none: no cost shown). The provider reports the tokens;
 * neither it nor `@istar-ts/agent` knows a price or a context window.
 */
import type { Usage } from '@istar-ts/agent';

/** USD per million tokens; a cache hit at `input` when it has no price of its own */
export type TokenPrices = {
  input: number | null;
  cachedInput: number | null;
  output: number | null;
};

export const NO_PRICES: TokenPrices = {
  input: null,
  cachedInput: null,
  output: null,
};

export type ConversationUsage = {
  contextTokens: number;
  totalTokens: number;
  /** null: no prices set */
  cost: number | null;
};

export const NO_USAGE: ConversationUsage = {
  contextTokens: 0,
  totalTokens: 0,
  cost: null,
};

/** `costPerMillionTokens`' arguments, once the input and output prices are set */
export const pricesOf = (
  prices: TokenPrices,
): { input: number; cachedInput?: number; output: number } | null =>
  prices.input === null || prices.output === null
    ? null
    : {
        input: prices.input,
        output: prices.output,
        ...(prices.cachedInput === null
          ? {}
          : { cachedInput: prices.cachedInput }),
      };

/** a model call's usage added to the conversation's, priced by `cost` */
export const addUsage = (
  usage: ConversationUsage,
  step: Usage,
  cost: ((usage: Usage) => number) | null,
): ConversationUsage => ({
  contextTokens: step.total_tokens,
  totalTokens: usage.totalTokens + step.total_tokens,
  cost: cost ? (usage.cost ?? 0) + cost(step) : null,
});

/** 950 → "950", 12_400 → "12.4k", 1_250_000 → "1.25M" */
export const formatTokens = (tokens: number): string =>
  tokens < 1000
    ? String(tokens)
    : tokens < 1_000_000
      ? `${Number((tokens / 1000).toFixed(1))}k`
      : `${Number((tokens / 1_000_000).toFixed(2))}M`;

/** "$0.0123": four places, fractions of a cent being what one request costs */
export const formatCost = (cost: number): string => `$${cost.toFixed(4)}`;
