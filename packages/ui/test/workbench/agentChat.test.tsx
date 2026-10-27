/**
 * The agent drawer's transcript blocks and composer (goal-controller#485),
 * each on its own: the prose as markdown (raw HTML dropped), a tool call's
 * status chip read off its result, the diff of two model snapshots, an
 * upload the provider doesn't take, and an @-chip attaching a project file.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue, TranscriptToolCall } from '@istar-ts/agent';
import { AssistantProse } from '@/components/workbench/agent/AssistantProse';
import { Composer } from '@/components/workbench/agent/Composer';
import { DiffCard } from '@/components/workbench/agent/DiffCard';
import { ToolCallCard } from '@/components/workbench/agent/ToolCallCard';
import {
  flatTable,
  introducedProblems,
  problemKey,
  revisionPrompt,
  toolCallChip,
} from '@/lib/workbench/agent/chatTranscript';
import { projectFilesOf } from '@/lib/workbench/agent/projectFiles';
import { PROVIDERS } from '@/lib/workbench/agent/providers';
import {
  addUsage,
  formatTokens,
  NO_USAGE,
  pricesOf,
} from '@/lib/workbench/agent/usage';

afterEach(cleanup);

const call = (
  overrides: Pick<TranscriptToolCall, 'disposition' | 'result'> &
    Partial<TranscriptToolCall>,
): TranscriptToolCall => ({
  id: 'call-1',
  name: 'set-properties',
  arguments: '{}',
  args: { id: 'G1', properties: { cost: '2' } },
  latencyMs: 1,
  ...overrides,
});

describe('the prose', () => {
  it('renders markdown, links in a new tab, and drops raw HTML', () => {
    const { container } = render(
      <AssistantProse
        text={
          'Add **R6** to `T2`, see [the guide](https://example.org).\n\n<script>alert(1)</script><b>raw</b>\n\n| a | b |\n|---|---|\n| 1 | 2 |'
        }
      />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('R6');
    expect(container.querySelector('code')?.textContent).toBe('T2');
    const link = screen.getByRole('link', { name: 'the guide' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).not.toContain('alert');
    expect(container.textContent).not.toContain('raw');
  });
});

describe("a tool call's status chip", () => {
  it('reads a read, a refusal, an applied edit and a validator result', () => {
    expect(
      toolCallChip({ disposition: 'read', result: { ok: true, content: [] } }),
    ).toEqual({ label: 'read', tone: 'ok' });
    expect(
      toolCallChip({
        disposition: 'applied',
        result: {
          ok: false,
          diagnostics: [
            {
              elementId: 'R6',
              code: 'invalid-target',
              message: 'no',
              severity: 'error',
            },
          ],
        },
      }),
    ).toEqual({ label: 'rejected', tone: 'danger' });
    expect(
      toolCallChip({
        disposition: 'applied',
        result: { ok: true, content: { ok: true } },
      }),
    ).toEqual({ label: '1 undo step', tone: 'ok' });
    expect(
      toolCallChip({
        disposition: 'read',
        result: { ok: true, content: { diagnostics: [] } },
      }),
    ).toEqual({ label: '0 issues', tone: 'ok' });
    expect(
      toolCallChip({
        disposition: 'read',
        result: { ok: true, content: { diagnostics: [{ message: 'x' }] } },
      }).label,
    ).toBe('1 issue');
  });

  it('shows the chip, and the result once opened', () => {
    render(
      <ToolCallCard
        call={call({
          disposition: 'applied',
          result: {
            ok: false,
            diagnostics: [
              {
                elementId: 'R6',
                code: 'invalid-target',
                message: 'the target must be a Task',
                severity: 'error',
              },
            ],
          },
        })}
      />,
    );
    const header = screen.getByRole('button', { expanded: false });
    expect(header.textContent).toContain('set-properties');
    expect(header.textContent).toContain('id: "G1"');
    expect(header.textContent).toContain('rejected');
    expect(screen.queryByText(/the target must be a Task/)).toBeNull();
    fireEvent.click(header);
    expect(screen.getByText(/the target must be a Task/)).toBeTruthy();
  });

  it('shows a list of flat objects as a table', () => {
    const content: JsonValue = [
      { id: 'G1', kind: 'goal' },
      { id: 'T1', kind: 'task', cost: 2 },
    ];
    expect(flatTable(content)?.columns).toEqual(['id', 'kind', 'cost']);
    expect(flatTable([{ id: 'G1', nested: { a: 1 } }])).toBeUndefined();
    render(
      <ToolCallCard
        call={call({ disposition: 'read', result: { ok: true, content } })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(
      screen.getAllByRole('columnheader').map((th) => th.textContent),
    ).toEqual(['id', 'kind', 'cost']);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});

describe('the diff card', () => {
  it('diffs two model snapshots, with its +/- counts', () => {
    const before = JSON.stringify(
      { actors: [{ id: 'A', nodes: [{ id: 'T2', assertion: 'R3<=3' }] }] },
      null,
      2,
    );
    const after = JSON.stringify(
      {
        actors: [
          { id: 'A', nodes: [{ id: 'T2', assertion: 'R3<=3 & R6>=20' }] },
        ],
      },
      null,
      2,
    );
    const { container } = render(
      <DiffCard fileName='deltaIoT.txt' before={before} after={after} />,
    );
    const figure = screen.getByRole('figure', {
      name: 'Changes to deltaIoT.txt',
    });
    expect(figure.textContent).toContain('+1');
    expect(figure.textContent).toContain('−1');
    expect(figure.textContent).toContain('Accepted');
    const text = (kind: string) =>
      [...container.querySelectorAll(`[data-kind=${kind}]`)].map((row) =>
        row.textContent?.replace(/\s+/g, ' '),
      );
    expect(text('remove')).toEqual(['- "assertion": "R3<=3"']);
    expect(text('add')).toEqual(['+ "assertion": "R3<=3 & R6>=20"']);
    expect(text('hunk')).toHaveLength(1);
  });
});

describe('the composer', () => {
  const provider = PROVIDERS.deepseek;

  it("refuses an upload the provider doesn't take, naming the ones it does", async () => {
    const onSend = vi.fn();
    render(
      <Composer
        provider={provider}
        projectFiles={[]}
        running={false}
        disabled={false}
        onSend={onSend}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('agent-upload');
    expect(input.accept).toContain('.props');
    expect(input.accept).toContain('.md');
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' })],
        },
      });
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('paper.pdf');
    expect(alert.textContent).toContain('.md');
    expect(alert.textContent).toContain('.props');
    expect(screen.queryByLabelText('Attached files')).toBeNull();

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['# notes'], 'notes.md')] },
      });
    });
    await screen.findByRole('button', { name: 'Remove notes.md' });
  });

  it('attaches a project file by its @-chip and sends it with the request', () => {
    const onSend = vi.fn();
    render(
      <Composer
        provider={provider}
        projectFiles={[
          { path: 'deltaIoT.txt', name: 'deltaIoT.txt', text: '{"actors":[]}' },
          { path: 'deltaIoT.props', name: 'deltaIoT.props', text: 'P=? [F x]' },
          { path: 'figures/plot.png', name: 'plot.png', text: 'PNG' },
        ]}
        running={false}
        disabled={false}
        onSend={onSend}
      />,
    );
    // a type the provider doesn't take: there, but not attachable
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: '@ plot.png',
      }).disabled,
    ).toBe(true);
    const chip = screen.getByRole('button', { name: '@ deltaIoT.props' });
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    screen.getByRole('button', { name: 'Remove deltaIoT.props' });

    const send = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Send',
    });
    expect(send.disabled).toBe(true);
    const box = screen.getByRole('textbox', { name: 'Message the agent' });
    fireEvent.change(box, { target: { value: 'Check the properties' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Check the properties', [
      { name: 'deltaIoT.props', mime: 'text/plain', text: 'P=? [F x]' },
    ]);
    expect(screen.queryByLabelText('Attached files')).toBeNull();
  });
});

describe("the composer's project files", () => {
  it("offer the engine's latest output, as generated, next to the project's files", () => {
    const files = projectFilesOf({
      model: { path: 'deltaIoT.txt', fileName: 'deltaIoT.txt', text: '{}' },
      resourceSlots: [{ paths: ['variables.json'] }],
      nativeSlots: [
        { path: 'deltaIoT.props', missing: false },
        { path: 'deltaIoT.kaos', missing: true },
      ],
      outputs: [
        { fileName: 'deltaIoT.prism', text: 'mdp // fresh' },
        { fileName: '../escape.prism', text: 'outside out/' },
      ],
      openedFiles: ['out/deltaIoT.prism', 'notes.md'],
      texts: {
        'variables.json': '{"x":1}',
        'deltaIoT.props': 'P=? [F x]',
        'out/deltaIoT.prism': 'mdp // saved',
      },
    });
    expect(files.map(({ path }) => path)).toEqual([
      'deltaIoT.txt',
      'variables.json',
      'deltaIoT.props',
      'out/deltaIoT.prism',
      'notes.md',
    ]);
    expect(files.find(({ name }) => name === 'deltaIoT.prism')?.text).toBe(
      'mdp // fresh',
    );
    // a file open in a tab whose text hasn't been read yet
    expect(files.at(-1)?.text).toBeUndefined();
  });

  it('can attach an output by its @-chip', () => {
    const onSend = vi.fn();
    render(
      <Composer
        provider={PROVIDERS.deepseek}
        projectFiles={[
          { path: 'out/deltaIoT.prism', name: 'deltaIoT.prism', text: 'mdp' },
        ]}
        running={false}
        disabled={false}
        onSend={onSend}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '@ deltaIoT.prism' }));
    const box = screen.getByRole('textbox', { name: 'Message the agent' });
    fireEvent.change(box, { target: { value: 'Why does G8 deadlock?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Why does G8 deadlock?', [
      { name: 'deltaIoT.prism', mime: 'text/plain', text: 'mdp' },
    ]);
  });
});

describe("a conversation's usage", () => {
  const step = (prompt: number, completion: number, hits = 0) => ({
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
    prompt_cache_hit_tokens: hits,
  });

  it('adds each call: the context is the last one, the cost only with prices', () => {
    const once = addUsage(NO_USAGE, step(1000, 100), null);
    expect(once).toEqual({
      contextTokens: 1100,
      totalTokens: 1100,
      cost: null,
    });
    expect(pricesOf({ input: 1, cachedInput: null, output: null })).toBeNull();
    expect(pricesOf({ input: 1, cachedInput: null, output: 2 })).toEqual({
      input: 1,
      output: 2,
    });
  });

  it('formats token counts', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(2000)).toBe('2k');
    expect(formatTokens(1_250_000)).toBe('1.25M');
  });
});

describe('the problems an edit introduced', () => {
  const problem = (elementId: string, message: string) =>
    ({ elementId, message, severity: 'error' }) as const;

  it('are the new ones on what it touched, by id or RT id, positions aside', () => {
    const before = [problem('G1', 'Not valid: 1:10 `+` is not an operator')];
    const now = [
      // the same problem, moved by a rename
      problem('G1', 'Not valid: 1:13 `+` is not an operator'),
      problem('G9', 'G9 has no children or tasks; every goal must be refined'),
      // on an element the edit didn't touch
      problem('G3', 'G3 has no children or tasks; every goal must be refined'),
    ];
    const introduced = introducedProblems(
      now,
      new Set(['uuid-of-g1', 'uuid-of-g9']),
      new Set(before.map(problemKey)),
      (id) => ({ 'uuid-of-g1': 'G1', 'uuid-of-g9': 'G9' })[id],
    );
    expect(introduced.map(({ elementId }) => elementId)).toEqual(['G9']);
  });

  it('go back to the agent, saying nothing was applied', () => {
    const prompt = revisionPrompt([
      problem('G9', 'G9 has no children or tasks; every goal must be refined'),
    ]);
    expect(prompt).toContain('was not applied');
    expect(prompt).toContain(
      '- error: G9 has no children or tasks; every goal must be refined',
    );
  });
});
