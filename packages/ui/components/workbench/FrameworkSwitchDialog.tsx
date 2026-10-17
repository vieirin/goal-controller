'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { FRAMEWORK_LABEL } from '@/lib/workbench/frameworks';
import { useWorkbench } from './WorkbenchContext';
import { Button, IconButton } from './ui';

/**
 * A model file of another framework than the open project's
 * (goal-controller#171): why it can't open as it is (conformity's message),
 * and the choice, as for a conversion: switch the project to its framework
 * and open it, or keep the project as it is.
 */
export default function FrameworkSwitchDialog() {
  const wb = useWorkbench();
  const pending = wb.frameworkSwitch;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') wb.cancelFrameworkSwitch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wb]);
  if (!pending) return null;
  const to = FRAMEWORK_LABEL[pending.framework];
  return (
    <div className='fixed inset-0 z-50 flex justify-center bg-white sm:items-center sm:bg-ink/30 sm:p-6'>
      <div
        role='alertdialog'
        aria-modal='true'
        aria-labelledby='framework-switch-title'
        aria-describedby='framework-switch-message'
        className='flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-w-md sm:rounded-xl sm:shadow-2xl'
      >
        <header className='flex items-start gap-3 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4'>
          <div className='min-w-0 flex-1'>
            <h2
              id='framework-switch-title'
              className='text-[15px] font-semibold text-ink'
            >
              {pending.fileName} is a {to} model
            </h2>
          </div>
          <IconButton
            icon={X}
            label='Keep the open project'
            onClick={wb.cancelFrameworkSwitch}
          />
        </header>
        <div className='space-y-2 px-4 py-4 text-[13px] text-ink-soft sm:px-5'>
          <p id='framework-switch-message'>{pending.message}.</p>
          <p>
            Opening it closes the open {FRAMEWORK_LABEL[pending.project]} model
            (it stays in Recent) and works in {to} from now on.
          </p>
        </div>
        <footer className='flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-5'>
          <Button variant='outline' onClick={wb.cancelFrameworkSwitch}>
            Keep the project
          </Button>
          <Button
            variant='primary'
            onClick={() => void wb.confirmFrameworkSwitch()}
          >
            Switch to {to}
          </Button>
        </footer>
      </div>
    </div>
  );
}
