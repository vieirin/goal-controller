import { AlertTriangle } from 'lucide-react';
import type { Problem } from '@/lib/workbench/types';
import { cx } from '../ui';

/** problems an edit left (or a proposal would leave), errors in danger */
export function ProblemList({
  heading,
  problems,
}: {
  heading: string;
  problems: readonly Problem[];
}) {
  if (problems.length === 0) return null;
  return (
    <div
      className='border-t border-line px-2 py-1.5'
      role='group'
      aria-label={heading}
    >
      <p className='mb-0.5 flex items-center gap-1 text-2xs font-medium text-ink-soft'>
        <AlertTriangle className='h-3 w-3 text-caution' aria-hidden />
        {heading}
      </p>
      <ul className='flex flex-col gap-0.5'>
        {problems.map((problem, i) => (
          <li
            key={i}
            className={cx(
              'text-2xs',
              problem.severity === 'error' ? 'text-danger' : 'text-caution',
            )}
          >
            {problem.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
