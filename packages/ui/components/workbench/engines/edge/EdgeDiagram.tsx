'use client';

import type { IstarExtension } from '@istar-ts/react';
import { edgePalette, oneActorOnly } from '../edgeFamily/extensions';
import { problemBadges, rtNumbering } from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** Edge reads goals, tasks and resources in one actor, named after their RT ids. */
const EDGE_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  rtNumbering,
  edgePalette,
];

/** What piStar mode's palette toggle adds for a file recorded for Edge. */
export const EDGE_PALETTE: readonly IstarExtension[] = [
  rtNumbering,
  edgePalette,
];

export default function EdgeDiagram() {
  return (
    <WorkbenchCanvas extensions={EDGE_EXTENSIONS} rejectEdit={oneActorOnly} />
  );
}
