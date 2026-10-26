'use client';

/**
 * The agent drawer (goal-controller#415), modelled on istar-ts's playground
 * drawer (`@istar-ts/agent`'s README usage). Both modes run over backend A's
 * session (`wb.glspSession`, istar-ts#239, goal-controller#450), served in
 * the model worker and connected here (`connectGlspMcpSession`): Auto mode calls `liveRegistry` directly (one call,
 * one undo step); Propose mode dry-runs on `changeSet`'s scratch session (a
 * fresh one per run) and shows each proposed step in words (or why it was
 * refused, possibly already at preview: a batch breaking the mode's own
 * post-guard is refused on the scratch session itself), applying the
 * approved ones as one undo step. The system prompt gets goal-controller's
 * context providers, the same ones `wb.glspSession` serves as MCP resources.
 * The endpoint, model and API key are typed into the drawer's own settings
 * and kept in `localStorage` only (`agentSettings.ts`): never in the project
 * file, never sent anywhere but the configured endpoint.
 */
import { useMemo, useRef, useState } from 'react';
import { Loader2, Send, Settings2 } from 'lucide-react';
import type { AgentEvent, ChangeSetEntry, ChatClient } from '@istar-ts/agent';
import type { GlspChangeSet } from '@istar-ts/agent/glsp';
import { contextProvidersFor } from '@/lib/workbench/agent/context';
import {
  loadAgentSettings,
  saveAgentSettings,
  type AgentSettings,
} from '@/lib/workbench/agent/agentSettings';
import { useWorkbench } from './WorkbenchContext';
import { Button, Segmented, cx } from './ui';

/** A Propose run's change set, for the user to approve or reject. */
type Pending = {
  changeSet: GlspChangeSet;
  entries: readonly ChangeSetEntry[];
};

type TranscriptLine =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; args: unknown; ok: boolean }
  | { kind: 'error'; text: string };

/**
 * What a proposed entry does, in words: its step's lines, or why it was
 * refused. The entry is a copy of what the worker's scratch call answered:
 * an `undo`/`redo` carries its own `undoDescription`, a
 * step its `stepId`, which `changeSet.step` finds it by.
 */
const describeEntry = (
  changeSet: GlspChangeSet,
  entry: ChangeSetEntry,
): { refused: boolean; lines: readonly string[] } => {
  if (!entry.result.ok)
    return {
      refused: true,
      lines: entry.result.diagnostics.map(({ message }) => message),
    };
  const undone = entry.result.undoDescription;
  if (undone) return { refused: false, lines: [undone] };
  return {
    refused: false,
    lines: changeSet.step(entry)?.description ?? [`${entry.name} (no change)`],
  };
};

export default function AgentDrawer() {
  const wb = useWorkbench();
  return wb.glspEnabled ? <AgentPanel /> : null;
}

function AgentPanel() {
  const wb = useWorkbench();
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const clientRef = useRef<ChatClient | null>(null);

  const registry = wb.glspSession?.liveRegistry ?? null;

  const contextProviders = useMemo(
    () => contextProvidersFor(wb.mode),
    [wb.mode],
  );

  const updateSettings = (next: AgentSettings) => {
    setSettings(next);
    saveAgentSettings(next);
  };

  const run = async () => {
    if (!registry || !prompt.trim() || running) return;
    const { createChatClient, runAgent } = await import('@istar-ts/agent');
    clientRef.current ??= createChatClient({
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: settings.apiKey,
    });
    const userText = prompt.trim();
    setPrompt('');
    setLines((prev) => [...prev, { kind: 'user', text: userText }]);
    setRunning(true);
    const onEvent = (event: AgentEvent) => {
      if (event.type !== 'tool-call') return;
      setLines((prev) => [
        ...prev,
        {
          kind: 'tool',
          name: event.call.name,
          args: event.call.args,
          ok: event.call.result.ok,
        },
      ]);
    };
    try {
      const common = {
        client: clientRef.current,
        prompt: userText,
        context: contextProviders,
        getModel: () => wb.session.store.getModel(),
        onEvent,
      };
      if (settings.approval === 'auto') {
        const { transcript } = await runAgent({
          ...common,
          approval: 'auto',
          tools: registry,
        });
        const last = transcript.messages.at(-1);
        if (last?.role === 'assistant' && last.content)
          setLines((prev) => [
            ...prev,
            { kind: 'assistant', text: last.content! },
          ]);
      } else {
        // `registry` (above) is `wb.glspSession`'s, so this run would not
        // have started without it
        const { changeSet } = wb.glspSession!;
        const { transcript, changeSet: entries } = await runAgent({
          ...common,
          approval: 'propose',
          changeSet,
        });
        const last = transcript.messages.at(-1);
        if (last?.role === 'assistant' && last.content)
          setLines((prev) => [
            ...prev,
            { kind: 'assistant', text: last.content! },
          ]);
        if (entries.length > 0) setPending({ changeSet, entries });
      }
    } catch (error) {
      setLines((prev) => [
        ...prev,
        {
          kind: 'error',
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  /** The approved change set, as one undo step: refused as a whole, the model untouched. */
  const approve = async ({ changeSet, entries }: Pending) => {
    setPending(null);
    const result = await changeSet.apply(entries);
    if (!result.ok)
      setLines((prev) => [
        ...prev,
        {
          kind: 'error',
          text: `Not applied: ${result.diagnostics.map(({ message }) => message).join('; ')}`,
        },
      ]);
  };

  return (
    <aside className='fixed right-3 top-14 bottom-3 z-40 flex w-80 flex-col rounded-lg border border-line-strong bg-white shadow-lg'>
      <div className='flex items-center justify-between border-b border-line px-3 py-2'>
        <span className='text-[13px] font-medium text-ink'>Agent</span>
        <div className='flex items-center gap-1'>
          <Segmented
            label='Approval'
            size='sm'
            value={settings.approval}
            onChange={(approval) => updateSettings({ ...settings, approval })}
            options={[
              { id: 'propose', label: 'Propose' },
              { id: 'auto', label: 'Auto' },
            ]}
          />
          <button
            type='button'
            aria-label='Agent settings'
            onClick={() => setSettingsOpen((open) => !open)}
            className='rounded-md p-1 text-ink-muted hover:bg-panel-deep hover:text-ink'
          >
            <Settings2 className='h-4 w-4' aria-hidden />
          </button>
        </div>
      </div>
      {settingsOpen && (
        <div className='flex flex-col gap-2 border-b border-line p-3 text-[13px]'>
          <label className='flex flex-col gap-1'>
            <span className='text-ink-muted'>Endpoint</span>
            <input
              className='rounded-md border border-line-strong px-2 py-1'
              value={settings.baseUrl}
              onChange={(e) =>
                updateSettings({ ...settings, baseUrl: e.target.value })
              }
            />
          </label>
          <label className='flex flex-col gap-1'>
            <span className='text-ink-muted'>Model</span>
            <input
              className='rounded-md border border-line-strong px-2 py-1'
              value={settings.model}
              onChange={(e) =>
                updateSettings({ ...settings, model: e.target.value })
              }
            />
          </label>
          <label className='flex flex-col gap-1'>
            <span className='text-ink-muted'>API key</span>
            <input
              type='password'
              className='rounded-md border border-line-strong px-2 py-1'
              value={settings.apiKey}
              onChange={(e) =>
                updateSettings({ ...settings, apiKey: e.target.value })
              }
            />
          </label>
        </div>
      )}
      <div className='flex-1 overflow-y-auto px-3 py-2'>
        {lines.map((line, i) => (
          <div key={i} className='mb-2 text-[13px]'>
            {line.kind === 'user' && (
              <div className='text-ink'>
                <span className='font-medium'>You: </span>
                {line.text}
              </div>
            )}
            {line.kind === 'assistant' && (
              <div className='text-ink-soft'>{line.text}</div>
            )}
            {line.kind === 'tool' && (
              <div
                className={cx(
                  'rounded-md bg-panel-deep px-2 py-1 font-mono text-xs',
                  line.ok ? 'text-ink-muted' : 'text-error',
                )}
              >
                {line.name}({JSON.stringify(line.args)})
              </div>
            )}
            {line.kind === 'error' && (
              <div className='text-error'>{line.text}</div>
            )}
          </div>
        ))}
        {pending && (
          <div className='rounded-md border border-line-strong p-2'>
            <div className='mb-1 text-[13px] font-medium'>
              {pending.entries.length} proposed call
              {pending.entries.length === 1 ? '' : 's'}
            </div>
            {pending.entries.map((entry) => {
              const { refused, lines: described } = describeEntry(
                pending.changeSet,
                entry,
              );
              return (
                <div
                  key={entry.toolCallId}
                  className={cx(
                    'mb-1 text-xs',
                    refused ? 'text-error' : 'text-ink-soft',
                  )}
                >
                  {described.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              );
            })}
            <div className='flex gap-2'>
              <Button variant='primary' onClick={() => void approve(pending)}>
                Approve
              </Button>
              <Button onClick={() => setPending(null)}>Reject</Button>
            </div>
          </div>
        )}
      </div>
      <div className='flex items-center gap-2 border-t border-line p-2'>
        <input
          className='flex-1 rounded-md border border-line-strong px-2 py-1 text-[13px]'
          placeholder='Ask the agent…'
          value={prompt}
          disabled={running || !registry}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
        />
        <Button
          variant='primary'
          onClick={() => void run()}
          disabled={running || !registry || !prompt.trim()}
        >
          {running ? (
            <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
          ) : (
            <Send className='h-4 w-4' aria-hidden />
          )}
        </Button>
      </div>
    </aside>
  );
}
