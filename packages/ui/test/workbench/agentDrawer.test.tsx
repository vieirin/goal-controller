/**
 * The agent drawer in the model column (goal-controller#485): toggled from
 * the model tabs' bar (opening it starts the GLSP session), and an Auto run
 * through it: the prose shows while it streams, the edit call's card and
 * the diff of the model's JSON text after it. The chat client is a stand-in
 * (`createChatClient` mocked); `runAgent` is the library's own, over a
 * stand-in session whose one tool edits the real model session. A Propose
 * run's change set still pending is never applied once it is superseded: by
 * a new request, a model-worker restart, or another model opened.
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
  ChatMessage,
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
import { restartModelWorker } from '@/lib/workbench/modelWorkerClient';
import type { GlspSession } from '@/lib/workbench/agent/glspSession';
import { settled } from './modelWorker';
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
/** what each request sent, in order */
const requests: Array<readonly ChatMessage[]> = [];

vi.mock('@istar-ts/agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@istar-ts/agent')>();
  const client: ChatClient = {
    model: 'stand-in',
    baseUrl: 'http://stand-in',
    complete: async ({ messages, onDelta }: ChatRequest) => {
      requests.push([...messages]);
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
  requests.length = 0;
  applied.mockClear();
});

const renameCall: ChatCompletion = {
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
};

const finalAnswer = (content: string): ChatCompletion => ({
  message: { role: 'assistant', content },
  finishReason: 'stop',
});

const ask = (text: string) => {
  const box = screen.getByRole('textbox', { name: 'Message the agent' });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
};

/** what Propose mode's change sets were applied with */
const applied = vi.fn(async () => ({ ok: true as const, content: null }));

/**
 * a session whose one tool renames G1 in the live model; Propose mode's
 * scratch session only says it did
 */
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
  const scratch = {
    list: registry.list,
    call: async (): Promise<ToolResult> => ({
      ok: true,
      content: { renamed: G1 },
    }),
  };
  return {
    liveRegistry: registry,
    changeSet: {
      openScratch: async () => ({ registry: scratch }),
      apply: applied,
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

  it("marks the run's edits on the model (wb.agentChanges)", async () => {
    window.localStorage.setItem(
      'goal-workbench:agent:v1',
      JSON.stringify({ approval: 'auto' }),
    );
    const wb = await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    expect(wb().agentChanges.edited.size).toBe(0);
    turns.push(
      { deltas: [], completion: renameCall },
      { deltas: [], completion: finalAnswer('Renamed G1.') },
    );
    ask('Rename G1');
    await screen.findByText('Renamed G1.');
    await waitFor(() => expect(wb().agentChanges.edited.has(G1)).toBe(true));
    expect(wb().agentChanges.added.size).toBe(0);
    expect(wb().agentChanges.removed.size).toBe(0);

    // the drawer clears the marks, as the Notation view's legend does
    screen.getByText('1 change by the agent marked on the model');
    fireEvent.click(screen.getByRole('button', { name: 'Clear marks' }));
    expect(wb().agentChanges.edited.size).toBe(0);
    expect(screen.queryByRole('button', { name: 'Clear marks' })).toBeNull();
  });

  describe('a pending proposal is never applied once superseded', () => {
    /** a Propose run (the default) that leaves its rename for review */
    const proposed = async () => {
      const wb = await opened();
      fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
      await waitFor(() => expect(wb().glspSession).not.toBeNull());
      turns.push(
        { deltas: [], completion: renameCall },
        { deltas: [], completion: finalAnswer('Proposed a rename.') },
      );
      ask('Rename G1');
      const card = await screen.findByRole('region', {
        name: 'Proposed changes',
      });
      within(card).getByRole('button', { name: 'Approve' });
      return { wb, card };
    };

    const notApplied = async (card: HTMLElement) => {
      await waitFor(() => expect(card.textContent).toContain('Not applied'));
      expect(
        within(card).queryByRole('button', { name: 'Approve' }),
      ).toBeNull();
      expect(applied).not.toHaveBeenCalled();
    };

    it('by a new request', async () => {
      const { card } = await proposed();
      turns.push({ deltas: [], completion: finalAnswer('Nothing to do.') });
      ask('Never mind');
      await notApplied(card);
      await screen.findByText('Nothing to do.');
    });

    it('by a model-worker restart', async () => {
      const { wb, card } = await proposed();
      const incident = wb().modelWorkerIncident;
      // off the canvas: its editor's mount-time requests on the crashed
      // session reject unhandled (goal-controller#492)
      act(() => wb().setModelTab('source'));
      await settled(wb().session);
      act(() => restartModelWorker());
      await waitFor(() =>
        expect(wb().modelWorkerIncident).toBeGreaterThan(incident),
      );
      await notApplied(card);
      screen.getByText('The editor restarted; the proposal was discarded.');
    });

    it('by another model opened: a new conversation', async () => {
      const { wb, card } = await proposed();
      const session = wb().session.id;
      await act(() => wb().openModelFile('other.txt', ISTAR));
      await waitFor(() => expect(wb().session.id).not.toBe(session));
      await waitFor(() => expect(card.isConnected).toBe(false));
      const transcript = screen.getByRole('log', { name: 'Transcript' });
      expect(within(transcript).queryAllByRole('listitem')).toHaveLength(0);
      expect(applied).not.toHaveBeenCalled();
    });
  });

  it('sends the conversation so far with each request', async () => {
    const wb = await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    const said = () =>
      requests
        .at(-1)
        ?.flatMap((message) =>
          message.role === 'system'
            ? []
            : [`${message.role}: ${message.content}`],
        );

    turns.push({ deltas: [], completion: finalAnswer('G1 is a goal.') });
    ask('What is G1?');
    await screen.findByText('G1 is a goal.');
    expect(said()).toEqual(['user: What is G1?']);

    turns.push({ deltas: [], completion: finalAnswer('It has two children.') });
    ask('And its children?');
    await screen.findByText('It has two children.');
    expect(said()).toEqual([
      'user: What is G1?',
      'assistant: G1 is a goal.',
      'user: And its children?',
    ]);

    // another model: a new conversation, nothing of the old one sent
    const session = wb().session.id;
    await act(() => wb().openModelFile('other.txt', ISTAR));
    await waitFor(() => expect(wb().session.id).not.toBe(session));
    turns.push({ deltas: [], completion: finalAnswer('Hello.') });
    ask('Hi');
    await screen.findByText('Hello.');
    expect(said()).toEqual(['user: Hi']);
  });

  it("counts the conversation's context, tokens and cost", async () => {
    window.localStorage.setItem(
      'goal-workbench:agent:v1',
      JSON.stringify({ prices: { input: 1, cachedInput: null, output: 2 } }),
    );
    const wb = await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    expect(screen.queryByLabelText('Usage')).toBeNull();
    const used = (prompt: number, completion: number): ChatCompletion => ({
      ...finalAnswer(`Used ${prompt}.`),
      usage: {
        prompt_tokens: prompt,
        completion_tokens: completion,
        total_tokens: prompt + completion,
      },
    });

    turns.push({ deltas: [], completion: used(1000, 200) });
    ask('One');
    await screen.findByText('Used 1000.');
    turns.push({ deltas: [], completion: used(1400, 300) });
    ask('Two');
    await screen.findByText('Used 1400.');
    // context: the last call's; total: both; cost: 2.4k in at $1/M, 500 out at $2/M
    expect(screen.getByLabelText('Usage').textContent).toBe(
      'context 1.7ktotal 2.9k$0.0034',
    );

    const session = wb().session.id;
    await act(() => wb().openModelFile('other.txt', ISTAR));
    await waitFor(() => expect(wb().session.id).not.toBe(session));
    await waitFor(() => expect(screen.queryByLabelText('Usage')).toBeNull());
  });

  it('follows new entries only while scrolled to the end', async () => {
    const wb = await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Show the agent' }));
    await waitFor(() => expect(wb().glspSession).not.toBeNull());
    // jsdom lays nothing out: the transcript's heights are the test's
    const transcript = screen.getByRole('log', { name: 'Transcript' });
    let height = 500;
    Object.defineProperty(transcript, 'scrollHeight', { get: () => height });
    Object.defineProperty(transcript, 'clientHeight', { get: () => 100 });
    const scrollTo = (top: number) => {
      transcript.scrollTop = top;
      fireEvent.scroll(transcript);
    };

    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    turns.push({
      deltas: ['First part', ', second part.'],
      gate,
      completion: finalAnswer('First part, second part.'),
    });
    ask('Explain G1');
    await screen.findByText('First part');
    expect(transcript.scrollTop).toBe(500);

    // scrolled up to read: the rest of the answer doesn't pull it down
    height = 800;
    scrollTo(0);
    await act(async () => open());
    await screen.findByText('First part, second part.');
    expect(transcript.scrollTop).toBe(0);

    // a new request follows again
    turns.push({ deltas: [], completion: finalAnswer('Done.') });
    height = 900;
    ask('Thanks');
    await screen.findByText('Done.');
    expect(transcript.scrollTop).toBe(900);
  });
});
