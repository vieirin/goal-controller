/**
 * Each model's agent conversation, kept the way Recent is kept
 * (goal-controller#485 follow-up; lib/project's `recentId`): in
 * `localStorage`, keyed by the project identity the model opens as, so
 * switching away and back to it (or reloading) brings its conversation
 * back, read-only (`useAgentChat`). Never in the project file. A
 * conversation nothing was said in yet isn't stored; one too long for its
 * budget drops its oldest entries.
 */
import { recentId, type RecentEntry } from '@/lib/project';
import type { StoredChatEntry } from './chatTranscript';
import type { ConversationUsage } from './usage';

const CONVERSATIONS_KEY = 'goal-workbench:agent:conversations:v1';
const MAX_ENTRIES = 200;
const MAX_STORED_CHARS = 1_000_000;

/** what a model's Recent entry is identified by (recentId) */
export type ConversationKey = Pick<
  RecentEntry,
  'fileName' | 'source' | 'aside'
>;

export type StoredConversation = {
  entries: readonly StoredChatEntry[];
  usage: ConversationUsage;
};

type ConversationStore = { [id: string]: StoredConversation };

const read = (): ConversationStore => {
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object'
      ? (value as ConversationStore)
      : {};
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

export const loadConversation = (
  key: ConversationKey,
): StoredConversation | null => read()[recentId(key)] ?? null;

/**
 * `conversation` kept under `key`'s recentId; nothing said yet (no entries)
 * is dropped instead of stored empty.
 */
export const saveConversation = (
  key: ConversationKey,
  conversation: StoredConversation,
): void => {
  const store = { ...read() };
  const id = recentId(key);
  if (conversation.entries.length === 0) delete store[id];
  else
    store[id] = {
      entries: capped(conversation.entries),
      usage: conversation.usage,
    };
  write(store);
};

export const forgetConversation = (key: ConversationKey): void => {
  const store = { ...read() };
  delete store[recentId(key)];
  write(store);
};
