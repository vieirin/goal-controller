/**
 * The Notation view and pool documents dispatch actions on the workbench's
 * dispatcher (goal-controller#411), the same single undo history as the
 * canvas and the inspector (#410): one dispatched action per edit, undone
 * by one `glspUndo`. A line added creates its element, a line removed
 * removes it, its links kept as orphans (goal-controller#518).
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
import type { CompoundOperation } from '@istar-ts/actions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import NotationView from '@/components/workbench/engines/definition/NotationView';
import {
  LanguageSupportContext,
  useProjectWorkspace,
} from '@/components/workbench/engines/definition/useLanguageSupport';
import FrameworkNotationView from '@/components/workbench/engines/framework/FrameworkNotationView';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import type { PoolHost } from '@/lib/workbench/poolSupport';
import { settled } from './modelWorker';

// a plain textarea stands in for CodeMirror: NotationEditor's dispatching
// logic (debounce, the action it sends) doesn't depend on CodeMirror itself
vi.mock('@/components/workbench/CodeEditor', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange?: (value: string) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// DSM3's own KAOS welcome model: its elements have no ids yet (goal-controller#171)
const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);
// in simpleChoice.txt, under the Actor: G1: Goal [+], its Description empty
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

afterEach(() => cleanup());

const workbench = (body: React.ReactNode) => {
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
      {body}
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

const opened = async (body: React.ReactNode) => {
  const view = workbench(body);
  await act(() => view.wb().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(view.wb().tree).not.toBeNull());
  return view;
};

const element = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id);

const notationTextarea = () =>
  document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label^="Goal model notation"]',
  )!;

/** The notation editor's debounce (EDIT_DELAY_MS in NotationEditor.tsx). */
const afterDebounce = () => act(() => new Promise((r) => setTimeout(r, 350)));

describe('the Notation view dispatches actions (#411)', () => {
  it('a name edit is one dispatched applyLabelEdit, undone by one glspUndo', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('G1: Goal [+]');
      return found;
    });

    const next = textarea.value.replace('G1: Goal [+]', 'G1: Renamed [+]');
    fireEvent.change(textarea, { target: { value: next } });
    await afterDebounce();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'applyLabelEdit',
      labelId: G1,
    });
    expect(element(wb(), G1)?.name).toBe('G1: Renamed [+]');
    expect(wb().text).toContain('Renamed');
    expect(wb().changeSource).toBe('inspector');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
  });

  it('a property edit is one dispatched istar.updateProperties, undone by one glspUndo', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    // G1 has no cost (edgeV2's Edge property): give it one first (its own
    // undo step), so the Notation view prints its line
    await act(async () => {
      await wb()
        .dispatcherFor('inspector')
        .dispatch({
          kind: 'istar.updateProperties',
          elementId: G1,
          properties: { cost: '3' },
        });
    });
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toMatch(/cost 3/);
      return found;
    });

    const next = textarea.value.replace('cost 3', 'cost 5');
    expect(next).not.toBe(textarea.value);
    fireEvent.change(textarea, { target: { value: next } });
    await afterDebounce();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'istar.updateProperties',
      elementId: G1,
      properties: { cost: '5' },
    });
    expect(wb().text).toContain('"cost": "5"');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().text).toBe(before);
  });

  it('a line with no kind’s word dispatches nothing: it is being typed (#518)', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('goal G1: Goal [+]');
      return found;
    });
    // an unknown word, and a line whose word is gone: nothing created,
    // nothing removed (G2's line names it no more), nothing renamed
    const value = `${textarea.value.replace('goal G2: Goal', 'G2: Goal')}\ngaol G9: Nothing`;
    fireEvent.change(textarea, { target: { value } });
    await afterDebounce();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a rejected edit clears ownEdit so a later, real change still dispatches', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    const dispatch = vi
      .spyOn(wb().dispatcherFor('inspector'), 'dispatch')
      .mockResolvedValueOnce({ ok: false, diagnostics: [] });
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('G1: Goal [+]');
      return found;
    });
    // a real edit, parseable by notationEdits, but the dispatcher rejects it
    // (e.g. the element went stale between render and debounce)
    fireEvent.change(textarea, {
      target: {
        value: textarea.value.replace('G1: Goal [+]', 'G1: Rejected [+]'),
      },
    });
    await afterDebounce();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');

    fireEvent.change(textarea, {
      target: {
        value: textarea.value.replace('G1: Goal [+]', 'G1: Second [+]'),
      },
    });
    await afterDebounce();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(element(wb(), G1)?.name).toBe('G1: Second [+]');
  });
});

describe('pool documents dispatch actions (#411)', () => {
  // a fake LanguageSupport: just captures the host useProjectWorkspace builds,
  // so its applyEdits (normally only reachable through the rename panel,
  // F2 + Enter, in a pool's CodeMirror extensions) can be called directly
  let capturedHost: PoolHost | null = null;
  const fakeSupport: LanguageSupport = {
    documentExtension: () => [],
    fieldExtension: () => [],
    setContext: () => {},
    setSaved: () => {},
    setWorkspace: (_workspace, host) => {
      capturedHost = host;
    },
  };
  const Workspace = () => {
    useProjectWorkspace('edgev2');
    return null;
  };
  const withWorkspace = (
    <LanguageSupportContext.Provider value={() => fakeSupport}>
      <Workspace />
    </LanguageSupportContext.Provider>
  );

  it('a pool rename reaches the model as a dispatched action, undone by one glspUndo', async () => {
    const { wb } = await opened(withWorkspace);
    await waitFor(() => expect(capturedHost).not.toBeNull());
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');

    await act(async () => {
      const message = capturedHost!.applyEdits([
        {
          document: 'model:G1:Description',
          from: 0,
          to: 0,
          text: 'from pool',
        },
      ]);
      expect(message).toBeNull();
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'istar.updateProperties',
      elementId: G1,
      properties: { Description: 'from pool' },
    });
    await settled(wb().session);
    expect(element(wb(), G1)?.customProperties?.Description).toBe('from pool');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().text).toBe(before);
  });
});

/** The elements of the open model, by name. */
const named = (wb: Workbench, name: string) =>
  [...wb.session.store.getModel().elements.values()].filter(
    (e) => e.name === name,
  );

describe('a line creates its element, a line removed removes it (#518)', () => {
  it('a new line under T2 creates its goal in the actor, its property too: one createNode, undone by one glspUndo', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    const before = wb().text;
    const actor = [...wb().session.store.getModel().elements.values()].find(
      (e) => e.kind === 'istar.Actor',
    )!;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('    task T2: Task');
      return found;
    });
    const value = textarea.value.replace(
      '    task T2: Task',
      '    task T2: Task\n  goal G9: Another goal\n    cost 3',
    );
    fireEvent.change(textarea, { target: { value } });
    await afterDebounce();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'createNode',
      elementTypeId: 'istar.Goal',
      containerId: actor.id,
      location: { x: expect.any(Number), y: expect.any(Number) },
      args: {
        id: expect.any(String),
        name: 'G9: Another goal',
        customProperties: { cost: '3' },
      },
    });
    await settled(wb().session);
    const [created] = named(wb(), 'G9: Another goal');
    expect(created).toMatchObject({
      kind: 'istar.Goal',
      parent: actor.id,
      customProperties: { cost: '3' },
    });

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(named(wb(), 'G9: Another goal')).toEqual([]);
    expect(wb().text).toBe(before);
  });

  it('a line removed removes only its element, its links kept as orphans; one glspUndo brings it back', async () => {
    const { wb } = workbench(<FrameworkNotationView mode='kaos' />);
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    const before = wb().text;
    const model = wb().session.store.getModel();
    const [property] = named(wb(), 'Internet connection available');
    const touching = [...model.links.values()].filter(
      (l) => l.source === property!.id || l.target === property!.id,
    );
    // its refinement leg, and its conflict with Save Bandwidth
    expect(touching).toHaveLength(2);
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('Internet connection available');
      return found;
    });
    // its line and the lines under it (its Description, its link line)
    const lines = textarea.value.split('\n');
    const at = lines.findIndex((l) =>
      l.includes('Internet connection available'),
    );
    const indent = (l: string) => l.length - l.trimStart().length;
    let end = at + 1;
    while (end < lines.length && indent(lines[end]!) > indent(lines[at]!))
      end++;
    const value = [...lines.slice(0, at), ...lines.slice(end)].join('\n');
    fireEvent.change(textarea, { target: { value } });
    await afterDebounce();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'istar.replaceModel',
    });
    await settled(wb().session);
    const after = wb().session.store.getModel();
    expect(after.elements.has(property!.id)).toBe(false);
    // every other element, and every link, still there
    expect(after.elements.size).toBe(model.elements.size - 1);
    expect([...after.links.keys()]).toEqual([...model.links.keys()]);
    await waitFor(() =>
      expect(wb().tree?.orphans.map((o) => o.missing)).toEqual([
        [property!.id],
        [property!.id],
      ]),
    );

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().session.store.getModel().elements.has(property!.id)).toBe(true);
    expect(wb().text).toBe(before);
  });

  it('a line added and one removed in one edit: one compound, undone by one glspUndo', async () => {
    const { wb } = workbench(<FrameworkNotationView mode='kaos' />);
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    const before = wb().text;
    const [user] = named(wb(), 'User');
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain(': User');
      return found;
    });
    // the agent's lines go, a softgoal's line (no id yet) and its property line come
    const lines = textarea.value.split('\n');
    const at = lines.findIndex((l) => l.endsWith(': User'));
    const value = [
      ...lines.slice(0, at),
      'softgoal Fast recovery',
      '  Priority high',
    ].join('\n');
    fireEvent.change(textarea, { target: { value } });
    await afterDebounce();

    expect(dispatch).toHaveBeenCalledTimes(1);
    const dispatched = dispatch.mock.calls[0]![0] as CompoundOperation;
    expect(dispatched.kind).toBe('compound');
    expect(dispatched.operationList.map((op) => op.kind)).toEqual([
      'istar.replaceModel',
      'createNode',
    ]);
    expect(dispatched.operationList[1]).toMatchObject({
      elementTypeId: 'kaos.Softgoal',
      args: { name: 'Fast recovery', customProperties: { Priority: 'high' } },
    });
    expect(dispatched.operationList[1]).not.toHaveProperty('containerId');
    await settled(wb().session);
    expect(named(wb(), 'User')).toEqual([]);
    expect(named(wb(), 'Fast recovery')).toHaveLength(1);

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(named(wb(), 'User')).toEqual([user]);
    expect(named(wb(), 'Fast recovery')).toEqual([]);
    expect(wb().text).toBe(before);
  });
});
