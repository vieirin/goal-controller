/**
 * The agent drawer in the model column (goal-controller#485): toggled from
 * the model tabs' bar (opening it starts the GLSP session), and an Auto run
 * through it: the prose shows while it streams, the edit call's card and
 * the diff of the model's JSON text after it. The chat client is a stand-in
 * (`createChatClient` mocked); `runAgent` is the library's own, over a
 * stand-in session whose one tool edits the real model session.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  ChatClient,
  ChatCompletion,
  ChatRequest,
  ToolResult,
} from '@istar-ts/agent';
import { ModelColumn } from '@/components/workbench/Workbench';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import * as glspSessionModule from '@/lib/workbench/agent/glspSession';
import type { GlspSession } from '@/lib/workbench/agent/glspSession';
import { mockReactFlowDom } from './reactFlowDom';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: one actor, G1 OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

/** the chat model's turns, each answered when the test says */
const turns: Array<{
  deltas: readonly string[];
  completion: ChatCompletion;
  gate?: Promise<void>;
}> = [];

vi.mock('@istar-ts/agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@istar-ts/agent')>();
  const client: ChatClient = {
    model: 'stand-in',
    baseUrl: 'http://stand-in',
    complete: async ({ onDelta }: ChatRequest) => {
      const turn = turns.shift();
      if (!turn) throw new Error('no turn left');
      const [first, ...rest] = turn.deltas;
      if (first) onDelta?.({ content: first });
      await turn.gate;
      for (const delta of rest) onDelta?.({ content: delta });
      return turn.completion;
    },
  };
  return { ...actual, createChatClient: () => client };
});

beforeAll(mockReactFlowDom);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  turns.length = 0;
});

/** a session whose one tool renames G1 in the live model */
const standInSession = (wb: () => Workbench): GlspSession => {
  const rename = async (): Promise<ToolResult> => {
    const result = await wb().session.dispatcher.dispatch({
      kind: 'applyLabelEdit',
      labelId: G1,
      text: 'G1: Renamed [+]',
    });
    return result.ok
      ? { ok: true, content: { renamed: G1 } }
      : { ok: false, diagnostics: result.diagnostics };
  };
  const registry = {
    list: () => [
      {
        name: 'rename',
        description: 'Renames G1.',
        parameters: { type: 'object' },
      },
    ],
    call: rename,
  };
  return {
    liveRegistry: registry,
    changeSet: {
      openScratch: async () => ({ registry }),
      apply: async () => ({ ok: true, content: null }),
      step: () => undefined,
      describeUndo: () => undefined,
    },
    close: () => undefined,
  };
};

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
      <ModelColumn />
    </WorkbenchProvider>,
  );
  const current = () => wb!;
  vi.spyOn(glspSessionModule, 'openGlspSession').mockImplementation(async () =>
    standInSession(current),
  );
  await act(() => current().openModelFile('simpleChoice.txt', ISTAR));
  await waitFor(() => expect(current().tree).not.toBeNull());
  return current;
};

describe('the agent drawer', () => {
  it('opens and closes from the model tabs, starting the GLSP session', async () => {
    const wb = await opened();
    expect(screen.queryByRole('complementary', { name: 'Agent' })).toBeNull();
    expect(wb().glspEnabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    const drawer = screen.getByRole('complementary', { name: 'Agent' });
    expect(drawer.textContent).toContain(
      'edits the open model through istar-ts',
    );
    expect(wb().glspEnabled).toBe(true);
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    // the model's own file, as an @-chip
    screen.getByRole('button', { name: '@ simpleChoice.txt' });

    fireEvent.click(screen.getByRole('button', { name: 'Hide the agent' }));
    expect(screen.queryByRole('complementary', { name: 'Agent' })).toBeNull();
  });

  it('streams the prose, then shows the edit and its diff', async () => {
    window.localStorage.setItem(
      'goal-workbench:agent:v1',
      JSON.stringify({ approval: 'auto' }),
    );
    const wb = await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    await waitFor(() => expect(wb().glspSession).not.toBeNull());

    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    turns.push(
      {
        deltas: [],
        completion: {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: { name: 'rename', arguments: '{}' },
              },
            ],
          },
          finishReason: 'tool_calls',
        },
      },
      {
        deltas: ['Renamed **G1**', ' as asked.'],
        gate,
        completion: {
          message: { role: 'assistant', content: 'Renamed **G1** as asked.' },
          finishReason: 'stop',
        },
      },
    );

    const box = screen.getByRole('textbox', { name: 'Message the agent' });
    fireEvent.change(box, { target: { value: 'Rename G1' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    // the first delta is in before the turn is over
    await waitFor(() => expect(screen.getByText('G1').tagName).toBe('STRONG'));
    expect(screen.queryByText(/as asked/)).toBeNull();
    const drawer = screen.getByRole('complementary', { name: 'Agent' });
    const call = within(drawer).getByRole('button', { expanded: false });
    expect(call.textContent).toContain('rename');
    expect(call.textContent).toContain('1 undo step');
    const diff = await screen.findByRole('figure', {
      name: 'Changes to simpleChoice.txt',
    });
    expect(diff.textContent).toContain('Renamed');

    await act(async () => open());
    await screen.findByText(/as asked/);
    expect(wb().text).toContain('Renamed');
  });
});
