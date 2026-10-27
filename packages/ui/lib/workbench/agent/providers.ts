/**
 * The chat providers the agent drawer offers (goal-controller#485):
 * `@istar-ts/agent`'s (istar-ts#257), each also taking the workbench's own
 * file types as text — what an @-chip attaches (a `.props`, a framework's
 * native file, a piStar model), which istar-ts, knowing no modeller's
 * files, doesn't list. `createChatClient({ provider })` keeps the object,
 * so `runAgent` inlines attachments with its `attach`.
 */
import {
  PROVIDERS as AGENT_PROVIDERS,
  type ChatProvider,
  type ChatProviderId,
} from '@istar-ts/agent';

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
