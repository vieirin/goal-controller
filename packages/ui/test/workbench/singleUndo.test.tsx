/**
 * One model, one undo history (goal-controller#410): the workbench owns the
 * store and its dispatcher, the text is derived from the model, and an edit
 * from the canvas, the inspector or the text is undone by one `glspUndo`
 * (⌘Z), which brings the diagram and `wb.text` back together.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useIstarEditor, type IstarEditor } from '@istar-ts/react';
import type { GoalViewNode } from '@goal-controller/goal-tree';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import {
  NameField,
  NodeColorField,
  RefinementField,
  useEditModel,
} from '@/components/workbench/engines/shared/inspector';
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: G1, OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';

beforeAll(mockReactFlowDom);
afterEach(() => cleanup());

/** The workbench with a canvas, its editor seen from the canvas's aside, and an inspector field. */
const workbench = (
  field?: (node: GoalViewNode) => React.ReactNode,
  iStarId = G1,
) => {
  let wb: Workbench | null = null;
  let editor: IstarEditor | null = null;
  const Probe = () => {
    wb = useWorkbench();
    const node = [...(wb.tree?.nodes.values() ?? [])].find(
      (n) => n.iStarId === iStarId,
    );
    return node && field ? (
      <div data-testid='inspector'>{field(node)}</div>
    ) : null;
  };
  const EditorProbe = () => {
    editor = useIstarEditor();
    return null;
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <WorkbenchCanvas extensions={[]} aside={<EditorProbe />} />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, editor: () => editor!, container: view.container };
};

const opened = async (field?: (node: GoalViewNode) => React.ReactNode) => {
  const view = workbench(field);
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  await waitFor(() => expect(view.editor()).not.toBeNull());
  return view;
};

const element = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id);

/** ⌘Z (⌘⇧Z: redo) on the canvas. */
const commandZ = (container: HTMLElement, shiftKey = false) =>
  act(() => {
    fireEvent.keyDown(container.querySelector('.istar-canvas')!, {
      key: 'z',
      metaKey: true,
      shiftKey,
    });
  });

describe('one undo history, the dispatcher’s (#410)', () => {
  it('derives the text from a canvas edit; ⌘Z takes back both the diagram and the text', async () => {
    const { wb, editor, container } = await opened();
    const before = wb().text;
    const { x, y } = element(wb(), G2)!;
    // what a drag dispatches
    await act(async () => {
      const result = await editor()
        .dispatcherFor('canvas')
        .dispatch({
          kind: 'changeBounds',
          newBounds: [{ elementId: G2, newPosition: { x: x + 40, y: y + 10 } }],
        });
      expect(result.ok).toBe(true);
    });
    expect(element(wb(), G2)).toMatchObject({ x: x + 40, y: y + 10 });
    expect(wb().changeSource).toBe('canvas');
    expect(JSON.parse(wb().text)).not.toEqual(JSON.parse(before));
    expect(wb().canUndo).toBe(true);

    await commandZ(container);
    expect(element(wb(), G2)).toMatchObject({ x, y });
    // the text as it was, byte for byte
    expect(wb().text).toBe(before);
    expect(wb().dirty).toBe(false);
    expect(wb().changeSource).toBe('undo');
    expect(wb().canUndo).toBe(false);

    // and ⌘⇧Z redoes it
    await commandZ(container, true);
    expect(element(wb(), G2)).toMatchObject({ x: x + 40, y: y + 10 });
  });

  it('a canvas rename is an action too: the text follows, one ⌘Z takes it back', async () => {
    const { wb, editor, container } = await opened();
    const before = wb().text;
    await act(async () => editor().elementActions(G1).rename('G1: Renamed'));
    expect(element(wb(), G1)?.name).toBe('G1: Renamed');
    expect(wb().text).toContain('"G1: Renamed"');
    await commandZ(container);
    expect(wb().text).toBe(before);
  });

  it('an inspector edit reaches the model as a dispatched action, and one glspUndo takes it back', async () => {
    const { wb } = await opened((node) => <NameField node={node} />);
    const before = wb().text;
    const inspector = wb().dispatcherFor('inspector');
    const dispatch = vi.spyOn(inspector, 'dispatch');
    const input = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement>(
        '[data-testid=inspector] input',
      );
      expect(found).not.toBeNull();
      return found!;
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.blur(input);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'applyLabelEdit',
      labelId: G1,
    });
    expect(element(wb(), G1)?.name).toContain('Renamed');
    expect(wb().text).toContain('Renamed');
    expect(wb().changeSource).toBe('inspector');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
    expect(wb().canUndo).toBe(false);
  });

  it('an inspector edit of several operations is one compound action, one undo step', async () => {
    // an edit that names an element and colours it: two operations, one edit
    const Both = ({ node }: { node: GoalViewNode }) => {
      const edit = useEditModel();
      return (
        <button
          type='button'
          onClick={() =>
            void edit(
              {
                kind: 'applyLabelEdit',
                labelId: node.iStarId,
                text: 'G1: Both',
              },
              {
                kind: 'istar.updateDisplay',
                elementId: node.iStarId,
                patch: { backgroundColor: '#00FF00' },
              },
            )
          }
        >
          both
        </button>
      );
    };
    const { wb, container } = await opened((node) => <Both node={node} />);
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const button = await waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>(
        '[data-testid=inspector] button',
      );
      expect(found).not.toBeNull();
      return found!;
    });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'compound',
      operationList: [
        { kind: 'applyLabelEdit' },
        { kind: 'istar.updateDisplay' },
      ],
    });
    expect(element(wb(), G1)).toMatchObject({
      name: 'G1: Both',
      display: { backgroundColor: '#00FF00' },
    });

    await commandZ(container);
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
    expect(element(wb(), G1)?.display?.backgroundColor).toBeUndefined();
    expect(wb().text).toBe(before);
  });

  it('the refinement is still a text edit (istar-ts#199), undone the same way', async () => {
    const { wb, container } = await opened((node) => (
      <RefinementField node={node} />
    ));
    const before = wb().text;
    const and = await waitFor(() => {
      const found = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[data-testid=inspector] button',
        ),
      ].find((button) => button.textContent === 'AND');
      expect(found).toBeDefined();
      return found!;
    });
    await act(async () => {
      fireEvent.click(and);
    });
    const kinds = () =>
      [...wb().session.store.getModel().links.values()]
        .filter((link) => link.target === G1)
        .map((link) => link.kind);
    expect(kinds()).toEqual([
      'istar.AndRefinementLink',
      'istar.AndRefinementLink',
    ]);
    await commandZ(container);
    expect(kinds()).toEqual([
      'istar.OrRefinementLink',
      'istar.OrRefinementLink',
    ]);
    expect(wb().text).toBe(before);
  });

  it('an inspector colour is an istar.updateDisplay', async () => {
    const { wb } = await opened((node) => (
      <NodeColorField node={node} fallback='#ffffff' />
    ));
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const input = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement>(
        '[data-testid=inspector] input[type=color]',
      );
      expect(found).not.toBeNull();
      return found!;
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: '#ff0000' } });
    });
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(dispatch.mock.calls.at(-1)![0]).toMatchObject({
      kind: 'istar.updateDisplay',
      elementId: G1,
    });
    expect(element(wb(), G1)?.display?.backgroundColor).toBe('#FF0000');
  });

  it('a text edit (setText, the editors not yet on actions) is one undo step; a burst of them, one', async () => {
    const { wb, container } = await opened();
    const before = wb().text;
    const renamed = (name: string) => before.replace('G1: Goal [+]', name);
    act(() => {
      wb().setText(renamed('G1: A'), 'source');
      wb().setText(renamed('G1: AB'), 'source');
    });
    expect(element(wb(), G1)?.name).toBe('G1: AB');
    // as written, not as the model would write it
    expect(wb().text).toBe(renamed('G1: AB'));
    // a text that doesn't parse is kept; the model stays the last one that did
    act(() => wb().setText('{ "actors": [', 'source'));
    expect(wb().jsonError).not.toBeNull();
    expect(element(wb(), G1)?.name).toBe('G1: AB');

    await commandZ(container);
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
    expect(wb().canUndo).toBe(false);
  });

  it('opening another model starts its history over', async () => {
    const { wb } = await opened();
    const first = wb().session;
    act(() => wb().setText(ISTAR.replace('G1: Goal [+]', 'G1: X'), 'source'));
    expect(wb().canUndo).toBe(true);
    await act(() => wb().openModelFile('again.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('again.txt'));
    expect(wb().session).not.toBe(first);
    expect(wb().canUndo).toBe(false);
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
  });
});
