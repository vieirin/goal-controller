'use client';

import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';
import { PISTAR_EXT_EXTENSION } from './extensions';
import PistarExtInspector from './PistarExtInspector';

const EXTENSIONS: readonly IstarExtension[] = [
  PISTAR_EXT_EXTENSION as IstarExtension,
];

/**
 * piStar-ext mode: the dialect's palette (iStar 2.0 and its own kinds, from the model's
 * metamodel), its shapes and labels, and its inspector beside the canvas.
 */
export default function PistarExtDiagram() {
  return (
    // pistar-ext-canvas: its link labels above the actors (app/globals.css)
    <div className='pistar-ext-canvas h-full'>
      <WorkbenchCanvas
        extensions={EXTENSIONS}
        aside={<PistarExtInspector />}
        paletteOnTop
        fitKey='pistar-ext'
      />
    </div>
  );
}
