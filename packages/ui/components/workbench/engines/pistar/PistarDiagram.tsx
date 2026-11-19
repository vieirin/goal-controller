'use client';

import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import { useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';
import { usePistarPalette } from '../engineViews';

const NO_EXTENSIONS: readonly IstarExtension[] = [];

/**
 * piStar mode: the library as it ships, with its own inspector beside the canvas, whatever
 * engine the file records. The top bar's toggle swaps in that engine's palette.
 */
export default function PistarDiagram() {
  const wb = useWorkbench();
  const { enginePalette } = useShell();
  // the palette the recorded engine offers (registry's `palette`), if any
  const palette = usePistarPalette(enginePalette ? wb.recordedEngine : null);
  return (
    <WorkbenchCanvas
      extensions={palette ?? NO_EXTENSIONS}
      aside={<IstarInspector />}
      paletteOnTop
      fitKey={palette ? 'engine-palette' : 'pistar'}
    />
  );
}
