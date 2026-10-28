'use client';

import { useWorkbench } from '../../WorkbenchContext';
import { Button, cx } from '../../ui';

/** The node-id colours a notation's lines carry, and what the agent's own marks add. */
const ENTRIES: ReadonlyArray<{ label: string; swatch: string }> = [
  { label: 'AND refinement', swatch: 'bg-and' },
  { label: 'OR refinement', swatch: 'bg-or' },
  { label: 'Task', swatch: 'bg-task' },
  { label: 'Added', swatch: 'bg-added' },
];

/**
 * Pinned under a notation editor (goal-controller#415's mock): the AND/OR/Task
 * id colours, and the agent's own "Added" mark (EDITED rows share OR's amber,
 * so it isn't repeated here). "Clear" drops every run's `agentChanges` so far.
 */
export default function AgentChangeLegend() {
  const wb = useWorkbench();
  const hasChanges =
    wb.agentChanges.added.size > 0 || wb.agentChanges.edited.size > 0;
  return (
    <div
      className={cx(
        'flex shrink-0 items-center gap-4 border-t border-line bg-panel px-3 py-1.5 text-2xs text-ink-muted',
      )}
    >
      {ENTRIES.map(({ label, swatch }) => (
        <span key={label} className='flex items-center gap-1.5'>
          <span className={cx('h-2.5 w-2.5 rounded-sm', swatch)} />
          {label}
        </span>
      ))}
      {hasChanges && (
        <Button
          variant='quiet'
          className='ml-auto'
          onClick={() => wb.clearAgentChanges()}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
