/**
 * Applying a quick fix (goal-controller#416): the server names the element
 * kind and a default name; this thread computes `location` with
 * `suggestPosition` and dispatches `createNode` through the surface's
 * dispatcher, so the edit lands on the single undo stack.
 */
import { describe, expect, it } from 'vitest';
import type { GoalCodeActionData } from '@goal-controller/goal-language/light';
import { createModelSession } from '@/lib/workbench/modelSession';
import { emptyModel } from '@/lib/workbench/dialects';
import { applyCodeAction } from '@/lib/workbench/codeActions';

describe('applyCodeAction (#416)', () => {
  it('creates the node through the dispatcher at a non-overlapping position; one undo removes it', async () => {
    const session = createModelSession(emptyModel(), () => {});
    const dispatcher = session.dispatcherFor('inspector');

    // an actor to put elements in (iStar's goals and tasks must be inside one)
    const actor = await dispatcher.dispatch({
      kind: 'createNode',
      elementTypeId: 'istar.Actor',
      args: { id: 'actor', name: 'Actor' },
    });
    expect(actor.ok).toBe(true);

    // an existing element, right where a fresh createNode would default to
    const seed = await dispatcher.dispatch({
      kind: 'createNode',
      elementTypeId: 'istar.Goal',
      containerId: 'actor',
      args: { id: 'seed', name: 'G1: Seed' },
    });
    expect(seed.ok).toBe(true);
    const seedElement = session.store.getModel().elements.get('seed')!;

    const data: GoalCodeActionData = {
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      containerId: 'actor',
      args: { name: 'T9: Task' },
    };
    const result = await applyCodeAction(
      dispatcher,
      session.store.getModel(),
      data,
    );
    expect(result.ok).toBe(true);

    const created = [...session.store.getModel().elements.values()].find(
      (element) => element.name === 'T9: Task',
    );
    expect(created).toBeDefined();
    // non-overlapping: suggestPosition moved it away from the seed element
    expect({ x: created!.x, y: created!.y }).not.toEqual({
      x: seedElement.x,
      y: seedElement.y,
    });

    const undo = await dispatcher.dispatch({ kind: 'glspUndo' });
    expect(undo.ok).toBe(true);
    expect(
      [...session.store.getModel().elements.values()].some(
        (element) => element.name === 'T9: Task',
      ),
    ).toBe(false);
    // the seed element is untouched: only the fix's own step was undone
    expect(session.store.getModel().elements.has('seed')).toBe(true);
  });
});
