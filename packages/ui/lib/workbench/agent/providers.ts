/**
 * The chat providers the agent drawer offers: `@istar-ts/agent` 0.16.0's
 * provider layer (istar-ts#257), in the shapes it publishes, held here
 * until that version is on the registry. At the bump this file re-exports
 * the library's `ChatProvider`, `ModelInfo`, `Attachment` and `PROVIDERS`,
 * and `createChatClient`/`runAgent` take `provider` and `attachments`
 * themselves (goal-controller#485).
 */
import { DEEPSEEK } from '@istar-ts/agent';
import { z } from 'zod';

export type ChatProviderId = 'deepseek';

export type ModelInfo = { readonly id: string; readonly label?: string };

/** A file the user attached to a message, read as text. */
export type Attachment = {
  readonly name: string;
  readonly mime: string;
  readonly text: string;
};

export type AcceptedFile = {
  readonly extension: string;
  readonly mime: string;
};

export type ChatProvider = {
  readonly id: ChatProviderId;
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  /** what the model selector offers when `listModels` can't ask the provider */
  readonly fallbackModels: readonly ModelInfo[];
  /** the provider's models; never rejects (its `fallbackModels` instead) */
  listModels(
    apiKey: string,
    fetchImpl?: typeof fetch,
  ): Promise<readonly ModelInfo[]>;
  /** the files `attach` takes, by extension (with the dot) */
  readonly acceptedFiles: readonly AcceptedFile[];
  /** the attachments as the text the request carries ahead of the prompt */
  attach(files: readonly Attachment[]): string;
};

/** OpenAI-compatible `GET /models`. */
const modelList = z.object({
  data: z.array(z.object({ id: z.string() })),
});

const TEXT_FILES: readonly AcceptedFile[] = [
  { extension: '.txt', mime: 'text/plain' },
  { extension: '.md', mime: 'text/markdown' },
  { extension: '.json', mime: 'application/json' },
  { extension: '.csv', mime: 'text/csv' },
  { extension: '.yaml', mime: 'application/yaml' },
  { extension: '.yml', mime: 'application/yaml' },
  { extension: '.xml', mime: 'application/xml' },
  { extension: '.props', mime: 'text/plain' },
  { extension: '.prism', mime: 'text/plain' },
  { extension: '.pm', mime: 'text/plain' },
];

const DEEPSEEK_PROVIDER: ChatProvider = {
  id: 'deepseek',
  label: 'DeepSeek',
  baseUrl: DEEPSEEK.baseUrl,
  defaultModel: DEEPSEEK.model,
  fallbackModels: [{ id: DEEPSEEK.model }],
  async listModels(apiKey, fetchImpl = fetch) {
    if (!apiKey) return DEEPSEEK_PROVIDER.fallbackModels;
    try {
      const response = await fetchImpl(`${DEEPSEEK.baseUrl}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return DEEPSEEK_PROVIDER.fallbackModels;
      const parsed = modelList.safeParse(await response.json());
      if (!parsed.success || parsed.data.data.length === 0)
        return DEEPSEEK_PROVIDER.fallbackModels;
      return parsed.data.data.map(({ id }) => ({ id }));
    } catch {
      return DEEPSEEK_PROVIDER.fallbackModels;
    }
  },
  acceptedFiles: TEXT_FILES,
  attach: (files) =>
    files
      .map(
        ({ name, mime, text }) =>
          `<file name="${name}" type="${mime}">\n${text}\n</file>`,
      )
      .join('\n\n'),
};

export const PROVIDERS: Record<ChatProviderId, ChatProvider> = {
  deepseek: DEEPSEEK_PROVIDER,
};
