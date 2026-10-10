'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  FileCode2,
  FileJson,
  FolderOpen,
  History,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { isPrismEngine } from '@/lib/types';
import {
  hasUnsavedEdits,
  recentAge,
  recentId,
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
  const open = async (example: ProjectIndexEntry) => {
    try {
      const { project, settings } = await readExample(example);
      openProject(project, settings && { settings });
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
  // engine folder → subfolder ('' for files at the top) → files
  const groups = new Map<string, Map<string, ProjectIndexEntry[]>>();
  (examples.data ?? []).forEach((example) => {
    const slash = example.name.lastIndexOf('/');
    const folder = slash >= 0 ? example.name.slice(0, slash) : '';
    const byFolder =
      groups.get(example.group) ?? new Map<string, ProjectIndexEntry[]>();
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), example]);
    groups.set(example.group, byFolder);
  });
  const fileRow = (example: ProjectIndexEntry) => {
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
  // an open project is its own tree: its files only (examples and Recent are the
  // start screen's, where another project is opened)
  if (wb.hasModel)
    return (
      <nav className='h-full overflow-auto bg-panel' aria-label='Files'>
        <ProjectSection />
      </nav>
    );

  return (
    <nav className='h-full overflow-auto bg-panel' aria-label='Files'>
      <Section title='Workspace'>
        <p className='px-6 text-2xs text-ink-muted'>No model open.</p>
        <OpenFolderRow />
      </Section>

      {groups.size > 0 && (
        <Section title='Examples'>
          {openExampleError && (
            <p role='alert' className='px-6 py-1 text-2xs text-danger'>
              {openExampleError}
            </p>
          )}
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

      {wb.recent.length > 0 && (
        <Section title='Recent'>
          {wb.recent.map((file) => (
            <Row
              key={recentId(file)}
              icon={History}
              label={
                recentOrigin(file)
                  ? `${file.fileName} (${recentOrigin(file)})`
                  : file.fileName
              }
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
              onClick={() => void wb.openRecent(file)}
              trailing={
                <button
                  type='button'
                  aria-label={`Remove ${file.fileName} from recent`}
                  className='rounded p-0.5 text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100'
                  onClick={() => wb.forgetRecent(recentId(file))}
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
      {isPrismEngine(wb.engine) && (
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
function OpenFolderRow() {
  const wb = useWorkbench();
  const [error, setError] = useState<string | null>(null);
  if (!canOpenFolders()) return null;
  return (
    <>
      <Row
        icon={FolderOpen}
        label='Open folder…'
        onClick={() =>
          void wb.openFolder().then(
            () => setError(null),
            (err: unknown) =>
              setError(err instanceof Error ? err.message : String(err)),
          )
        }
      />
      {error && (
        <p role='alert' className='px-6 py-1 text-2xs text-danger'>
          {error}
        </p>
      )}
    </>
  );
}

function ResourceSlotRows({
  slot,
  onAdd,
}: {
  slot: ResourceSlot;
  onAdd: (file: { name: string; text: string }) => void;
}) {
  const wb = useWorkbench();
  const input = useRef<HTMLInputElement>(null);
  const problems = wb.parsedResources[slot.kind]?.diagnostics.length ?? 0;
  return (
    <div>
      <Row
        icon={slot.missing ? Plus : FileCode2}
        label={slot.definition.label}
        detail={
          slot.missing ? (
            <span title={slot.definition.help}>missing</span>
          ) : problems ? (
            <span className='text-caution'>{problems} problems</span>
          ) : (
            slot.paths.length
          )
        }
        onClick={() =>
          // a kind no dialect declares (a seed's files) is shown, not added to
          slot.declared && (slot.missing || slot.definition.many)
            ? input.current?.click()
            : slot.paths[0] && wb.setModelTab(resourceTabId(slot.paths[0]))
        }
        trailing={
          slot.missing || !slot.declared ? null : (
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
