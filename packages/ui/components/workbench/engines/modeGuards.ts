import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import type { ModelMode } from '@/lib/workbench/pistar';
import { oneActorOnly } from './shared/extensions';
import {
  edgeOneActor,
  edgeV2ResourceBoundsGuard,
} from './edgeFamily/extensions';

const NO_GUARDS: readonly ActionGuard<string, string>[] = [];
const NO_POST_GUARDS: readonly ActionPostGuard<string, string>[] = [];

const mutroseOneActor = oneActorOnly(
  'MutRoSe reads a single actor (its mission): add goals and tasks inside the existing one.',
);

type ModeGuards = {
  readonly guards: readonly ActionGuard<string, string>[];
  readonly postGuards: readonly ActionPostGuard<string, string>[];
};

/**
 * Each mode's own rules (goal-controller#412), by `wb.mode` (goal-controller#439
 * review): the session consults this directly, not whichever diagram happens to
 * be mounted — the Source tab unmounts the diagram entirely, but the mode's
 * guards must still run for an edit the Inspector (a sibling panel) makes.
 */
const MODE_GUARDS: Partial<Record<ModelMode, ModeGuards>> = {
  edge: { guards: NO_GUARDS, postGuards: [edgeOneActor] },
  edgev2: {
    guards: NO_GUARDS,
    postGuards: [edgeOneActor, edgeV2ResourceBoundsGuard],
  },
  mutrose: { guards: NO_GUARDS, postGuards: [mutroseOneActor] },
};

export const guardsForMode = (mode: ModelMode): ModeGuards =>
  MODE_GUARDS[mode] ?? { guards: NO_GUARDS, postGuards: NO_POST_GUARDS };
