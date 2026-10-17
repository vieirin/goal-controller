'use client';

import { kaosExtension } from '@istar-ts/dsm3-kaos';
import { nfrExtension } from '@istar-ts/dsm3-nfr';
import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import type { FrameworkMode } from '@/lib/workbench/frameworkModes';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** Each framework's look and palette: istar-ts's registry parts for it. */
const EXTENSIONS: Readonly<Record<FrameworkMode, readonly IstarExtension[]>> = {
  kaos: [kaosExtension as unknown as IstarExtension],
  nfr: [nfrExtension as unknown as IstarExtension],
};

/**
 * A KAOS or NFR model (goal-controller#171): the canvas with its framework's
 * shapes and palette (hubs, link-anchored links and nodes on the paper are
 * istar-ts's), and istar-ts's inspector beside it.
 */
export default function FrameworkDiagram({ mode }: { mode: FrameworkMode }) {
  return (
    <WorkbenchCanvas
      extensions={EXTENSIONS[mode]}
      aside={<IstarInspector />}
      paletteOnTop
      fitKey={mode}
    />
  );
}
