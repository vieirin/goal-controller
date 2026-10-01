'use client';

import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Info,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GoalViewNode } from '@goal-controller/goal-tree';
import { isPrismEngine } from '@/lib/types';
import { baseName, downloadText } from '@/lib/workbench/download';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
  nodeTone,
} from '@/lib/workbench/pistar';
import type { Problem } from '@/lib/workbench/types';
import CodeEditor from './CodeEditor';
import { readFile } from './TopBar';
import { useWorkbench, type BottomTab } from './WorkbenchContext';
import {
  Button,
  IconButton,
  NodeChip,
  Segmented,
  Switch,
  Tabs,
  cx,
} from './ui';

export default function BottomPanel({ onToggle }: { onToggle: () => void }) {
  const wb = useWorkbench();
  const errors = wb.problems.filter((p) => p.severity === 'error').length;
  const warnings = wb.problems.filter((p) => p.severity === 'warning').length;
  const tabs: Array<{
    id: BottomTab;
    label: string;
    count?: number;
    tone?: 'danger' | 'caution' | null;
  }> = [
    {
      id: 'problems',
      label: 'Problems',
      count: errors + warnings,
      tone: errors ? 'danger' : warnings ? 'caution' : null,
    },
    { id: 'variables', label: 'Variables', count: wb.variables.length },
    { id: 'model', label: 'Model' },
    { id: 'log', label: 'Log' },
  ];
  return (
    <section
      className='flex h-full min-h-0 flex-col bg-white'
      aria-label='Problems, variables, model and log'
    >
      <Tabs
        label='Bottom panel'
        tabs={tabs}
        value={wb.bottomTab}
        onChange={wb.setBottomTab}
        trailing={
          <IconButton
            icon={ChevronsUpDown}
            label='Show or hide this panel'
            onClick={onToggle}
          />
        }
      />
      <div className='min-h-0 flex-1 overflow-hidden'>
        {wb.bottomTab === 'problems' && <ProblemsView />}
        {wb.bottomTab === 'variables' && <VariablesView />}
        {wb.bottomTab === 'model' && <ModelDataView />}
        {wb.bottomTab === 'log' && <LogView />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;
const TONE = {
  error: 'text-danger',
  warning: 'text-caution',
  info: 'text-ink-muted',
} as const;
const SOURCE = {
  json: 'JSON',
  model: 'model',
  engine: 'engine',
  generation: 'generation',
} as const;

export function ProblemsView() {
  const wb = useWorkbench();
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    if (copied === null) return undefined;
    const timer = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  if (!wb.hasModel)
    return <p className='p-3 text-[13px] text-ink-muted'>No model open.</p>;
  const shown = wb.problems.filter((p) => showInfo || p.severity !== 'info');
  const hiddenInfo = wb.problems.length - shown.length;
  const canGo = (problem: Problem) =>
    (problem.source === 'json' && !!problem.line) ||
    (!!problem.nodeId && !!wb.tree?.nodes.has(problem.nodeId));
  const go = (problem: Problem) => {
    if (problem.source === 'json' && problem.line)
      wb.revealSourceLine(problem.line);
    else if (problem.nodeId) wb.select(problem.nodeId, 'problems');
  };
  return (
    <div className='h-full overflow-auto'>
      {shown.length === 0 && (
        <p className='p-3 text-[13px] text-ink-muted'>
          No problems{wb.analyzing ? ' so far — checking…' : '.'}
        </p>
      )}
      <ul>
        {shown.map((problem, index) => {
          const Icon = ICON[problem.severity];
          const node = problem.nodeId
            ? wb.tree?.nodes.get(problem.nodeId)
            : undefined;
          return (
            <li
              key={`${problem.message}-${index}`}
              className='group flex items-start gap-1 border-b border-line/60 pr-2 text-[13px] hover:bg-panel'
            >
              {/* clicking goes to the problem: the node in the model (selected and highlighted) or the line in the source */}
              <button
                type='button'
                onClick={() => go(problem)}
                disabled={!canGo(problem)}
                title={
                  canGo(problem)
                    ? problem.source === 'json'
                      ? 'Go to this line in the source'
                      : 'Go to this node in the model'
                    : undefined
                }
                className='flex min-w-0 flex-1 items-start gap-2 px-3 py-1.5 text-left disabled:cursor-default'
              >
                <Icon
                  className={cx(
                    'mt-0.5 h-4 w-4 shrink-0',
                    TONE[problem.severity],
                  )}
                  aria-label={problem.severity}
                />
                <span className='min-w-0 flex-1 text-ink'>
                  {problem.message}
                </span>
                {problem.line && (
                  <span className='font-mono text-2xs text-ink-muted'>
                    line {problem.line}
                  </span>
                )}
                {node && node.id !== node.iStarId && (
                  <NodeChip id={node.id} tone={nodeTone(node)} />
                )}
                <span className='rounded bg-panel px-1 text-2xs text-ink-muted'>
                  {SOURCE[problem.source]}
                </span>
              </button>
              <button
                type='button'
                aria-label={copied === index ? 'Copied' : 'Copy this problem'}
                title={copied === index ? 'Copied' : 'Copy this problem'}
                onClick={async () => {
                  await navigator.clipboard.writeText(problem.message);
                  setCopied(index);
                }}
                className='mt-1 shrink-0 rounded p-1 text-ink-faint hover:bg-white hover:text-ink'
              >
                {copied === index ? (
                  <Check className='h-3.5 w-3.5 text-and' aria-hidden />
                ) : (
                  <Copy className='h-3.5 w-3.5' aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {hiddenInfo > 0 && (
        <button
          type='button'
          className='px-3 py-2 text-2xs text-ink-muted underline'
          onClick={() => setShowInfo(true)}
        >
          Show {hiddenInfo} info message{hiddenInfo > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const CONSTRUCT_ORDER = [
  'sequence',
  'anyOrder',
  'interleaved',
  'alternative',
  'choice',
  'degradation',
] as const;

/** Goal, task and resource counts, plus how often each execution construct appears. */
export function ModelDataView() {
  const { tree, engine, hasModel } = useWorkbench();
  if (!hasModel || !tree)
    return <p className='p-3 text-[13px] text-ink-muted'>No model open.</p>;
  const nodes = [...tree.nodes.values()];
  const count = (kind: GoalViewNode['kind']) =>
    nodes.filter((n) => n.kind === kind).length;
  const constructs = new Map<string, number>();
  nodes.forEach((n) => {
    if (n.construct)
      constructs.set(n.construct, (constructs.get(n.construct) ?? 0) + 1);
  });
  const listed = CONSTRUCT_ORDER.filter((construct) =>
    constructs.has(construct),
  );
  return (
    <div className='h-full overflow-auto p-3 text-[13px]'>
      <div className='flex flex-wrap gap-x-4 gap-y-1 text-ink-soft'>
        <span>
          <b className='text-ink'>{count('goal')}</b> goals
        </span>
        <span>
          <b className='text-ink'>{count('task')}</b> tasks
        </span>
        <span>
          <b className='text-ink'>{count('resource')}</b> resources
        </span>
      </div>
      {listed.length > 0 && (
        <ul className='mt-3 space-y-0.5 text-ink-soft'>
          {listed.map((construct) => (
            <li key={construct}>
              {constructs.get(construct)} × {CONSTRUCT_LABEL[construct]}{' '}
              <span className='text-ink-muted'>
                — {CONSTRUCT_HELP[construct]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {engine === 'sleec' && (
        <p className='mt-3 text-ink-muted'>
          SLEEC ignores the execution notation.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VariablesView() {
  const wb = useWorkbench();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'achievability' | 'context'>(
    'all',
  );
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () =>
      wb.variables.filter(
        (v) =>
          (filter === 'all' || v.kind === filter) &&
          (!query ||
            v.name.toLowerCase().includes(query.toLowerCase()) ||
            v.usedBy.some((id) => id.toLowerCase() === query.toLowerCase())),
      ),
    [wb.variables, filter, query],
  );

  if (!isPrismEngine(wb.engine)) {
    return (
      <p className='p-3 text-[13px] text-ink-muted'>
        SLEEC specifications do not use variables.
      </p>
    );
  }
  if (!wb.hasModel)
    return <p className='p-3 text-[13px] text-ink-muted'>No model open.</p>;
  if (wb.variables.length === 0) {
    return (
      <p className='p-3 text-[13px] text-ink-muted'>
        {wb.analyzing
          ? 'Reading the model…'
          : 'This model has no tasks or context conditions, so there is nothing to set.'}
      </p>
    );
  }

  const importValues = async (file: File) => {
    try {
      const parsed = JSON.parse(await readFile(file)) as Record<
        string,
        unknown
      >;
      const known = new Map(wb.variables.map((v) => [v.name, v]));
      const next: Record<string, boolean | number> = {};
      let skipped = 0;
      for (const [name, value] of Object.entries(parsed)) {
        const variable = known.get(name);
        if (variable?.kind === 'context' && typeof value === 'boolean')
          next[name] = value;
        else if (
          variable?.kind === 'achievability' &&
          typeof value === 'number' &&
          value >= 0 &&
          value <= 1
        )
          next[name] = value;
        else skipped += 1;
      }
      wb.setValues(next);
      setImportError(
        skipped
          ? `Imported ${Object.keys(next).length}; skipped ${skipped} unknown or out-of-range values.`
          : null,
      );
    } catch (error) {
      setImportError(`Could not read the file: ${(error as Error).message}`);
    }
  };

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5'>
        <label className='relative'>
          <Search
            className='pointer-events-none absolute left-1.5 top-1.5 h-3.5 w-3.5 text-ink-faint'
            aria-hidden
          />
          <input
            className='w-44 rounded-md border border-line-strong py-0.5 pl-6 pr-2 text-xs'
            placeholder='Filter by name or node'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label='Filter variables'
          />
        </label>
        <Segmented
          size='sm'
          label='Variable kind'
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'achievability', label: 'Probabilities' },
            { id: 'context', label: 'Conditions' },
          ]}
        />
        <div className='ml-auto flex items-center gap-1'>
          <input
            ref={fileInput}
            type='file'
            accept='.json,application/json'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importValues(file);
              e.target.value = '';
            }}
          />
          <Button
            onClick={() => fileInput.current?.click()}
            title='Load values from a JSON file'
          >
            <Upload className='h-3.5 w-3.5' aria-hidden /> Import
          </Button>
          <Button
            onClick={() =>
              downloadText(
                `${baseName(wb.fileName)}.variables.json`,
                JSON.stringify(wb.values, null, 2),
                'application/json',
              )
            }
            title='Save the values as JSON'
          >
            <Download className='h-3.5 w-3.5' aria-hidden /> Export
          </Button>
          <Button
            onClick={wb.resetValues}
            title='Probabilities 0.8, conditions false'
          >
            <RotateCcw className='h-3.5 w-3.5' aria-hidden /> Reset
          </Button>
        </div>
      </div>
      {importError && (
        <p className='border-b border-line bg-caution-soft px-3 py-1 text-2xs text-caution'>
          {importError}
        </p>
      )}
      <div className='min-h-0 flex-1 overflow-auto'>
        <table className='w-full text-[13px]'>
          <thead className='sticky top-0 z-10 bg-white text-left text-2xs uppercase tracking-wider text-ink-muted shadow-[0_1px_0_#DDE3E1]'>
            <tr>
              <th className='px-3 py-1 font-semibold'>Variable</th>
              <th className='hidden px-3 py-1 font-semibold sm:table-cell'>
                Used by
              </th>
              <th className='px-3 py-1 font-semibold'>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((variable) => {
              const value = wb.values[variable.name];
              return (
                <tr
                  key={variable.name}
                  className='border-b border-line/60 hover:bg-panel/60'
                >
                  <td className='px-3 py-1.5'>
                    <span className='font-mono text-xs text-ink'>
                      {variable.name}
                    </span>
                    <span className='block text-2xs text-ink-muted sm:ml-2 sm:inline'>
                      {variable.kind === 'context'
                        ? 'condition'
                        : 'success probability'}
                    </span>
                    <div className='mt-1 flex flex-wrap gap-1 sm:hidden'>
                      {variable.usedBy.map((id) => (
                        <NodeChip
                          key={id}
                          id={id}
                          tone={nodeTone(wb.tree?.nodes.get(id))}
                          onClick={() => wb.select(id, 'variables')}
                        />
                      ))}
                    </div>
                  </td>
                  <td className='hidden px-3 py-1 sm:table-cell'>
                    <div className='flex flex-wrap gap-1'>
                      {variable.usedBy.map((id) => (
                        <NodeChip
                          key={id}
                          id={id}
                          tone={nodeTone(wb.tree?.nodes.get(id))}
                          onClick={() => wb.select(id, 'variables')}
                        />
                      ))}
                    </div>
                  </td>
                  <td className='px-3 py-1'>
                    {variable.kind === 'context' ? (
                      <Switch
                        checked={value === true}
                        onChange={(checked) =>
                          wb.setValue(variable.name, checked)
                        }
                        label={value ? 'true' : 'false'}
                      />
                    ) : (
                      <div className='flex items-center gap-2'>
                        <input
                          type='range'
                          min={0}
                          max={1}
                          step={0.01}
                          value={Number(value)}
                          onChange={(e) =>
                            wb.setValue(variable.name, Number(e.target.value))
                          }
                          aria-label={`${variable.name} probability`}
                          className='w-20 accent-[#1F7A74] sm:w-32'
                        />
                        <input
                          type='number'
                          min={0}
                          max={1}
                          step={0.05}
                          value={Number(value)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isNaN(n))
                              wb.setValue(
                                variable.name,
                                Math.min(1, Math.max(0, n)),
                              );
                          }}
                          aria-label={`${variable.name} value`}
                          className='w-16 rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-xs'
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function LogView() {
  const wb = useWorkbench();
  const log = wb.runs.find((run) => run.report?.log)?.report?.log;
  if (!log)
    return (
      <p className='p-3 text-[13px] text-ink-muted'>
        The generation log appears after the first generation.
      </p>
    );
  return (
    <div className='h-full'>
      <CodeEditor
        value={log}
        language='text'
        readOnly
        ariaLabel='Generation log'
      />
    </div>
  );
}
