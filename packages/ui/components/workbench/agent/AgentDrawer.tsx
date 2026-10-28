'use client';

/**
 * The agent drawer (goal-controller#415, #485), after the mock in
 * `docs/mocks/agent-chat.md`: a panel of the model column, with the
 * transcript of the runs (`useAgentChat`) and the composer. Its settings
 * (provider, model, API key, approval mode) are kept in `localStorage`
 * only (`agentSettings.ts`): never in the project file, never sent
 * anywhere but the provider's endpoint.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import {
  loadAgentSettings,
  saveAgentSettings,
  type AgentSettings,
} from '@/lib/workbench/agent/agentSettings';
import {
  introducedProblems,
  type ChatEntry,
} from '@/lib/workbench/agent/chatTranscript';
import type { Problem } from '@/lib/workbench/types';
import { toPistar } from '@istar-ts/core';
import { effectivePrices, PROVIDERS } from '@/lib/workbench/agent/providers';
import { formatCost, formatTokens } from '@/lib/workbench/agent/usage';
import {
  projectFilesOf,
  type ProjectFile,
} from '@/lib/workbench/agent/projectFiles';
import { useWorkbench } from '../WorkbenchContext';
import { Button, IconButton, Segmented } from '../ui';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { Composer } from './Composer';
import { DiffCard } from './DiffCard';
import { ProposalCard } from './ProposalCard';
import { ReadOnlyEntry } from './ReadOnlyEntry';
import { SharedEntryCard } from './SharedEntryCard';
import { useAgentChatContext } from './AgentChatHost';

/** how near its end a scroll still counts as landing at its end */
const FOLLOW_SLACK_PX = 24;

/** the keys a user reaches for to read back up the transcript */
const SCROLL_UP_KEYS = new Set(['PageUp', 'ArrowUp', 'Home']);

const useProjectFiles = (): readonly ProjectFile[] => {
  const wb = useWorkbench();
  return useMemo(
    () =>
      projectFilesOf({
        model: { path: wb.modelPath, fileName: wb.fileName, text: wb.text },
        resourceSlots: wb.resourceSlots,
        nativeSlots: wb.nativeSlots,
        outputs: wb.lastGood?.files ?? [],
        openedFiles: wb.openedFiles,
        texts: wb.resourceTexts,
      }),
    [
      wb.modelPath,
      wb.fileName,
      wb.text,
      wb.resourceSlots,
      wb.nativeSlots,
      wb.lastGood,
      wb.openedFiles,
      wb.resourceTexts,
    ],
  );
};

export default function AgentDrawer({ onClose }: { onClose: () => void }) {
  const wb = useWorkbench();
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chat = useAgentChatContext();
  const projectFiles = useProjectFiles();
  const keyOf = useCallback(
    (id: string) => wb.tree?.byIStarId.get(id)?.key,
    [wb.tree],
  );
  // the latest edit, while nothing has changed the model since: undoable
  const latestDiff = chat.entries.findLast(
    (entry) => entry.kind === 'diff' && !entry.undone,
  );
  const modelNow = useMemo(
    () => (latestDiff ? toPistar(wb.session.store.getModel()) : null),
    // the text follows every change of the session's model
    [latestDiff, wb.session, wb.text],
  );
  const undoable =
    latestDiff?.kind === 'diff' && latestDiff.after === modelNow
      ? latestDiff.id
      : null;
  const { fromList } = effectivePrices(settings.prices, settings.model);
  // what the model's views badge (EDITED, NEW, …) until cleared
  const { added, edited, removed } = wb.agentChanges;
  const marked = added.size + edited.size + removed.size;

  const updateSettings = useCallback((next: AgentSettings) => {
    setSettings(next);
    saveAgentSettings(next);
  }, []);

  // the latest entry in view, a streamed one as it grows, while the
  // transcript is scrolled to its end: following is decided by intent, not
  // by measuring the gap after the fact (goal-controller#504) — a wheel,
  // touch or keyboard scroll up turns it off, a scroll that lands at the
  // end turns it back on, and a programmatic scroll (ours) never turns it
  // off, however much the content grew in between
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  // entries seen since following last stopped, for the "new messages" pill
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const seenLength = useRef(0);

  const resumeFollowing = useCallback(() => {
    following.current = true;
    setPendingCount(null);
  }, []);
  const stopFollowing = useCallback(() => {
    following.current = false;
  }, []);

  useEffect(() => {
    const view = scroller.current;
    if (!view) return;
    if (chat.entries.at(-1)?.kind === 'user') resumeFollowing();
    if (following.current) {
      view.scrollTop = view.scrollHeight;
    } else {
      const added = chat.entries.length - seenLength.current;
      setPendingCount((prev) => (prev ?? 0) + Math.max(added, 0));
    }
    seenLength.current = chat.entries.length;
  }, [chat.entries, resumeFollowing]);

  // content that lays out after the commit (markdown, diffs, tool cards) or
  // a drawer resize: keep pinned to the end while following
  useEffect(() => {
    const view = scroller.current;
    const inner = list.current;
    if (!view || !inner || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (following.current) view.scrollTop = view.scrollHeight;
    });
    observer.observe(view);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [wb.glspEnabled]);

  return (
    <aside className='flex h-full flex-col bg-white' aria-label='Agent'>
      <header className='flex items-center gap-2 border-b border-line px-3 py-2'>
        <div className='min-w-0 flex-1'>
          <h2 className='text-[13px] font-semibold text-ink'>Agent</h2>
          <p className='truncate text-2xs text-ink-muted'>
            edits the open model through istar-ts
          </p>
        </div>
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
        <IconButton
          icon={Settings2}
          label='Agent settings'
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        />
        <IconButton icon={X} label='Close the agent' onClick={onClose} />
      </header>
      {settingsOpen && (
        <AgentSettingsPanel settings={settings} onChange={updateSettings} />
      )}
      {marked > 0 && (
        <div
          role='status'
          className='flex items-center gap-2 border-b border-line bg-panel px-3 py-1 text-2xs text-ink-muted'
        >
          <span className='flex-1'>
            {marked} change{marked === 1 ? '' : 's'} by the agent marked on the
            model
          </span>
          <Button variant='quiet' onClick={wb.clearAgentChanges}>
            Clear marks
          </Button>
        </div>
      )}
      <div className='relative min-h-0 flex-1'>
        <div
          ref={scroller}
          role='log'
          aria-label='Transcript'
          className='h-full overflow-y-auto px-3 py-3'
          onScroll={({ currentTarget: view }) => {
            if (
              view.scrollHeight - view.scrollTop - view.clientHeight <
              FOLLOW_SLACK_PX
            ) {
              resumeFollowing();
            }
          }}
          onWheel={(e) => {
            if (e.deltaY < 0) stopFollowing();
          }}
          onTouchMove={stopFollowing}
          onKeyDown={(e) => {
            if (SCROLL_UP_KEYS.has(e.key)) stopFollowing();
          }}
        >
          {!wb.glspEnabled ? (
            <div className='flex flex-col items-start gap-2 text-[13px] text-ink-muted'>
              <p>
                The agent edits the model through its GLSP session, which is
                off.
              </p>
              <Button variant='outline' onClick={() => wb.setGlspEnabled(true)}>
                Turn it on
              </Button>
            </div>
          ) : (
            <ol ref={list} className='flex flex-col gap-3'>
              {chat.storedEntries.map((entry) => (
                <li key={entry.id} className='opacity-60'>
                  <ReadOnlyEntry entry={entry} />
                </li>
              ))}
              {chat.storedEntries.length > 0 && (
                <li className='flex items-center gap-2 text-2xs text-ink-muted'>
                  <span className='h-px flex-1 bg-line' />
                  <span>Earlier conversation · read-only</span>
                  <span className='h-px flex-1 bg-line' />
                  <Button variant='quiet' onClick={chat.forgetStored}>
                    Forget
                  </Button>
                </li>
              )}
              {chat.entries.map((entry) => (
                <li key={entry.id}>
                  <TranscriptEntry
                    entry={entry}
                    problems={wb.problems}
                    keyOf={keyOf}
                    undoable={entry.id === undoable}
                    onUndo={chat.undo}
                    onApprove={chat.approve}
                    onReject={chat.reject}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
        {pendingCount !== null && (
          <button
            type='button'
            className='absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-trace px-3 py-1 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90'
            onClick={() => {
              const view = scroller.current;
              if (view) view.scrollTop = view.scrollHeight;
              resumeFollowing();
            }}
          >
            {pendingCount > 0
              ? `${pendingCount} new message${pendingCount === 1 ? '' : 's'}`
              : 'New messages'}{' '}
            ↓
          </button>
        )}
      </div>
      <Composer
        key={chat.conversation}
        provider={PROVIDERS[settings.providerId]}
        projectFiles={projectFiles}
        running={chat.running}
        disabled={!wb.glspSession}
        onSend={(text, attachments) =>
          void chat.send(text, attachments, settings)
        }
      />
      {chat.usage.totalTokens > 0 && (
        <p
          aria-label='Usage'
          className='flex gap-3 border-t border-line bg-white px-3 py-1 font-mono text-2xs text-ink-muted'
        >
          <span title="The last model call's tokens: what the next request starts from">
            context {formatTokens(chat.usage.contextTokens)}
          </span>
          <span title='Every model call in this conversation'>
            total {formatTokens(chat.usage.totalTokens)}
          </span>
          {chat.usage.cost !== null && (
            <span
              title={
                fromList
                  ? "Estimated at DeepSeek's peak list prices of 2026-10-27; set prices in the settings to override"
                  : 'At the prices in the settings'
              }
            >
              {fromList ? 'est. ' : ''}
              {formatCost(chat.usage.cost)}
            </span>
          )}
        </p>
      )}
    </aside>
  );
}

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

function TranscriptEntry({
  entry,
  problems,
  keyOf,
  undoable,
  onUndo,
  onApprove,
  onReject,
}: {
  entry: ChatEntry;
  /** the model's problems now (`wb.problems`) */
  problems: readonly Problem[];
  /** an element's RT id, the notation's problems name it by */
  keyOf: (id: string) => string | undefined;
  /** a diff that is still the model's latest edit */
  undoable: boolean;
  onUndo: (id: string) => void;
  onApprove: (proposal: Proposal) => Promise<void>;
  onReject: (proposal: Proposal) => void;
}) {
  switch (entry.kind) {
    case 'diff':
      return (
        <DiffCard
          fileName={entry.fileName}
          before={entry.before}
          after={entry.after}
          status={entry.undone ? 'undone' : 'accepted'}
          problems={
            entry.undone
              ? []
              : introducedProblems(
                  problems,
                  entry.touched,
                  entry.baseline,
                  keyOf,
                )
          }
          onUndo={undoable ? () => onUndo(entry.id) : undefined}
        />
      );
    case 'proposal':
      return (
        <ProposalCard
          proposal={entry}
          onApprove={() => void onApprove(entry)}
          onReject={() => onReject(entry)}
        />
      );
    default:
      return <SharedEntryCard entry={entry} />;
  }
}
