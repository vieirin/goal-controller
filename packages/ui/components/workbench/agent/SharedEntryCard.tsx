/**
 * The entry kinds a live transcript (`AgentDrawer`'s `TranscriptEntry`) and
 * a stored, read-only one (`ReadOnlyEntry`) render the same: neither a
 * `ChatEntry` nor a `StoredChatEntry` only, so each dispatches here instead
 * of repeating the five cases.
 */
import type { SharedEntry } from '@/lib/workbench/agent/chatTranscript';
import { AssistantProse } from './AssistantProse';
import { ErrorLine } from './ErrorLine';
import { NoticeLine } from './NoticeLine';
import { ToolCallCard } from './ToolCallCard';
import { UserCard } from './UserCard';

export function SharedEntryCard({ entry }: { entry: SharedEntry }) {
  switch (entry.kind) {
    case 'user':
      return <UserCard text={entry.text} attachments={entry.attachments} />;
    case 'assistant':
      return <AssistantProse text={entry.text} />;
    case 'tool':
      return <ToolCallCard call={entry.call} />;
    case 'error':
      return <ErrorLine text={entry.text} />;
    case 'notice':
      return <NoticeLine text={entry.text} />;
  }
}
