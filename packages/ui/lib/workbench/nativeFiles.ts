/**
 * A model's native files in the workbench (goal-controller#143): the native
 * files each registered engine's dialect declares (what the Open dialog
 * takes), and each of the open project's native files' state: one with a
 * writer follows the model (it is written from the model after each edit);
 * one that wasn't in sync when the project opened is held as it is, until
 * it is regenerated from the model or the model is re-imported from it; one
 * without a writer is compared with the model, and re-imported. What is
 * wrong is a problem (Model group), which opens the file's tab.
 */
import {
  firstError,
  nativeExtensions,
  nativeFileFor,
  type FoundNativeFile,
  type NativeDiagnostic,
  type NativeFileContext,
  type NativeWriteResult,
} from '@goal-controller/dialect';
import {
  nativeSync,
  writeNative,
  type NativeDeclarations,
  type NativeSlot,
  type NativeSync,
} from '../project';
import { isTransformEngine } from '../types';
import { dialectOf, ENGINE_LIST } from './engineDialects';
import type { Problem } from './types';

/**
 * The native files a mode's dialect declares (an engine's definition's, a
 * framework engine's too: kaosprop's `.kaos`, goal-controller#181; none for
 * the others).
 */
export const nativeDeclarationsOf = (
  mode: string | null,
): NativeDeclarations | undefined =>
  isTransformEngine(mode)
    ? (dialectOf(mode) as { nativeFiles?: NativeDeclarations } | null)
        ?.nativeFiles
    : undefined;

/** Every registered engine's dialect, by the engine's id: what a native file's name is looked up in. */
export const NATIVE_DIALECTS: readonly {
  id: string;
  nativeFiles?: NativeDeclarations;
}[] = ENGINE_LIST.flatMap((engine) => {
  const { dialect } = engine as { dialect?: { nativeFiles?: unknown } };
  return dialect
    ? [
        {
          id: engine.id,
          nativeFiles: dialect.nativeFiles as NativeDeclarations | undefined,
        },
      ]
    : [];
});

/** The native file a file's name says it is, among the registered engines' (its dialect: the engine's id). */
export const nativeFileOf = (fileName: string): FoundNativeFile | null =>
  nativeFileFor(NATIVE_DIALECTS, fileName);

/** The extensions the Open dialog takes for native files, from the declared formats. */
export const NATIVE_EXTENSIONS: readonly string[] =
  nativeExtensions(NATIVE_DIALECTS);

/**
 * What the Open dialog takes: piStar models, project archives, the native
 * files the dialects declare (their extensions, not a list), and the
 * importers' that no dialect declares as a native file yet.
 */
export const openAccept = (
  nativeExtensions: readonly string[],
  importerExtensions: readonly string[] = [],
): string =>
  [
    ...new Set([
      '.txt',
      '.json',
      '.tar.gz',
      '.tgz',
      '.tar',
      '.zip',
      ...nativeExtensions,
      ...importerExtensions,
    ]),
    'application/json',
    'text/plain',
    'application/gzip',
    'application/x-tar',
    'application/zip',
  ].join(',');

/**
 * What the workbench knows of the open project's native files: the store
 * it learned it in (another project's knows nothing of them), the files it
 * has checked against the model, those held (not in sync when the project
 * opened: kept as they are until regenerated or re-imported), the model's
 * text each was last in sync with (`''`: none, write it from the model as
 * it is), and what writing each last said.
 */
export type NativeTracking = {
  store: unknown;
  checked: readonly string[];
  held: readonly string[];
  inSyncWith: Readonly<Record<string, string>>;
  wrote: Readonly<Record<string, readonly NativeDiagnostic[]>>;
};

/** Tracking for a store: what is known of it, or nothing when it was another's. */
export const trackingFor = (
  tracking: NativeTracking | null,
  store: unknown,
): NativeTracking =>
  tracking && tracking.store === store
    ? tracking
    : { store, checked: [], held: [], inSyncWith: {}, wrote: {} };

/**
 * Each native file whose text has been read (from the tracking's store)
 * and isn't checked yet, checked against the model: one its dialect writes
 * that doesn't read to the model is held; the others are in sync with it
 * now. The same tracking when there is nothing new to check.
 */
export const checkNatives = (
  tracking: NativeTracking,
  slots: readonly NativeSlot[],
  texts: Readonly<Record<string, string>>,
  modelText: string,
  context: (slot: NativeSlot) => NativeFileContext,
): NativeTracking => {
  const fresh = slots.filter(
    (slot) =>
      !slot.missing &&
      texts[slot.path] !== undefined &&
      !tracking.checked.includes(slot.path),
  );
  if (!fresh.length) return tracking;
  const held = fresh.filter(
    (slot) =>
      !!slot.definition.write &&
      nativeSync(slot.definition, texts[slot.path]!, modelText, context(slot))
        .state !== 'in-sync',
  );
  return {
    ...tracking,
    checked: [...tracking.checked, ...fresh.map((slot) => slot.path)],
    held: [...tracking.held, ...held.map((slot) => slot.path)],
    inSyncWith: {
      ...tracking.inSyncWith,
      ...Object.fromEntries(
        fresh
          .filter((slot) => !held.includes(slot))
          .map((slot) => [slot.path, modelText]),
      ),
    },
  };
};

/**
 * A file in sync with this model text from now (the model re-imported
 * from it, or it written from the model), not held; `modelText` `''`: to
 * be written from the model as it is (regenerated).
 */
export const inSyncNow = (
  tracking: NativeTracking,
  path: string,
  modelText: string,
  wrote?: readonly NativeDiagnostic[],
): NativeTracking => ({
  ...tracking,
  held: tracking.held.filter((p) => p !== path),
  checked: [...new Set([...tracking.checked, path])],
  inSyncWith: { ...tracking.inSyncWith, [path]: modelText },
  wrote: wrote ? { ...tracking.wrote, [path]: wrote } : tracking.wrote,
});

/** What the editors show of a native file, and how it stands with the model. */
export type NativeState = {
  slot: NativeSlot;
  /** its text as its tab shows it: as written from the model while it follows, else as it is */
  text: string;
  /** written from the model after each edit (its dialect writes it, and it isn't held) */
  following: boolean;
  /** what writing it from the model gave, when the model changed since the file was in sync with it */
  write: NativeWriteResult | null;
  /** what its last writing said (what it left out, wrote differently) */
  wrote: readonly NativeDiagnostic[];
  /** how it stands with the model (when it doesn't follow it) */
  sync: NativeSync | null;
};

/**
 * Each present native file's state. A file its dialect writes follows the
 * model once it is checked and not held: as it is while the model is the
 * one it was last in sync with, else written from the model. Before its
 * check, it is as it is and never written. A held file, or one its dialect
 * only reads, is compared with the model. A file whose text isn't read
 * yet has none.
 */
export const nativeStates = (
  slots: readonly NativeSlot[],
  texts: Readonly<Record<string, string>>,
  modelText: string,
  tracking: NativeTracking,
  context: (slot: NativeSlot) => NativeFileContext,
): NativeState[] =>
  slots.flatMap((slot): NativeState[] => {
    const stored = texts[slot.path];
    if (slot.missing || stored === undefined) return [];
    const following =
      !!slot.definition.write && !tracking.held.includes(slot.path);
    const inSyncWith = tracking.inSyncWith[slot.path];
    const wrote = tracking.wrote[slot.path] ?? [];
    const base = { slot, following, wrote, write: null, sync: null };
    if (following && (inSyncWith === undefined || inSyncWith === modelText))
      return [{ ...base, text: stored }];
    if (following) {
      const write = writeNative(slot.definition, modelText, context(slot));
      return [{ ...base, text: write.text ?? stored, write }];
    }
    return [
      {
        ...base,
        text: stored,
        sync: nativeSync(slot.definition, stored, modelText, context(slot)),
      },
    ];
  });

/**
 * The files to write after an edit of the model (those that follow it, as
 * written from it anew), and the tracking with each in sync with this
 * model text: each written once per model text.
 */
export const followed = (
  tracking: NativeTracking,
  states: readonly NativeState[],
  modelText: string,
): { writes: { path: string; text: string }[]; tracking: NativeTracking } => {
  const written = states.flatMap((state) =>
    state.following && state.write?.text != null
      ? [{ state, text: state.write.text }]
      : [],
  );
  return {
    writes: written.map(({ state, text }) => ({ path: state.slot.path, text })),
    tracking: written.reduce(
      (next, { state }) =>
        inSyncNow(next, state.slot.path, modelText, state.write!.diagnostics),
      tracking,
    ),
  };
};

const fileName = (path: string) => path.split('/').pop() ?? path;

/** What is wrong with the native files, as problems that open the file's tab. */
export const nativeProblems = (states: readonly NativeState[]): Problem[] =>
  states.flatMap(({ slot, following, write, wrote, sync }): Problem[] => {
    const name = fileName(slot.path);
    const reveal = { document: slot.path, from: 0, to: 0 };
    const source = slot.definition.label;
    if (write && write.text === null)
      return [
        {
          severity: 'warning',
          source,
          message: `${name} can't be written from the model: ${firstError(write.diagnostics)}`,
          reveal,
        },
      ];
    // what its last writing said: what it left out, or wrote differently
    if (following)
      return wrote.map((d) => ({
        severity: d.severity,
        source,
        message: `${name}: ${d.message}`,
        reveal,
      }));
    if (sync?.state === 'unreadable')
      return [
        {
          severity: 'error',
          source,
          message: `${name} doesn't read: ${sync.why}`,
          reveal,
        },
      ];
    if (sync?.state === 'out-of-sync')
      return [
        {
          severity: 'warning',
          source,
          message: `${name} is out of sync with the model (${sync.why}): ${slot.definition.write ? 'regenerate it, or re-import the model from it' : 're-import the model from it'}`,
          reveal,
        },
      ];
    return [];
  });

/** A native file the project lacked, written from the model when it opened: its text, or why not. */
export type GeneratedNative = { slot: NativeSlot; write: NativeWriteResult };

/**
 * The native files a project lacks that its dialect writes, each written
 * from the model as it opened (goal-controller#143): a project that ships
 * without its native file gets it at once. A file its dialect only reads
 * is never made.
 */
export const generateAbsent = (
  slots: readonly NativeSlot[],
  modelText: string,
  context: (slot: NativeSlot) => NativeFileContext,
): GeneratedNative[] =>
  slots
    .filter((slot) => slot.missing && slot.definition.write)
    .map((slot) => ({
      slot,
      write: writeNative(slot.definition, modelText, context(slot)),
    }));

/** Why an absent native file couldn't be made from the model, as problems (the file has no tab to open). */
export const absentProblems = (
  generated: readonly GeneratedNative[],
): Problem[] =>
  generated.flatMap(({ slot, write }): Problem[] =>
    write.text === null
      ? [
          {
            severity: 'warning',
            source: slot.definition.label,
            message: `${fileName(slot.path)} can't be written from the model: ${firstError(write.diagnostics)}`,
          },
        ]
      : [],
  );
