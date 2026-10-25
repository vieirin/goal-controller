/**
 * The agent drawer's own settings (goal-controller#415): the chat endpoint,
 * model and API key, typed into the drawer and kept in `localStorage` only —
 * never in the project file, and never sent anywhere but the endpoint the
 * user configured (`createChatClient`'s closure keeps the key out of the
 * transcript too). Separate key from `lib/workbench/storage.ts`'s workspace
 * preferences: those are exported with a project's settings; this isn't.
 */
import { DEEPSEEK } from '@istar-ts/agent';
import type { ApprovalMode } from '@istar-ts/agent';

const AGENT_SETTINGS_KEY = 'goal-workbench:agent:v1';

export type AgentSettings = {
  baseUrl: string;
  model: string;
  apiKey: string;
  approval: ApprovalMode;
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  baseUrl: DEEPSEEK.baseUrl,
  model: DEEPSEEK.model,
  apiKey: '',
  approval: 'propose',
};

export const loadAgentSettings = (): AgentSettings => {
  try {
    const raw = window.localStorage.getItem(AGENT_SETTINGS_KEY);
    if (!raw) return DEFAULT_AGENT_SETTINGS;
    return { ...DEFAULT_AGENT_SETTINGS, ...(JSON.parse(raw) as object) };
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
