'use client';

import type { IstarExtension } from '@istar-ts/react';
import { edgeOneActor, edgePalette } from '../edgeFamily/extensions';
import { problemBadges, rtNumbering } from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** EdgeV2 reads goals, tasks and resources in one actor, named after their RT ids. */
const EDGEV2_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  rtNumbering,
  edgePalette,
];

/** What piStar mode's palette toggle adds for a file recorded for EdgeV2. */
export const EDGEV2_PALETTE: readonly IstarExtension[] = [
  rtNumbering,
  edgePalette,
];

export default function EdgeV2Diagram() {
  return (
    <WorkbenchCanvas extensions={EDGEV2_EXTENSIONS} rejectEdit={edgeOneActor} />
  );
}
