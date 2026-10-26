/**
 * The model and its dispatcher live in the model worker (goal-controller#434),
 * the main thread holds a mirror. jsdom has no `Worker`: the worker's host
 * runs in-process (modelWorkerLocal.ts), over the same `MessagePort` per
 * session the browser uses, so every edit here crosses a port both ways.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteDispatcher, type ActionListener } from '@istar-ts/actions';
import {
  createEmptyModel,
  metamodelOf,
  ModelOperationError,
} from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { createModelSession } from '@/lib/workbench/modelSession';
import { localModelWorkerSessions } from '@/lib/workbench/modelWorkerLocal';
import { emptyModelText } from '@/lib/workbench/frameworks';
import { readModelText, writeModelMode } from '@/lib/workbench/pistar';
import { settled } from './modelWorker';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: one actor, G1 OR-refined into G2 and G3
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  return () => wb!;
};

const opened = async (text = ISTAR) => {
  const wb = workbench();
  await act(() => wb().openModelFile('simpleChoice.txt', text));
  await waitFor(() => expect(wb().tree).not.toBeNull());
  await act(() => wb().session.ready);
  return wb;
};

const nameOf = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id)?.name;

describe('the model lives in the worker; the main thread holds a mirror (#434)', () => {
  it("the main thread's store is a read-only mirror of an open worker session", async () => {
    const wb = await opened();
    expect(await localModelWorkerSessions()).toContain(wb().session.id);
    expect(() => wb().session.store.replace(createEmptyModel())).toThrow(
      ModelOperationError,
    );
  });

  it.each(['canvas', 'inspector'] as const)(
    'a %s edit goes through the worker, then updates the mirror and wb.text; one glspUndo undoes it, byte for byte',
    async (surface) => {
      const wb = await opened();
      const before = wb().text;
      const pending = wb()
        .dispatcherFor(surface)
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: Moved' });
      // a message away: nothing has changed yet on this side
      expect(nameOf(wb(), G1)).toBe('G1: Goal [+]');
      await act(async () => {
        expect((await pending).ok).toBe(true);
      });
      expect(nameOf(wb(), G1)).toBe('G1: Moved');
      expect(wb().text).toContain('"G1: Moved"');
      expect(wb().changeSource).toBe(surface);
      expect(wb().canUndo).toBe(true);

      await act(async () => {
        await wb().dispatcherFor(surface).dispatch({ kind: 'glspUndo' });
      });
      expect(nameOf(wb(), G1)).toBe('G1: Goal [+]');
      expect(wb().text).toBe(before);
      expect(wb().changeSource).toBe('undo');
      expect(wb().canUndo).toBe(false);
      expect(wb().dirty).toBe(false);
    },
  );

  it('a raw write (wb.setText) is shown as written at once, reaches the worker as one undo step, and one glspUndo undoes it', async () => {
    const wb = await opened();
    const before = wb().text;
    // not the model's own serialization: no indentation at all
    const written = JSON.stringify(
      JSON.parse(before.replace('G1: Goal [+]', 'G1: Raw')),
    );
    act(() => wb().setText(written, 'source'));
    expect(wb().text).toBe(written);
    await settled(wb().session);
    expect(nameOf(wb(), G1)).toBe('G1: Raw');
    // the worker kept the text as written: it isn't derived again
    expect(wb().text).toBe(written);
    expect(wb().changeSource).toBe('source');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(nameOf(wb(), G1)).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
  });

  it('a raw write that is not JSON keeps its text and its JSON problem; the model, in the worker too, stays', async () => {
    const wb = await opened();
    const model = wb().session.store.getModel();
    act(() => wb().setText('{ "actors": [', 'source'));
    await settled(wb().session);
    expect(wb().text).toBe('{ "actors": [');
    expect(wb().jsonError).not.toBeNull();
    expect(wb().session.store.getModel()).toBe(model);
    expect(wb().canUndo).toBe(false);
    // an edit after it is derived from the worker's model, the text taken back
    await act(async () => {
      await wb()
        .dispatcherFor('inspector')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: After' });
    });
    expect(wb().jsonError).toBeNull();
    expect(JSON.parse(wb().text).actors[0].nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'G1: After' })]),
    );
  });

  it("a guard's rejection in the worker never changes the mirror", async () => {
    const wb = await opened(writeModelMode(ISTAR, 'edgev2'));
    await waitFor(() => expect(wb().mode).toBe('edgev2'));
    await settled(wb().session);
    const model = wb().session.store.getModel();
    const text = wb().text;
    const heard = vi.fn();
    const unsubscribe = wb().session.store.subscribe(heard);

    const result = await act(() =>
      wb()
        .dispatcherFor('canvas')
        .dispatch({
          kind: 'createNode',
          elementTypeId: 'istar.Actor',
          location: { x: 900, y: 900 },
        }),
    );
    unsubscribe();

    expect(result.ok).toBe(false);
    expect(heard).not.toHaveBeenCalled();
    expect(wb().session.store.getModel()).toBe(model);
    expect(wb().text).toBe(text);
    expect(wb().canUndo).toBe(false);
    expect(
      [...model.elements.values()].filter((e) => e.kind === 'istar.Actor'),
    ).toHaveLength(1);
    expect(model.elements.has(ACTOR)).toBe(true);
  });

  it("a session switch closes the old one's worker session", async () => {
    const wb = await opened();
    const first = wb().session.id;
    expect(await localModelWorkerSessions()).toContain(first);

    await act(() => wb().openModelFile('again.txt', ISTAR));
    await waitFor(() => expect(wb().session.id).not.toBe(first));
    const second = wb().session.id;
    await act(() => wb().session.ready);
    await waitFor(async () => {
      const open = await localModelWorkerSessions();
      expect(open).not.toContain(first);
      expect(open).toContain(second);
    });

    act(() => wb().closeModel());
    await waitFor(async () =>
      expect(await localModelWorkerSessions()).not.toContain(second),
    );
  });

  it('a conversion to another metamodel (a raw write) is followed by the mirror, and undone across it', async () => {
    const wb = await opened();
    const before = wb().text;
    const kaos = emptyModelText('kaos');
    act(() => wb().setText(kaos, 'convert'));
    await settled(wb().session);
    expect(metamodelOf(wb().session.store.getModel())).toBe(KAOS_OBSTACLES);
    expect(wb().session.store.getModel().elements.size).toBe(0);
    expect(wb().text).toBe(kaos);

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(metamodelOf(wb().session.store.getModel())).not.toBe(KAOS_OBSTACLES);
    expect(nameOf(wb(), G1)).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
  });
});

describe('the mirror reads each file with its own metamodel (istar-ts#250)', () => {
  const example = (path: string) =>
    readFileSync(join(__dirname, '../../../../examples', path), 'utf8');

  it.each([
    ['KAOS', 'kaos/kaos-welcome.txt'],
    ['NFR', 'nfr/nfr-welcome.txt'],
  ])(
    'a %s model opens with no seed flash: the seed is shown, and kept once the worker answers',
    async (_, path) => {
      const text = example(path);
      const read = readModelText(text);
      if (!('model' in read)) throw read.error;
      const changes = vi.fn();
      const session = createModelSession(text, changes, () => {}, {
        seed: read.model,
      });
      const heard = vi.fn();
      session.store.subscribe(heard);
      expect(session.store.getModel()).toBe(read.model);
      await session.ready;
      await settled(session);
      expect(session.store.getModel()).toBe(read.model);
      expect(heard).not.toHaveBeenCalled();
      expect(changes).not.toHaveBeenCalled();
      session.dispose();
    },
  );

  it('a KAOS model converted to iStar 2.0 is followed by the same mirror, and undone back to KAOS', async () => {
    const kaosText = example('kaos/kaos-welcome.txt');
    const wb = await opened(kaosText);
    const store = wb().session.store;
    const kaos = metamodelOf(store.getModel());
    expect(kaos).not.toBe(metamodelOf(createEmptyModel()));
    const before = wb().text;

    const istar = emptyModelText('istar-2.0');
    act(() => wb().setText(istar, 'convert'));
    await settled(wb().session);
    expect(wb().session.store).toBe(store);
    expect(metamodelOf(store.getModel())).not.toBe(kaos);
    expect(wb().text).toBe(istar);

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(metamodelOf(store.getModel())).toBe(kaos);
    expect(wb().text).toBe(before);
  });
});

describe('the engine worker follows the model worker directly (#434)', () => {
  it("a port served by the session hears the worker's changes, with no main-thread dispatcher in between", async () => {
    const session = createModelSession(
      ISTAR,
      () => {},
      () => {},
    );
    await session.ready;
    const { port1, port2 } = new MessageChannel();
    const stop = session.serve(port1);
    const engineSide = createRemoteDispatcher<string, string, MessageEvent>(
      port2,
    );
    const heard = vi.fn<ActionListener<string, string>>();
    engineSide.subscribe(heard);

    const result = await session
      .dispatcherFor('canvas')
      .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'G1: Heard' });
    expect(result.ok).toBe(true);
    await waitFor(() =>
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'sourceModelChanged' }),
      ),
    );
    // the model's own requests answer too: it's the worker's dispatcher
    const model = await engineSide.dispatch({
      kind: 'requestModel',
      requestId: 'engine',
    });
    expect(JSON.stringify(model)).toContain('G1: Heard');

    stop();
    port2.close();
    session.dispose();
  });
});
