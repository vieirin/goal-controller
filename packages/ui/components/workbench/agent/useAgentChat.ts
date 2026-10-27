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
import type {
  AgentEvent,
  AgentRun,
  ChangeSetEntry,
  ChatMessage,
} from '@istar-ts/agent';
import type { GlspChangeSet } from '@istar-ts/agent/glsp';
import { toPistar } from '@istar-ts/core';
import { contextProvidersFor } from '@/lib/workbench/agent/context';
import type { AgentSettings } from '@/lib/workbench/agent/agentSettings';
import {
  problemKey,
  problemsText,
  revisionPrompt,
  type ChatEntry,
  type PreviewView,
} from '@/lib/workbench/agent/chatTranscript';
import { previewProposal } from '@/lib/workbench/agent/proposalPreview';
import { diffModel, snapshotModel } from '@/lib/workbench/agentChanges';
import { PROVIDERS, type Attachment } from '@/lib/workbench/agent/providers';
import {
  addUsage,
  NO_USAGE,
  pricesOf,
  type ConversationUsage,
} from '@/lib/workbench/agent/usage';
import { useWorkbench } from '../WorkbenchContext';

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

/** how many times a proposal that would leave errors goes back to the agent */
export const MAX_REVISIONS = 2;

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
  /** the model's problems as last rendered: what a run starts from */
  const latestProblems = useRef(wb.problems);
  latestProblems.current = wb.problems;
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
    const baseline = new Set(latestProblems.current.map(problemKey));
    let before = toPistar(session.store.getModel());
    let beforeModel = snapshotModel(session.store.getModel());
    let chain = Promise.resolve();
    const record = (afterId: string) => {
      chain = chain
        .then(() => session.synced())
        .then(() => {
          const model = session.store.getModel();
          const after = toPistar(model);
          if (after !== before) {
            const { added, edited } = diffModel(beforeModel, model);
            insertAfter(afterId, {
              kind: 'diff',
              id: nextId(),
              fileName,
              before,
              after,
              touched: new Set([...added, ...edited]),
              baseline,
              undone: false,
            });
          }
          before = after;
          beforeModel = snapshotModel(model);
        })
        // the worker crashed: the incident says so, and the model was reset
        .catch(() => undefined);
    };
    return { record, done: () => chain };
  };

  /** One request to the agent; a Propose run whose change set would leave errors asks for its revision. */
  type Request = {
    prompt: string;
    attachments: readonly Attachment[];
    /** how many times the agent was already sent back to revise its proposal */
    revision: number;
  };

  const send = async (
    text: string,
    attachments: readonly Attachment[],
    settings: AgentSettings,
  ) => {
    if (!wb.glspSession || running || !text.trim()) return;
    setRunning(true);
    // a new request supersedes a change set still waiting for review
    setProposalState('discarded', (e) => e.state === 'pending');
    append({ kind: 'user', id: nextId(), text, attachments });
    let request: Request | null = { prompt: text, attachments, revision: 0 };
    while (request) request = await runOnce(request, settings);
    setRunning(false);
  };

  /** a run of `request`, and what to send next: a revision, or nothing */
  const runOnce = async (
    { prompt, attachments, revision }: Request,
    settings: AgentSettings,
  ): Promise<Request | null> => {
    const glsp = wb.glspSession;
    if (!glsp) return null;
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
        prompt,
        attachments,
        history: history.current,
        // the problems the workbench shows now, which no tool reports
        // (an edit of an earlier request may have left some)
        context: [
          ...contextProviders,
          {
            name: 'model-problems',
            title: 'Problems in the model now',
            text: problemsText(latestProblems.current),
            resource: false,
          },
        ],
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
      if (controller.signal.aborted) return null;
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
      if (result.changeSet.length === 0) return null;
      const preview = await previewOf(glsp.changeSet, result.changeSet);
      const errors = preview.ok
        ? preview.problems.filter(({ severity }) => severity === 'error')
        : [];
      const sendBack = errors.length > 0 && revision < MAX_REVISIONS;
      append({
        kind: 'proposal',
        id: nextId(),
        changeSet: glsp.changeSet,
        entries: result.changeSet,
        preview,
        state: sendBack ? 'revised' : 'pending',
      });
      if (!sendBack) return null;
      append({
        kind: 'notice',
        id: nextId(),
        text: `The proposal would leave ${errors.length} error${errors.length === 1 ? '' : 's'}: the agent is revising it (${revision + 1} of ${MAX_REVISIONS}).`,
      });
      return {
        prompt: revisionPrompt(errors),
        attachments: [],
        revision: revision + 1,
      };
    } catch (error) {
      if (!controller.signal.aborted)
        append({ kind: 'error', id: nextId(), text: messageOf(error) });
      return null;
    } finally {
      // once the mirror shows the run's last edit
      await diffs.done();
      // another model's snapshot says nothing about this one
      if (!controller.signal.aborted) wb.endAgentChanges();
    }
  };

  /**
   * The change set replayed on a copy of the live model: its JSON text
   * before and after, and the problems the workbench would report after it
   * that it doesn't now (`wb.previewProblems`, on both models alike).
   */
  const previewOf = async (
    changeSet: GlspChangeSet,
    proposed: readonly ChangeSetEntry[],
  ): Promise<PreviewView> => {
    const live = wb.session.store.getModel();
    const replayed = await previewProposal(live, changeSet, proposed);
    if (!replayed.ok) return replayed;
    const now = new Set(wb.previewProblems(live).map(problemKey));
    return {
      ok: true,
      fileName: wb.fileName || 'model.json',
      before: toPistar(live),
      after: toPistar(replayed.model),
      problems: wb
        .previewProblems(replayed.model)
        .filter((problem) => !now.has(problemKey(problem))),
    };
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

  /** the diff `id`'s edit undone (the latest edit, nothing after it) */
  const undo = (id: string) => {
    wb.undo();
    setEntries((prev) =>
      prev.map((e) =>
        e.kind === 'diff' && e.id === id ? { ...e, undone: true } : e,
      ),
    );
  };

  const reject = ({ id }: Proposal) =>
    setProposalState('rejected', (e) => e.id === id);

  return {
    entries,
    running,
    conversation,
    usage,
    send,
    approve,
    reject,
    undo,
  };
}

export type AgentChat = ReturnType<typeof useAgentChat>;
