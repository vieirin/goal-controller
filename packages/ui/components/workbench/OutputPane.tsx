'use client';

import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { AlertTriangle, Check, Copy, Download, ListTree, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isPrismEngine } from '@/lib/types';
import { setLineMarks, type LineMark } from '@/lib/workbench/codemirror';
import { baseName, downloadText } from '@/lib/workbench/download';
import { lineOwner } from '@/lib/workbench/trace';
import CodeEditor from './CodeEditor';
import { useWorkbench, type OutputTab, type Run } from './WorkbenchContext';
import { Button, IconButton, Kbd, Menu, MenuItem, Tabs, cx } from './ui';

const time = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function OutputPane() {
  const wb = useWorkbench();
  const lastGood = wb.runs.find((run) => run.output !== null) ?? null;
  const tabs: Array<{ id: OutputTab; label: string }> = [
    { id: 'output', label: isPrismEngine(wb.engine) ? 'PRISM' : 'SLEEC' },
    { id: 'diff', label: 'Diff' },
    { id: 'report', label: 'Report' },
  ];
  return (
    <section className='flex h-full min-h-0 flex-col bg-white' aria-label='Generated output'>
      <Tabs label='Output views' tabs={tabs} value={wb.outputTab} onChange={wb.setOutputTab} trailing={<OutputActions run={lastGood} />} />
      <Freshness />
      <div className='min-h-0 flex-1'>
        {!wb.hasModel ? (
          <Empty>Open a goal model to generate its specification.</Empty>
        ) : !lastGood ? (
          wb.generating ? (
            <Empty>
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> Generating…
            </Empty>
          ) : (
            <Empty>
              Press <Kbd>⌘↵</Kbd> to generate{wb.live ? ', or edit the model — Live regenerates on every change' : ''}.
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
  return <div className='flex h-full items-center justify-center gap-2 p-6 text-center text-sm text-ink-muted'>{children}</div>;
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
        <AlertTriangle className='h-3 w-3' aria-hidden /> Generation failed at {time(current.at)} — showing the last successful output. See Problems.
      </>
    );
  } else if (stale) {
    tone = 'bg-caution-soft text-caution';
    text = live ? 'Model changed — regenerating…' : <>Model changed since {time(current!.at)} — press <Kbd>⌘↵</Kbd> to regenerate.</>;
  } else if (current) {
    text = (
      <>
        <Check className='h-3 w-3 text-and' aria-hidden /> Up to date · generated {time(current.at)} in{' '}
        {(current.durationMs / 1000).toFixed(2)} s · {(current.output ?? '').split('\n').length} lines
      </>
    );
  }
  return <div className={cx('flex items-center gap-1.5 border-b border-line px-3 py-1 text-2xs', tone)}>{text}</div>;
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
            <Button onClick={toggle} aria-expanded={open} title='Jump to a module'>
              <ListTree className='h-4 w-4' aria-hidden /> Outline
            </Button>
          )}
        >
          {(close) => (
            <div className='max-h-80 overflow-auto'>
              {outline.map((entry) => (
                <MenuItem
                  key={`${entry.label}-${entry.line}`}
                  hint={`L${entry.line}`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('workbench:output-line', { detail: entry.line }));
                    if (entry.owner) wb.select(entry.owner, 'output');
                    close();
                  }}
                >
                  <span className='font-mono text-xs'>{entry.label}</span>
                </MenuItem>
              ))}
            </div>
          )}
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
        onClick={() => downloadText(`${baseName(wb.fileName)}.${isPrismEngine(run.engine) ? 'prism' : 'sleec'}`, output)}
      />
    </>
  );
}

/** Generated output with trace: the selected node's lines are highlighted; clicking a line selects its node. */
function TracedOutput({ output }: { output: string }) {
  const wb = useWorkbench();
  const [view, setView] = useState<EditorView | null>(null);
  const latest = useRef(wb);
  latest.current = wb;

  const extensions = useMemo(
    () => [
      EditorView.editorAttributes.of({ class: 'cm-clickable-line' }),
      EditorView.domEventHandlers({
        mousedown(event, editorView) {
          const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
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
    if (wb.selected && trace) {
      trace.lines.forEach((line, index) => {
        if (line.primary.includes(wb.selected!)) {
          marks.push({ line: index + 1, className: 'cm-trace-primary' });
          firstPrimary ??= index + 1;
        } else if (line.mentions.includes(wb.selected!)) {
          marks.push({ line: index + 1, className: 'cm-trace-mention' });
        }
      });
    }
    // prefer the node's own module over the constant declarations at the top
    const ownModule = wb.selected ? trace?.outline.find((entry) => entry.owner === wb.selected) : undefined;
    const target = ownModule?.line ?? firstPrimary;
    const doc = view.state.doc;
    view.dispatch({
      effects: [
        setLineMarks.of(marks),
        ...(target && wb.selectOrigin !== 'output' && target <= doc.lines
          ? [EditorView.scrollIntoView(doc.line(target).from, { y: 'start', yMargin: 24 })]
          : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, wb.selectSeq, wb.trace]);

  // outline jumps
  useEffect(() => {
    if (!view) return undefined;
    const onJump = (event: Event) => {
      const line = (event as CustomEvent<number>).detail;
      const doc = view.state.doc;
      if (line >= 1 && line <= doc.lines) {
        view.dispatch({ effects: EditorView.scrollIntoView(doc.line(line).from, { y: 'start', yMargin: 24 }) });
      }
    };
    window.addEventListener('workbench:output-line', onJump);
    return () => window.removeEventListener('workbench:output-line', onJump);
  }, [view]);

  return (
    <CodeEditor
      value={output}
      language={isPrismEngine(wb.engine) ? 'prism' : 'text'}
      readOnly
      ariaLabel='Generated output'
      extensions={extensions}
      onReady={setView}
    />
  );
}

/** Current output against an earlier run. */
function DiffView() {
  const { runs } = useWorkbench();
  const good = runs.filter((run) => run.output !== null);
  const [baseId, setBaseId] = useState<number | null>(null);
  const current = good[0];
  const base = good.find((run) => run.id === baseId) ?? good[1];
  const extensions = useMemo(
    () =>
      base?.output !== undefined && base.output !== null
        ? [unifiedMergeView({ original: base.output, mergeControls: false, gutter: true, collapseUnchanged: { margin: 3, minSize: 8 } })]
        : [],
    [base],
  );
  if (!current || !base) {
    return <Empty>The diff appears after the second generation: change the model and generate again.</Empty>;
  }
  const count = (text: string) => new Set(text.split('\n'));
  const before = count(base.output ?? '');
  const after = count(current.output ?? '');
  const added = [...after].filter((l) => !before.has(l)).length;
  const removed = [...before].filter((l) => !after.has(l)).length;
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b border-line px-3 py-1.5 text-2xs text-ink-muted'>
        <span>
          Latest ({time(current.at)}) compared with
        </span>
        <select
          className='rounded border border-line-strong bg-white px-1 py-0.5 text-2xs text-ink'
          value={base.id}
          onChange={(e) => setBaseId(Number(e.target.value))}
          aria-label='Compare with run'
        >
          {good.slice(1).map((run) => (
            <option key={run.id} value={run.id}>
              run at {time(run.at)} ({run.engine})
            </option>
          ))}
        </select>
        <span className='ml-auto font-mono'>
          <span className='text-and'>+{added}</span> <span className='text-danger'>−{removed}</span> lines
        </span>
      </div>
      <div className='min-h-0 flex-1' key={`${current.id}-${base.id}`}>
        {added + removed === 0 ? (
          <Empty>No differences: the latest output is identical to that run.</Empty>
        ) : (
          <CodeEditor value={current.output ?? ''} language='prism' readOnly ariaLabel='Output diff' extensions={extensions} />
        )}
      </div>
    </div>
  );
}

function ReportView({ run }: { run: Run }) {
  const summary = run.report?.summary as Record<string, number | string> | undefined;
  if (!summary) return <Empty>This engine does not produce a generation report.</Empty>;
  const rows: Array<[string, Array<[string, string]>]> = [
    ['Model', [['Goals', 'totalGoals'], ['Tasks', 'totalTasks'], ['Resources', 'totalResources'], ['Variables', 'totalVariables']]],
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
        Generated in <b className='text-ink'>{String(summary.elapsedTime ?? '')}</b>
      </p>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        {rows.map(([title, entries]) => (
          <dl key={title} className='space-y-1'>
            <dt className='mb-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>{title}</dt>
            {entries
              .filter(([, key]) => summary[key] !== undefined)
              .map(([label, key]) => (
                <div key={key} className='flex justify-between border-b border-line/60 py-0.5 text-[13px]'>
                  <span className='text-ink-soft'>{label}</span>
                  <span className='font-mono text-ink'>{String(summary[key])}</span>
                </div>
              ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
