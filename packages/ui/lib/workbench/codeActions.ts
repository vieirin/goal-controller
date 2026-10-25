/**
 * Applies a quick fix the goal language server named (goal-controller#416):
 * the server names the element kind, a default name and the actor it nests
 * under in the document, when it has one (goal-controller#440); this thread
 * holds the model, so it resolves that actor against it (a stale or
 * non-actor id is dropped), computes `location` with `suggestPosition`
 * (deterministic, never overlapping) right before dispatching, through the
 * surface's own dispatcher so the edit is tagged and undoable with the rest
 * (one `glspUndo`).
 */
import {
  elementKindDefinition,
  isActorKindIn,
  metamodelOf,
  suggestPosition,
  type Size,
} from '@istar-ts/core';
import type { ActionDispatcher, ActionResult } from '@istar-ts/actions';
import type { AnyModel } from '@goal-controller/lib';
import type { GoalCodeActionData } from '@goal-controller/goal-language/light';

/** The live actor `containerId` names, or none: a stale or non-actor id is dropped. */
const resolveContainerId = (
  model: AnyModel,
  containerId: string | undefined,
): string | undefined => {
  if (containerId === undefined) return undefined;
  const element = model.elements.get(containerId);
  return element && isActorKindIn(metamodelOf(model), element.kind)
    ? containerId
    : undefined;
};

/**
 * Whether the fix can create its node: in the actor the server named, when
 * it still exists, or on the paper when the kind allows it (goal-controller#440).
 * Offer no fix when neither holds: `createNode` would reject it.
 */
export const canApplyCodeAction = (
  model: AnyModel,
  data: GoalCodeActionData,
): boolean =>
  resolveContainerId(model, data.containerId) !== undefined ||
  !!elementKindDefinition(metamodelOf(model), data.elementTypeId)?.info
    ?.canBeOnPaper;

/**
 * A kind's size as `suggestPosition` must read it (`actorBounds`'s own
 * doc): the metamodel's, unless a host passes its registry's (one that
 * overrides a kind's rendered size independently of the metamodel). No such
 * override exists in this workbench today, so the metamodel's own is always
 * right here.
 */
const metamodelSizeOf =
  (model: AnyModel) =>
  (kind: string): Size =>
    elementKindDefinition(metamodelOf(model), kind)?.size ?? {
      width: 0,
      height: 0,
    };

export const applyCodeAction = (
  dispatcher: ActionDispatcher<string, string>,
  model: AnyModel,
  data: GoalCodeActionData,
  defaultSizeOf: (kind: string) => Size = metamodelSizeOf(model),
): Promise<ActionResult<unknown>> => {
  const containerId = resolveContainerId(model, data.containerId);
  const location = suggestPosition(model, {
    kind: data.elementTypeId,
    ...(containerId !== undefined && { containerId }),
    defaultSizeOf,
  });
  return dispatcher.dispatch({
    kind: 'createNode',
    elementTypeId: data.elementTypeId,
    ...(containerId !== undefined && { containerId }),
    location,
    args: data.args,
  });
};
