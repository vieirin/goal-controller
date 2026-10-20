/**
 * Native files as data (goal-controller#143): which of a set of dialects'
 * native files a file's name says it is, and the piStar model as two are
 * compared, a native file's read and the project's `model.json`: what its
 * format can't carry (`lossy`) left out, keys and id'd lists in one order.
 */
import type {
  AnyDialect,
  NativeDiagnostic,
  NativeFileDefinition,
  PistarJson,
} from './schema';

/** Why a native file didn't read or wasn't written: its first error's message. */
export const firstError = (diagnostics: readonly NativeDiagnostic[]): string =>
  diagnostics.find((d) => d.severity === 'error')?.message ?? 'no reason given';

/** A value as a JSON file's text (a piStar model's): two-space indents, a final line break. */
export const jsonText = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

/** A native file of a dialect, as a file's name finds it. */
export type FoundNativeFile = {
  /** the dialect's id */
  dialect: string;
  /** the native file's id in the dialect */
  id: string;
  file: NativeFileDefinition;
  /** the extension it was found by */
  extension: string;
  /** the file's name without it: the model's */
  baseName: string;
};

/** Every native file the dialects declare, with the dialect's id, in their order. */
export const nativeFilesOf = (
  dialects: readonly Pick<AnyDialect, 'id' | 'nativeFiles'>[],
): { dialect: string; id: string; file: NativeFileDefinition }[] =>
  dialects.flatMap((dialect) =>
    Object.entries(dialect.nativeFiles ?? {}).map(([id, file]) => ({
      dialect: dialect.id,
      id,
      file,
    })),
  );

/** The extensions the dialects' native files are opened by, in their order, each once. */
export const nativeExtensions = (
  dialects: readonly Pick<AnyDialect, 'id' | 'nativeFiles'>[],
): string[] => [
  ...new Set(nativeFilesOf(dialects).flatMap(({ file }) => file.extensions)),
];

/**
 * The extensions two dialects' native files both take: which the Open
 * dialog can't tell apart (a registry checks there are none). Dialects
 * over one another that declare the same native file (one definition,
 * goal-controller#190) share it: its reader says which of them a file opens
 * in (`dialectRecord.engine`).
 */
export const sharedNativeExtensions = (
  dialects: readonly Pick<AnyDialect, 'id' | 'nativeFiles'>[],
): { extension: string; dialects: string[] }[] => {
  const by = new Map<
    string,
    { dialects: string[]; files: Set<NativeFileDefinition> }
  >();
  for (const { dialect, file } of nativeFilesOf(dialects))
    for (const extension of file.extensions) {
      const owners = by.get(extension) ?? { dialects: [], files: new Set() };
      owners.dialects.push(dialect);
      owners.files.add(file);
      by.set(extension, owners);
    }
  return [...by]
    .filter(([, owners]) => owners.files.size > 1)
    .map(([extension, owners]) => ({ extension, dialects: owners.dialects }));
};

/** The native file a file's name says it is (its longest extension wins), or null. */
export const nativeFileFor = (
  dialects: readonly Pick<AnyDialect, 'id' | 'nativeFiles'>[],
  fileName: string,
): FoundNativeFile | null => {
  const lower = fileName.toLowerCase();
  let found: FoundNativeFile | null = null;
  for (const { dialect, id, file } of nativeFilesOf(dialects))
    for (const extension of file.extensions)
      if (
        lower.endsWith(extension) &&
        lower.length > extension.length &&
        (!found || extension.length > found.extension.length)
      )
        found = {
          dialect,
          id,
          file,
          extension,
          baseName: fileName.slice(0, fileName.length - extension.length),
        };
  return found;
};

/** Whether a lossy path (`actors.*.nodes.*.x`) names a value's path (its keys and indices). */
const matches = (pattern: readonly string[], path: readonly string[]) =>
  pattern.length === path.length &&
  pattern.every((part, i) => part === '*' || part === path[i]);

/** A value without what the lossy paths name, at any depth. */
export const withoutLossy = (
  value: unknown,
  lossy: readonly string[] = [],
): unknown => {
  const patterns = lossy.map((path) => path.split('.'));
  const walk = (inner: unknown, path: string[]): unknown => {
    if (Array.isArray(inner))
      return inner
        .map((item, i): [unknown, string[]] => [item, [...path, String(i)]])
        .filter(([, at]) => !patterns.some((p) => matches(p, at)))
        .map(([item, at]) => walk(item, at));
    if (inner && typeof inner === 'object')
      return Object.fromEntries(
        Object.entries(inner)
          .filter(([key]) => !patterns.some((p) => matches(p, [...path, key])))
          .map(([key, item]) => [key, walk(item, [...path, key])]),
      );
    return inner;
  };
  return walk(value, []);
};

/**
 * The piStar lists whose order means nothing, compared as sets: the links
 * and the dependencies (a file may write them in any order). Every other
 * list is compared in order: the actors, their nodes, the orphans (the
 * model's order, which the Notation view and the layout keep).
 */
export const UNORDERED_LISTS: readonly string[] = ['links', 'dependencies'];

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A value with its keys sorted at any depth; the top-level lists of
 * UNORDERED_LISTS in one order (by id, then by content: repeated ids too).
 */
const ordered = (value: unknown, path: readonly string[] = []): unknown => {
  if (Array.isArray(value)) {
    const items = value.map((item, i) => ordered(item, [...path, String(i)]));
    if (path.length !== 1 || !UNORDERED_LISTS.includes(path[0]!)) return items;
    const key = (item: unknown) =>
      `${item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : ''}\u0000${JSON.stringify(item)}`;
    return items
      .map((item) => [key(item), item] as const)
      .sort(([a], [b]) => byText(a, b))
      .map(([, item]) => item);
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          ordered((value as Record<string, unknown>)[key], [...path, key]),
        ]),
    );
  return value;
};

/**
 * A piStar model as two are compared: what the lossy paths name left out
 * (before anything is reordered: an index is the model's), every object's
 * keys sorted, the lists whose order means nothing (UNORDERED_LISTS: the
 * links, the dependencies) in one order; every other list as it is.
 */
export const canonicalModel = (
  model: PistarJson,
  lossy: readonly string[] = [],
): unknown => ordered(withoutLossy(model, lossy));

/**
 * Where two piStar models differ, but for the lossy paths: the first
 * differing path and both values there (JSON), or null when they don't.
 * Order counts but in the links and the dependencies (UNORDERED_LISTS):
 * two models with their actors or nodes in another order differ.
 */
export const modelDifference = (
  a: PistarJson,
  b: PistarJson,
  lossy: readonly string[] = [],
): { path: string; a: string; b: string } | null => {
  const walk = (
    x: unknown,
    y: unknown,
    path: string[],
  ): { path: string; a: string; b: string } | null => {
    const objects =
      x && y && typeof x === 'object' && typeof y === 'object' ? true : false;
    if (objects && Array.isArray(x) === Array.isArray(y)) {
      const keys = [
        ...new Set([...Object.keys(x as object), ...Object.keys(y as object)]),
      ];
      for (const key of keys) {
        const left = (x as Record<string, unknown>)[key];
        // an id'd item is named by its id (`actors.a.nodes.G1.text`)
        const id =
          Array.isArray(x) && left && typeof left === 'object' && 'id' in left
            ? String((left as { id: unknown }).id)
            : key;
        const found = walk(left, (y as Record<string, unknown>)[key], [
          ...path,
          id,
        ]);
        if (found) return found;
      }
      return null;
    }
    const [left, right] = [JSON.stringify(x), JSON.stringify(y)];
    return left === right
      ? null
      : {
          path: path.join('.') || '(the model)',
          a: left ?? 'nothing',
          b: right ?? 'nothing',
        };
  };
  return walk(canonicalModel(a, lossy), canonicalModel(b, lossy), []);
};
