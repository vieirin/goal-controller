/**
 * SourceView dispatches actions instead of `wb.setText` (goal-controller#411):
 * a settled text edit reaches the model, whole, through `dispatcherFor
 * ('inspector')` as one `istar.replaceModel`, and one `glspUndo` takes it
 * back, byte for byte. `CodeEditor` (CodeMirror) is stubbed with a plain
 * textarea: SourceView's own debounce-and-dispatch logic is what's under
 * test here, not CodeMirror's DOM.
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
import { withFileMetamodel } from '@istar-ts/core';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { parseModel } from '@/lib/workbench/dialects';
import { serializeModel, writeModelMode } from '@/lib/workbench/pistar';
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
const ANOTHER_MODEL = readFileSync(
  join(ROOT, 'examples/edge/anotherSimple.txt'),
  'utf8',
);
// a piStar-ext model (its mode recorded, so it is read with its file
// metamodel applied): examples/pistar-ext/minimal.txt isn't self-describing
const PISTAR_EXT = writeModelMode(
  readFileSync(join(ROOT, 'examples/pistar-ext/minimal.txt'), 'utf8'),
  'pistarext',
);

// simpleChoice.txt's ids
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';
const NEEDED_BY_LINK = '63f6cc85-fc79-46d4-b1a8-dfff1e08cc50';

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

const opened = async (text: string = ISTAR, name = 'simpleChoice.txt') => {
  const view = workbench();
  await act(() => view.wb().openFile(name, text, { setup: true }));
  await waitFor(() => expect(view.wb().text.trim().length).toBeGreaterThan(0));
  return view;
};

const element = (wb: Workbench, id: string) =>
  wb.session.store.getModel().elements.get(id);

/** `ISTAR`, parsed, mutated and re-stringified with the same indentation (no trailing newline, as the fixture has none). */
const edited = (mutate: (parsed: Record<string, unknown>) => void): string => {
  const parsed = JSON.parse(ISTAR);
  mutate(parsed);
  return JSON.stringify(parsed, null, 2);
};

type Node = {
  id: string;
  text?: string;
  customProperties?: Record<string, unknown>;
  x: number;
  y: number;
};

const nodes = (parsed: Record<string, unknown>): Node[] =>
  (parsed.actors as { nodes: Node[] }[])[0]!.nodes;

type Link = { id: string; type: string; source: string; target: string };

const links = (parsed: Record<string, unknown>): Link[] =>
  parsed.links as Link[];

/**
 * Edits the textarea to `after`, lets it settle (one `istar.replaceModel`
 * dispatch), asserts the result is `after` byte for byte, then takes it
 * back with one `glspUndo` and asserts that is `before` byte for byte.
 */
const roundTrip = async (
  wb: () => Workbench,
  container: HTMLElement,
  before: string,
  after: string,
) => {
  vi.useFakeTimers();
  const dispatch = vi.spyOn(wb().dispatcherFor('inspector'), 'dispatch');
  const setText = vi.spyOn(wb(), 'setText');
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

  fireEvent.change(textarea, { target: { value: after } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch.mock.calls[0]![0]).toMatchObject({
    kind: 'istar.replaceModel',
  });
  expect(setText).not.toHaveBeenCalled();
  expect(wb().text).toBe(after);

  await act(async () => {
    await wb().dispatcherFor('inspector').dispatch({ kind: 'glspUndo' });
  });
  expect(wb().text).toBe(before);
};

describe('SourceView dispatches actions (#411)', () => {
  it('a rename', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      nodes(p).find((n) => n.id === G1)!.text = 'G1: Renamed';
    });
    await roundTrip(wb, container, ISTAR, after);
  });

  it('a property change', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      nodes(p).find((n) => n.id === G1)!.customProperties!.Description =
        'changed';
    });
    await roundTrip(wb, container, ISTAR, after);
  });

  it('an added node', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      nodes(p).push({
        id: 'new-g4',
        text: 'G4: New',
        type: 'istar.Goal',
        x: 500,
        y: 500,
        customProperties: { Description: '' },
      } as Node & { type: string });
    });
    await roundTrip(wb, container, ISTAR, after);
  });

  it('a removed link', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      const list = links(p);
      list.splice(
        list.findIndex((l) => l.id === NEEDED_BY_LINK),
        1,
      );
    });
    await roundTrip(wb, container, ISTAR, after);
  });

  it('a moved node', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      const g2 = nodes(p).find((n) => n.id === G2)!;
      g2.x += 40;
      g2.y += 10;
    });
    await roundTrip(wb, container, ISTAR, after);
  });

  it('a change to the metamodel block', async () => {
    const { wb, container } = await opened(PISTAR_EXT, 'minimal.txt');
    const before = wb().text;
    const after = serializeModel(
      withFileMetamodel(parseModel(before), {
        name: 'iStar4RationalAgents',
        elements: [],
      }),
      before,
    );
    await roundTrip(wb, container, before, after);
  });

  it('a paste of a whole different model', async () => {
    const { wb, container } = await opened();
    await roundTrip(wb, container, ISTAR, ANOTHER_MODEL);
  });

  it('a reordered paste', async () => {
    const { wb, container } = await opened();
    const after = edited((p) => {
      links(p).reverse();
    });
    await roundTrip(wb, container, ISTAR, after);
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

  it('unparseable text falls back to setText, kept as typed', async () => {
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
