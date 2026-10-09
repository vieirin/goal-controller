/**
 * Recent: the projects (single files are implicit ones) last worked on, newest
 * first, each with its latest text so unsaved edits survive a reload. Kept
 * through a storage port (the browser's localStorage), read only when called.
 */
import type { ProjectSource } from './store';

/** Storage's two methods: window.localStorage is one. */
export interface RecentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The key entries were always kept under: older entries read as they are. */
export const RECENT_KEY = 'goal-workbench:recent:v1';
const MAX_RECENT = 8;
const MAX_STORED_CHARS = 2_000_000;

/**
 * `Settings`: what the workbench keeps with an entry (its engine, options and
 * workbench state when it was left); opaque here.
 */
export type RecentEntry<Settings = unknown> = {
  fileName: string;
  text: string;
  /** last exported (or opened) version; differs from text when there are unsaved edits */
  savedText?: string;
  settings?: Settings;
  /** where the project came from (missing in entries written before projects) */
  source?: ProjectSource;
  at: number;
};

const read = <Settings>(storage: RecentStorage): RecentEntry<Settings>[] => {
  try {
    const raw = storage.getItem(RECENT_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is RecentEntry<Settings> =>
            typeof entry?.fileName === 'string' &&
            typeof entry?.text === 'string',
        )
      : [];
  } catch {
    return [];
  }
};

const write = (storage: RecentStorage, value: unknown): boolean => {
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled
  }
};

export const loadRecent = <Settings = unknown>(
  storage: RecentStorage,
): RecentEntry<Settings>[] => read<Settings>(storage);

/** Remember a project (newest first, one entry per name). */
export const rememberRecent = <Settings = unknown>(
  storage: RecentStorage,
  entry: Omit<RecentEntry<Settings>, 'at'>,
  now: number = Date.now(),
): RecentEntry<Settings>[] => {
  if (!entry.text || entry.text.length > MAX_STORED_CHARS)
    return read<Settings>(storage);
  const next = [
    { ...entry, at: now },
    ...read<Settings>(storage).filter((r) => r.fileName !== entry.fileName),
  ].slice(0, MAX_RECENT);
  // drop the oldest entries until it fits
  while (next.length > 0 && !write(storage, next)) next.pop();
  return next;
};

export const forgetRecent = <Settings = unknown>(
  storage: RecentStorage,
  fileName: string,
): RecentEntry<Settings>[] => {
  const next = read<Settings>(storage).filter((r) => r.fileName !== fileName);
  write(storage, next);
  return next;
};

/** "just now", "5 min ago", "3 h ago", "Sep 24" */
export const recentAge = (at: number, now: number = Date.now()): string => {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
};

export const hasUnsavedEdits = (entry: RecentEntry): boolean =>
  entry.savedText !== undefined && entry.savedText !== entry.text;
