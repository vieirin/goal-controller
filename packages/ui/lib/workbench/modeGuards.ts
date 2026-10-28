/**
 * Each mode's own rules (goal-controller#412), by `wb.mode` (goal-controller#439
 * review), and the guards they are made of. Plain TypeScript with no React in
 * reach: the dispatcher they guard lives in the model worker
 * (goal-controller#434), which builds them from the mode the main thread sends
 * it, since a function can't cross `postMessage`. The main thread still reads
 * them for Propose mode's scratch sessions (agent/glspSession.ts) and the
 * agent's context (agent/context.ts).
 */
import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import { isActorIn, metamodelOf } from '@istar-ts/core';
import type { ModelMode } from './pistar';
import { firstResourceIssue } from './edgeProperties';
import { GUARD_REJECTION_CODE } from './guardDiagnostics';

/**
 * An engine that reads one actor: a second one is rejected, saying so
 * (goal-controller#412). A postGuard on the resulting model's own actor
 * count, not a pre-guard gated on `createNode` (goal-controller#439 review):
 * `istar.replaceModel` (a SourceView paste) and a compound's children reach
 * this the same way `createNode` does, so a second actor can't get in
 * through any of them.
 */
export const oneActorOnly =
  (message: string): ActionPostGuard<string, string> =>
  (_operation, modelAfter) => {
    const metamodel = metamodelOf(modelAfter);
    const actors = [...modelAfter.elements.values()].filter(
      isActorIn(metamodel),
    );
    if (actors.length > 1)
      return [
        {
          elementId: '',
          severity: 'error',
          message,
          source: 'shield',
          code: GUARD_REJECTION_CODE,
        },
      ];
  };

/** The Edge engines build one goal tree from one actor: a second actor is taken back out. */
export const edgeOneActor = oneActorOnly(
  'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.',
);

/**
 * A resource's bounds (goal-controller#412): today only a badge (`resourceVariable`,
 * engines/edgeFamily/extensions.tsx) and, at transform time, the mapper throwing it
 * into `[INVALID RESOURCE]` (packages/lib/src/engines/edgeFamily/checks.ts,
 * `firstResourceIssue`). Reads one element's own properties, no tree and no PRISM
 * generation, so it is cheap enough to run on every `istar.updateProperties`: the
 * "P9 shield" for edgeV2 (#408), wired to edgeV2 only, per the migration plan.
 *
 * A warning, never an error (goal-controller#439 review): the Inspector dispatches one
 * property key per edit, so an `int` resource's `initialValue`/`lowerBound`/`upperBound`
 * only ever reach a valid combination one field at a time — every intermediate state
 * would otherwise be rejected, and a bool→int switch could never be completed through
 * that UI at all. The edit applies; the issue is returned with the result and still
 * shown (the badge, from the same check, independent of this guard).
 */
export const edgeV2ResourceBoundsGuard: ActionPostGuard<string, string> = (
  operation,
  modelAfter,
) => {
  if (operation.kind !== 'istar.updateProperties') return;
  const element = modelAfter.elements.get(operation.elementId);
  if (!element || element.kind !== 'istar.Resource') return;
  const issue = firstResourceIssue(element.customProperties ?? {});
  if (!issue) return;
  return [
    {
      elementId: operation.elementId,
      severity: 'warning',
      message: issue,
      source: 'edgev2',
    },
  ];
};

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
 * The rules by mode: the session's dispatcher consults this directly, not
 * whichever diagram happens to be mounted — the Source tab unmounts the
 * diagram entirely, but the mode's guards must still run for an edit the
 * Inspector (a sibling panel) makes.
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
