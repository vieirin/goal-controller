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
import type { AgentEvent, AgentRun, ChatMessage } from '@istar-ts/agent';
import { toPistar } from '@istar-ts/core';
import { contextProvidersFor } from '@/lib/workbench/agent/context';
import type { AgentSettings } from '@/lib/workbench/agent/agentSettings';
import type { ChatEntry } from '@/lib/workbench/agent/chatTranscript';
import { PROVIDERS, type Attachment } from '@/lib/workbench/agent/providers';
import {
  addUsage,
  NO_USAGE,
  pricesOf,
  type ConversationUsage,
} from '@/lib/workbench/agent/usage';
import { useWorkbench } from '../WorkbenchContext';

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function useAgentChat() {
  const wb = useWorkbench();
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [running, setRunning] = useState(false);
  /** bumped when another model opens: a new conversation (and composer) */
  const [conversation, setConversation] = useState(0);
  const runController = useRef<AbortController | null>(null);
  /**
   * The conversation so far (no system prompt), sent with each request: the
   * system prompt is rebuilt each run, so it reads the model as it is now
   * (a rejected change set's dry run is still in here, as the agent's
   * proposal, but not in the model it is told of).
   */
  const history = useRef<readonly ChatMessage[]>([]);
  const [usage, setUsage] = useState<ConversationUsage>(NO_USAGE);
  const ids = useRef(0);
  const nextId = () => `entry-${(ids.current += 1)}`;

  const append = (entry: ChatEntry) => setEntries((prev) => [...prev, entry]);
  /**
   * right after the entry `id` (a diff after its edit, however late it
   * comes); nowhere once that entry's conversation has been cleared
   */
  const insertAfter = (id: string, entry: ChatEntry) =>
    setEntries((prev) => {
      const at = prev.findIndex((e) => e.id === id);
      return at < 0
        ? prev
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

  // another model opened: a new conversation, the running request (if any)
  // stopped. A crash recovery replaces the session on the same model (the
  // incident, in the same render): the conversation goes on, its change
  // set discarded above.
  const seenSession = useRef({
    id: wb.session.id,
    incident: wb.modelWorkerIncident,
  });
  useEffect(() => {
    const seen = seenSession.current;
    if (wb.session.id === seen.id) return;
    seenSession.current = {
      id: wb.session.id,
      incident: wb.modelWorkerIncident,
    };
    if (wb.modelWorkerIncident !== seen.incident) return;
    runController.current?.abort();
    setEntries([]);
    history.current = [];
    setUsage(NO_USAGE);
    setConversation((n) => n + 1);
  }, [wb.session.id, wb.modelWorkerIncident]);

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
    const { costPerMillionTokens, createChatClient, runAgent } =
      await import('@istar-ts/agent');
    const prices = pricesOf(settings.prices);
    const cost = prices ? costPerMillionTokens(prices) : null;
    const client = createChatClient({
      provider: PROVIDERS[settings.providerId],
      model: settings.model,
      apiKey: settings.apiKey,
      stream: true,
    });
    const run = nextId();
    const controller = new AbortController();
    runController.current = controller;
    const diffs = diffRecorder();
    // what the run changes is marked on the model's views (`wb.agentChanges`)
    wb.beginAgentChanges();
    const onEvent = (event: AgentEvent) => {
      // its conversation was cleared: nothing more of it shows
      if (controller.signal.aborted) return;
      switch (event.type) {
        case 'delta':
          if (event.delta.content)
            setAssistantText(
              `${run}-step-${event.step}`,
              (prev) => prev + event.delta.content,
            );
          return;
        case 'step': {
          const stepUsage = event.step.usage;
          if (stepUsage) setUsage((prev) => addUsage(prev, stepUsage, cost));
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
        history: history.current,
        context: contextProviders,
        getModel: () => wb.session.store.getModel(),
        onEvent,
        signal: controller.signal,
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
      if (controller.signal.aborted) return;
      history.current = result.transcript.messages.filter(
        ({ role }) => role !== 'system',
      );
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
      if (!controller.signal.aborted)
        append({ kind: 'error', id: nextId(), text: messageOf(error) });
    } finally {
      // once the mirror shows the run's last edit
      await diffs.done();
      // another model's snapshot says nothing about this one
      if (!controller.signal.aborted) wb.endAgentChanges();
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

  return { entries, running, conversation, usage, send, approve, reject };
}

export type AgentChat = ReturnType<typeof useAgentChat>;
