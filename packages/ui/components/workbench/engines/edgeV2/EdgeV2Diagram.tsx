'use client';

import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import type { IstarExtension } from '@istar-ts/react';
import {
  edgeOneActor,
  edgePalette,
  edgeV2ResourceBoundsGuard,
} from '../edgeFamily/extensions';
import { rtNumbering } from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** EdgeV2 reads goals, tasks and resources in one actor, named after their RT ids. */
const EDGEV2_EXTENSIONS: readonly IstarExtension[] = [rtNumbering, edgePalette];

/** What piStar mode's palette toggle adds for a file recorded for EdgeV2. */
export const EDGEV2_PALETTE: readonly IstarExtension[] = [
  rtNumbering,
  edgePalette,
];

const EDGEV2_GUARDS: readonly ActionGuard<string, string>[] = [edgeOneActor];
// the engine's own check (goal-controller#412): edgeV2 only, per the migration plan
const EDGEV2_POST_GUARDS: readonly ActionPostGuard<string, string>[] = [
  edgeV2ResourceBoundsGuard,
];

export default function EdgeV2Diagram() {
  return (
    <WorkbenchCanvas
      extensions={EDGEV2_EXTENSIONS}
      guards={EDGEV2_GUARDS}
      postGuards={EDGEV2_POST_GUARDS}
    />
  );
}
