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
  nativeExtensions,
  nativeFileFor,
  type FoundNativeFile,
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
import {
  ENGINE_DIALECTS,
  ENGINE_LIST,
  isDialectEngine,
} from './engineDialects';
import type { Problem } from './types';

/** The native files a mode's dialect declares (an engine's definition's; none for the others). */
export const nativeDeclarationsOf = (
  mode: string | null,
): NativeDeclarations | undefined =>
  isTransformEngine(mode) && isDialectEngine(mode)
    ? (ENGINE_DIALECTS[mode] as { nativeFiles?: NativeDeclarations })
        .nativeFiles
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

/** What the editors show of a native file, and how it stands with the model. */
export type NativeState = {
  slot: NativeSlot;
  /** its text as its tab shows it: as written from the model while it follows, else as it is */
  text: string;
  /** written from the model after each edit (its dialect writes it, and it isn't held) */
  following: boolean;
  /** what writing it from the model said (while it follows) */
  write: NativeWriteResult | null;
  /** how it stands with the model (when it doesn't follow it) */
  sync: NativeSync | null;
};

/**
 * Each present native file's state, given its text as read (or edited),
 * the model's text, the files held because they weren't in sync when the
 * project opened, and the model's text each file was last in sync with: a
 * file that follows is written only once the model is edited (until then
 * it stays as it was written). A file whose text isn't read yet has none.
 */
export const nativeStates = (
  slots: readonly NativeSlot[],
  texts: Readonly<Record<string, string>>,
  modelText: string,
  held: ReadonlySet<string>,
  inSyncWith: Readonly<Record<string, string>>,
  context: (slot: NativeSlot) => NativeFileContext,
): NativeState[] =>
  slots.flatMap((slot): NativeState[] => {
    const stored = texts[slot.path];
    if (slot.missing || stored === undefined) return [];
    const following = !!slot.definition.write && !held.has(slot.path);
    if (following && inSyncWith[slot.path] === modelText)
      return [{ slot, text: stored, following, write: null, sync: null }];
    if (following) {
      const write = writeNative(slot.definition, modelText, context(slot));
      return [
        { slot, text: write.text ?? stored, following, write, sync: null },
      ];
    }
    return [
      {
        slot,
        text: stored,
        following,
        write: null,
        sync: nativeSync(slot.definition, stored, modelText, context(slot)),
      },
    ];
  });

/** Whether a native file with a writer is held when its project opens: it doesn't read to the model. */
export const heldAtOpen = (
  slot: NativeSlot,
  text: string,
  modelText: string,
  context: NativeFileContext,
): boolean =>
  !!slot.definition.write &&
  nativeSync(slot.definition, text, modelText, context).state !== 'in-sync';

const fileName = (path: string) => path.split('/').pop() ?? path;

/** What is wrong with the native files, as problems that open the file's tab. */
export const nativeProblems = (states: readonly NativeState[]): Problem[] =>
  states.flatMap(({ slot, write, sync }): Problem[] => {
    const name = fileName(slot.path);
    const reveal = { document: slot.path, from: 0, to: 0 };
    const source = slot.definition.label;
    if (write && write.text === null)
      return [
        {
          severity: 'warning',
          source,
          message: `${name} can't be written from the model: ${write.diagnostics.find((d) => d.severity === 'error')?.message ?? 'no reason given'}`,
          reveal,
        },
      ];
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
