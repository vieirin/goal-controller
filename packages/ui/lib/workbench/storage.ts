/** Browser persistence for the workbench (autosave + recent files). */

const WORKSPACE_KEY = 'goal-workbench:workspace:v1';
const RECENT_KEY = 'goal-workbench:recent:v1';
const MAX_RECENT = 8;
const MAX_STORED_CHARS = 2_000_000;

export type RecentFile = { fileName: string; text: string; at: number };

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

export const loadWorkspace = <T,>(): T | null => read<T>(WORKSPACE_KEY);

export const saveWorkspace = (workspace: { text: string }): boolean =>
  workspace.text.length <= MAX_STORED_CHARS && write(WORKSPACE_KEY, workspace);

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
