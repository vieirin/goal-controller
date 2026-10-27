/**
 * A model's earlier conversation (goal-controller#485 follow-up), as it was
 * left before this reopening: the live transcript's own cards, off a
 * `StoredChatEntry` instead of a `ChatEntry`, so nothing here can be acted
 * on. A 'diff' shows no problems (the model has since moved on; they were
 * the live run's own) and no Undo.
 */
import type { StoredChatEntry } from '@/lib/workbench/agent/chatTranscript';
import { DiffCard } from './DiffCard';
import { ReadOnlyProposal } from './ReadOnlyProposal';
import { SharedEntryCard } from './SharedEntryCard';

export function ReadOnlyEntry({ entry }: { entry: StoredChatEntry }) {
  switch (entry.kind) {
    case 'diff':
      return (
        <DiffCard
          fileName={entry.fileName}
          before={entry.before}
          after={entry.after}
          status={entry.undone ? 'undone' : 'accepted'}
        />
      );
    case 'proposal':
      return <ReadOnlyProposal proposal={entry} />;
    default:
      return <SharedEntryCard entry={entry} />;
  }
}
