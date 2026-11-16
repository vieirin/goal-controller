/**
 * A line that creates its element without an id (goal-controller#518) gets
 * the id its element shows written on it, in the editor: typing on the line
 * then renames the element rather than creating another. CodeMirror itself
 * (not a stand-in), since the id is written into its document.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import FrameworkNotationView from '@/components/workbench/engines/framework/FrameworkNotationView';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { settled } from './modelWorker';

const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);

beforeAll(() => {
  // what CodeMirror measures text with
  Object.assign(Range.prototype, {
    getClientRects: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
});

afterEach(() => cleanup());

/** The notation editor's debounce (EDIT_DELAY_MS in NotationEditor.tsx). */
const afterDebounce = () => act(() => new Promise((r) => setTimeout(r, 350)));

const named = (wb: Workbench, name: string) =>
  [...wb.session.store.getModel().elements.values()].filter(
    (e) => e.name === name,
  );

describe('the id a created element shows, written on its line (#518)', () => {
  it('writes the short id on the line, so typing on renames the element', async () => {
    let wb: Workbench | null = null;
    const Probe = () => {
      const current = useWorkbench();
      useEffect(() => {
        wb = current;
      });
      return null;
    };
    const { container } = render(
      <WorkbenchProvider lockedEngine={null}>
        <Probe />
        <FrameworkNotationView mode='kaos' />
      </WorkbenchProvider>,
    );
    await act(() => wb!.openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    const view = await waitFor(() => {
      const editor = container.querySelector<HTMLElement>('.cm-editor');
      const found = editor && EditorView.findFromDOM(editor);
      expect(found?.state.doc.toString()).toContain(': User');
      return found!;
    });
    const type = (from: number, insert: string) =>
      act(() => {
        view.dispatch({ changes: { from, insert }, userEvent: 'input.type' });
      });
    const dispatch = vi.spyOn(wb!.dispatcherFor('inspector'), 'dispatch');

    await type(view.state.doc.length, '\nsoftgoal Fast recovery');
    await afterDebounce();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ kind: 'createNode' });
    await settled(wb!.session);
    const [created] = named(wb!, 'Fast recovery');
    expect(created).toBeDefined();
    const line = `softgoal ${created!.id.slice(0, 8)}: Fast recovery`;
    await waitFor(() =>
      expect(view.state.doc.toString().split('\n').at(-1)).toBe(line),
    );

    // typing on: the same element, renamed
    await type(view.state.doc.length, ' plan');
    await afterDebounce();
    await settled(wb!.session);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1]![0]).toMatchObject({
      kind: 'applyLabelEdit',
      labelId: created!.id,
    });
    expect(named(wb!, 'Fast recovery plan').map((e) => e.id)).toEqual([
      created!.id,
    ]);
    expect(view.state.doc.toString().split('\n').at(-1)).toBe(`${line} plan`);
  });
});
