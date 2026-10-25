'use client';

/**
 * The agent drawer (goal-controller#415), modelled on istar-ts's playground
 * drawer (`@istar-ts/agent`'s README usage): connects to M5's MCP server
 * (`wb.glspMcp`) with `createMcpToolRegistry`, adds goal-controller's own
 * context providers to the system prompt, and runs the chat loop with
 * `runAgent`. The endpoint, model and API key are typed into the drawer's
 * own settings and kept in `localStorage` only (`agentSettings.ts`): never
 * in the project file, never sent anywhere but the configured endpoint.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Send, Settings2 } from 'lucide-react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  AgentEvent,
  ChangeSetEntry,
  ChatClient,
  ToolRegistry,
} from '@istar-ts/agent';
import { contextProvidersFor } from '@/lib/workbench/agent/engineContext';
import {
  DEFAULT_AGENT_SETTINGS,
  loadAgentSettings,
  saveAgentSettings,
  type AgentSettings,
} from '@/lib/workbench/agent/agentSettings';
import { createMcpChangeSet } from '@/lib/workbench/agent/mcpChangeSet';
import { useWorkbench } from './WorkbenchContext';
import { Button, Segmented, cx } from './ui';

type Pending = {
  entries: readonly ChangeSetEntry[];
  resolve: (approved: readonly ChangeSetEntry[]) => void;
};

type TranscriptLine =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; args: unknown; ok: boolean }
  | { kind: 'error'; text: string };

export default function AgentDrawer() {
  const wb = useWorkbench();
  const [settings, setSettings] = useState<AgentSettings>(
    DEFAULT_AGENT_SETTINGS,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const registryRef = useRef<ToolRegistry | null>(null);
  const clientRef = useRef<ChatClient | null>(null);

  useEffect(() => {
    setSettings(loadAgentSettings());
  }, []);

  const glspMcp = wb.glspMcp;
  useEffect(() => {
    registryRef.current = null;
    if (!glspMcp) return;
    let disposed = false;
    void (async () => {
      const { createMcpToolRegistry } = await import('@istar-ts/agent');
      const client = new Client({ name: 'goal-controller', version: '1.0.0' });
      await client.connect(
        new StreamableHTTPClientTransport(glspMcp.url, {
          fetch: glspMcp.fetch,
        }),
      );
      const registry = await createMcpToolRegistry(client, {
        boundArgs: { sessionId: glspMcp.sessionId },
      });
      if (!disposed) registryRef.current = registry;
    })();
    return () => {
      disposed = true;
    };
  }, [glspMcp]);

  const contextProviders = useMemo(
    () => contextProvidersFor(wb.engine, wb.mode),
    [wb.engine, wb.mode],
  );

  if (!wb.glspEnabled) return null;

  const updateSettings = (next: AgentSettings) => {
    setSettings(next);
    saveAgentSettings(next);
  };

  const run = async () => {
    const registry = registryRef.current;
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
      if (settings.approval === 'auto') {
        const { transcript } = await runAgent({
          client: clientRef.current,
          prompt: userText,
          context: contextProviders,
          getModel: () => wb.session.store.getModel(),
          approval: 'auto',
          tools: registry,
          onEvent,
        });
        const last = transcript.messages.at(-1);
        if (last?.role === 'assistant' && last.content)
          setLines((prev) => [
            ...prev,
            { kind: 'assistant', text: last.content! },
          ]);
      } else {
        const base = createMcpChangeSet(registry);
        const changeSet = {
          openScratch: base.openScratch,
          apply: (entries: readonly ChangeSetEntry[]) =>
            new Promise<readonly ChangeSetEntry[]>((resolve) => {
              setPending({ entries, resolve });
            }).then((approved) => base.apply(approved)),
        };
        const { transcript, changeSet: proposed } = await runAgent({
          client: clientRef.current,
          prompt: userText,
          context: contextProviders,
          getModel: () => wb.session.store.getModel(),
          approval: 'propose',
          changeSet,
          onEvent,
        });
        void proposed;
        const last = transcript.messages.at(-1);
        if (last?.role === 'assistant' && last.content)
          setLines((prev) => [
            ...prev,
            { kind: 'assistant', text: last.content! },
          ]);
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
            {pending.entries.map((entry) => (
              <div
                key={entry.toolCallId}
                className='mb-1 font-mono text-xs text-ink-soft'
              >
                {entry.name}({JSON.stringify(entry.args)})
              </div>
            ))}
            <div className='flex gap-2'>
              <Button
                variant='primary'
                onClick={() => {
                  pending.resolve(pending.entries);
                  setPending(null);
                }}
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  pending.resolve([]);
                  setPending(null);
                }}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className='flex items-center gap-2 border-t border-line p-2'>
        <input
          className='flex-1 rounded-md border border-line-strong px-2 py-1 text-[13px]'
          placeholder='Ask the agent…'
          value={prompt}
          disabled={running || !registryRef.current}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
        />
        <Button
          variant='primary'
          onClick={() => void run()}
          disabled={running || !registryRef.current || !prompt.trim()}
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
