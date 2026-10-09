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
  /**
   * An edited entry moved aside when a clean file with the same identity came
   * in (its edits are kept, as a second entry): 1, 2, …
   */
  aside?: number;
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

/**
 * Which entry a project is: where it came from and its file name, so an
 * example and a local file of the same name are two entries (opening one
 * never replaces the other's edits). Entries written before projects have no
 * source and count as local files.
 */
export const recentId = (
  entry: Pick<RecentEntry, 'fileName' | 'source' | 'aside'>,
): string => {
  const { source, fileName, aside } = entry;
  const copy = aside ? `~${aside}` : '';
  switch (source?.kind) {
    case undefined:
    case 'file':
      return `file:${fileName}${copy}`;
    case 'directory':
      return `directory:${source.key}:${fileName}${copy}`;
    case 'opfs':
      return `opfs:${source.name}:${fileName}${copy}`;
    case 'github':
      return `github:${source.repo}/${source.path}:${fileName}${copy}`;
  }
};

export const loadRecent = <Settings = unknown>(
  storage: RecentStorage,
): RecentEntry<Settings>[] => read<Settings>(storage);

/**
 * Remember a project (newest first, one entry per project: recentId). An
 * entry with edits not exported is never lost to a clean file of the same
 * identity and other text (a fresh copy opened again): it is moved aside, as
 * an entry of its own. Edits going on, an export or a reopen replace it.
 */
export const rememberRecent = <Settings = unknown>(
  storage: RecentStorage,
  entry: Omit<RecentEntry<Settings>, 'at'>,
  now: number = Date.now(),
): RecentEntry<Settings>[] => {
  const entries = read<Settings>(storage);
  if (!entry.text || entry.text.length > MAX_STORED_CHARS) return entries;
  const id = recentId(entry);
  const kept = entries.find((r) => recentId(r) === id);
  const others = entries.filter((r) => recentId(r) !== id);
  const clean = entry.savedText === undefined || entry.savedText === entry.text;
  const asideOf = (r: RecentEntry<Settings>) =>
    recentId({ ...r, aside: undefined }) ===
    recentId({ ...entry, aside: undefined })
      ? (r.aside ?? 0)
      : 0;
  const movedAside =
    kept && clean && hasUnsavedEdits(kept) && kept.text !== entry.text
      ? [{ ...kept, aside: Math.max(0, ...entries.map(asideOf)) + 1 }]
      : [];
  const next = [{ ...entry, at: now }, ...movedAside, ...others].slice(
    0,
    MAX_RECENT,
  );
  // drop the oldest entries until it fits
  while (next.length > 0 && !write(storage, next)) next.pop();
  return next;
};

/** `id`: the entry's recentId. */
export const forgetRecent = <Settings = unknown>(
  storage: RecentStorage,
  id: string,
): RecentEntry<Settings>[] => {
  const next = read<Settings>(storage).filter((r) => recentId(r) !== id);
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
