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
  /**
   * Plain-language statements of this mode's own rules, for M6's agent
   * context (goal-controller#415): one sentence per rule, not the guard's
   * rejection message (some, like `edgeV2ResourceBoundsGuard`, only compute
   * one when a violation already happened).
   */
  readonly describe: readonly string[];
};

/**
 * Each mode's own rules (goal-controller#412), by `wb.mode` (goal-controller#439
 * review): the session consults this directly, not whichever diagram happens to
 * be mounted — the Source tab unmounts the diagram entirely, but the mode's
 * guards must still run for an edit the Inspector (a sibling panel) makes.
 */
const MODE_GUARDS: Partial<Record<ModelMode, ModeGuards>> = {
  edge: {
    guards: NO_GUARDS,
    postGuards: [edgeOneActor],
    describe: [
      'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.',
    ],
  },
  edgev2: {
    guards: NO_GUARDS,
    postGuards: [edgeOneActor, edgeV2ResourceBoundsGuard],
    describe: [
      'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.',
      "A resource's bounds must stay consistent: an int resource needs lowerBound <= initialValue <= upperBound, and a bool resource's initialValue must be true or false.",
    ],
  },
  mutrose: {
    guards: NO_GUARDS,
    postGuards: [mutroseOneActor],
    describe: [
      'MutRoSe reads a single actor (its mission): add goals and tasks inside the existing one.',
    ],
  },
};

export const guardsForMode = (mode: ModelMode): ModeGuards =>
  MODE_GUARDS[mode] ?? {
    guards: NO_GUARDS,
    postGuards: NO_POST_GUARDS,
    describe: [],
  };
