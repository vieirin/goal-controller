'use client';

import { useQuery } from '@tanstack/react-query';
import {
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  hasUnsavedEdits,
  recentAge,
  recentId,
  type ProjectIndexEntry,
} from '@/lib/project';
import { declarationsOf } from '@/lib/workbench/projectResources';
import type { RecentFile } from '@/lib/workbench/storage';
import { thumbnailOfText, type Thumbnail } from '@/lib/workbench/thumbnail';
import { exampleMode, listExamplePreviews } from '@/services/examples';
import { recentOrigin, useExamples, useOpenFolder } from '../Explorer';
import { useOpenFile } from '../TopBar';
import { useWorkbench } from '../WorkbenchContext';
import { Button, Kbd, cx } from '../ui';
import { useExampleRoute } from './exampleRoute';
import { SECTION_REFERENCES, type Reference } from './references';
import { modeLabel, modelKindLabel } from './labels';
import ModelThumbnail from './ModelThumbnail';

/** The engines' sections, in this order; a folder not listed comes after, by its name. */
const GROUP_ORDER = [
  'edgeV2',
  'edge',
  'goda',
  'mutrose',
  'grl',
  'tropos4as',
  'sleec',
  'pistar-ext',
];

const useExamplePreviews = () =>
  useQuery({
    queryKey: ['example-previews'],
    queryFn: listExamplePreviews,
    staleTime: Infinity,
  });

/** Matches a search: every word somewhere in the text, in any case. */
const matches = (query: string, ...texts: (string | undefined)[]) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = texts.join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
};

/** The examples by engine folder, in the order the sections are shown. */
const sectionsOf = (examples: readonly ProjectIndexEntry[]) => {
  const groups = new Map<string, ProjectIndexEntry[]>();
  for (const example of examples)
    groups.set(example.group, [...(groups.get(example.group) ?? []), example]);
  const rank = (group: string) =>
    GROUP_ORDER.includes(group)
      ? GROUP_ORDER.indexOf(group)
      : GROUP_ORDER.length;
  return [...groups.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
  );
};

/**
 * The start screen: open or draw a model, pick up a recent one, or start from
 * an example, each a card showing its model, in a section per engine. An
 * example that reads files beside its model is a project, shown with them.
 */
export default function Home({ onNewModel }: { onNewModel: () => void }) {
  const wb = useWorkbench();
  const { open, input } = useOpenFile();
  const examples = useExamples();
  const previews = useExamplePreviews();
  // an example opens on a page of its own: back is this screen again
  const {
    show: openExample,
    error: openExampleError,
    opening,
  } = useExampleRoute();
  const folder = useOpenFolder();
  const [query, setQuery] = useState('');

  const recent = wb.recent.filter((file) => matches(query, file.fileName));
  const sections = sectionsOf(
    (examples.data ?? []).filter((example) =>
      matches(
        query,
        example.name,
        example.group,
        modeLabel(exampleMode(example)),
      ),
    ),
  );
  const nothing = query && recent.length === 0 && sections.length === 0;

  return (
    <section
      className='h-full overflow-auto bg-white'
      aria-label='Open a goal model'
    >
      {input}
      <header className='sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur'>
        <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4'>
          <div className='mr-auto min-w-0'>
            <h1 className='text-lg font-semibold text-ink'>Goal models</h1>
            <p className='text-2xs text-ink-muted'>
              A piStar model (<span className='font-mono'>.txt</span> or{' '}
              <span className='font-mono'>.json</span>) or a project archive (
              <span className='font-mono'>.tar.gz</span> or{' '}
              <span className='font-mono'>.zip</span>): drop it anywhere on this
              window, open it from disk, or draw a new one.
            </p>
          </div>
          <label className='relative flex items-center'>
            <span className='sr-only'>Search models and examples</span>
            <Search
              className='pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-faint'
              aria-hidden
            />
            <input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search'
              className='h-8 w-44 rounded-md border border-line bg-panel pl-8 pr-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-trace focus:bg-white focus:outline-none'
            />
          </label>
          <Button variant='outline' onClick={open}>
            <FileText className='h-4 w-4' aria-hidden /> Open file…
          </Button>
          {folder.open && (
            <Button
              variant='outline'
              onClick={folder.open}
              title='Open a folder as a project'
            >
              <FolderOpen className='h-4 w-4' aria-hidden /> Open folder…
            </Button>
          )}
          <Button variant='primary' onClick={onNewModel}>
            <FilePlus2 className='h-4 w-4' aria-hidden /> New model
          </Button>
        </div>
      </header>

      <div className='mx-auto max-w-6xl space-y-8 px-6 py-6'>
        {recent.length > 0 && (
          <CardSection title='Recent' count={recent.length}>
            {recent.map((file) => (
              <RecentCard key={recentId(file)} file={file} />
            ))}
          </CardSection>
        )}

        {folder.error && (
          <p
            className='rounded-md bg-danger-soft px-3 py-2 text-2xs text-danger'
            role='alert'
          >
            {folder.error}
          </p>
        )}
        {openExampleError && (
          <p
            className='rounded-md bg-danger-soft px-3 py-2 text-2xs text-danger'
            role='alert'
          >
            {openExampleError}
          </p>
        )}
        {sections.map(([group, entries]) => (
          <CardSection
            key={group}
            title={modeLabel(exampleMode(entries[0]!)) ?? group}
            detail={group}
            count={entries.length}
            references={SECTION_REFERENCES[group]}
          >
            {entries.map((example) => (
              <ExampleCard
                key={example.path}
                example={example}
                preview={previews.data?.[example.path]}
                opening={opening === example.path}
                onOpen={() => openExample(example)}
              />
            ))}
          </CardSection>
        ))}
        {nothing && (
          <p className='py-12 text-center text-[13px] text-ink-muted'>
            Nothing matches “{query}”.
          </p>
        )}

        <p className='text-2xs text-ink-muted'>
          <Kbd>⌘↵</Kbd> generate · <Kbd>⇧⌘E</Kbd> full-screen model ·{' '}
          <Kbd>⌘S</Kbd> export · <Kbd>⌘B</Kbd> side bar
        </p>
      </div>
    </section>
  );
}

function CardSection({
  title,
  detail,
  count,
  references,
  children,
}: {
  title: string;
  /** beside the title: the examples' folder */
  detail?: string;
  count: number;
  /** under the cards: what the engine and its examples rest on */
  references?: readonly Reference[];
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className='space-y-3'>
      <h2 className='flex items-baseline gap-2'>
        <span className='text-[13px] font-semibold text-ink'>{title}</span>
        {detail && detail !== title && (
          <span className='font-mono text-2xs text-ink-faint'>{detail}/</span>
        )}
        <span className='text-2xs text-ink-faint'>{count}</span>
      </h2>
      <ul className='grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-4'>
        {children}
      </ul>
      {references && references.length > 0 && (
        <References references={references} />
      )}
    </section>
  );
}

/** A section's references: the engine's, then the sources of its examples. */
function References({ references }: { references: readonly Reference[] }) {
  return (
    <div className='border-t border-line pt-2'>
      <h3 className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
        References
      </h3>
      <ol className='mt-1 list-decimal space-y-0.5 pl-5 text-2xs text-ink-muted marker:text-ink-faint'>
        {references.map((reference) => (
          <li key={reference.text}>
            {reference.url ? (
              <a
                href={reference.url}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-ink hover:underline'
              >
                {reference.text}
              </a>
            ) : (
              reference.text
            )}
            {reference.examples && (
              <span className='text-ink-faint'>
                {' '}
                — source of{' '}
                {reference.examples
                  .map((path) => path.split('/').pop())
                  .join(', ')}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A card: the model drawn, its name, and what it is under it. */
function Card({
  thumbnail,
  title,
  prefix,
  badge,
  meta,
  onOpen,
  busy = false,
  label,
  trailing,
}: {
  thumbnail: Thumbnail | null;
  title: string;
  /** before the title, quieter: its folder */
  prefix?: string;
  /** over the drawing's corner: a project's folder */
  badge?: ReactNode;
  meta: ReactNode;
  onOpen: () => void;
  busy?: boolean;
  /** what the card's button is announced as */
  label: string;
  /** over the card, top right (a remove button) */
  trailing?: ReactNode;
}) {
  return (
    <li className='group relative flex'>
      <button
        type='button'
        onClick={onOpen}
        disabled={busy}
        aria-label={label}
        aria-busy={busy}
        className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-line-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trace disabled:cursor-progress'
      >
        {/* the drawing fills a fixed frame: never sized by the model it shows */}
        <div className='relative aspect-[4/3] w-full shrink-0 border-b border-line bg-panel'>
          <div className='absolute inset-2'>
            <ModelThumbnail thumbnail={thumbnail} />
          </div>
          {badge && <div className='absolute left-2 top-2'>{badge}</div>}
          {busy && (
            <div className='absolute inset-0 grid place-items-center bg-white/60'>
              <Loader2
                className='h-5 w-5 animate-spin text-trace'
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className='flex w-full min-w-0 flex-1 flex-col gap-1 px-3 py-2'>
          <p
            className='truncate text-[13px] text-ink'
            title={`${prefix ?? ''}${title}`}
          >
            {prefix && <span className='text-ink-faint'>{prefix}</span>}
            {title}
          </p>
          <div className='flex min-w-0 flex-wrap items-center gap-1 text-2xs text-ink-muted'>
            {meta}
          </div>
        </div>
      </button>
      {trailing}
    </li>
  );
}

const Chip = ({
  children,
  tone = 'quiet',
  title,
}: {
  children: ReactNode;
  tone?: 'quiet' | 'trace';
  title?: string;
}) => (
  <span
    title={title}
    className={cx(
      'shrink-0 rounded border px-1',
      tone === 'trace'
        ? 'border-trace/30 text-trace'
        : 'border-line text-ink-muted',
    )}
  >
    {children}
  </span>
);

function ExampleCard({
  example,
  preview,
  opening,
  onOpen,
}: {
  example: ProjectIndexEntry;
  preview: unknown;
  opening: boolean;
  onOpen: () => void;
}) {
  const mode = exampleMode(example);
  const thumbnail = useMemo(
    () =>
      preview ? thumbnailOfText(JSON.stringify(preview), mode ?? null) : null,
    [preview, mode],
  );
  const slash = example.name.lastIndexOf('/');
  const prefix = slash >= 0 ? example.name.slice(0, slash + 1) : undefined;
  const title = example.name.slice(slash + 1);
  const project = example.form === 'file';
  // a project's fixtures: the resources its engine reads, as the engine names them
  const declarations = declarationsOf(mode ?? null);
  const fixtures = Object.keys(example.projectResources).map(
    (kind) => declarations?.[kind]?.label ?? kind,
  );
  const reference = example.files.some((file) => file.startsWith('reference/'));
  return (
    <Card
      thumbnail={thumbnail}
      title={title}
      prefix={prefix}
      label={`Open the ${example.group} example ${example.name}${project ? ', a project' : ''}`}
      busy={opening}
      onOpen={onOpen}
      badge={
        project && (
          <span className='flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-2xs text-ink-soft shadow-sm'>
            <Folder className='h-3 w-3' aria-hidden /> Project
          </span>
        )
      }
      meta={
        project ? (
          <>
            <span className='mr-0.5'>{example.files.length} files</span>
            {fixtures.map((fixture) => (
              <Chip key={fixture}>{fixture}</Chip>
            ))}
            {reference && (
              <Chip title='Reference outputs to compare with'>reference</Chip>
            )}
          </>
        ) : (
          <span className='flex items-center gap-1'>
            <FileText className='h-3 w-3' aria-hidden /> Model
          </span>
        )
      }
    />
  );
}

function RecentCard({ file }: { file: RecentFile }) {
  const wb = useWorkbench();
  const thumbnail = useMemo(() => thumbnailOfText(file.text), [file.text]);
  const origin = recentOrigin(file);
  return (
    <Card
      thumbnail={thumbnail}
      title={file.fileName}
      label={`Open ${file.fileName}`}
      onOpen={() => void wb.openRecent(file)}
      meta={
        <>
          {origin && <span>{origin}</span>}
          {hasUnsavedEdits(file) && (
            <span
              className='rounded bg-trace/10 px-1 text-trace'
              title='Has edits that were not exported'
            >
              edited
            </span>
          )}
          {file.settings && (
            <Chip
              tone={file.settings.pistar ? 'trace' : 'quiet'}
              title={
                file.settings.pistar
                  ? 'Modelled freely in piStar mode'
                  : 'Target engine'
              }
            >
              {modelKindLabel(file.settings)}
            </Chip>
          )}
          <span className='ml-auto'>{recentAge(file.at)}</span>
        </>
      }
      trailing={
        <button
          type='button'
          aria-label={`Remove ${file.fileName} from recent`}
          onClick={() => wb.forgetRecent(recentId(file))}
          className='absolute right-2 top-2 rounded bg-white/90 p-1 text-ink-faint shadow-sm hover:text-ink sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100'
        >
          <X className='h-3.5 w-3.5' aria-hidden />
        </button>
      }
    />
  );
}
