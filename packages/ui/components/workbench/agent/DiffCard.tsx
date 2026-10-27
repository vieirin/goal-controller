import { useMemo } from 'react';
import { Check, Undo2 } from 'lucide-react';
import type { Problem } from '@/lib/workbench/types';
import { modelDiff, type DiffLine } from '@/lib/workbench/agent/chatTranscript';
import { Button, cx } from '../ui';
import { ProblemList } from './ProblemList';
import { StatusChip } from './StatusChip';

const ROW: Record<DiffLine['kind'], string> = {
  add: 'bg-and-soft text-ink',
  remove: 'bg-danger-soft text-ink',
  context: 'text-ink-soft',
  hunk: 'bg-panel text-ink-faint',
};

const GUTTER: Record<DiffLine['kind'], { mark: string; className: string }> = {
  add: { mark: '+', className: 'text-and' },
  remove: { mark: '-', className: 'text-danger' },
  context: { mark: ' ', className: '' },
  hunk: { mark: ' ', className: '' },
};

/** an applied edit: the model's JSON text before and after it, as a unified diff */
export function DiffCard({
  fileName,
  before,
  after,
  status = 'accepted',
  problems = [],
  onUndo,
}: {
  fileName: string;
  before: string;
  after: string;
  /** an applied edit's, or undone since; a proposal's preview */
  status?: 'accepted' | 'undone' | 'preview';
  /** what the edit left (would leave) in the model */
  problems?: readonly Problem[];
  /** the edit undone: only while it is the model's latest */
  onUndo?: () => void;
}) {
  const { added, removed, lines } = useMemo(
    () => modelDiff(before, after),
    [before, after],
  );
  return (
    <figure
      className='overflow-hidden rounded-md border border-line bg-white'
      aria-label={`Changes to ${fileName}`}
    >
      <figcaption className='flex items-center gap-2 border-b border-line px-2 py-1.5 font-mono text-xs'>
        <span className='min-w-0 truncate font-semibold text-ink'>
          {fileName}
        </span>
        <span className='text-and'>+{added}</span>
        <span className='text-danger'>−{removed}</span>
        <span className='flex-1' />
        {onUndo && (
          <Button
            variant='quiet'
            className='h-5 px-1.5 text-2xs'
            onClick={onUndo}
          >
            <Undo2 className='h-3 w-3' aria-hidden />
            Undo
          </Button>
        )}
        {status === 'accepted' && (
          <StatusChip tone='ok'>
            <Check className='h-3 w-3' aria-hidden />
            Accepted
          </StatusChip>
        )}
        {status === 'undone' && <StatusChip tone='muted'>Undone</StatusChip>}
        {status === 'preview' && <StatusChip tone='muted'>Preview</StatusChip>}
      </figcaption>
      <div className='max-h-80 overflow-auto'>
        <div className='min-w-max py-1 font-mono text-2xs'>
          {lines.map((line, i) => (
            <div
              key={i}
              data-kind={line.kind}
              className={cx('flex pr-3', ROW[line.kind])}
            >
              <span
                className={cx(
                  'w-5 shrink-0 select-none text-center',
                  GUTTER[line.kind].className,
                )}
                aria-hidden
              >
                {GUTTER[line.kind].mark}
              </span>
              <span className='whitespace-pre'>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
      <ProblemList
        heading={
          status === 'preview'
            ? 'It would leave these problems'
            : 'It left these problems'
        }
        problems={problems}
      />
    </figure>
  );
}
