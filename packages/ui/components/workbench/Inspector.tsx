'use client';

import { ArrowUpRight, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TransformEngine } from '@/lib/types';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
  composeNodeText,
  isValidName,
  notationConstruct,
  notationIds,
  setNodeProperty,
  setNodeText,
  setRefinement,
  type ViewNode,
} from '@/lib/workbench/pistar';
import { nodeTone } from './TreeView';
import { useWorkbench } from './WorkbenchContext';
import { Button, NodeChip, Segmented, cx } from './ui';

/** Local text state that commits after a short pause. */
const useDraft = (value: string, commit: (next: string) => void, delay = 300) => {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const change = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commitRef.current(next), delay);
  };
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      commitRef.current(draft);
    }
  };
  return { draft, change, flush };
};

const OPERATORS: Record<Exclude<TransformEngine, 'sleec'>, Array<{ op: string; construct: keyof typeof CONSTRUCT_LABEL }>> = {
  edgev2: [
    { op: ';', construct: 'sequence' },
    { op: '+', construct: 'anyOrder' },
    { op: '#', construct: 'interleaved' },
    { op: '|', construct: 'alternative' },
    { op: '?', construct: 'choice' },
    { op: '->', construct: 'degradation' },
  ],
  edge: [
    { op: ';', construct: 'sequence' },
    { op: '#', construct: 'interleaved' },
    { op: '|', construct: 'alternative' },
    { op: '->', construct: 'degradation' },
  ],
};

const NUMERIC_KEYS: Record<string, 'number' | 'integer'> = {
  utility: 'number',
  cost: 'number',
  maxRetries: 'integer',
};

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className='block space-y-1'>
      <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>{label}</span>
      {children}
      {hint && <span className='block text-2xs text-ink-muted'>{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-line-strong bg-white px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:border-trace focus:outline-none';

export default function Inspector() {
  const wb = useWorkbench();
  const node = wb.selected ? wb.tree?.nodes.get(wb.selected) : undefined;
  if (!wb.tree) {
    return <p className='p-4 text-sm text-ink-muted'>Open a model to inspect its goals and tasks.</p>;
  }
  if (!node) return <ModelSummary />;
  return <NodeInspector key={node.id} node={node} />;
}

function ModelSummary() {
  const { tree, engine } = useWorkbench();
  if (!tree) return null;
  const nodes = [...tree.nodes.values()];
  const count = (kind: ViewNode['kind']) => nodes.filter((n) => n.kind === kind).length;
  const constructs = new Map<string, number>();
  nodes.forEach((n) => {
    if (n.construct) constructs.set(n.construct, (constructs.get(n.construct) ?? 0) + 1);
  });
  return (
    <div className='space-y-3 p-4 text-[13px]'>
      <p className='text-ink-muted'>
        Select a goal or task — in the tree, the source or the generated output — to inspect and edit it. Use Edit
        diagram to add or remove goals, tasks and links.
      </p>
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
      {constructs.size > 0 && (
        <ul className='space-y-0.5 text-ink-soft'>
          {[...constructs.entries()].map(([construct, n]) => (
            <li key={construct}>
              {n} × {CONSTRUCT_LABEL[construct as keyof typeof CONSTRUCT_LABEL]}{' '}
              <span className='text-ink-muted'>— {CONSTRUCT_HELP[construct as keyof typeof CONSTRUCT_HELP]}</span>
            </li>
          ))}
        </ul>
      )}
      {engine === 'sleec' && <p className='text-ink-muted'>SLEEC ignores the execution notation.</p>}
    </div>
  );
}

function NodeInspector({ node }: { node: ViewNode }) {
  const wb = useWorkbench();
  const { engine, tree } = wb;
  const edit = (update: (text: string) => string) => wb.setText(update(wb.text), 'inspector');

  const name = useDraft(node.name, (next) =>
    edit((text) => setNodeText(text, node.iStarId, composeNodeText(node.id, next, node.notation))),
  );
  const notation = useDraft(node.notation ?? '', (next) =>
    edit((text) => setNodeText(text, node.iStarId, composeNodeText(node.id, node.name, next || null))),
  );

  const draftConstruct = notationConstruct(notation.draft || null, engine);
  const listed = notationIds(notation.draft);
  const pursueable = node.children.filter((id) => tree?.nodes.get(id)?.kind !== 'resource');
  const traceLines = wb.trace?.lines.filter((line) => line.primary.includes(node.id)).length ?? 0;
  const usedVariables = wb.variables.filter((v) => v.usedBy.includes(node.id));
  const known = useMemo(
    () => wb.analysis?.knownProperties[node.kind === 'quality' ? 'goal' : node.kind] ?? [],
    [wb.analysis, node.kind],
  );
  const keys = useMemo(
    () => [...new Set([...known.filter((k) => k !== 'root'), ...Object.keys(node.properties).filter((k) => k !== 'root')])],
    [known, node.properties],
  );
  const [newKey, setNewKey] = useState('');

  const tone = nodeTone(node);
  const kindLabel = node.kind === 'goal' ? 'Goal' : node.kind === 'task' ? 'Task' : node.kind === 'resource' ? 'Resource' : 'Quality';

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <NodeChip id={node.id} tone={tone} />
            <span className='text-2xs uppercase tracking-wider text-ink-muted'>
              {kindLabel}
              {node.kind === 'goal' && node.relation && ` · ${node.relation.toUpperCase()}`}
            </span>
          </div>
          {node.construct && (
            <p className='mt-1 text-[13px] text-ink-soft'>
              <b className={tone === 'or' ? 'text-or' : 'text-and'}>{CONSTRUCT_LABEL[node.construct]}</b> —{' '}
              {CONSTRUCT_HELP[node.construct]}
            </p>
          )}
        </div>
        {traceLines > 0 && (
          <Button
            variant='outline'
            onClick={() => {
              wb.setOutputTab('output');
              wb.select(node.id, 'inspector');
            }}
            title='Scroll the generated output to this node'
          >
            {traceLines} lines <ArrowUpRight className='h-3.5 w-3.5' aria-hidden />
          </Button>
        )}
      </div>

      <Field
        label='Name'
        hint={!isValidName(name.draft) ? 'Only letters, spaces, hyphens and apostrophes are allowed in names.' : undefined}
      >
        <input
          className={cx(inputClass, !isValidName(name.draft) && 'border-caution')}
          value={name.draft}
          onChange={(e) => name.change(e.target.value)}
          onBlur={name.flush}
        />
      </Field>

      {node.kind === 'goal' && engine !== 'sleec' && (
        <Field
          label='Execution notation'
          hint={
            notation.draft.trim()
              ? draftConstruct
                ? `${CONSTRUCT_LABEL[draftConstruct]} — ${CONSTRUCT_HELP[draftConstruct]}`
                : 'No operator this engine understands.'
              : `No notation: ${node.relation === 'or' ? 'alternative' : 'interleaved'} by default.`
          }
        >
          <input
            className={cx(inputClass, 'font-mono')}
            value={notation.draft}
            placeholder={pursueable.join(';') || 'G1;G2'}
            onChange={(e) => notation.change(e.target.value)}
            onBlur={notation.flush}
            spellCheck={false}
          />
          {pursueable.length > 0 && (
            <div className='flex flex-wrap items-center gap-1 pt-1'>
              <span className='text-2xs text-ink-muted'>Children:</span>
              {pursueable.map((id) => (
                <span key={id} className={cx(listed.length > 0 && !listed.includes(id) && 'rounded ring-1 ring-caution')} title={listed.length > 0 && !listed.includes(id) ? 'Missing from the notation' : undefined}>
                  <NodeChip id={id} tone={nodeTone(tree?.nodes.get(id))} onClick={() => wb.select(id, 'inspector')} />
                </span>
              ))}
              {listed.filter((id) => !pursueable.includes(id)).map((id) => (
                <span key={id} className='rounded bg-danger-soft px-1 font-mono text-2xs text-danger' title='Not a child of this goal'>
                  {id}?
                </span>
              ))}
            </div>
          )}
          {pursueable.length > 1 && (
            <div className='flex flex-wrap gap-1 pt-1'>
              {OPERATORS[engine].map(({ op, construct }) => (
                <button
                  key={op}
                  type='button'
                  title={`${CONSTRUCT_LABEL[construct]}: ${CONSTRUCT_HELP[construct]}`}
                  onClick={() => notation.change(pursueable.join(op))}
                  className='rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink'
                >
                  <span className='font-mono font-semibold'>{op}</span> {CONSTRUCT_LABEL[construct]}
                </button>
              ))}
              {draftConstruct === 'degradation' && !/@\d/.test(notation.draft) && (
                <button
                  type='button'
                  title='Retry the first child up to 3 times before falling back'
                  onClick={() => notation.change(notation.draft.replace(/^([A-Za-z]+\d+\w*)/, '$1@3'))}
                  className='rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink'
                >
                  <span className='font-mono font-semibold'>@3</span> retries
                </button>
              )}
              {engine === 'edge' && (
                <button
                  type='button'
                  title='Choice (Edge notation: a standalone +)'
                  onClick={() => notation.change('+')}
                  className='rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink'
                >
                  <span className='font-mono font-semibold'>+</span> Choice
                </button>
              )}
            </div>
          )}
        </Field>
      )}

      {node.kind === 'goal' && node.children.length > 0 && (
        <Field label='Refinement' hint='How the goal is refined into its children (the link type in the diagram).'>
          <div>
            <Segmented
              size='sm'
              label='Refinement'
              value={node.relation ?? 'and'}
              onChange={(relation) => edit((text) => setRefinement(text, node.iStarId, relation))}
              options={[
                { id: 'and', label: 'AND', title: 'All children are needed' },
                { id: 'or', label: 'OR', title: 'One child is enough' },
              ]}
            />
          </div>
        </Field>
      )}

      <div className='space-y-1.5'>
        <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>Properties</span>
        {keys.map((key) => (
          <PropertyRow
            key={key}
            name={key}
            value={node.properties[key]}
            engineKnows={known.includes(key)}
            onChange={(value) => edit((text) => setNodeProperty(text, node.iStarId, key, value))}
          />
        ))}
        <form
          className='flex items-center gap-1 pt-1'
          onSubmit={(e) => {
            e.preventDefault();
            const key = newKey.trim();
            if (!key || key in node.properties) return;
            edit((text) => setNodeProperty(text, node.iStarId, key, ''));
            setNewKey('');
          }}
        >
          <input
            className={cx(inputClass, 'font-mono text-xs')}
            placeholder='new property'
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            aria-label='New property name'
          />
          <Button type='submit' variant='outline' disabled={!newKey.trim()}>
            <Plus className='h-3.5 w-3.5' aria-hidden /> Add
          </Button>
        </form>
      </div>

      {usedVariables.length > 0 && (
        <div className='space-y-1'>
          <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>Variables</span>
          <div className='flex flex-wrap gap-1'>
            {usedVariables.map((v) => (
              <button
                key={v.name}
                type='button'
                onClick={() => wb.setBottomTab('variables')}
                className='rounded border border-line bg-white px-1.5 py-0.5 font-mono text-2xs text-ink-soft hover:border-trace'
                title='Edit in the Variables panel'
              >
                {v.name} = {String(wb.values[v.name])}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyRow({
  name,
  value,
  engineKnows,
  onChange,
}: {
  name: string;
  value: string | undefined;
  engineKnows: boolean;
  onChange: (value: string | null) => void;
}) {
  const draft = useDraft(value ?? '', (next) => onChange(next === '' && value === undefined ? null : next));
  const kind = NUMERIC_KEYS[name];
  const invalid =
    !!draft.draft &&
    ((kind === 'number' && !/^\d+(\.\d+)?$/.test(draft.draft)) || (kind === 'integer' && !/^\d+$/.test(draft.draft)));
  const long = name === 'Description' || name === 'assertion' || name === 'maintain';
  return (
    <div className='grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-start gap-1.5'>
      <span
        className={cx('truncate pt-1.5 font-mono text-xs', engineKnows ? 'text-ink' : 'text-ink-muted')}
        title={engineKnows ? `${name} (read by this engine)` : `${name} (not read by this engine)`}
      >
        {name}
      </span>
      {long ? (
        <textarea
          rows={name === 'Description' ? 2 : 1}
          className={cx(inputClass, 'resize-y font-mono text-xs')}
          value={draft.draft}
          placeholder={value === undefined ? 'not set' : ''}
          onChange={(e) => draft.change(e.target.value)}
          onBlur={draft.flush}
        />
      ) : (
        <input
          className={cx(inputClass, 'font-mono text-xs', invalid && 'border-danger')}
          value={draft.draft}
          placeholder={value === undefined ? 'not set' : ''}
          inputMode={kind ? 'decimal' : undefined}
          aria-invalid={invalid}
          title={invalid ? (kind === 'integer' ? 'Use a whole number' : 'Use a non-negative number') : undefined}
          onChange={(e) => draft.change(e.target.value)}
          onBlur={draft.flush}
        />
      )}
      {value !== undefined ? (
        <button
          type='button'
          aria-label={`Remove ${name}`}
          title={`Remove ${name}`}
          onClick={() => onChange(null)}
          className='mt-1 rounded p-0.5 text-ink-faint hover:bg-danger-soft hover:text-danger'
        >
          <X className='h-3.5 w-3.5' aria-hidden />
        </button>
      ) : (
        <span className='w-5' />
      )}
    </div>
  );
}
