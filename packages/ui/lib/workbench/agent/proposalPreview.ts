/**
 * A Propose run's change set as it would leave the model (goal-controller
 * #485), before it is applied: each proposed step's operations, as the
 * scratch session ran them (their created ids pinned), replayed in order on
 * a store over the live model. The model is immutable, so the live one is
 * never touched; the scratch session already ran the mode's guards, so
 * nothing is checked again here.
 */
import type { ChangeSetEntry } from '@istar-ts/agent';
import type { GlspChangeSet } from '@istar-ts/agent/glsp';
import { createActionDispatcher } from '@istar-ts/actions';
import { createModelStore, type AnyIstarModel } from '@istar-ts/core';

export type ProposalPreview =
  | { ok: true; model: AnyIstarModel }
  | { ok: false; message: string };

export const previewProposal = async (
  live: AnyIstarModel,
  changeSet: GlspChangeSet,
  entries: readonly ChangeSetEntry[],
): Promise<ProposalPreview> => {
  const store = createModelStore(live);
  const dispatcher = createActionDispatcher(store);
  for (const entry of entries) {
    for (const operation of changeSet.step(entry)?.operations ?? []) {
      const result = await dispatcher.dispatch(operation);
      if (!result.ok)
        return {
          ok: false,
          message: result.diagnostics.map(({ message }) => message).join('; '),
        };
    }
  }
  return { ok: true, model: store.getModel() };
};
