'use client';

import { kaosExtension } from '@istar-ts/dsm3-kaos';
import { nfrExtension } from '@istar-ts/dsm3-nfr';
import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import type { FrameworkMode } from '@/lib/workbench/frameworkModes';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/**
 * A framework's registry parts as the workbench's canvas takes them. The
 * workbench types every model, and so its store and provider, as an iStar
 * 2.0 one (lib/workbench/dialects.ts: a model keeps its own metamodel, which
 * istar-ts reads at run time), so an extension typed with KAOS's or NFR's
 * kinds is widened here, the one place it is (goal-controller#171).
 */
const forCanvas = <EK extends string, LK extends string>(
  extension: IstarExtension<EK, LK>,
): IstarExtension => extension as unknown as IstarExtension;

/** Each framework's look and palette: istar-ts's registry parts for it. */
const EXTENSIONS: Readonly<Record<FrameworkMode, readonly IstarExtension[]>> = {
  kaos: [forCanvas(kaosExtension)],
  nfr: [forCanvas(nfrExtension)],
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
