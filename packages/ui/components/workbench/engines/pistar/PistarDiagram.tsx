'use client';

import type { TransformEngine } from '@/lib/types';
import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import { useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';
import { EDGE_PALETTE } from '../edge/EdgeDiagram';
import { EDGEV2_PALETTE } from '../edgeV2/EdgeV2Diagram';
import { GODA_PALETTE } from '../goda/GodaDiagram';
import { GRL_PALETTE } from '../grl/GrlDiagram';
import { ISTARDT_PALETTE } from '../istardt/IstardtDiagram';
import { MUTROSE_PALETTE } from '../mutrose/MutroseDiagram';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';
import { TROPOS4AS_PALETTE } from '../tropos4as/Tropos4asDiagram';
import { CGM_PALETTE } from '../cgm/CgmDiagram';

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
    case 'grl':
      return GRL_PALETTE;
    case 'istardt':
      return ISTARDT_PALETTE;
    case 'tropos4as':
      return TROPOS4AS_PALETTE;
    case 'cgm':
      return CGM_PALETTE;
    // a framework's engine has no iStar palette (goal-controller#171)
    case 'kaosdoc':
    case 'kaosprop':
    case 'kaosexpert':
    case 'nfrprop':
      return null;
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
