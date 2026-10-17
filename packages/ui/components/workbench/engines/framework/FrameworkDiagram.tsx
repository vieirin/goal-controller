'use client';

import { kaosExtension } from '@istar-ts/dsm3-kaos';
import { nfrExtension } from '@istar-ts/dsm3-nfr';
import { fillOf, type AnyDialect } from '@goal-controller/dialect';
import type { IstarModel } from '@istar-ts/core';
import {
  DefaultElementComponent,
  IstarInspector,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import { nextFrameworkId } from '@/lib/workbench/frameworkOpen';
import {
  FRAMEWORK_DIALECTS,
  type FrameworkMode,
} from '@/lib/workbench/frameworkModes';
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

/** A kind's name as people read it: `kaos.BehavioralGoal` is "Behavioral Goal". */
const labelOf = (kind: string): string =>
  kind.replace(/^[^.]+\./, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/**
 * What the workbench adds to a framework's registry parts, from its dialect
 * (goal-controller#171): each listed kind drawn in the dialect's fill unless
 * a colour is saved, and a new one named with its next id (`G3: Behavioral
 * Goal`), so its Notation line names it; kinds sharing a prefix (KAOS's two
 * goals) share its numbering.
 */
export const dialectParts = (definition: AnyDialect): IstarExtension => {
  function FilledElement(props: ElementComponentProps): ReactElement {
    const { element } = props;
    const drawn = element.display?.backgroundColor
      ? element
      : {
          ...element,
          display: {
            ...element.display,
            backgroundColor: fillOf(definition, element.kind),
          },
        };
    return <DefaultElementComponent {...props} element={drawn} />;
  }
  return {
    name: `${definition.id}-dialect`,
    elements: Object.fromEntries(
      Object.entries(definition.elements).map(([kind, element]) => [
        kind,
        {
          component: FilledElement,
          ...(element?.prefix && {
            defaultName: ({ model }: { model: IstarModel }) =>
              `${nextFrameworkId(model, element.prefix!)}: ${labelOf(kind)}`,
          }),
        },
      ]),
    ),
  } as IstarExtension;
};

/** Each framework's look and palette: istar-ts's registry parts for it, then its dialect's. */
const EXTENSIONS: Readonly<Record<FrameworkMode, readonly IstarExtension[]>> = {
  kaos: [forCanvas(kaosExtension), dialectParts(FRAMEWORK_DIALECTS.kaos)],
  nfr: [forCanvas(nfrExtension), dialectParts(FRAMEWORK_DIALECTS.nfr)],
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
