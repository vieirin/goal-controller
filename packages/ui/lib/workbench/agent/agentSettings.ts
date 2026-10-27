/**
 * The agent drawer's own settings (goal-controller#415, #485): the chat
 * provider, its model and the API key, set in the drawer and kept in
 * `localStorage` only — never in the project file, and never sent anywhere
 * but the provider's endpoint (`createChatClient`'s closure keeps the key out
 * of the transcript too). Separate key from `lib/workbench/storage.ts`'s
 * workspace preferences: those are exported with a project's settings; this
 * isn't.
 */
import type { ApprovalMode } from '@istar-ts/agent';
import { z } from 'zod';
import { isProviderId, PROVIDERS, type ChatProviderId } from './providers';

const AGENT_SETTINGS_KEY = 'goal-workbench:agent:v1';

export type AgentSettings = {
  providerId: ChatProviderId;
  /** one of the provider's models (`listModels`); its `defaultModel` at first */
  model: string;
  apiKey: string;
  approval: ApprovalMode;
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  providerId: 'deepseek',
  model: PROVIDERS.deepseek.defaultModel,
  apiKey: '',
  approval: 'propose',
};

/**
 * Each field read on its own, the default for one that's missing or wrong:
 * a stored entry from before the providers (a `baseUrl` endpoint, no provider) keeps its key, model
 * and approval mode.
 */
const storedSettings = z.object({
  providerId: z
    .custom<ChatProviderId>(isProviderId)
    .catch(DEFAULT_AGENT_SETTINGS.providerId),
  model: z.string().min(1).optional().catch(undefined),
  apiKey: z.string().catch(DEFAULT_AGENT_SETTINGS.apiKey),
  approval: z.enum(['propose', 'auto']).catch(DEFAULT_AGENT_SETTINGS.approval),
});

export const loadAgentSettings = (): AgentSettings => {
  try {
    const raw = window.localStorage.getItem(AGENT_SETTINGS_KEY);
    if (!raw) return DEFAULT_AGENT_SETTINGS;
    const parsed = storedSettings.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_AGENT_SETTINGS;
    const { providerId, model, apiKey, approval } = parsed.data;
    return {
      providerId,
      model: model ?? PROVIDERS[providerId].defaultModel,
      apiKey,
      approval,
    };
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
};

export const saveAgentSettings = (settings: AgentSettings): void => {
  try {
    window.localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage disabled or over quota: the drawer keeps the in-memory settings for this session
  }
};

/**
 * `model` if the provider lists it, else its default model when listed, else
 * the list's first: what the selector shows once `listModels` has answered.
 */
export const modelIn = (
  models: readonly { id: string }[],
  model: string,
  defaultModel: string,
): string =>
  models.some(({ id }) => id === model)
    ? model
    : models.some(({ id }) => id === defaultModel)
      ? defaultModel
      : (models[0]?.id ?? defaultModel);
