/**
 * The chat providers the agent drawer offers (goal-controller#485):
 * `@istar-ts/agent`'s (istar-ts#257), each also taking the workbench's own
 * file types as text — what an @-chip attaches (a `.props`, a framework's
 * native file, a piStar model, an engine's output), which istar-ts, knowing no modeller's
 * files, doesn't list. `createChatClient({ provider })` keeps the object,
 * so `runAgent` inlines attachments with its `attach`.
 */
import {
  PROVIDERS as AGENT_PROVIDERS,
  type ChatProvider,
  type ChatProviderId,
} from '@istar-ts/agent';
import { NO_PRICES, type TokenPrices } from './usage';

export type {
  Attachment,
  ChatProvider,
  ChatProviderId,
  ModelInfo,
} from '@istar-ts/agent';

export type AcceptedFile = ChatProvider['acceptedFiles'][number];

const WORKBENCH_FILES: readonly AcceptedFile[] = [
  { extension: '.props', mime: 'text/plain' },
  { extension: '.kaos', mime: 'text/plain' },
  { extension: '.istardtx', mime: 'text/plain' },
  { extension: '.tropos', mime: 'text/plain' },
  { extension: '.jucm', mime: 'text/plain' },
  { extension: '.hddl', mime: 'text/plain' },
  { extension: '.istar', mime: 'text/plain' },
  { extension: '.pistar', mime: 'text/plain' },
  { extension: '.xml', mime: 'application/xml' },
  // what the engines generate
  { extension: '.prism', mime: 'text/plain' },
  { extension: '.nm', mime: 'text/plain' },
  { extension: '.pm', mime: 'text/plain' },
  { extension: '.pctl', mime: 'text/plain' },
  { extension: '.lts', mime: 'text/plain' },
  { extension: '.pl', mime: 'text/plain' },
  { extension: '.rannot', mime: 'text/plain' },
  { extension: '.sleec', mime: 'text/plain' },
];

const withWorkbenchFiles = (provider: ChatProvider): ChatProvider => ({
  ...provider,
  acceptedFiles: [
    ...provider.acceptedFiles,
    ...WORKBENCH_FILES.filter(
      ({ extension }) =>
        !provider.acceptedFiles.some((file) => file.extension === extension),
    ),
  ],
});

export const PROVIDERS: Record<ChatProviderId, ChatProvider> = {
  deepseek: withWorkbenchFiles(AGENT_PROVIDERS.deepseek),
};

export const isProviderId = (value: unknown): value is ChatProviderId =>
  typeof value === 'string' && Object.hasOwn(PROVIDERS, value);

/**
 * DeepSeek's published list prices, USD per 1M tokens, peak rate
 * (https://api-docs.deepseek.com/quick_start/pricing, read 2026-10-27;
 * off-peak, 01:00–04:00 and 06:00–10:00 UTC on weekdays, is half). No entry
 * for a model DeepSeek hasn't published one for (`deepseek-chat`,
 * `deepseek-reasoner`): `effectivePrices` falls back to nothing for it,
 * unless the settings type one in.
 */
export const LIST_PRICES: Partial<Record<string, TokenPrices>> = {
  'deepseek-flash': { input: 0.3, cachedInput: 0.006, output: 1.2 },
  'deepseek-v4-pro': { input: 1.32, cachedInput: 0.044, output: 3.96 },
};

/**
 * `typed` (the settings' prices), each field falling back to `model`'s list
 * price (none listed: unset, as `typed` alone would leave it). `fromList`:
 * at least one field is the list's, not typed in the settings — what the
 * usage line's "est." and its title read off.
 */
export const effectivePrices = (
  typed: TokenPrices,
  model: string,
): { prices: TokenPrices; fromList: boolean } => {
  const list = LIST_PRICES[model] ?? NO_PRICES;
  const prices: TokenPrices = {
    input: typed.input ?? list.input,
    cachedInput: typed.cachedInput ?? list.cachedInput,
    output: typed.output ?? list.output,
  };
  const fromList =
    (typed.input === null && list.input !== null) ||
    (typed.cachedInput === null && list.cachedInput !== null) ||
    (typed.output === null && list.output !== null);
  return { prices, fromList };
};
