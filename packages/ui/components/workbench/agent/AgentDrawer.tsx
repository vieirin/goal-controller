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
import type { ChatEntry } from '@/lib/workbench/agent/chatTranscript';
import { PROVIDERS } from '@/lib/workbench/agent/providers';
import { useWorkbench } from '../WorkbenchContext';
import { Button, IconButton, Segmented } from '../ui';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { AssistantProse } from './AssistantProse';
import { Composer, type ProjectFile } from './Composer';
import { DiffCard } from './DiffCard';
import { ErrorLine } from './ErrorLine';
import { ProposalCard } from './ProposalCard';
import { ToolCallCard } from './ToolCallCard';
import { UserCard } from './UserCard';
import { useAgentChatContext } from './AgentChatHost';

const nameOf = (path: string): string => path.split('/').at(-1) ?? path;

/**
 * The open project's files an @-chip can attach: the model's own text,
 * then the resources the engine reads, the model's native files and the
 * other files open in a tab, each once.
 */
const useProjectFiles = (): readonly ProjectFile[] => {
  const wb = useWorkbench();
  return useMemo(() => {
    const model: ProjectFile = {
      path: wb.modelPath ?? wb.fileName,
      name: nameOf(wb.fileName),
      text: wb.text,
    };
    const paths = new Set([
      ...wb.resourceSlots.flatMap(({ paths }) => paths),
      ...wb.nativeSlots.flatMap(({ path, missing }) => (missing ? [] : [path])),
      ...wb.openedFiles,
    ]);
    paths.delete(model.path);
    return [
      ...(wb.fileName ? [model] : []),
      ...[...paths].map((path) => ({
        path,
        name: nameOf(path),
        text: wb.resourceTexts[path],
      })),
    ];
  }, [
    wb.modelPath,
    wb.fileName,
    wb.text,
    wb.resourceSlots,
    wb.nativeSlots,
    wb.openedFiles,
    wb.resourceTexts,
  ]);
};

export default function AgentDrawer({ onClose }: { onClose: () => void }) {
  const wb = useWorkbench();
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chat = useAgentChatContext();
  const projectFiles = useProjectFiles();

  const updateSettings = useCallback((next: AgentSettings) => {
    setSettings(next);
    saveAgentSettings(next);
  }, []);

  // the latest entry in view, a streamed one as it grows
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
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
      <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
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
                  onApprove={chat.approve}
                  onReject={chat.reject}
                />
              </li>
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </div>
      <Composer
        provider={PROVIDERS[settings.providerId]}
        projectFiles={projectFiles}
        running={chat.running}
        disabled={!wb.glspSession}
        onSend={(text, attachments) =>
          void chat.send(text, attachments, settings)
        }
      />
    </aside>
  );
}

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

function TranscriptEntry({
  entry,
  onApprove,
  onReject,
}: {
  entry: ChatEntry;
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
  }
}
