import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { modelDiff, type DiffLine } from '@/lib/workbench/agent/chatTranscript';
import { cx } from '../ui';
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
}: {
  fileName: string;
  before: string;
  after: string;
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
        <StatusChip tone='ok'>
          <Check className='h-3 w-3' aria-hidden />
          Accepted
        </StatusChip>
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
    </figure>
  );
}
