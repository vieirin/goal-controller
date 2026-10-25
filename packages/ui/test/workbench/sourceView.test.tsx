/**
 * SourceView dispatches actions instead of `wb.setText` (goal-controller#411):
 * a settled text edit reaches the model through `dispatcherFor('inspector')`,
 * and one `glspUndo` takes it back, byte for byte. `CodeEditor` (CodeMirror)
 * is stubbed with a plain textarea: SourceView's own debounce-and-dispatch
 * logic is what's under test here, not CodeMirror's DOM.
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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import SourceView from '@/components/workbench/SourceView';

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
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const ROOT = join(__dirname, '../../../..');
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

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
      <SourceView />
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

const element = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id);

describe('SourceView dispatches actions (#411)', () => {
  it('a settled rename reaches the model as applyLabelEdit, not setText; one glspUndo takes it back', async () => {
    const { wb, container } = await opened();
    vi.useFakeTimers();
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const setText = vi.spyOn(wb(), 'setText');
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    fireEvent.change(textarea, {
      target: { value: before.replace('G1: Goal [+]', 'G1: Renamed') },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      kind: 'applyLabelEdit',
      labelId: G1,
    });
    expect(setText).not.toHaveBeenCalled();
    expect(element(wb(), G1)?.name).toBe('G1: Renamed');
    expect(wb().text).toBe(before.replace('G1: Goal [+]', 'G1: Renamed'));

    await act(async () => {
      await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
    });
    expect(element(wb(), G1)?.name).toBe('G1: Goal [+]');
    expect(wb().text).toBe(before);
    expect(wb().canUndo).toBe(false);
  });

  it('does not dispatch per keystroke: only the settled text is diffed', async () => {
    const { wb, container } = await opened();
    vi.useFakeTimers();
    const before = wb().text;
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    fireEvent.change(textarea, {
      target: { value: before.replace('G1: Goal [+]', 'G1: R') },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent.change(textarea, {
      target: { value: before.replace('G1: Goal [+]', 'G1: Renamed') },
    });
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(element(wb(), G1)?.name).toBe('G1: Renamed');
  });

  it('text the diff cannot express falls back to setText, kept as typed', async () => {
    const { wb, container } = await opened();
    vi.useFakeTimers();
    const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    const broken = '{ "actors": [';
    fireEvent.change(textarea, { target: { value: broken } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(wb().text).toBe(broken);
    expect(wb().jsonError).not.toBeNull();
  });
});
