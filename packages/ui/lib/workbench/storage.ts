import type { ModelSettings } from './types';

/**
 * Browser persistence for the workbench. Preferences (engine, options,
 * variable values) are kept across reloads; models are not reopened on load —
 * the model being edited is kept in Recent, from where the user picks it up.
 */

const WORKSPACE_KEY = 'goal-workbench:workspace:v1';
const RECENT_KEY = 'goal-workbench:recent:v1';
const MAX_RECENT = 8;
const MAX_STORED_CHARS = 2_000_000;

export type RecentFile = {
  fileName: string;
  text: string;
  /** last exported (or opened) version; differs from text when there are unsaved edits */
  savedText?: string;
  /** engine and options last used with this model */
  settings?: ModelSettings;
  at: number;
};

const read = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): boolean => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled
  }
};

export const loadPreferences = <T extends object>(): T | null => {
  const stored = read<T & { fileName?: string; text?: string; savedText?: string }>(WORKSPACE_KEY);
  if (!stored) return null;
  // older versions autosaved the open model here: move it to Recent so it isn't lost
  const { fileName, text, savedText, ...preferences } = stored;
  if (text) {
    rememberRecent({ fileName: fileName || 'untitled.txt', text, savedText });
    write(WORKSPACE_KEY, preferences);
  }
  return preferences as T;
};

export const savePreferences = (preferences: object): boolean => write(WORKSPACE_KEY, preferences);

export const loadRecent = (): RecentFile[] => read<RecentFile[]>(RECENT_KEY) ?? [];

/** Remember a file (newest first, one entry per name). */
export const rememberRecent = (file: Omit<RecentFile, 'at'>): RecentFile[] => {
  if (!file.text || file.text.length > MAX_STORED_CHARS) return loadRecent();
  const next = [
    { ...file, at: Date.now() },
    ...loadRecent().filter((r) => r.fileName !== file.fileName),
  ].slice(0, MAX_RECENT);
  // drop the oldest entries until it fits
  while (next.length > 0 && !write(RECENT_KEY, next)) next.pop();
  return next;
};

export const forgetRecent = (fileName: string): RecentFile[] => {
  const next = loadRecent().filter((r) => r.fileName !== fileName);
  write(RECENT_KEY, next);
  return next;
};

/** "just now", "5 min ago", "3 h ago", "Sep 24" */
export const recentAge = (at: number, now: number = Date.now()): string => {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const hasUnsavedEdits = (file: RecentFile): boolean =>
  file.savedText !== undefined && file.savedText !== file.text;
