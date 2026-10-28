/**
 * Each model's agent conversation, kept the way Recent is kept
 * (goal-controller#485 follow-up; lib/project's `recentId`): in
 * `localStorage`, keyed by the project identity the model opens as (the
 * caller computes the id with `recentId`, the same one Recent uses), so
 * switching away and back to it (or reloading) brings its conversation
 * back, read-only (`useAgentChat`). Never in the project file. A
 * conversation nothing was said in yet isn't stored; one too long for its
 * budget drops its oldest entries. `pruneConversations` (lib/workbench/
 * storage.ts, after every Recent change) drops a conversation whose model
 * Recent no longer lists: otherwise one evicted from Recent (its 8-entry
 * cap, or a quota that made it drop an older entry) would keep its
 * conversation here forever, and reappear with it if the same identity is
 * remembered again.
 */
import type { StoredChatEntry } from './chatTranscript';
import type { ConversationUsage } from './usage';

const CONVERSATIONS_KEY = 'goal-workbench:agent:conversations:v1';
const MAX_ENTRIES = 200;
const MAX_STORED_CHARS = 1_000_000;

export type StoredConversation = {
  entries: readonly StoredChatEntry[];
  usage: ConversationUsage;
};

type ConversationStore = { [id: string]: StoredConversation };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isUsage = (value: unknown): value is ConversationUsage =>
  isRecord(value) &&
  typeof value.contextTokens === 'number' &&
  typeof value.totalTokens === 'number' &&
  (typeof value.cost === 'number' || value.cost === null);

/** loose: a `StoredChatEntry`'s own kind tells its shape apart; this only guards against junk */
const isStoredEntry = (value: unknown): value is StoredChatEntry =>
  isRecord(value) &&
  typeof value.kind === 'string' &&
  typeof value.id === 'string';

const isStoredConversation = (value: unknown): value is StoredConversation =>
  isRecord(value) &&
  Array.isArray(value.entries) &&
  value.entries.every(isStoredEntry) &&
  isUsage(value.usage);

const read = (): ConversationStore => {
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};
    const store: ConversationStore = {};
    for (const [id, conversation] of Object.entries(value))
      if (isStoredConversation(conversation)) store[id] = conversation;
    return store;
  } catch {
    return {};
  }
};

const write = (store: ConversationStore): void => {
  try {
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(store));
  } catch {
    // storage disabled or over quota: the conversation stays in memory for this session only
  }
};

/** `entries`, capped to its latest, then (still over budget) its oldest dropped */
const capped = (
  entries: readonly StoredChatEntry[],
): readonly StoredChatEntry[] => {
  let kept = entries.slice(-MAX_ENTRIES);
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_STORED_CHARS)
    kept = kept.slice(1);
  return kept;
};

export const loadConversation = (id: string): StoredConversation | null =>
  read()[id] ?? null;

/**
 * `conversation` kept under `id` (its model's `recentId`); nothing said yet
 * (no entries) is dropped instead of stored empty.
 */
export const saveConversation = (
  id: string,
  conversation: StoredConversation,
): void => {
  const store = { ...read() };
  if (conversation.entries.length === 0) delete store[id];
  else
    store[id] = {
      entries: capped(conversation.entries),
      usage: conversation.usage,
    };
  write(store);
};

export const forgetConversation = (id: string): void => {
  const store = { ...read() };
  delete store[id];
  write(store);
};

/** only `ids`' conversations kept; every other one dropped (a model Recent no longer lists) */
export const pruneConversations = (ids: ReadonlySet<string>): void => {
  const store = read();
  const kept: ConversationStore = {};
  for (const [id, conversation] of Object.entries(store))
    if (ids.has(id)) kept[id] = conversation;
  write(kept);
};
