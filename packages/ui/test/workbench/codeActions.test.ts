/**
 * Applying a quick fix (goal-controller#416, goal-controller#440): the
 * server's own output (its element kind, a default name, and the actor it
 * nests under in the document, if any) is fed unchanged into
 * `applyCodeAction`; this thread resolves the actor against the live model,
 * computes `location` with `suggestPosition` and dispatches `createNode`
 * through the surface's dispatcher, so the edit lands on the single undo
 * stack.
 */
import { describe, expect, it } from 'vitest';
import {
  defineDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import {
  createGoalLspServices,
  serverCodeActions,
} from '@goal-controller/goal-language/lsp';
import { createModelSession } from '@/lib/workbench/modelSession';
import { emptyModel } from '@/lib/workbench/dialects';
import {
  applyCodeAction,
  canApplyCodeAction,
} from '@/lib/workbench/codeActions';

/** Just enough of a dialect for the server to name `T9`'s kind (goal-controller#440). */
const dialect = defineDialect({
  id: 'test',
  name: 'Test',
  elements: {
    goal: { prefix: 'G', fill: '#fff' },
    task: { prefix: 'T', fill: '#fff' },
  },
  defaultFill: '#fff',
  properties: { goal: [], task: [] },
  propertyLineOrder: [],
  indent: '  ',
  problems: {
    notAChild: { severity: 'error', message: 'Not a child' },
    missingFromNotation: { severity: 'warning', message: 'Missing' },
    relationMismatch: { severity: 'error', message: 'Relation mismatch' },
    notInDiagram: {
      severity: 'error',
      message: 'Add this element in the diagram',
    },
  },
});

/** `G1` is `actor`'s, in the document and in the context alike. */
const context: DefinitionContext = {
  elements: { G1: { kind: 'goal', children: [], properties: {} } },
  variables: [],
  actors: {
    actor: {
      kind: 'istar.Actor',
      name: 'Actor',
      properties: {},
      elements: ['G1'],
    },
  },
};

describe('applyCodeAction (#416, #440)', () => {
  it('creates the node inside the actor the server names from the document, through the dispatcher; one undo removes it', async () => {
    const session = createModelSession(emptyModel(), () => {});
    const dispatcher = session.dispatcherFor('inspector');

    const actor = await dispatcher.dispatch({
      kind: 'createNode',
      elementTypeId: 'istar.Actor',
      args: { id: 'actor', name: 'Actor' },
    });
    expect(actor.ok).toBe(true);

    const { shared, store } = createGoalLspServices();
    store.set({ dialect, context });
    // T9 nests under G1 (indented): the server finds G1's actor its owner
    const doc = 'G1: Seed\n  T9: Lift';
    const from = doc.indexOf('T9');
    const to = from + 'T9'.length;
    const actions = await serverCodeActions(
      shared,
      'file:///notation.goal',
      doc,
      { from, to },
    );
    expect(actions).toHaveLength(1);
    const data = actions[0]!.data;
    expect(data).toEqual({
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      containerId: 'actor',
      args: { name: 'T9: Task' },
    });

    const model = session.store.getModel();
    expect(canApplyCodeAction(model, data)).toBe(true);
    const result = await applyCodeAction(dispatcher, model, data);
    expect(result.ok).toBe(true);

    const created = [...session.store.getModel().elements.values()].find(
      (element) => element.name === 'T9: Task',
    );
    expect(created).toBeDefined();
    expect(created!.parent).toBe('actor');

    const undo = await dispatcher.dispatch({ kind: 'glspUndo' });
    expect(undo.ok).toBe(true);
    expect(
      [...session.store.getModel().elements.values()].some(
        (element) => element.name === 'T9: Task',
      ),
    ).toBe(false);
    // the actor is untouched: only the fix's own step was undone
    expect(session.store.getModel().elements.has('actor')).toBe(true);
  });

  it('offers no fix when the element has no owner and its kind cannot be on paper', async () => {
    const session = createModelSession(emptyModel(), () => {});
    const { shared, store } = createGoalLspServices();
    // no actors in the context: T9 nests under nothing the model owns
    store.set({ dialect, context: { elements: {}, variables: [] } });
    const doc = 'T9: Lift';
    const from = doc.indexOf('T9');
    const to = from + 'T9'.length;
    const [action] = await serverCodeActions(
      shared,
      'file:///notation.goal',
      doc,
      { from, to },
    );
    expect(action!.data.containerId).toBeUndefined();
    // istar.Task can't be placed outside an actor (@istar-ts/core)
    expect(canApplyCodeAction(session.store.getModel(), action!.data)).toBe(
      false,
    );
  });
});
