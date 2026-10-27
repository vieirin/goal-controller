/**
 * A stored change set, as the live `ProposalCard` renders one, off its
 * precomputed description (`StoredChatEntry`'s 'proposal') instead of a
 * live `changeSet`: no Approve/Reject, a pending one shown as "Not applied"
 * (goal-controller#485 follow-up).
 */
import type { StoredChatEntry } from '@/lib/workbench/agent/chatTranscript';
import { ProposalEntryRow, ProposalPreview, SETTLED } from './ProposalCard';
import { StatusChip } from './StatusChip';

type StoredProposal = Extract<StoredChatEntry, { kind: 'proposal' }>;

export function ReadOnlyProposal({ proposal }: { proposal: StoredProposal }) {
  const { described, state, preview } = proposal;
  const { label, tone } =
    state === 'pending'
      ? { label: 'Not applied', tone: 'muted' as const }
      : SETTLED[state];
  return (
    <section
      className='rounded-md border border-line-strong bg-white p-2'
      aria-label='Proposed changes'
    >
      <header className='mb-2 flex items-center gap-2 text-[13px]'>
        <span className='flex-1 font-medium text-ink'>
          {described.length} proposed change{described.length === 1 ? '' : 's'}
        </span>
        <StatusChip tone={tone}>{label}</StatusChip>
      </header>
      <ol className='flex flex-col gap-1.5'>
        {described.map((entry, i) => (
          <ProposalEntryRow key={entry.toolCallId} index={i} {...entry} />
        ))}
      </ol>
      <ProposalPreview preview={preview} />
    </section>
  );
}
