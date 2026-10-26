/**
 * piStar-ext's "Add new" and its model-properties panel dispatch actions
 * (goal-controller#411) instead of rewriting the text with
 * `writeModelExtension`: both write the file's `"metamodel"` block through
 * `istar.setFileMetamodel`, one undo step, and a block the dialect refuses
 * is rejected by `pistarExtMetamodelGuard` (lib/workbench/dialects.ts),
 * shown where the thrown error used to be.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import React, { useEffect, useMemo } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fileMetamodelOf } from '@istar-ts/core';
import type { IstarExtension } from '@istar-ts/react';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import WorkbenchCanvas from '@/components/workbench/engines/shared/WorkbenchCanvas';
import AddConstruct from '@/components/workbench/engines/pistarExt/AddConstruct';
import PistarExtInspector from '@/components/workbench/engines/pistarExt/PistarExtInspector';
import { pistarExtExtension } from '@/components/workbench/engines/pistarExt/extensions';
import { usePistarExt } from '@/components/workbench/engines/pistarExt/usePistarExt';
import { modelDialect, modelExtensionOf } from '@/lib/workbench/dialects';
import { mockReactFlowDom } from './reactFlowDom';
import { settled } from './modelWorker';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);

beforeAll(mockReactFlowDom);
afterEach(() => cleanup());

/** piStar-ext mode, as PistarExtDiagram renders it: the canvas, its "Add new" and its inspector. */
function PistarExtHarness() {
  const { extension } = usePistarExt();
  const extensions = useMemo<readonly IstarExtension[]>(
    () => [pistarExtExtension(extension) as IstarExtension],
    [extension],
  );
  return (
    <WorkbenchCanvas
      extensions={extensions}
      aside={<PistarExtInspector />}
      paletteOnTop
      paletteEnd={<AddConstruct />}
    />
  );
}

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <PistarExtHarness />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

const opened = async () => {
  const view = workbench();
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  return view;
};

/** ⌘Z on the canvas, and the worker's answer shown (#434). */
const commandZ = async (wb: () => Workbench, container: HTMLElement) => {
  act(() => {
    fireEvent.keyDown(container.querySelector('.istar-canvas')!, {
      key: 'z',
      metaKey: true,
    });
  });
  await settled(wb().session);
};

describe('piStar-ext dispatches istar.setFileMetamodel (#411)', () => {
  it('"Add new" dispatches one istar.setFileMetamodel, undone by one glspUndo', async () => {
    const { wb, container } = await opened();

    fireEvent.click(
      await waitFor(() => {
        const found = [...container.querySelectorAll('button')].find(
          (b) => b.textContent === 'Add new',
        );
        expect(found).toBeDefined();
        return found!;
      }),
    );
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role=dialog]');
      expect(found).not.toBeNull();
      return found!;
    });
    const name = dialog.querySelector('input')!;
    act(() => {
      fireEvent.change(name, { target: { value: 'Foo' } });
    });
    const create = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'Create',
    )!;
    fireEvent.click(create);

    const block = await waitFor(() => {
      const found = fileMetamodelOf(wb().session.store.getModel());
      expect(found?.elements).toMatchObject([{ kind: 'model.Foo' }]);
      return found;
    });
    expect(block?.elements).toMatchObject([{ kind: 'model.Foo' }]);
    expect(wb().text).toContain('model.Foo');

    await commandZ(wb, container);
    expect(fileMetamodelOf(wb().session.store.getModel())).toBeUndefined();
  });

  it('a new construct’s shape and line of its own draw on the canvas, the same way a dialect’s own construct’s do (#457)', async () => {
    const { wb, container } = await opened();
    const path = 'M 0 0 L 10 0 L 10 10 Z';

    fireEvent.click(
      await waitFor(() => {
        const found = [...container.querySelectorAll('button')].find(
          (b) => b.textContent === 'Add new',
        );
        expect(found).toBeDefined();
        return found!;
      }),
    );
    const dialog = await waitFor(() => {
      const found = document.querySelector('[role=dialog]');
      expect(found).not.toBeNull();
      return found!;
    });
    const name = dialog.querySelector('input')!;
    // the dialog's second textarea: description, then shape (SVG path data)
    const shapeInput = dialog.querySelectorAll('textarea')[1]!;
    act(() => {
      fireEvent.change(name, { target: { value: 'Mission' } });
      fireEvent.change(shapeInput, { target: { value: path } });
    });
    const create = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'Create',
    )!;
    fireEvent.click(create);

    await waitFor(() => {
      const found = fileMetamodelOf(wb().session.store.getModel());
      expect(found?.elements).toMatchObject([
        { kind: 'model.Mission', shape: { path } },
      ]);
    });
    // the canvas draws the model's own construct the same way PistarExtDiagram
    // builds its extensions: the merged dialect (withModelEntries), through
    // pistarExtExtension — its shape (istar-ts's KindShape) survives the
    // shared mapper, converted back from the dialect's own SVG path string
    const model = modelExtensionOf(wb().session.store.getModel());
    const { extension } = modelDialect('pistarext', model);
    expect(
      pistarExtExtension(extension).elements?.['model.Mission']?.shape,
    ).toEqual({ path });
  });

  it("the model panel's stereotype add/remove dispatch istar.setFileMetamodel, each one undo step", async () => {
    const { wb, container } = await opened();

    fireEvent.click(
      await waitFor(() => {
        const found = [...container.querySelectorAll('[role=tab]')].find(
          (t) => t.textContent === 'Stereotype',
        );
        expect(found).toBeDefined();
        return found!;
      }),
    );
    const fieldset = await waitFor(() => {
      const found = container.querySelector('fieldset');
      expect(found).not.toBeNull();
      return found!;
    });
    const name = fieldset.querySelector('input')!;
    const select = fieldset.querySelector('select')!;
    act(() => {
      fireEvent.change(name, { target: { value: 'Fancy' } });
      fireEvent.change(select, { target: { value: 'istar.Actor' } });
    });
    const add = [...fieldset.querySelectorAll('button')].find(
      (b) => b.textContent === 'Add',
    )!;
    fireEvent.click(add);

    await waitFor(() => {
      const found = fileMetamodelOf(wb().session.store.getModel());
      expect(found?.stereotypes).toMatchObject([{ name: 'Fancy' }]);
    });

    await commandZ(wb, container);
    expect(fileMetamodelOf(wb().session.store.getModel())).toBeUndefined();
  });

  it('a block the dialect refuses (a stereotype name it already has) is rejected: the model is untouched', async () => {
    const { wb } = await opened();
    const before = wb().session.store.getModel();

    // 'action' is one of iStar4RationalAgents' own stereotypes (istar4RationalAgents.ts)
    const result = await wb()
      .dispatcherFor('inspector')
      .dispatch({
        kind: 'istar.setFileMetamodel',
        block: {
          name: 'model',
          stereotypes: [{ name: 'action', appliesTo: ['istar.Task'] }],
        },
      });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.message).toContain('action');
    expect(wb().session.store.getModel()).toBe(before);
    expect(wb().canUndo).toBe(false);
  });
});
