import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { TranscriptToolCall } from '@istar-ts/agent';
import {
  argsSummary,
  flatTable,
  toolCallChip,
} from '@/lib/workbench/agent/chatTranscript';
import { cx } from '../ui';
import { ResultTable } from './ResultTable';
import { StatusChip } from './StatusChip';

/**
 * A tool call, collapsed to its name, arguments and outcome; open, its
 * result (a refusal's diagnostics), as a table when it is a list of flat
 * objects, else as JSON.
 */
export function ToolCallCard({ call }: { call: TranscriptToolCall }) {
  const [open, setOpen] = useState(false);
  const chip = toolCallChip(call);
  const { result } = call;
  const shown = result.ok
    ? result.content
    : { diagnostics: result.diagnostics };
  const table = result.ok ? flatTable(result.content) : undefined;
  return (
    <div className='rounded-md border border-line bg-white'>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className='flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs hover:bg-panel'
      >
        <ChevronRight
          className={cx(
            'h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <span className='shrink-0 font-semibold text-trace'>{call.name}</span>
        <span className='min-w-0 flex-1 truncate text-ink-muted'>
          {argsSummary(call.args)}
        </span>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </button>
      {open && (
        <div className='border-t border-line bg-panel px-2 py-1.5'>
          {table ? (
            <ResultTable {...table} />
          ) : (
            <pre className='overflow-x-auto whitespace-pre font-mono text-2xs text-ink-soft'>
              {JSON.stringify(shown, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
