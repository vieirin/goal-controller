'use client';

import type { TransformEngine } from '@/lib/types';
import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import { useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';
import { EDGE_PALETTE } from '../edge/EdgeDiagram';
import { EDGEV2_PALETTE } from '../edgeV2/EdgeV2Diagram';
import { GODA_PALETTE } from '../goda/GodaDiagram';
import { MUTROSE_PALETTE } from '../mutrose/MutroseDiagram';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

const NO_EXTENSIONS: readonly IstarExtension[] = [];

/**
 * The palette an engine offers in piStar mode (the top bar's toggle), or null when it has
 * none of its own: SLEEC reads the whole iStar palette.
 */
export const pistarPaletteFor = (
  engine: TransformEngine,
): readonly IstarExtension[] | null => {
  switch (engine) {
    case 'edge':
      return EDGE_PALETTE;
    case 'edgev2':
      return EDGEV2_PALETTE;
    case 'sleec':
      return null;
    case 'mutrose':
      return MUTROSE_PALETTE;
    case 'goda':
      return GODA_PALETTE;
  }
};

/**
 * piStar mode: the library as it ships, with its own inspector beside the canvas, whatever
 * engine the file records. The top bar's toggle swaps in that engine's palette.
 */
export default function PistarDiagram() {
  const wb = useWorkbench();
  const { enginePalette } = useShell();
  const palette =
    enginePalette && wb.recordedEngine
      ? pistarPaletteFor(wb.recordedEngine)
      : null;
  return (
    <WorkbenchCanvas
      extensions={palette ?? NO_EXTENSIONS}
      aside={<IstarInspector />}
      paletteOnTop
      fitKey={palette ? 'engine-palette' : 'pistar'}
    />
  );
}
