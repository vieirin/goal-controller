/**
 * Each mode's own rules (goal-controller#412), by `wb.mode` (goal-controller#439
 * review): an engine's, as the registry states them (engineDialects.ts, its
 * `rules`), made of the guards in guards.ts. Plain TypeScript with no React in
 * reach: the dispatcher they guard lives in the model worker
 * (goal-controller#434), which builds them from the mode the main thread sends
 * it, since a function can't cross `postMessage`. The main thread still reads
 * them for Propose mode's scratch sessions (agent/glspSession.ts) and the
 * agent's context (agent/context.ts).
 */
import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import type { ModelMode } from './pistar';
import { ENGINE_RULES } from './engineDialects';

export { oneActorOnly, resourceBoundsGuard } from './guards';

const NO_GUARDS: readonly ActionGuard<string, string>[] = [];
const NO_POST_GUARDS: readonly ActionPostGuard<string, string>[] = [];

export type ModeGuards = {
  readonly guards: readonly ActionGuard<string, string>[];
  readonly postGuards: readonly ActionPostGuard<string, string>[];
  /**
   * Plain-language statements of this mode's own rules, for M6's agent
   * context (goal-controller#415): one sentence per rule, not the guard's
   * rejection message (some, like `resourceBoundsGuard`, only compute
   * one when a violation already happened).
   */
  readonly describe: readonly string[];
};

/**
 * The rules by mode: the session's dispatcher consults this directly, not
 * whichever diagram happens to be mounted — the Source tab unmounts the
 * diagram entirely, but the mode's guards must still run for an edit the
 * Inspector (a sibling panel) makes. An engine's are its registration's.
 */
const MODE_GUARDS: Partial<Record<ModelMode, ModeGuards>> = Object.fromEntries(
  Object.entries(ENGINE_RULES).map(([mode, rules]) => [
    mode,
    {
      guards: rules.guards ?? NO_GUARDS,
      postGuards: rules.postGuards ?? NO_POST_GUARDS,
      describe: rules.describe,
    },
  ]),
);

export const guardsForMode = (mode: ModelMode): ModeGuards =>
  MODE_GUARDS[mode] ?? {
    guards: NO_GUARDS,
    postGuards: NO_POST_GUARDS,
    describe: [],
  };
