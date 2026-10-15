'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  FileCode2,
  FileJson,
  History,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { isPrismEngine } from '@/lib/types';
import {
  sourceLabel,
  type ProjectIndexEntry,
  type ResourceSlot,
} from '@/lib/project';
import { resourceTabId } from '@/lib/workbench/projectResources';
import { outputExtensionOf } from '@/lib/workbench/engineDialects';
import type { RecentFile } from '@/lib/workbench/storage';
import { listExamples, openExample as readExample } from '@/services/examples';
import { useWorkbench } from './WorkbenchContext';
import { cx } from './ui';

export const useExamples = () =>
  useQuery({
    queryKey: ['examples'],
    queryFn: listExamples,
    staleTime: Infinity,
  });

/**
 * What tells a Recent entry from another of the same name: an example's, an
 * edited copy moved aside. None for a local file.
 */
export const recentOrigin = (file: RecentFile): string | null =>
  [file.source?.kind === 'github' && 'example', file.aside && 'edited copy']
    .filter(Boolean)
    .join(', ') || null;

export const useOpenExample = () => {
  const { openProject } = useWorkbench();
  const [error, setError] = useState<string | null>(null);
  // the example being fetched (its index path), until it opens or fails
  const [opening, setOpening] = useState<string | null>(null);
  /** Opens it; the file it opened as, or null when it couldn't (the error says why). */
  const open = async (example: ProjectIndexEntry): Promise<string | null> => {
    setOpening(example.path);
    try {
      const { project, settings, fileName } = await readExample(example);
      openProject(project, settings && { settings });
      setError(null);
      return fileName;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setOpening(null);
    }
  };
  return { open, error, opening };
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

/**
 * The side bar: the open project's files. It is there only while a model is
 * open; examples and Recent are the start screen's (home/Home.tsx), where
 * another project is opened.
 */
export default function Explorer() {
  return (
    <nav className='h-full overflow-auto bg-panel' aria-label='Files'>
      <ProjectSection />
    </nav>
  );
}

/** Whether this browser can open a folder as a project (File System Access). */
const canOpenFolders = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/**
 * The open project (goal-controller#25): where it is, and each project
 * resource its engine reads, with its files (each opens in its tab) or
 * "missing", and a way to add one.
 */
function ProjectSection() {
  const wb = useWorkbench();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<void>) =>
    void action().then(
      () => setError(null),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
    );
  const lastOutput = wb.lastGood;
  const outputs = wb.listing.filter((file) => file.role === 'output');
  const others = wb.listing.filter((file) => file.role === 'other');
  const variablesSlot = wb.resourceSlots.find(
    (slot) => slot.kind === 'variables',
  );
  const fileRow = (path: string) => (
    <Row
      key={path}
      icon={FileCode2}
      label={path}
      onClick={() => wb.openProjectFile(path)}
      active={wb.modelTab === resourceTabId(path)}
    />
  );
  return (
    <Section title={wb.project?.name ?? 'Project'}>
      {wb.project && (
        <p
          className='truncate px-6 text-2xs text-ink-muted'
          title={sourceLabel(wb.project.source)}
        >
          {sourceLabel(wb.project.source)}
        </p>
      )}
      {wb.resourceNotice && (
        <p className='px-6 py-1 text-2xs text-trace' role='status'>
          {wb.resourceNotice}
        </p>
      )}
      <Row
        icon={FileJson}
        label={wb.fileName || 'untitled.txt'}
        detail={wb.dirty ? <span className='text-trace'>●</span> : null}
        onClick={() => wb.setModelTab('source')}
      />
      {/* the model's variables: one row with the file their values are in, when the engine reads one */}
      {isPrismEngine(wb.engine) && !variablesSlot && (
        <Row
          icon={SlidersHorizontal}
          label='variables'
          detail={wb.variables.length}
          onClick={() => wb.setBottomTab('variables')}
        />
      )}
      {!wb.settings.pistar && (
        <Row
          icon={FileCode2}
          label={`output.${outputExtensionOf(wb.engine)}`}
          detail={
            !lastOutput ? (
              '—'
            ) : wb.stale ? (
              <span className='text-caution'>stale</span>
            ) : null
          }
          onClick={() => wb.setOutputTab('output')}
        />
      )}
      {wb.resourceSlots.map((slot) => (
        <ResourceSlotRows
          key={slot.kind}
          slot={slot}
          values={
            slot === variablesSlot && isPrismEngine(wb.engine)
              ? {
                  count: wb.variables.length,
                  open: () => wb.setBottomTab('variables'),
                }
              : undefined
          }
          onAdd={(file) => run(() => wb.addResource(slot.kind, file))}
        />
      ))}
      {outputs.length > 0 && (
        <div className='pl-3'>
          <Section title='Reference outputs' defaultOpen={false}>
            {outputs.map(({ path }) => fileRow(path))}
          </Section>
        </div>
      )}
      {others.length > 0 && (
        <div className='pl-3'>
          <Section title='Other files' defaultOpen={false}>
            {others.map(({ path }) => fileRow(path))}
          </Section>
        </div>
      )}
      <Row
        icon={History}
        label='Open another project…'
        onClick={() => wb.closeModel()}
      />
      {error && (
        <p role='alert' className='px-6 py-1 text-2xs text-danger'>
          {error}
        </p>
      )}
    </Section>
  );
}

/** Open folder…: a folder on disk as a project, from the start (Chrome, Edge). */
/**
 * Opening a folder as a project: none where this browser can't (no File
 * System Access); the error of the last try, until one succeeds.
 */
export const useOpenFolder = () => {
  const wb = useWorkbench();
  const [error, setError] = useState<string | null>(null);
  const open = canOpenFolders()
    ? () =>
        void wb.openFolder().then(
          () => setError(null),
          (err: unknown) =>
            setError(err instanceof Error ? err.message : String(err)),
        )
    : null;
  return { open, error };
};

function ResourceSlotRows({
  slot,
  values,
  onAdd,
}: {
  slot: ResourceSlot;
  /**
   * the model's values this kind holds (Edge's variables.json): how many, and
   * where they are set. Without the file they are kept in the workbench.
   */
  values?: { count: number; open: () => void };
  onAdd: (file: { name: string; text: string }) => void;
}) {
  const wb = useWorkbench();
  const input = useRef<HTMLInputElement>(null);
  const problems = wb.parsedResources[slot.kind]?.diagnostics.length ?? 0;
  return (
    <div>
      <Row
        icon={values ? SlidersHorizontal : slot.missing ? Plus : FileCode2}
        label={slot.definition.label}
        detail={
          problems ? (
            <span className='text-caution'>{problems} problems</span>
          ) : values ? (
            slot.missing ? (
              <span title='Kept in the workbench: add a file to keep them in the project'>
                {values.count} · no file
              </span>
            ) : (
              values.count
            )
          ) : slot.missing ? (
            <span title={slot.definition.help}>missing</span>
          ) : (
            slot.paths.length
          )
        }
        onClick={() =>
          // values without their file are set where the workbench keeps them
          values && slot.missing
            ? values.open()
            : // a kind no dialect declares (a seed's files) is shown, not added to
              slot.declared && (slot.missing || slot.definition.many)
              ? input.current?.click()
              : slot.paths[0] && wb.setModelTab(resourceTabId(slot.paths[0]))
        }
        trailing={
          (slot.missing && !values) || !slot.declared ? null : (
            <button
              type='button'
              aria-label={`Add a file to ${slot.definition.label}`}
              className='rounded p-0.5 text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100'
              onClick={() => input.current?.click()}
            >
              <Plus className='h-3 w-3' aria-hidden />
            </button>
          )
        }
      />
      {slot.definition.many &&
        slot.paths.map((path) => (
          <div key={path} className='pl-3'>
            <Row
              icon={FileCode2}
              label={path.split('/').pop() ?? path}
              onClick={() => wb.setModelTab(resourceTabId(path))}
              active={wb.modelTab === resourceTabId(path)}
            />
          </div>
        ))}
      <input
        ref={input}
        type='file'
        className='hidden'
        aria-label={`${slot.definition.label} file`}
        accept={slot.definition.accept?.join(',')}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onAdd({ name: file.name, text: await file.text() });
        }}
      />
    </div>
  );
}
