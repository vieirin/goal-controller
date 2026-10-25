/**
 * The Notation view, pool documents and the framework "give every element
 * an id" action dispatch actions on the workbench's dispatcher
 * (goal-controller#411), the same single undo history as the canvas and
 * the inspector (#410): one dispatched action per edit, undone by one
 * `glspUndo`.
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

  it('typing an edit that is rejected does not swallow a later, real change', async () => {
    const { wb } = await opened(<NotationView engine='edgev2' />);
    const textarea = await waitFor(() => {
      const found = notationTextarea();
      expect(found.value).toContain('G1: Goal [+]');
      return found;
    });
    // an unknown id: notationEdits reads no edit from it, so nothing is dispatched;
    // the next, real edit must still refresh the editor from the canonical text
    fireEvent.change(textarea, { target: { value: 'ZZ: Nothing\n' } });
    await afterDebounce();
    fireEvent.change(textarea, {
      target: {
        value: textarea.value.replace('G1: Goal [+]', 'G1: Second [+]'),
      },
    });
    await afterDebounce();
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
    expect(element(wb(), G1)?.customProperties?.Description).toBe('from pool');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().text).toBe(before);
  });
});

describe('a framework model’s missing ids are given as one compound (#411)', () => {
  it('gives every missing id as one compound action, undone by one glspUndo', async () => {
    // its own open, not `opened()`'s simpleChoice.txt: a KAOS file opened
    // over an iStar one asks to switch frameworks first (goal-controller#171)
    const { wb } = workbench(<FrameworkNotationView mode='kaos' />);
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().tree).not.toBeNull());
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const button = await waitFor(() => {
      const found = document.querySelector('button');
      expect(found).not.toBeNull();
      return found!;
    });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const dispatched = dispatch.mock.calls[0]![0] as {
      kind: string;
      operationList: { kind: string }[];
    };
    expect(dispatched.kind).toBe('compound');
    expect(dispatched.operationList.length).toBeGreaterThan(1);
    expect(
      dispatched.operationList.every((op) => op.kind === 'applyLabelEdit'),
    ).toBe(true);
    expect(wb().text).toContain('G1: Reliability');
    expect(wb().text).toContain('A1: User');

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(wb().text).toBe(before);
  });
});
