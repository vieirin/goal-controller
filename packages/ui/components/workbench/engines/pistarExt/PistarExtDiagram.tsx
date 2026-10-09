'use client';

import type { IstarExtension } from '@istar-ts/react';
import { useMemo } from 'react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';
import AddConstruct from './AddConstruct';
import { pistarExtExtension } from './extensions';
import PistarExtInspector from './PistarExtInspector';
import { usePistarExt } from './usePistarExt';

/**
 * piStar-ext mode: the dialect's palette (iStar 2.0, its own kinds and the model's,
 * from the model's metamodel) with piStar-ext's "Add new" at its end, its shapes and
 * labels, and its inspector beside the canvas.
 */
export default function PistarExtDiagram() {
  const { extension } = usePistarExt();
  // a new list when the model's constructs change: the canvas rebuilds its registry
  const extensions = useMemo<readonly IstarExtension[]>(
    () => [pistarExtExtension(extension) as IstarExtension],
    [extension],
  );
  return (
    // pistar-ext-canvas: its link labels above the actors (app/globals.css)
    <div className='pistar-ext-canvas h-full w-full min-w-0'>
      <WorkbenchCanvas
        extensions={extensions}
        aside={<PistarExtInspector />}
        paletteOnTop
        paletteEnd={<AddConstruct />}
        fitKey='pistar-ext'
      />
    </div>
  );
}
