/**
 * Applies a quick fix the goal language server named (goal-controller#416):
 * the server only knows the element kind and a default name, since it
 * doesn't hold the model; this thread does, so it computes `location` with
 * `suggestPosition` (deterministic, never overlapping, inside the actor)
 * right before dispatching, through the surface's own dispatcher so the
 * edit is tagged and undoable with the rest (one `glspUndo`).
 */
import { suggestPosition } from '@istar-ts/core';
import type { ActionDispatcher, ActionResult } from '@istar-ts/actions';
import type { AnyModel } from '@goal-controller/lib';
import type { GoalCodeActionData } from '@goal-controller/goal-language/light';

export const applyCodeAction = (
  dispatcher: ActionDispatcher<string, string>,
  model: AnyModel,
  data: GoalCodeActionData,
): Promise<ActionResult<unknown>> => {
  const location = suggestPosition(model, {
    kind: data.elementTypeId,
    ...(data.containerId !== undefined && { containerId: data.containerId }),
  });
  return dispatcher.dispatch({
    kind: 'createNode',
    elementTypeId: data.elementTypeId,
    ...(data.containerId !== undefined && { containerId: data.containerId }),
    location,
    args: data.args,
  });
};
