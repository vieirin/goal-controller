import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type {
  ChatEntry,
  ChipTone,
  ProposalState,
} from '@/lib/workbench/agent/chatTranscript';
import { describeEntry } from '@/lib/workbench/agent/chatTranscript';
import { Button, cx } from '../ui';
import { DiffCard } from './DiffCard';
import { ProblemList } from './ProblemList';
import { StatusChip } from './StatusChip';

type Proposal = Extract<ChatEntry, { kind: 'proposal' }>;

/** a settled proposal's chip (`ReadOnlyProposal` reads this too, for a stored one) */
export const SETTLED: Record<
  Exclude<ProposalState, 'pending'>,
  { label: string; tone: ChipTone }
> = {
  applied: { label: 'Applied', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'muted' },
  discarded: { label: 'Not applied', tone: 'muted' },
  revised: { label: 'Sent back', tone: 'caution' },
};

/** one numbered row of a change set: its step in words, a refused one's reasons in danger */
export function ProposalEntryRow({
  index,
  toolCallId,
  name,
  refused,
  lines,
}: {
  index: number;
  toolCallId: string;
  name: string;
  refused: boolean;
  lines: readonly string[];
}) {
  return (
    <li
      key={toolCallId}
      className={cx(
        'flex gap-2 rounded-md border px-2 py-1.5',
        refused ? 'border-danger/30 bg-danger-soft' : 'border-line bg-white',
      )}
    >
      <span className='w-4 shrink-0 font-mono text-xs font-semibold text-ink'>
        {index + 1}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate font-mono text-xs font-semibold text-ink'>
            {name}
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
}

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
        {entries.map((entry, i) => (
          <ProposalEntryRow
            key={entry.toolCallId}
            index={i}
            toolCallId={entry.toolCallId}
            name={entry.name}
            {...describeEntry(changeSet, entry)}
          />
        ))}
      </ol>
      <ProposalPreview preview={proposal.preview} />
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

/**
 * What the change set would do to the model: the problems it would leave,
 * always; its diff, on demand. `ReadOnlyProposal` reads a stored one's
 * `preview` through this too.
 */
export function ProposalPreview({ preview }: { preview: Proposal['preview'] }) {
  const [open, setOpen] = useState(false);
  if (!preview.ok)
    return (
      <p className='mt-2 text-2xs text-ink-muted'>
        No preview: {preview.message}
      </p>
    );
  return (
    <div className='mt-2 flex flex-col gap-1.5'>
      {preview.problems.length > 0 && (
        <div className='rounded-md border border-line'>
          <ProblemList
            heading='It would leave these problems'
            problems={preview.problems}
          />
        </div>
      )}
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className='flex items-center gap-1 self-start text-2xs font-medium text-ink-soft hover:text-ink'
      >
        <ChevronRight
          className={cx('h-3 w-3 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        Preview the model after it
      </button>
      {open && (
        <DiffCard
          fileName={preview.fileName}
          before={preview.before}
          after={preview.after}
          status='preview'
        />
      )}
    </div>
  );
}
