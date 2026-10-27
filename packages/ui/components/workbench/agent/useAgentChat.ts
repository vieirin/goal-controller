/**
 * The agent drawer's runs (goal-controller#415, #485), over backend A's
 * session (`wb.glspSession`, istar-ts#239, goal-controller#450), served in
 * the model worker: Auto mode calls `liveRegistry` directly (one call, one
 * undo step); Propose mode dry-runs on `changeSet`'s scratch session (a
 * fresh one per run) and leaves the change set in the transcript for the
 * user to approve (applied as one undo step) or reject. The system prompt
 * gets goal-controller's context providers, the same ones `wb.glspSession`
 * serves as MCP resources.
 *
 * Each run's events become transcript entries as they come: a step's prose
 * as its deltas stream in, each tool call, and after each edit (an Auto
 * call, an approved change set) the model's JSON text before and after it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, AgentRun } from '@istar-ts/agent';
import { toPistar } from '@istar-ts/core';
import { contextProvidersFor } from '@/lib/workbench/agent/context';
import type { AgentSettings } from '@/lib/workbench/agent/agentSettings';
import type { ChatEntry } from '@/lib/workbench/agent/chatTranscript';
import { PROVIDERS, type Attachment } from '@/lib/workbench/agent/providers';
import { useWorkbench } from '../WorkbenchContext';

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useAgentChat() {
  const wb = useWorkbench();
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [running, setRunning] = useState(false);
  const ids = useRef(0);
  const nextId = () => `entry-${(ids.current += 1)}`;

  const append = (entry: ChatEntry) => setEntries((prev) => [...prev, entry]);
  /** right after the entry `id` (a diff after its edit, however late it comes) */
  const insertAfter = (id: string, entry: ChatEntry) =>
    setEntries((prev) => {
      const at = prev.findIndex((e) => e.id === id);
      return at < 0
        ? [...prev, entry]
        : [...prev.slice(0, at + 1), entry, ...prev.slice(at + 1)];
    });
  const setAssistantText = (id: string, next: (text: string) => string) =>
    setEntries((prev) =>
      prev.some((e) => e.id === id)
        ? prev.map((e) =>
            e.id === id && e.kind === 'assistant'
              ? { ...e, text: next(e.text) }
              : e,
          )
        : [...prev, { kind: 'assistant', id, text: next('') }],
    );
  const setProposalState = (
    state: Proposal['state'],
    which: (entry: Proposal) => boolean,
  ) =>
    setEntries((prev) =>
      prev.map((e) =>
        e.kind === 'proposal' && which(e) ? { ...e, state } : e,
      ),
    );

  // a model-worker crash (goal-controller#469) discards a Propose preview
  // still up: its scratch session lived in the worker that just died. Keyed
  // on the incident count, not its presence, so a second crash before this
  // one is dismissed still fires again.
  const seenIncident = useRef(wb.modelWorkerIncident);
  useEffect(() => {
    if (wb.modelWorkerIncident === seenIncident.current) return;
    seenIncident.current = wb.modelWorkerIncident;
    setEntries((prev) => {
      if (!prev.some((e) => e.kind === 'proposal' && e.state === 'pending'))
        return prev;
      return [
        ...prev.map((e) =>
          e.kind === 'proposal' && e.state === 'pending'
            ? { ...e, state: 'discarded' as const }
            : e,
        ),
        {
          kind: 'error',
          id: `incident-${wb.modelWorkerIncident}`,
          text: 'The editor restarted; the proposal was discarded.',
        },
      ];
    });
  }, [wb.modelWorkerIncident]);

  // a change set previewed over the session a newly opened model replaced
  const seenSession = useRef(wb.session.id);
  useEffect(() => {
    if (wb.session.id === seenSession.current) return;
    seenSession.current = wb.session.id;
    setProposalState('discarded', (e) => e.state === 'pending');
  }, [wb.session.id]);

  const contextProviders = useMemo(
    () => contextProvidersFor(wb.mode),
    [wb.mode],
  );

  /**
   * The model's JSON text now, and a recorder that adds, after an entry, a
   * diff of the text since the last one it recorded, once the session's
   * mirror shows what the worker did. Chained: diffs come in edit order.
   */
  const diffRecorder = () => {
    const session = wb.session;
    const fileName = wb.fileName || 'model.json';
    const snapshot = () => toPistar(session.store.getModel());
    let before = snapshot();
    let chain = Promise.resolve();
    const record = (afterId: string) => {
      chain = chain
        .then(() => session.synced())
        .then(() => {
          const after = snapshot();
          if (after !== before)
            insertAfter(afterId, {
              kind: 'diff',
              id: nextId(),
              fileName,
              before,
              after,
            });
          before = after;
        })
        // the worker crashed: the incident says so, and the model was reset
        .catch(() => undefined);
    };
    return { record, done: () => chain };
  };

  const send = async (
    text: string,
    attachments: readonly Attachment[],
    settings: AgentSettings,
  ) => {
    const glsp = wb.glspSession;
    if (!glsp || running || !text.trim()) return;
    setRunning(true);
    // a new request supersedes a change set still waiting for review
    setProposalState('discarded', (e) => e.state === 'pending');
    append({ kind: 'user', id: nextId(), text, attachments });
    const { createChatClient, runAgent } = await import('@istar-ts/agent');
    const client = createChatClient({
      provider: PROVIDERS[settings.providerId],
      model: settings.model,
      apiKey: settings.apiKey,
      stream: true,
    });
    const run = nextId();
    const diffs = diffRecorder();
    // what the run changes is marked on the model's views (`wb.agentChanges`)
    wb.beginAgentChanges();
    const onEvent = (event: AgentEvent) => {
      switch (event.type) {
        case 'delta':
          if (event.delta.content)
            setAssistantText(
              `${run}-step-${event.step}`,
              (prev) => prev + event.delta.content,
            );
          return;
        case 'step': {
          const content = event.step.message.content;
          if (content?.trim())
            setAssistantText(`${run}-step-${event.step.index}`, () => content);
          return;
        }
        case 'tool-call': {
          const id = nextId();
          append({ kind: 'tool', id, call: event.call });
          if (event.call.disposition === 'applied' && event.call.result.ok)
            diffs.record(id);
          return;
        }
        case 'stop':
          return;
      }
    };
    try {
      const common = {
        client,
        prompt: text,
        attachments,
        context: contextProviders,
        getModel: () => wb.session.store.getModel(),
        onEvent,
      };
      const result: AgentRun =
        settings.approval === 'auto'
          ? await runAgent({
              ...common,
              approval: 'auto',
              tools: glsp.liveRegistry,
            })
          : await runAgent({
              ...common,
              approval: 'propose',
              changeSet: glsp.changeSet,
            });
      await diffs.done();
      const { stop } = result.transcript;
      if (stop.reason !== 'final')
        append({
          kind: 'error',
          id: nextId(),
          text: `Stopped (${stop.reason})${stop.message ? `: ${stop.message}` : ''}`,
        });
      if (result.changeSet.length > 0)
        append({
          kind: 'proposal',
          id: nextId(),
          changeSet: glsp.changeSet,
          entries: result.changeSet,
          state: 'pending',
        });
    } catch (error) {
      append({ kind: 'error', id: nextId(), text: messageOf(error) });
    } finally {
      // once the mirror shows the run's last edit
      await diffs.done();
      wb.endAgentChanges();
      setRunning(false);
    }
  };

  /** The approved change set, as one undo step: refused as a whole, the model untouched. */
  const approve = async ({ id, changeSet, entries: proposed }: Proposal) => {
    setProposalState('applied', (e) => e.id === id);
    const diffs = diffRecorder();
    wb.beginAgentChanges();
    try {
      const result = await changeSet.apply(proposed);
      if (!result.ok) {
        setProposalState('discarded', (e) => e.id === id);
        append({
          kind: 'error',
          id: nextId(),
          text: `Not applied: ${result.diagnostics.map(({ message }) => message).join('; ')}`,
        });
        return;
      }
      diffs.record(id);
    } catch (error) {
      append({ kind: 'error', id: nextId(), text: messageOf(error) });
    } finally {
      await diffs.done();
      wb.endAgentChanges();
    }
  };

  const reject = ({ id }: Proposal) =>
    setProposalState('rejected', (e) => e.id === id);

  return { entries, running, send, approve, reject };
}

export type AgentChat = ReturnType<typeof useAgentChat>;
