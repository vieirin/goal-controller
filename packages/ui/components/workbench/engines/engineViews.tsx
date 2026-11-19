'use client';

/**
 * The registered engines' diagrams and inspectors, resolved on the client
 * from the registry (lib/workbench/engineDialects.ts): an engine's palette is
 * a lazy import there, loaded here, so the registry stays data the workers
 * and services read without React. An engine without one gets the whole
 * iStar palette. Its inspector follows from its dialect: the one built from
 * it, or, without one (SLEEC), names, links and properties.
 */
import { useEffect, useState } from 'react';
import type { IstarExtension } from '@istar-ts/react';
import type { TransformEngine } from '@/lib/types';
import {
  dialectOf,
  ENGINE_LIST,
  hasPistarPalette,
  isDialectEngine,
  viewOf,
} from '@/lib/workbench/engineDialects';
import DefinitionInspector from './definition/DefinitionInspector';
import PlainInspector from './shared/PlainInspector';
import WorkbenchCanvas from './shared/WorkbenchCanvas';

const NO_EXTENSIONS: readonly IstarExtension[] = [];

/** The palettes loaded so far, by engine. */
const palettes = new Map<TransformEngine, readonly IstarExtension[]>();
const loading = new Map<TransformEngine, Promise<readonly IstarExtension[]>>();

/** An engine's palette, loaded once (none: the whole iStar palette). */
export const loadPalette = (
  engine: TransformEngine,
): Promise<readonly IstarExtension[]> => {
  const pending = loading.get(engine);
  if (pending) return pending;
  const load = viewOf(engine).palette;
  const palette = load
    ? load().then(({ default: extensions }) => extensions)
    : Promise.resolve(NO_EXTENSIONS);
  void palette.then((extensions) => palettes.set(engine, extensions));
  loading.set(engine, palette);
  return palette;
};

/** An engine's palette, once it is loaded (at once if it was): null meanwhile. */
const paletteNow = (engine: TransformEngine) =>
  palettes.get(engine) ?? (viewOf(engine).palette ? null : NO_EXTENSIONS);

/** An engine's palette, null while it loads. */
export const usePalette = (
  engine: TransformEngine | null,
): readonly IstarExtension[] | null => {
  const [, loaded] = useState(0);
  const palette = engine ? paletteNow(engine) : null;
  useEffect(() => {
    if (!engine || palette) return;
    let live = true;
    void loadPalette(engine).then(() => live && loaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, [engine, palette]);
  return palette;
};

/**
 * The palette piStar mode's toggle offers for a file recorded for an engine,
 * null when it offers none (SLEEC, a framework's engine) or while it loads.
 */
export const usePistarPalette = (
  engine: TransformEngine | null,
): readonly IstarExtension[] | null =>
  usePalette(engine && hasPistarPalette(engine) ? engine : null);

/** An engine's model on the canvas, with its palette. */
export function EngineDiagram({ engine }: { engine: TransformEngine }) {
  const palette = usePalette(engine);
  return palette ? <WorkbenchCanvas extensions={palette} /> : null;
}

/**
 * An engine's node editor: the one built from its iStar dialect, or an
 * engine's without a definition (SLEEC); a framework's engine has none here
 * (its diagram carries istar-ts's).
 */
export function EngineInspector({ engine }: { engine: TransformEngine }) {
  if (isDialectEngine(engine)) return <DefinitionInspector engine={engine} />;
  return dialectOf(engine) ? null : <PlainInspector engine={engine} />;
}

// the palettes load as the workbench does, so a diagram or piStar mode's
// toggle rarely waits for one
if (typeof window !== 'undefined')
  for (const { id } of ENGINE_LIST) void loadPalette(id);
