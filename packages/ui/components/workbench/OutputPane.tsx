'use client';

import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  ListTree,
  Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GoalView, ViewKind } from '@goal-controller/goal-tree';
import {
  outputExtensionOf,
  outputLabelOf,
  outputLanguageOf,
} from '@/lib/workbench/engineDialects';
import { setLineMarks, type LineMark } from '@/lib/workbench/codemirror';
import { baseName, downloadText } from '@/lib/workbench/download';
import { lineOwner, type OutlineEntry } from '@/lib/workbench/trace';
import CodeEditor from './CodeEditor';
import {
  useSelection,
  useWorkbench,
  type OutputTab,
  type Run,
} from './WorkbenchContext';
import { Button, IconButton, Kbd, Menu, MenuItem, Tabs, cx } from './ui';

const time = (at: number): string =>
  new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function OutputPane() {
  const wb = useWorkbench();
  const lastGood = wb.runs.find((run) => run.output !== null) ?? null;
  const tabs: Array<{ id: OutputTab; label: string }> = [
    { id: 'output', label: outputLabelOf(wb.engine) },
    { id: 'diff', label: 'Diff' },
    { id: 'report', label: 'Report' },
  ];
  return (
    <section
      className='flex h-full min-h-0 flex-col bg-white'
      aria-label='Generated output'
    >
      <Tabs
        label='Output views'
        tabs={tabs}
        value={wb.outputTab}
        onChange={wb.setOutputTab}
        trailing={<OutputActions run={lastGood} />}
      />
      <Freshness />
      <div className='min-h-0 flex-1'>
        {!wb.hasModel ? (
          <Empty>Open a goal model to generate its specification.</Empty>
        ) : !lastGood ? (
          wb.generating ? (
            <Empty>
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden />{' '}
              Generating…
            </Empty>
          ) : (
            <Empty>
              Press <Kbd>⌘↵</Kbd> to generate
              {wb.live
                ? ', or edit the model — Live regenerates on every change'
                : ''}
              .
            </Empty>
          )
        ) : wb.outputTab === 'output' ? (
          <TracedOutput output={lastGood.output ?? ''} />
        ) : wb.outputTab === 'diff' ? (
          <DiffView />
        ) : (
          <ReportView run={lastGood} />
        )}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-full items-center justify-center gap-2 p-6 text-center text-sm text-ink-muted'>
      {children}
    </div>
  );
}

/** One line saying whether the output matches the model. */
function Freshness() {
  const { current, stale, generating, live } = useWorkbench();
  if (!current && !generating) return null;
  let tone = 'text-ink-muted';
  let text: React.ReactNode;
  if (generating) {
    text = (
      <>
        <Loader2 className='h-3 w-3 animate-spin' aria-hidden /> Generating…
      </>
    );
  } else if (current?.error) {
    tone = 'bg-danger-soft text-danger';
    text = (
      <>
        <AlertTriangle className='h-3 w-3' aria-hidden /> Generation failed at{' '}
        {time(current.at)} — showing the last successful output. See Problems.
      </>
    );
  } else if (stale) {
    tone = 'bg-caution-soft text-caution';
    text = live ? (
      'Model changed — regenerating…'
    ) : (
      <>
        Model changed since {time(current!.at)} — press <Kbd>⌘↵</Kbd> to
        regenerate.
      </>
    );
  } else if (current) {
    text = (
      <>
        <Check className='h-3 w-3 text-and' aria-hidden /> Up to date ·
        generated {time(current.at)} in {(current.durationMs / 1000).toFixed(2)}{' '}
        s · {(current.output ?? '').split('\n').length} lines
      </>
    );
  }
  return (
    <div
      className={cx(
        'flex items-center gap-1.5 border-b border-line px-3 py-1 text-2xs',
        tone,
      )}
    >
      {text}
    </div>
  );
}

const OUTLINE_SECTIONS: Array<{ kind: ViewKind; title: string }> = [
  { kind: 'goal', title: 'Goals' },
  { kind: 'task', title: 'Tasks' },
  { kind: 'resource', title: 'Resources' },
  { kind: 'quality', title: 'Qualities' },
];

const byId = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });

/** Outline entries by the kind of node they belong to, ids in numeric order (G2 before G10). */
const outlineSections = (
  outline: OutlineEntry[],
  tree: GoalView | null,
): Array<{
  title: string;
  entries: Array<{ entry: OutlineEntry; name: string | null }>;
}> => {
  const nodeOf = (entry: OutlineEntry) =>
    entry.owner ? tree?.nodes.get(entry.owner) : undefined;
  const sections = OUTLINE_SECTIONS.map(({ kind, title }) => ({
    title,
    entries: outline
      .filter((entry) => nodeOf(entry)?.kind === kind)
      .sort((a, b) => byId(a.owner ?? '', b.owner ?? '') || a.line - b.line)
      .map((entry) => ({ entry, name: nodeOf(entry)?.name ?? null })),
  }));
  // modules and reward structures not tied to a node, in file order
  const other = outline
    .filter((entry) => !nodeOf(entry))
    .map((entry) => ({ entry, name: null }));
  return [...sections, { title: 'Other', entries: other }].filter(
    (section) => section.entries.length > 0,
  );
};

/** Outline sections; each node can be expanded to list its direct children. */
function OutlineList({
  outline,
  onDone,
}: {
  outline: OutlineEntry[];
  onDone: () => void;
}) {
  const wb = useWorkbench();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // first module of each node, for jumping to a child
  const lineOf = new Map<string, number>();
  for (const entry of outline)
    if (entry.owner && !lineOf.has(entry.owner))
      lineOf.set(entry.owner, entry.line);

  const jump = (line: number | undefined, owner: string | null) => {
    if (line)
      window.dispatchEvent(
        new CustomEvent('workbench:output-line', { detail: line }),
      );
    if (owner) wb.select(owner, 'output');
    onDone();
  };

  return (
    <div className='max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden'>
      {outlineSections(outline, wb.tree).map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className='sticky top-0 z-10 flex items-center justify-between bg-white px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
            {section.title}
            <span className='font-normal normal-case tracking-normal text-ink-faint'>
              {section.entries.length}
            </span>
          </h3>
          {section.entries.map(({ entry, name }) => {
            const children = entry.owner
              ? (wb.tree?.nodes.get(entry.owner)?.children ?? [])
              : [];
            const open = !!entry.owner && expanded.has(entry.owner);
            return (
              <div key={`${entry.label}-${entry.line}`}>
                <div className='flex items-center'>
                  {children.length > 0 && entry.owner ? (
                    <button
                      type='button'
                      aria-expanded={open}
                      aria-label={`${open ? 'Hide' : 'Show'} the children of ${entry.owner}`}
                      onClick={() => toggle(entry.owner as string)}
                      className='grid h-6 w-5 shrink-0 place-items-center rounded text-ink-faint hover:bg-panel hover:text-ink'
                    >
                      <ChevronRight
                        className={cx(
                          'h-3.5 w-3.5 transition-transform',
                          open && 'rotate-90',
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <span className='w-5 shrink-0' aria-hidden />
                  )}
                  <div className='min-w-0 flex-1'>
                    <MenuItem
                      hint={`L${entry.line}`}
                      onClick={() => jump(entry.line, entry.owner)}
                    >
                      <span className='flex min-w-0 items-baseline gap-2'>
                        <span className='shrink-0 font-mono text-xs'>
                          {entry.owner ?? entry.label}
                        </span>
                        {name && (
                          <span className='truncate text-xs text-ink-muted'>
                            {name}
                          </span>
                        )}
                      </span>
                    </MenuItem>
                  </div>
                </div>
                {open && (
                  <ul className='mb-1 ml-[1.1rem] border-l border-line pl-2'>
                    {children.map((id) => {
                      const child = wb.tree?.nodes.get(id);
                      const line = lineOf.get(id);
                      return (
                        <li key={id}>
                          <MenuItem
                            hint={line ? `L${line}` : undefined}
                            onClick={() => jump(line, id)}
                          >
                            <span className='flex min-w-0 items-baseline gap-2'>
                              <span className='shrink-0 font-mono text-xs text-ink-soft'>
                                {id}
                              </span>
                              {child && (
                                <span className='truncate text-xs text-ink-muted'>
                                  {child.name}
                                </span>
                              )}
                            </span>
                          </MenuItem>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function OutputActions({ run }: { run: Run | null }) {
  const wb = useWorkbench();
  const [copied, setCopied] = useState(false);
  if (!run?.output) return null;
  const output = run.output;
  const outline = wb.trace?.outline ?? [];
  return (
    <>
      {wb.outputTab === 'output' && outline.length > 0 && (
        <Menu
          label='Jump to'
          trigger={({ toggle, open }) => (
            <Button
              onClick={toggle}
              aria-expanded={open}
              title='Jump to a module'
            >
              <ListTree className='h-4 w-4' aria-hidden />{' '}
              <span className='hidden sm:inline'>Outline</span>
            </Button>
          )}
        >
          {(close) => <OutlineList outline={outline} onDone={close} />}
        </Menu>
      )}
      <IconButton
        icon={copied ? Check : Copy}
        label='Copy output'
        onClick={async () => {
          await navigator.clipboard.writeText(output);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
      <IconButton
        icon={Download}
        label='Download output'
        onClick={() =>
          downloadText(
            `${baseName(wb.fileName)}.${outputExtensionOf(run.engine)}`,
            output,
          )
        }
      />
    </>
  );
}

/** Generated output with trace: the selected node's lines are highlighted; clicking a line selects its node. */
function TracedOutput({ output }: { output: string }) {
  const wb = useWorkbench();
  const sel = useSelection();
  const [view, setView] = useState<EditorView | null>(null);
  const latest = useRef(wb);
  latest.current = wb;

  const extensions = useMemo(
    () => [
      // long guards wrap instead of scrolling sideways
      EditorView.lineWrapping,
      EditorView.editorAttributes.of({ class: 'cm-clickable-line' }),
      EditorView.domEventHandlers({
        mousedown(event, editorView) {
          const pos = editorView.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos === null) return false;
          const line = editorView.state.doc.lineAt(pos).number;
          const owner = lineOwner(latest.current.trace?.lines[line - 1]);
          if (owner) latest.current.select(owner, 'output');
          return false;
        },
      }),
    ],
    [],
  );

  // highlight + reveal the selected node
  useEffect(() => {
    if (!view) return;
    const trace = wb.trace;
    const marks: LineMark[] = [];
    let firstPrimary: number | null = null;
    if (sel.selected && trace) {
      trace.lines.forEach((line, index) => {
        if (line.primary.includes(sel.selected!)) {
          marks.push({ line: index + 1, className: 'cm-trace-primary' });
          firstPrimary ??= index + 1;
        } else if (line.mentions.includes(sel.selected!)) {
          marks.push({ line: index + 1, className: 'cm-trace-mention' });
        }
      });
    }
    // prefer the node's own module over the constant declarations at the top
    const ownModule = sel.selected
      ? trace?.outline.find((entry) => entry.owner === sel.selected)
      : undefined;
    const target = ownModule?.line ?? firstPrimary;
    const doc = view.state.doc;
    view.dispatch({
      effects: [
        setLineMarks.of(marks),
        ...(target && sel.selectOrigin !== 'output' && target <= doc.lines
          ? [
              EditorView.scrollIntoView(doc.line(target).from, {
                y: 'start',
                yMargin: 24,
              }),
            ]
          : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sel.selectSeq, wb.trace]);

  // outline jumps
  useEffect(() => {
    if (!view) return undefined;
    const onJump = (event: Event) => {
      const line = (event as CustomEvent<number>).detail;
      const doc = view.state.doc;
      if (line >= 1 && line <= doc.lines) {
        view.dispatch({
          effects: EditorView.scrollIntoView(doc.line(line).from, {
            y: 'start',
            yMargin: 24,
          }),
        });
      }
    };
    window.addEventListener('workbench:output-line', onJump);
    return () => window.removeEventListener('workbench:output-line', onJump);
  }, [view]);

  return (
    <CodeEditor
      value={output}
      language={outputLanguageOf(wb.engine)}
      readOnly
      ariaLabel='Generated output'
      extensions={extensions}
      onReady={setView}
    />
  );
}

/** Current output against an earlier run. */
/** What differs between the inputs of two runs (from their signatures). */
const changedInputs = (from: string, to: string): string => {
  try {
    const [model, engine, options, variables] = JSON.parse(from) as unknown[];
    const [model2, engine2, options2, variables2] = JSON.parse(to) as unknown[];
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const parts = [
      !same(model, model2) && 'model',
      !same(engine, engine2) && 'engine',
      !same(options, options2) && 'options',
      !same(variables, variables2) && 'variables',
    ].filter(Boolean);
    return parts.length > 0 ? `${parts.join(', ')} changed` : 'same inputs';
  } catch {
    return '';
  }
};

function DiffView() {
  const { runs } = useWorkbench();
  const good = runs.filter((run) => run.output !== null);
  const [baseId, setBaseId] = useState<number | null>(null);
  const current = good[0];
  // earlier outputs of the same engine that actually differ, newest of each first
  const seen = new Set<string>(current?.output ? [current.output] : []);
  const baselines = good.slice(1).filter((run) => {
    if (
      !current ||
      run.engine !== current.engine ||
      run.output === null ||
      seen.has(run.output)
    )
      return false;
    seen.add(run.output);
    return true;
  });
  const base = baselines.find((run) => run.id === baseId) ?? baselines[0];
  const extensions = useMemo(
    () =>
      base?.output !== undefined && base.output !== null
        ? [
            EditorView.lineWrapping,
            unifiedMergeView({
              original: base.output,
              mergeControls: false,
              gutter: true,
              collapseUnchanged: { margin: 3, minSize: 8 },
            }),
          ]
        : [EditorView.lineWrapping],
    [base],
  );
  if (!current || !base) {
    return (
      <Empty>
        {good.length > 1
          ? 'Nothing to compare: every generation so far produced this same output. Change the model, its options or variables to see what the change does.'
          : 'The diff appears once a change to the model, its options or variables changes the output.'}
      </Empty>
    );
  }
  const count = (text: string) => new Set(text.split('\n'));
  const before = count(base.output ?? '');
  const after = count(current.output ?? '');
  const added = [...after].filter((l) => !before.has(l)).length;
  const removed = [...before].filter((l) => !after.has(l)).length;
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b border-line px-3 py-1.5 text-2xs text-ink-muted'>
        <span className='shrink-0'>
          Latest ({time(current.at)}) compared with
        </span>
        <select
          className='min-w-0 rounded border border-line-strong bg-white px-1 py-0.5 text-2xs text-ink'
          value={base.id}
          onChange={(e) => setBaseId(Number(e.target.value))}
          aria-label='Compare with an earlier output'
        >
          {baselines.map((run) => (
            <option key={run.id} value={run.id}>
              {time(run.at)} · {changedInputs(run.signature, current.signature)}
            </option>
          ))}
        </select>
        <span className='ml-auto shrink-0 font-mono'>
          <span className='text-and'>+{added}</span>{' '}
          <span className='text-danger'>−{removed}</span> lines
        </span>
      </div>
      <div className='min-h-0 flex-1' key={`${current.id}-${base.id}`}>
        <CodeEditor
          value={current.output ?? ''}
          language='prism'
          readOnly
          ariaLabel='Output diff'
          extensions={extensions}
        />
      </div>
    </div>
  );
}

function ReportView({ run }: { run: Run }) {
  const summary = run.report?.summary as
    | Record<string, number | string>
    | undefined;
  if (!summary)
    return <Empty>This engine does not produce a generation report.</Empty>;
  const rows: Array<[string, Array<[string, string]>]> = [
    [
      'Model',
      [
        ['Goals', 'totalGoals'],
        ['Tasks', 'totalTasks'],
        ['Resources', 'totalResources'],
        ['Variables', 'totalVariables'],
      ],
    ],
    [
      'Goal types',
      [
        ['Sequence', 'goalTypeSequence'],
        ['Any order', 'goalTypeAnyOrder'],
        ['Interleaved', 'goalTypeInterleaved'],
        ['Alternative', 'goalTypeAlternative'],
        ['Choice', 'goalTypeChoice'],
        ['Degradation', 'goalTypeDegradation'],
      ],
    ],
    [
      'Generated',
      [
        ['Goal modules', 'goalModules'],
        ['Pursue lines', 'goalPursueLines'],
        ['Achieved lines', 'goalAchievedLines'],
        ['Skip lines', 'goalSkippedLines'],
        ['Achievability formulas', 'goalAchievabilityFormulas'],
        ['Task lines', 'tasksLabels'],
      ],
    ],
  ];
  return (
    <div className='h-full overflow-auto p-4'>
      <p className='mb-3 text-[13px] text-ink-soft'>
        Generated in{' '}
        <b className='text-ink'>{String(summary.elapsedTime ?? '')}</b>
      </p>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        {rows.map(([title, entries]) => (
          <dl key={title} className='space-y-1'>
            <dt className='mb-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
              {title}
            </dt>
            {entries
              .filter(([, key]) => summary[key] !== undefined)
              .map(([label, key]) => (
                <div
                  key={key}
                  className='flex justify-between border-b border-line/60 py-0.5 text-[13px]'
                >
                  <span className='text-ink-soft'>{label}</span>
                  <span className='font-mono text-ink'>
                    {String(summary[key])}
                  </span>
                </div>
              ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
