/**
 * The lint tooltip action a `notInDiagram` diagnostic gets (goal-controller#440):
 * `codeActionDiagnostics` turns the server's code actions into
 * `@codemirror/lint` actions, one that can apply (`canApplyCodeAction`)
 * right now, dispatched through the given surface.
 */
import { Text } from '@codemirror/state';
import { describe, expect, it, vi } from 'vitest';
import type { GoalCodeActionData } from '@goal-controller/goal-language/light';
import { codeActionDiagnostics } from '@/lib/workbench/serverLanguageSupport';

const doc = Text.of(['T9: Lift']);
const diagnostic = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
  severity: 1,
  message: 'Add this element in the diagram',
};

describe('codeActionDiagnostics (#440)', () => {
  it('has an action for a code action that can apply, dispatching it on click', async () => {
    const data: GoalCodeActionData = {
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      containerId: 'actor',
      args: { name: 'T9: Task' },
    };
    const dispatch = vi.fn();
    const model = {
      elements: new Map([
        [
          'actor',
          { id: 'actor', kind: 'istar.Actor', name: 'Actor', x: 0, y: 0 },
        ],
      ]),
    };
    const [lint] = await codeActionDiagnostics(
      doc,
      [diagnostic],
      async () => [data],
      () => ({
        dispatcher: { dispatch, subscribe: vi.fn() },
        model: model as never,
      }),
    );
    expect(lint).toMatchObject({ from: 0, to: 2, severity: 'error' });
    expect(lint!.actions).toHaveLength(1);
    lint!.actions![0]!.apply(null as never, 0, 2);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'createNode',
        elementTypeId: 'istar.Task',
        containerId: 'actor',
        args: { name: 'T9: Task' },
      }),
    );
  });

  it('has no action when the code action cannot apply (no owner, off the paper)', async () => {
    const data: GoalCodeActionData = {
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      args: { name: 'T9: Task' },
    };
    const model = { elements: new Map() };
    const [lint] = await codeActionDiagnostics(
      doc,
      [diagnostic],
      async () => [data],
      () => ({
        dispatcher: { dispatch: vi.fn(), subscribe: vi.fn() },
        model: model as never,
      }),
    );
    expect(lint!.actions).toHaveLength(0);
  });

  it('has no action when nothing can dispatch it yet', async () => {
    const data: GoalCodeActionData = {
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      containerId: 'actor',
      args: { name: 'T9: Task' },
    };
    const [lint] = await codeActionDiagnostics(
      doc,
      [diagnostic],
      async () => [data],
      () => null,
    );
    expect(lint!.actions).toHaveLength(0);
  });
});
