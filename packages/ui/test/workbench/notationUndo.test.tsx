/**
 * Each kind of edit typed in the Notation view (goal-controller#518) is one
 * undo step: one `glspUndo` restores exactly the model before it (its piStar
 * text, byte for byte), one `glspRedo` the model after it. A relabel, a
 * rename, a property set and unset, two ids swapped, an element created
 * and removed, an orphan repaired by its element's line written again.
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
import FrameworkNotationView from '@/components/workbench/engines/framework/FrameworkNotationView';
import { settled } from './modelWorker';

// a plain textarea stands in for CodeMirror (as in notationActions.test.tsx)
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

const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);

afterEach(() => cleanup());

const opened = async () => {
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
      <FrameworkNotationView mode='kaos' />
    </WorkbenchProvider>,
  );
  await act(() => wb!.openModelFile('kaos-welcome.txt', KAOS_WELCOME));
  await waitFor(() => expect(wb!.tree).not.toBeNull());
  await waitFor(() => expect(textarea().value).toContain(': User'));
  return () => wb!;
};

const textarea = () =>
  document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label^="Goal model notation"]',
  )!;

/** Types `edit(text)` over the editor's text, and waits for the model to have it. */
const typed = async (wb: () => Workbench, edit: (text: string) => string) => {
  const value = edit(textarea().value);
  fireEvent.change(textarea(), { target: { value } });
  await act(() => new Promise((r) => setTimeout(r, 350)));
  await settled(wb().session);
};

const step = (wb: () => Workbench, kind: 'glspUndo' | 'glspRedo') =>
  act(async () => {
    await wb().dispatcherFor('inspector').dispatch({ kind });
  });

const lines = (text: string) => text.split('\n');
const withoutLine = (pattern: RegExp) => (text: string) =>
  lines(text)
    .filter((line) => !pattern.test(line))
    .join('\n');

const EDITS: [string, (text: string) => string][] = [
  [
    'a relabel',
    (t) => t.replace('5d2a606c: Save Bandwidth', '5d2a606c: Save Data'),
  ],
  ['a rename', (t) => t.replace('softgoal 5d2a606c:', 'softgoal save_bw:')],
  [
    'a property set',
    (t) =>
      t.replace(
        /(softgoal 5d2a606c: Save Bandwidth\n(?:.*\n)*?) {2}Priority\n/,
        '$1  Priority high\n',
      ),
  ],
  [
    'a property unset',
    (t) =>
      t.replace(
        /(softgoal 5d2a606c: Save Bandwidth)\n {2}Type softgoal\n/,
        '$1\n',
      ),
  ],
  [
    'two ids swapped',
    (t) =>
      t
        .replace('8c2734b4:', '\0:')
        .replace('1938d85d:', '8c2734b4:')
        .replace('\0:', '1938d85d:'),
  ],
  ['an element created', (t) => `${t}\nbehavioral_goal Fresh\n  Priority low`],
  [
    'an element removed, its links kept as orphans',
    withoutLine(/^\s*domain_property b7293d46: /),
  ],
  [
    'a line added and an id changed in one edit (N3)',
    (t) =>
      t.replace(
        'softgoal 7857cb00: Reliability',
        'softgoal chg_1: Reliability\nbehavioral_goal NewOne',
      ),
  ],
];

describe('an edit typed in the Notation view is one undo step (#518)', () => {
  for (const [name, edit] of EDITS)
    it(`${name}: undone, the model before it; redone, the model after it`, async () => {
      const wb = await opened();
      const before = wb().text;
      await typed(wb, edit);
      const after = wb().text;
      expect(after).not.toBe(before);
      await step(wb, 'glspUndo');
      expect(wb().text).toBe(before);
      await step(wb, 'glspRedo');
      expect(wb().text).toBe(after);
    });

  it('an orphan repaired by its line written again (its author’s id, N2): each step undone and redone', async () => {
    const wb = await opened();
    const states = [wb().text];
    // the editor keeps what is typed (the stand-in textarea shows the text
    // last written from the model: what is typed is kept here)
    const original = textarea().value;
    const line = lines(original).find((l) =>
      /^\s*domain_property b7293d46: /.test(l),
    )!;
    const renamed = line.replace('b7293d46:', 'net_up:');
    const rounds = [
      original.replace(line, renamed),
      lines(original.replace(line, renamed))
        .filter((l) => l !== renamed)
        .join('\n'),
      original.replace(line, renamed),
    ];
    for (const text of rounds) {
      await typed(wb, () => text);
      states.push(wb().text);
      if (text === rounds[1]) expect(wb().tree!.orphans).toHaveLength(2);
    }
    expect(new Set(states).size).toBe(4);
    expect(wb().tree!.orphans).toEqual([]);
    expect(
      [...wb().session.store.getModel().elements.values()].filter((e) =>
        e.id.startsWith('b7293d46'),
      ),
    ).toHaveLength(1);
    for (const state of [...states].reverse().slice(1)) {
      await step(wb, 'glspUndo');
      expect(wb().text).toBe(state);
    }
    for (const state of states.slice(1)) {
      await step(wb, 'glspRedo');
      expect(wb().text).toBe(state);
    }
  });

  it('a new element and its Description typed under an element’s line, then that element’s own Description changed (N1)', async () => {
    const wb = await opened();
    const model = () => wb().session.store.getModel();
    const original = lines(textarea().value);
    expect(original[0]).toBe('softgoal 7857cb00: Reliability');
    expect(original[9]).toBe('  Description');
    const first = [
      original[0]!,
      'behavioral_goal X',
      '  Description newdesc',
      ...original.slice(1),
    ];
    await typed(wb, () => first.join('\n'));
    const reliability = model().elements.get(
      [...model().elements.keys()].find((id) => id.startsWith('7857cb00'))!,
    )!;
    const [x] = [...model().elements.values()].filter((e) => e.name === 'X');
    expect(x!.customProperties).toMatchObject({ Description: 'newdesc' });
    expect(reliability.customProperties?.Description ?? '').toBe('');
    // the text as typed: Reliability's Description line is under X's lines
    expect(first[11]).toBe('  Description');
    const second = first.map((l, i) =>
      i === 11 ? '  Description reliable' : l,
    );
    await typed(wb, () => second.join('\n'));
    expect(
      model().elements.get(reliability.id)!.customProperties,
    ).toMatchObject({ Description: 'reliable' });
    expect(model().elements.get(x!.id)!.customProperties).toMatchObject({
      Description: 'newdesc',
    });
  });
});
