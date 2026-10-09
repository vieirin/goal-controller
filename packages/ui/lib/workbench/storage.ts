import {
  forgetRecent as forgetEntry,
  loadRecent as loadEntries,
  rememberRecent as rememberEntry,
  type RecentEntry,
  type RecentStorage,
} from '../project';
import type { ModelSettings } from './types';

/**
 * Browser persistence for the workbench. Preferences (engine, options,
 * variable values) are kept across reloads; models are not reopened on load —
 * the model being edited is kept in Recent (lib/project), from where the user
 * picks it up.
 */

const WORKSPACE_KEY = 'goal-workbench:workspace:v1';

/** A Recent entry with the settings the workbench keeps with it. */
export type RecentFile = RecentEntry<ModelSettings>;

/** localStorage, read when used: storage may be disabled (and there is none on the server) */
const browserStorage: RecentStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

const read = <T>(key: string): T | null => {
  try {
    const raw = browserStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): boolean => {
  try {
    browserStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled
  }
};

export const loadPreferences = <T extends object>(): T | null => {
  const stored = read<
    T & { fileName?: string; text?: string; savedText?: string }
  >(WORKSPACE_KEY);
  if (!stored) return null;
  // older versions autosaved the open model here: move it to Recent so it isn't lost
  const { fileName, text, savedText, ...preferences } = stored;
  if (text) {
    rememberRecent({ fileName: fileName || 'untitled.txt', text, savedText });
    write(WORKSPACE_KEY, preferences);
  }
  return preferences as T;
};

export const savePreferences = (preferences: object): boolean =>
  write(WORKSPACE_KEY, preferences);

export const loadRecent = (): RecentFile[] =>
  loadEntries<ModelSettings>(browserStorage);

/** Remember a project (newest first, one entry per project: recentId). */
export const rememberRecent = (file: Omit<RecentFile, 'at'>): RecentFile[] =>
  rememberEntry<ModelSettings>(browserStorage, file);

/** `id`: the entry's recentId. */
export const forgetRecent = (id: string): RecentFile[] =>
  forgetEntry<ModelSettings>(browserStorage, id);
