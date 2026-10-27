import type { ReactNode } from 'react';
import type { ChipTone } from '@/lib/workbench/agent/chatTranscript';
import { cx } from '../ui';

const TONE: Record<ChipTone, string> = {
  ok: 'bg-and-soft text-and',
  caution: 'bg-caution-soft text-caution',
  danger: 'bg-danger-soft text-danger',
  muted: 'bg-panel-deep text-ink-muted',
};

/** a block's right-aligned status: a call's outcome, a diff's, a proposal's */
export function StatusChip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px font-mono text-2xs',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}
