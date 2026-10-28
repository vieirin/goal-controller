/**
 * DefinitionInspector's NotationField (applyLabelEdit) and PartInspector
 * (istar.updateProperties), goal-controller#411/M2a: an edit reaches the
 * model as one dispatched action, one glspUndo takes it back, and the
 * exported piStar matches the old pistar.ts helpers (setNodeText,
 * setNodeProperty, setLinkProperty) byte for byte.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import React, { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { elementLine } from '@goal-controller/goal-language';
import type { ActionResult } from '@istar-ts/actions';
import {
  useWorkbench,
  WorkbenchProvider,
  type SelectedPart,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { NotationField } from '@/components/workbench/engines/definition/DefinitionInspector';
import PartInspector from '@/components/workbench/engines/definition/PartInspector';
import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import {
  setLinkProperty,
  setNodeProperty,
  setNodeText,
} from '@/lib/workbench/pistar';
import { mockReactFlowDom } from './reactFlowDom';
import { settled } from './modelWorker';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: G1 (goal, OR-refined), its actor, and a NeededByLink
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';
const LINK = '63f6cc85-fc79-46d4-b1a8-dfff1e08cc50';

beforeAll(mockReactFlowDom);
afterEach(() => cleanup());

/** The workbench with NotationField for `iStarId`'s node, kept live as the tree changes. */
const openedNotation = async (iStarId: string) => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    const node = [...(current.tree?.nodes.values() ?? [])].find(
      (n) => n.iStarId === iStarId,
    );
    return node ? (
      <div data-testid='inspector'>
        <NotationField node={node} engine='edgev2' />
      </div>
    ) : null;
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  await act(() => wb!.openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(wb!.tree).not.toBeNull());
  return { wb: () => wb!, container: view.container };
};

/** The workbench with PartInspector for `part`; it looks the link/actor up itself. */
const openedPart = async (part: SelectedPart) => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return (
      <div data-testid='inspector'>
        <PartInspector engine='edgev2' part={part} />
      </div>
    );
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  await act(() => wb!.openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(wb!.tree).not.toBeNull());
  return { wb: () => wb!, container: view.container };
};

const undo = (wb: Workbench) =>
  act(async () => {
    await wb.dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
  });

describe("DefinitionInspector's NotationField dispatches applyLabelEdit (#411)", () => {
  it('a notation edit reaches the model as one applyLabelEdit, undone by one glspUndo, matching setNodeText byte for byte', async () => {
    const { wb, container } = await openedNotation(G1);
    const before = wb().text;
    const node = [...wb().tree!.nodes.values()].find((n) => n.iStarId === G1)!;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const input = await waitFor(() => {
      const found = container.querySelector<HTMLInputElement>(
        '[data-testid=inspector] input',
      );
      expect(found).not.toBeNull();
      return found!;
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'retry' } });
      fireEvent.blur(input);
    });
    await settled(wb().session);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'applyLabelEdit',
      labelId: G1,
    });
    const expected = setNodeText(
      before,
      G1,
      elementLine(ENGINE_DIALECTS.edgev2, {
        id: node.id,
        name: node.name,
        notation: 'retry',
      }),
    );
    expect(wb().text).toBe(expected);

    await undo(wb());
    expect(wb().text).toBe(before);
    expect(wb().canUndo).toBe(false);
  });
});

describe('PartInspector dispatches istar.updateProperties (#411, goal-controller#107)', () => {
  // no dialect gives an actor or a link properties yet (goal-controller#107
  // is not built out), so "Add a property" has no suggestions to pick in the
  // DOM: dispatch exactly what PartInspector's write() would.
  const setProperty = async (
    wb: Workbench,
    elementId: string,
    key: string,
    value: string | null,
  ): Promise<ActionResult> => {
    let result: ActionResult | undefined;
    await act(async () => {
      result = await wb.dispatcherFor('inspector').dispatch({
        kind: 'istar.updateProperties',
        elementId,
        properties: { [key]: value },
      });
    });
    return result!;
  };

  describe('an actor (an element)', () => {
    it('setting a property reaches the model as one istar.updateProperties, undone by one glspUndo, matching setNodeProperty byte for byte', async () => {
      const { wb, container } = await openedPart({ type: 'actor', id: ACTOR });
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');

      const result = await setProperty(wb(), ACTOR, 'Foo', 'bar');
      expect(result.ok).toBe(true);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: ACTOR,
      });
      expect(wb().text).toBe(setNodeProperty(before, ACTOR, 'Foo', 'bar'));
      await waitFor(() =>
        expect(
          container.querySelector('[data-testid=inspector]'),
        ).not.toBeNull(),
      );

      await undo(wb());
      expect(wb().text).toBe(before);
      expect(wb().canUndo).toBe(false);
    });

    it('changing it reaches the model as one istar.updateProperties, undone by one glspUndo, matching setNodeProperty byte for byte', async () => {
      const { wb, container } = await openedPart({ type: 'actor', id: ACTOR });
      await setProperty(wb(), ACTOR, 'Foo', 'bar');
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
      const input = await waitFor(() => {
        const found = container.querySelector<HTMLInputElement>(
          '[data-testid=inspector] input',
        );
        expect(found).not.toBeNull();
        return found!;
      });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'baz' } });
        fireEvent.blur(input);
      });
      await settled(wb().session);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: ACTOR,
        properties: { Foo: 'baz' },
      });
      expect(wb().text).toBe(setNodeProperty(before, ACTOR, 'Foo', 'baz'));

      await undo(wb());
      expect(wb().text).toBe(before);
      // the setup dispatch (setting Foo) is still on the undo stack
      expect(wb().canUndo).toBe(true);
    });

    it('removing one of several properties reaches the model as one istar.updateProperties, undone by one glspUndo, matching setNodeProperty byte for byte', async () => {
      const { wb, container } = await openedPart({ type: 'actor', id: ACTOR });
      await setProperty(wb(), ACTOR, 'Foo', 'bar');
      await setProperty(wb(), ACTOR, 'Bar', 'qux');
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
      const remove = await waitFor(() => {
        const found = container.querySelector<HTMLButtonElement>(
          '[aria-label="Remove Foo"]',
        );
        expect(found).not.toBeNull();
        return found!;
      });

      await act(async () => {
        fireEvent.click(remove);
      });
      await settled(wb().session);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: ACTOR,
        properties: { Foo: null },
      });
      expect(wb().text).toBe(setNodeProperty(before, ACTOR, 'Foo', null));

      await undo(wb());
      expect(wb().text).toBe(before);
      // the two setup dispatches (setting Foo and Bar) are still on the undo stack
      expect(wb().canUndo).toBe(true);
    });

    it('removing the last custom property keeps "customProperties": {}, matching setNodeProperty byte for byte (istar-ts#219)', async () => {
      const { wb } = await openedPart({ type: 'actor', id: ACTOR });
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');

      // the actor's only custom property (ACTOR's "Description"): PartInspector
      // never shows it as a removable row (it is excluded from the generic
      // list), so this removes it directly, as `istar.updateProperties` would
      // for any other property
      const result = await setProperty(wb(), ACTOR, 'Description', null);
      expect(result.ok).toBe(true);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(wb().text).toContain('"customProperties": {}');
      expect(wb().text).toBe(
        setNodeProperty(before, ACTOR, 'Description', null),
      );

      await undo(wb());
      expect(wb().text).toBe(before);
      expect(wb().canUndo).toBe(false);
    });
  });

  describe('a link', () => {
    it('setting a property reaches the model as one istar.updateProperties, undone by one glspUndo, matching setLinkProperty byte for byte', async () => {
      const { wb } = await openedPart({ type: 'link', id: LINK });
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');

      const result = await setProperty(wb(), LINK, 'Foo', 'bar');
      expect(result.ok).toBe(true);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: LINK,
      });
      expect(wb().text).toBe(setLinkProperty(before, LINK, 'Foo', 'bar'));

      await undo(wb());
      expect(wb().text).toBe(before);
      expect(wb().canUndo).toBe(false);
    });

    it('changing it reaches the model as one istar.updateProperties, undone by one glspUndo, matching setLinkProperty byte for byte', async () => {
      const { wb, container } = await openedPart({ type: 'link', id: LINK });
      await setProperty(wb(), LINK, 'Foo', 'bar');
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
      const input = await waitFor(() => {
        const found = container.querySelector<HTMLInputElement>(
          '[data-testid=inspector] input',
        );
        expect(found).not.toBeNull();
        return found!;
      });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'baz' } });
        fireEvent.blur(input);
      });
      await settled(wb().session);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: LINK,
        properties: { Foo: 'baz' },
      });
      expect(wb().text).toBe(setLinkProperty(before, LINK, 'Foo', 'baz'));

      await undo(wb());
      expect(wb().text).toBe(before);
      // the setup dispatch (setting Foo) is still on the undo stack
      expect(wb().canUndo).toBe(true);
    });

    it('removing its only property reaches the model as one istar.updateProperties, undone by one glspUndo, matching setLinkProperty byte for byte', async () => {
      const { wb, container } = await openedPart({ type: 'link', id: LINK });
      await setProperty(wb(), LINK, 'Foo', 'bar');
      const before = wb().text;
      const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
      const remove = await waitFor(() => {
        const found = container.querySelector<HTMLButtonElement>(
          '[aria-label="Remove Foo"]',
        );
        expect(found).not.toBeNull();
        return found!;
      });

      await act(async () => {
        fireEvent.click(remove);
      });
      await settled(wb().session);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0]![0]).toMatchObject({
        kind: 'istar.updateProperties',
        elementId: LINK,
        properties: { Foo: null },
      });
      expect(wb().text).toBe(setLinkProperty(before, LINK, 'Foo', null));

      await undo(wb());
      expect(wb().text).toBe(before);
      // the setup dispatch (setting Foo) is still on the undo stack
      expect(wb().canUndo).toBe(true);
    });
  });
});
