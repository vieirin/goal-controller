import type {
  ChatEntry,
  ProposalState,
} from '@/lib/workbench/agent/chatTranscript';
import { describeEntry } from '@/lib/workbench/agent/chatTranscript';
import { Button, cx } from '../ui';
import { StatusChip } from './StatusChip';

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

const SETTLED: Record<
  Exclude<ProposalState, 'pending'>,
  { label: string; tone: 'ok' | 'muted' }
> = {
  applied: { label: 'Applied', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'muted' },
  discarded: { label: 'Not applied', tone: 'muted' },
};

/**
 * Propose mode's change set: one numbered row per proposed call, its step
 * in words (a refused one's reasons, in danger), approved or rejected as a
 * whole, as one undo step.
 */
export function ProposalCard({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { changeSet, entries, state } = proposal;
  return (
    <section
      className='rounded-md border border-line-strong bg-white p-2'
      aria-label='Proposed changes'
    >
      <header className='mb-2 flex items-center gap-2 text-[13px]'>
        <span className='flex-1 font-medium text-ink'>
          {entries.length} proposed change{entries.length === 1 ? '' : 's'}
        </span>
        {state !== 'pending' && (
          <StatusChip tone={SETTLED[state].tone}>
            {SETTLED[state].label}
          </StatusChip>
        )}
      </header>
      <ol className='flex flex-col gap-1.5'>
        {entries.map((entry, i) => {
          const { refused, lines } = describeEntry(changeSet, entry);
          return (
            <li
              key={entry.toolCallId}
              className={cx(
                'flex gap-2 rounded-md border px-2 py-1.5',
                refused
                  ? 'border-danger/30 bg-danger-soft'
                  : 'border-line bg-white',
              )}
            >
              <span className='w-4 shrink-0 font-mono text-xs font-semibold text-ink'>
                {i + 1}
              </span>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='truncate font-mono text-xs font-semibold text-ink'>
                    {entry.name}
                  </span>
                  {refused && <StatusChip tone='danger'>refused</StatusChip>}
                </div>
                {lines.map((line, j) => (
                  <p
                    key={j}
                    className={cx(
                      'text-xs',
                      refused ? 'text-danger' : 'text-ink-muted',
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {state === 'pending' && (
        <div className='mt-2 flex gap-2'>
          <Button variant='primary' onClick={onApprove}>
            Approve
          </Button>
          <Button variant='outline' onClick={onReject}>
            Reject
          </Button>
        </div>
      )}
    </section>
  );
}
