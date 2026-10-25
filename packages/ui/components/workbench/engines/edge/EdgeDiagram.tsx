'use client';

import type { ActionPostGuard } from '@istar-ts/actions';
import type { IstarExtension } from '@istar-ts/react';
import { edgeOneActor, edgePalette } from '../edgeFamily/extensions';
import { rtNumbering } from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** Edge reads goals, tasks and resources in one actor, named after their RT ids. */
const EDGE_EXTENSIONS: readonly IstarExtension[] = [rtNumbering, edgePalette];

/** What piStar mode's palette toggle adds for a file recorded for Edge. */
export const EDGE_PALETTE: readonly IstarExtension[] = [
  rtNumbering,
  edgePalette,
];

const EDGE_POST_GUARDS: readonly ActionPostGuard<string, string>[] = [
  edgeOneActor,
];

export default function EdgeDiagram() {
  return (
    <WorkbenchCanvas
      extensions={EDGE_EXTENSIONS}
      postGuards={EDGE_POST_GUARDS}
    />
  );
}
