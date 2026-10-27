import { FileText, X } from 'lucide-react';
import { cx } from '../ui';

/** an attached file's name; removable in the composer */
export function AttachmentChip({
  name,
  onRemove,
  inverted = false,
}: {
  name: string;
  onRemove?: () => void;
  /** on the user card's dark ground */
  inverted?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-mono text-2xs',
        inverted
          ? 'bg-white/15 text-white/90'
          : 'border border-line-strong bg-white text-ink-soft',
      )}
    >
      <FileText className='h-3 w-3 shrink-0' aria-hidden />
      <span className='truncate'>{name}</span>
      {onRemove && (
        <button
          type='button'
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className='-mr-1 rounded-full p-0.5 text-ink-muted hover:bg-panel-deep hover:text-ink'
        >
          <X className='h-3 w-3' aria-hidden />
        </button>
      )}
    </span>
  );
}
