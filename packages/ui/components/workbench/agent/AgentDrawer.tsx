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
import { PROVIDERS } from '@/lib/workbench/agent/providers';
import { formatCost, formatTokens } from '@/lib/workbench/agent/usage';
import {
  projectFilesOf,
  type ProjectFile,
} from '@/lib/workbench/agent/projectFiles';
import { useWorkbench } from '../WorkbenchContext';
import { Button, IconButton, Segmented } from '../ui';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { AssistantProse } from './AssistantProse';
import { Composer } from './Composer';
import { DiffCard } from './DiffCard';
import { ErrorLine } from './ErrorLine';
import { NoticeLine } from './NoticeLine';
import { ProposalCard } from './ProposalCard';
import { ToolCallCard } from './ToolCallCard';
import { UserCard } from './UserCard';
import { useAgentChatContext } from './AgentChatHost';

/** how near its end the transcript still counts as at its end */
const FOLLOW_SLACK_PX = 24;

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
  // what the model's views badge (EDITED, NEW, …) until cleared
  const { added, edited, removed } = wb.agentChanges;
  const marked = added.size + edited.size + removed.size;

  const updateSettings = useCallback((next: AgentSettings) => {
    setSettings(next);
    saveAgentSettings(next);
  }, []);

  // the latest entry in view, a streamed one as it grows, while the
  // transcript is scrolled to its end: scrolling up stops following it,
  // sending a request (or scrolling back down) resumes
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    const view = scroller.current;
    if (!view) return;
    if (chat.entries.at(-1)?.kind === 'user') following.current = true;
    if (following.current) view.scrollTop = view.scrollHeight;
  }, [chat.entries]);

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
      <div
        ref={scroller}
        role='log'
        aria-label='Transcript'
        className='min-h-0 flex-1 overflow-y-auto px-3 py-3'
        onScroll={({ currentTarget: view }) => {
          following.current =
            view.scrollHeight - view.scrollTop - view.clientHeight <
            FOLLOW_SLACK_PX;
        }}
      >
        {!wb.glspEnabled ? (
          <div className='flex flex-col items-start gap-2 text-[13px] text-ink-muted'>
            <p>
              The agent edits the model through its GLSP session, which is off.
            </p>
            <Button variant='outline' onClick={() => wb.setGlspEnabled(true)}>
              Turn it on
            </Button>
          </div>
        ) : (
          <ol className='flex flex-col gap-3'>
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
            <span title='At the prices in the settings'>
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
    case 'user':
      return <UserCard text={entry.text} attachments={entry.attachments} />;
    case 'assistant':
      return <AssistantProse text={entry.text} />;
    case 'tool':
      return <ToolCallCard call={entry.call} />;
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
    case 'error':
      return <ErrorLine text={entry.text} />;
    case 'notice':
      return <NoticeLine text={entry.text} />;
  }
}
