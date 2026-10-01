'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  FileCode2,
  FileJson,
  History,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { isPrismEngine, type TransformEngine } from '@/lib/types';
import { hasUnsavedEdits, recentAge } from '@/lib/workbench/storage';
import type { ExampleFile } from '@/lib/workbench/types';
import { writeModelMode } from '@/lib/workbench/pistar';
import { listExamples, loadExample } from '@/services/examples';
import { useWorkbench } from './WorkbenchContext';
import { cx } from './ui';

export const useExamples = () =>
  useQuery({
    queryKey: ['examples'],
    queryFn: listExamples,
    staleTime: Infinity,
  });

const EXAMPLE_ENGINES: Record<string, TransformEngine> = {
  edge: 'edge',
  edgeV2: 'edgev2',
  sleec: 'sleec',
};

export const useOpenExample = () => {
  const { openModel } = useWorkbench();
  const [error, setError] = useState<string | null>(null);
  const open = async (example: ExampleFile) => {
    try {
      const { fileName, content } = await loadExample(example.path);
      // examples are grouped by the engine they target
      const engine = EXAMPLE_ENGINES[example.group];
      // the example's engine is recorded in it, so it opens (and reopens from Recent) for that engine
      openModel(
        fileName,
        engine ? writeModelMode(content, engine) : content,
        engine ? { settings: { engine } } : undefined,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return { open, error };
};

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className='flex w-full items-center gap-1 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-muted hover:text-ink'
      >
        <ChevronRight
          className={cx('h-3 w-3 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        {title}
      </button>
      {open && <div className='pb-2'>{children}</div>}
    </div>
  );
}

const Row = ({
  icon: Icon,
  label,
  detail,
  onClick,
  active,
  trailing,
}: {
  icon: typeof FileJson;
  label: string;
  detail?: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
}) => (
  <div
    className={cx(
      'group flex items-center gap-1 pr-1',
      active && 'bg-trace-soft',
    )}
  >
    <button
      type='button'
      onClick={onClick}
      className='flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-6 text-left text-[13px] text-ink-soft hover:text-ink'
      title={label}
    >
      <Icon className='h-3.5 w-3.5 shrink-0 text-ink-faint' aria-hidden />
      <span className='truncate'>{label}</span>
      {detail && (
        <span className='ml-auto shrink-0 pl-1 text-2xs text-ink-faint'>
          {detail}
        </span>
      )}
    </button>
    {trailing}
  </div>
);

export default function Explorer() {
  const wb = useWorkbench();
  const examples = useExamples();
  const { open: openExample, error: openExampleError } = useOpenExample();
  // the open model is already listed above
  const others = wb.recent.filter(
    (file) => !(wb.hasModel && file.fileName === wb.fileName),
  );
  // engine folder → subfolder ('' for files at the top) → files
  const groups = new Map<string, Map<string, ExampleFile[]>>();
  (examples.data ?? []).forEach((example) => {
    const slash = example.name.lastIndexOf('/');
    const folder = slash >= 0 ? example.name.slice(0, slash) : '';
    const byFolder =
      groups.get(example.group) ?? new Map<string, ExampleFile[]>();
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), example]);
    groups.set(example.group, byFolder);
  });
  const fileRow = (example: ExampleFile) => {
    const fileName = example.name.split('/').pop() ?? example.name;
    return (
      <Row
        key={example.path}
        icon={FileJson}
        label={fileName}
        onClick={() => void openExample(example)}
        active={wb.fileName === fileName}
      />
    );
  };
  const lastOutput = wb.runs.find((run) => run.output !== null);

  return (
    <nav className='h-full overflow-auto bg-panel' aria-label='Files'>
      <Section title='Workspace'>
        {wb.hasModel ? (
          <>
            <Row
              icon={FileJson}
              label={wb.fileName || 'untitled.txt'}
              detail={wb.dirty ? <span className='text-trace'>●</span> : null}
              onClick={() => wb.setModelTab('source')}
            />
            {isPrismEngine(wb.engine) && (
              <Row
                icon={SlidersHorizontal}
                label='variables'
                detail={wb.variables.length}
                onClick={() => wb.setBottomTab('variables')}
              />
            )}
            <Row
              icon={FileCode2}
              label={`output.${isPrismEngine(wb.engine) ? 'prism' : 'sleec'}`}
              detail={
                !lastOutput ? (
                  '—'
                ) : wb.stale ? (
                  <span className='text-caution'>stale</span>
                ) : null
              }
              onClick={() => wb.setOutputTab('output')}
            />
          </>
        ) : (
          <p className='px-6 text-2xs text-ink-muted'>No model open.</p>
        )}
      </Section>

      {groups.size > 0 && (
        <Section title='Examples'>
          {[...groups.entries()].map(([group, folders]) => (
            <Section key={group} title={group} defaultOpen={group === 'edgeV2'}>
              {folders.get('')?.map(fileRow)}
              {[...folders.entries()]
                .filter(([folder]) => folder !== '')
                .map(([folder, files]) => (
                  <div key={folder} className='pl-3'>
                    <Section title={folder} defaultOpen={false}>
                      {files.map(fileRow)}
                    </Section>
                  </div>
                ))}
            </Section>
          ))}
        </Section>
      )}

      {openExampleError && (
        <p className='px-3 py-2 text-2xs text-rose-700' role='alert'>
          {openExampleError}
        </p>
      )}

      {others.length > 0 && (
        <Section title='Recent'>
          {others.map((file) => (
            <Row
              key={file.fileName}
              icon={History}
              label={file.fileName}
              detail={
                hasUnsavedEdits(file) ? (
                  <span
                    className='text-trace'
                    title='Has edits that were not exported'
                  >
                    edited
                  </span>
                ) : (
                  recentAge(file.at)
                )
              }
              onClick={() =>
                wb.openModel(file.fileName, file.text, {
                  savedText: file.savedText,
                  settings: file.settings,
                })
              }
              trailing={
                <button
                  type='button'
                  aria-label={`Remove ${file.fileName} from recent`}
                  className='rounded p-0.5 text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100'
                  onClick={() => wb.forgetRecent(file.fileName)}
                >
                  <X className='h-3 w-3' aria-hidden />
                </button>
              }
            />
          ))}
        </Section>
      )}
    </nav>
  );
}
