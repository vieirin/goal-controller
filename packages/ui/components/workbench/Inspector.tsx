'use client';

import { ArrowUpRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GoalViewNode } from '@goal-controller/goal-tree';
import { KNOWN_PROPERTIES } from '@/lib/models/knownProperties';
import type { TransformEngine } from '@/lib/types';
import {
  DEFAULT_ELEMENT_FILL,
  EDGE_RESOURCE_FILL,
  PROPERTY_SPECS,
  inputOf,
  type NodeKindKey,
  type PropertyInput,
} from '@/lib/workbench/edgeProperties';
import type { AnalyzeResponse } from '@/lib/workbench/types';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
  composeNodeText,
  isValidName,
  nodeTone,
  setNodeColor,
  setNodeProperty,
  setNodeText,
  setRefinement,
} from '@/lib/workbench/pistar';
import { useSelection, useWorkbench } from './WorkbenchContext';
import { useShell } from './shell';
import { Button, CreatableSelect, NodeChip, Segmented, cx } from './ui';

/**
 * Local text state that commits after a short pause. While it is being edited, the value
 * coming back is not taken: the tree is computed on the server, so it echoes a commit a
 * request later and would overwrite what was typed since. It is taken again once it
 * catches up with the draft (or shortly after the field is left).
 */
const useDraft = (
  value: string,
  commit: (next: string) => void,
  delay = 300,
) => {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const editing = useRef(false);
  const latest = useRef(value);
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    if (!editing.current) setDraft(value);
    else if (value === latest.current) editing.current = false;
  }, [value]);
  const change = (next: string) => {
    editing.current = true;
    latest.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(next);
    }, delay);
  };
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      commitRef.current(draft);
    }
    // stop editing once the server catches up, or soon anyway (a commit may come back
    // normalized, e.g. trimmed, and never equal the draft)
    if (value === latest.current) editing.current = false;
    else {
      const left = latest.current;
      setTimeout(() => {
        // typing again since: still editing
        if (!editing.current || latest.current !== left) return;
        editing.current = false;
        setDraft(current.current);
      }, 1500);
    }
  };
  return { draft, change, flush };
};

const OPERATORS: Record<
  Exclude<TransformEngine, 'sleec'>,
  Array<{ op: string; construct: keyof typeof CONSTRUCT_LABEL }>
> = {
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

const ENGINE_LABEL: Record<TransformEngine, string> = {
  edgev2: 'EdgeV2',
  edge: 'Edge',
  sleec: 'SLEEC',
};

const KIND_PLURAL: Record<NodeKindKey, string> = {
  goal: 'goals',
  task: 'tasks',
  resource: 'resources',
};
const listKinds = (kinds: NodeKindKey[]): string =>
  kinds.map((k) => KIND_PLURAL[k]).join(kinds.length === 2 ? ' and ' : ', ');

/** Where each engine declares the properties it reads, per element kind (packages/lib). */
const ENGINE_KEYS: Record<
  TransformEngine,
  {
    file: string;
    lists: Partial<Record<NodeKindKey, string>>;
    map: Record<NodeKindKey, string>;
  }
> = {
  edgev2: {
    file: 'packages/lib/src/engines/edgeV2/mapper.ts',
    lists: {
      goal: 'EDGE_GOAL_KEYS',
      task: 'EDGE_TASK_KEYS',
      resource: 'EDGE_RESOURCE_KEYS',
    },
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
    },
  },
  edge: {
    file: 'packages/lib/src/engines/edge/mapper.ts',
    lists: {
      goal: 'EDGE_GOAL_KEYS',
      task: 'EDGE_TASK_KEYS',
      resource: 'EDGE_RESOURCE_KEYS',
    },
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
    },
  },
  sleec: {
    file: 'packages/lib/src/engines/sleec/mapper.ts',
    lists: { goal: 'SLEEC_GOAL_KEYS', task: 'SLEEC_TASK_KEYS' },
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
    },
  },
};

/** What to change so the engine reads a property on this kind of element. */
const howToAccept = (
  key: string,
  kind: NodeKindKey,
  engine: TransformEngine,
): string => {
  const { file, lists, map } = ENGINE_KEYS[engine];
  const list = lists[kind];
  return list
    ? `To make ${ENGINE_LABEL[engine]} read it here, add '${key}' to ${list} in ${file} and use it in ${map[kind]}.`
    : `${ENGINE_LABEL[engine]} skips ${KIND_PLURAL[kind]} (skipResource in ${file}).`;
};

/**
 * Why the engine ignores a property here, where it is read instead (another kind of element,
 * another engine), and which structure to update for the engine to read it here.
 */
const whereAccepted = (
  key: string,
  kind: NodeKindKey,
  engine: TransformEngine,
  known: AnalyzeResponse['knownProperties'],
  allKnown: Partial<
    Record<TransformEngine, AnalyzeResponse['knownProperties']>
  >,
): string => {
  const kinds = Object.keys(KIND_PLURAL) as NodeKindKey[];
  const here = ENGINE_LABEL[engine];
  const sameEngine = kinds.filter((k) => known[k].includes(key));
  if (sameEngine.length > 0) {
    return `${here} reads ${key} on ${listKinds(sameEngine)}, not on ${KIND_PLURAL[kind]}. ${howToAccept(key, kind, engine)}`;
  }
  const others = (Object.keys(ENGINE_LABEL) as TransformEngine[])
    .filter((e) => e !== engine)
    .map((e) => ({
      e,
      on: kinds.filter((k) => allKnown[e]?.[k].includes(key)),
    }))
    .filter(({ on }) => on.length > 0);
  if (others.length > 0) {
    return `Not read by ${here}. ${others.map(({ e, on }) => `${ENGINE_LABEL[e]} reads it on ${listKinds(on)}`).join('; ')}. ${howToAccept(key, kind, engine)}`;
  }
  return `Not read by ${here}: kept in the file, no effect on the output. ${howToAccept(key, kind, engine)}`;
};

const NUMERIC_KEYS: Record<string, 'number' | 'integer'> = {
  utility: 'number',
  cost: 'number',
  maxRetries: 'integer',
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className='block space-y-1'>
      <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
        {label}
      </span>
      {children}
      {hint && <span className='block text-2xs text-ink-muted'>{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-line-strong bg-white px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:border-trace focus:outline-none';

export default function Inspector() {
  const wb = useWorkbench();
  const { modelReadOnly } = useShell();
  const { selected } = useSelection();
  const node = selected ? wb.tree?.nodes.get(selected) : undefined;
  if (!wb.tree) {
    return (
      <p className='p-4 text-sm text-ink-muted'>
        Open a model to inspect its goals and tasks.
      </p>
    );
  }
  if (!node) {
    return (
      <p className='p-4 text-[13px] text-ink-muted'>
        Select a goal or task — in the diagram, the source or the generated
        output — to inspect
        {modelReadOnly
          ? ' it'
          : ' and edit it. Add or remove goals, tasks and links in the diagram'}
        . Counts and constructs are in the Model tab.
      </p>
    );
  }
  return modelReadOnly ? (
    <NodeSummary key={node.id} node={node} />
  ) : (
    <NodeInspector key={node.id} node={node} />
  );
}

const kindLabelOf = (node: GoalViewNode): string =>
  node.kind === 'goal'
    ? 'Goal'
    : node.kind === 'task'
      ? 'Task'
      : node.kind === 'resource'
        ? 'Resource'
        : 'Quality';

/** Chip, kind and construct, with a jump to the node's lines in the output. */
function NodeHeader({ node }: { node: GoalViewNode }) {
  const wb = useWorkbench();
  const tone = nodeTone(node);
  const traceLines =
    wb.trace?.lines.filter((line) => line.primary.includes(node.id)).length ??
    0;
  return (
    <div className='flex items-start justify-between gap-2'>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          <NodeChip id={node.id} tone={tone} />
          <span className='text-2xs uppercase tracking-wider text-ink-muted'>
            {kindLabelOf(node)}
            {node.kind === 'goal' &&
              node.relation &&
              ` · ${node.relation.toUpperCase()}`}
          </span>
        </div>
        {node.construct && (
          <p className='mt-1 text-[13px] text-ink-soft'>
            <b className={tone === 'or' ? 'text-or' : 'text-and'}>
              {CONSTRUCT_LABEL[node.construct]}
            </b>{' '}
            — {CONSTRUCT_HELP[node.construct]}
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
          {traceLines} lines{' '}
          <ArrowUpRight className='h-3.5 w-3.5' aria-hidden />
        </Button>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className='grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2 py-1'>
      <dt
        className='truncate text-2xs font-semibold uppercase tracking-wider text-ink-muted'
        title={label}
      >
        {label}
      </dt>
      <dd className='min-w-0 break-words text-[13px] text-ink'>{children}</dd>
    </div>
  );
}

/**
 * The other end of a node's Qualification links: the Qualities qualifying it, or what a
 * Quality qualifies. Named when the element has no RT id (Qualities often do not).
 */
function QualificationChips({ ids }: { ids: readonly string[] }) {
  const wb = useWorkbench();
  return (
    <span className='flex flex-wrap gap-1'>
      {ids.map((id) => {
        const other = wb.tree?.nodes.get(id);
        return (
          <NodeChip
            key={id}
            id={id}
            label={other && other.id === other.iStarId ? other.name : id}
            tone={nodeTone(other)}
            onClick={() => wb.select(id, 'inspector')}
          />
        );
      })}
    </span>
  );
}

const qualificationLabel = (node: GoalViewNode) =>
  node.kind === 'quality' ? 'Qualifies' : 'Qualified by';
const qualificationIds = (node: GoalViewNode) =>
  node.kind === 'quality' ? node.qualifies : node.qualities;

/** Read-only view of a node: what is set, nothing to edit. */
function NodeSummary({ node }: { node: GoalViewNode }) {
  const wb = useWorkbench();
  const { tree } = wb;
  const properties = Object.entries(node.properties).filter(
    ([key, value]) => key !== 'root' && value !== '',
  );
  const usedVariables = wb.variables.filter((v) => v.usedBy.includes(node.id));
  return (
    <div className='space-y-3 p-4'>
      <NodeHeader node={node} />
      <dl className='divide-y divide-line'>
        <SummaryRow label='Name'>
          {node.name || <span className='text-ink-faint'>(no name)</span>}
        </SummaryRow>
        {node.notation && (
          <SummaryRow label='Notation'>
            <span className='font-mono text-xs'>{node.notation}</span>
          </SummaryRow>
        )}
        {node.children.length > 0 && (
          <SummaryRow label='Children'>
            <span className='flex flex-wrap gap-1'>
              {node.children.map((id) => (
                <NodeChip
                  key={id}
                  id={id}
                  tone={nodeTone(tree?.nodes.get(id))}
                  onClick={() => wb.select(id, 'inspector')}
                />
              ))}
            </span>
          </SummaryRow>
        )}
        {qualificationIds(node).length > 0 && (
          <SummaryRow label={qualificationLabel(node)}>
            <QualificationChips ids={qualificationIds(node)} />
          </SummaryRow>
        )}
        {properties.map(([key, value]) => (
          <SummaryRow key={key} label={key}>
            <span className='whitespace-pre-wrap font-mono text-xs'>
              {value}
            </span>
          </SummaryRow>
        ))}
        {usedVariables.length > 0 && (
          <SummaryRow label='Variables'>
            <span className='font-mono text-xs'>
              {usedVariables
                .map((v) => `${v.name} = ${String(wb.values[v.name])}`)
                .join(', ')}
            </span>
          </SummaryRow>
        )}
      </dl>
    </div>
  );
}

function NodeInspector({ node }: { node: GoalViewNode }) {
  const wb = useWorkbench();
  const { engine, tree } = wb;
  const edit = (update: (text: string) => string) =>
    wb.setText(update(wb.text), 'inspector');

  const name = useDraft(node.name, (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        composeNodeText(node.id, next, node.notation),
      ),
    ),
  );
  const notation = useDraft(node.notation ?? '', (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        composeNodeText(node.id, node.name, next || null),
      ),
    ),
  );

  // what the engine's grammar reads in the saved notation (computed on the server)
  const draftConstruct = node.construct;
  const listed = node.order;
  const pursueable = node.children.filter(
    (id) => tree?.nodes.get(id)?.kind !== 'resource',
  );
  const usedVariables = wb.variables.filter((v) => v.usedBy.includes(node.id));
  // what the engine reads: independent of the model, so also known in the piStar view (no analysis)
  const knownProperties =
    KNOWN_PROPERTIES[engine] ?? wb.analysis?.knownProperties;
  const allKnown: Record<TransformEngine, AnalyzeResponse['knownProperties']> =
    KNOWN_PROPERTIES;
  const known = useMemo(
    () => knownProperties?.[node.kind === 'quality' ? 'goal' : node.kind] ?? [],
    [knownProperties, node.kind],
  );
  // Edge engines: how each property is edited and whether it applies, given the others
  const specs = useMemo(
    () =>
      engine === 'edge' || engine === 'edgev2'
        ? PROPERTY_SPECS[engine][node.kind === 'quality' ? 'goal' : node.kind]
        : [],
    [engine, node.kind],
  );
  const specOf = (key: string) => specs.find((spec) => spec.key === key);
  const applies = (key: string) =>
    specOf(key)?.applies?.(node.properties) ?? true;
  // rows: in the spec's order, the properties that apply and are set or needed; then any
  // other set property. The engine's other applicable ones are offered when adding one
  const keys = useMemo(() => {
    const set = Object.keys(node.properties).filter((k) => k !== 'root');
    const fromSpec = specs
      .filter(
        (spec) =>
          spec.key in node.properties ||
          ((spec.applies?.(node.properties) ?? true) &&
            (spec.required?.(node.properties) ?? false)),
      )
      .map((spec) => spec.key);
    return [...new Set([...fromSpec, ...set])];
  }, [specs, node.properties]);
  // what validators may refer to: the element itself and the goals (dependsOn)
  const validation = useMemo(
    () => ({
      self: node.id,
      goalIds: tree
        ? [...tree.nodes.values()]
            .filter((n) => n.kind === 'goal')
            .map((n) => n.id)
        : [],
    }),
    [node.id, tree],
  );
  const suggestions = known.filter(
    (k) => k !== 'root' && !keys.includes(k) && applies(k),
  );

  return (
    <div className='space-y-4 p-4'>
      <NodeHeader node={node} />

      <Field
        label='Name'
        hint={
          !isValidName(name.draft)
            ? 'Only letters, spaces, hyphens and apostrophes are allowed in names.'
            : undefined
        }
      >
        <input
          className={cx(
            inputClass,
            !isValidName(name.draft) && 'border-caution',
          )}
          value={name.draft}
          onChange={(e) => name.change(e.target.value)}
          onBlur={name.flush}
        />
      </Field>

      {node.kind === 'goal' && engine !== 'sleec' && (
        <Field
          label='Execution notation'
          hint={
            notation.draft.trim() !== (node.notation ?? '')
              ? // the grammar reads it once it is saved
                'Checking the notation…'
              : notation.draft.trim()
                ? node.notationError
                  ? `Not valid for this engine: ${node.notationError}`
                  : draftConstruct
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
                <span
                  key={id}
                  className={cx(
                    listed.length > 0 &&
                      !listed.includes(id) &&
                      'rounded ring-1 ring-caution',
                  )}
                  title={
                    listed.length > 0 && !listed.includes(id)
                      ? 'Missing from the notation'
                      : undefined
                  }
                >
                  <NodeChip
                    id={id}
                    tone={nodeTone(tree?.nodes.get(id))}
                    onClick={() => wb.select(id, 'inspector')}
                  />
                </span>
              ))}
              {listed
                .filter((id) => !pursueable.includes(id))
                .map((id) => (
                  <span
                    key={id}
                    className='rounded bg-danger-soft px-1 font-mono text-2xs text-danger'
                    title='Not a child of this goal'
                  >
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
                  <span className='font-mono font-semibold'>{op}</span>{' '}
                  {CONSTRUCT_LABEL[construct]}
                </button>
              ))}
              {draftConstruct === 'degradation' &&
                !/@\d/.test(notation.draft) && (
                  <button
                    type='button'
                    title='Retry the first child up to 3 times before falling back'
                    onClick={() =>
                      notation.change(
                        notation.draft.replace(/^([A-Za-z]+\d+\w*)/, '$1@3'),
                      )
                    }
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
        <Field
          label='Refinement'
          hint='How the goal is refined into its children (the link type in the diagram).'
        >
          <div>
            <Segmented
              size='sm'
              label='Refinement'
              value={node.relation ?? 'and'}
              onChange={(relation) =>
                edit((text) => setRefinement(text, node.iStarId, relation))
              }
              options={[
                { id: 'and', label: 'AND', title: 'All children are needed' },
                { id: 'or', label: 'OR', title: 'One child is enough' },
              ]}
            />
          </div>
        </Field>
      )}

      {qualificationIds(node).length > 0 && (
        <Field
          label={qualificationLabel(node)}
          hint='Qualification links in the diagram: a Quality qualifies an element, it does not refine it.'
        >
          <QualificationChips ids={qualificationIds(node)} />
        </Field>
      )}

      <ColorField
        color={node.color}
        // what the diagram draws when no colour is saved (Edge resources are yellow)
        fallback={
          node.kind === 'resource' && (engine === 'edge' || engine === 'edgev2')
            ? EDGE_RESOURCE_FILL
            : DEFAULT_ELEMENT_FILL
        }
        onChange={(color) =>
          edit((text) => setNodeColor(text, node.iStarId, color))
        }
      />

      <div className='space-y-1.5'>
        <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
          Properties
        </span>
        {/* one grid for every row: the names get their width, the inputs the rest */}
        <div className='grid grid-cols-[minmax(0,max-content)_minmax(8rem,1fr)_auto] gap-1.5'>
          {keys.map((key) => (
            <PropertyRow
              key={key}
              name={key}
              value={node.properties[key]}
              engineKnows={known.includes(key)}
              input={
                specOf(key) ? inputOf(specOf(key)!, node.properties) : undefined
              }
              validate={
                applies(key) && specOf(key)?.validate
                  ? (value) =>
                      specOf(key)!.validate!(
                        value,
                        { ...node.properties, [key]: value },
                        validation,
                      )
                  : undefined
              }
              notApplying={
                !applies(key) && node.properties[key] !== undefined
                  ? (specOf(key)?.notApplying?.(node.properties) ??
                    'Not used with the other properties set')
                  : null
              }
              notReadBy={
                knownProperties && !known.includes(key) && key !== 'Description'
                  ? whereAccepted(
                      key,
                      node.kind === 'quality' ? 'goal' : node.kind,
                      engine,
                      knownProperties,
                      allKnown,
                    )
                  : null
              }
              onChange={(value) =>
                edit((text) => setNodeProperty(text, node.iStarId, key, value))
              }
            />
          ))}
        </div>
        <CreatableSelect
          className='pt-1'
          label='Add a property'
          placeholder={
            suggestions.length > 0
              ? `Add a property: pick one ${ENGINE_LABEL[engine]} reads, or type a name`
              : 'Add a property: type a name'
          }
          options={suggestions.map((key) => ({
            value: key,
            hint: ENGINE_LABEL[engine],
          }))}
          createLabel={(key) =>
            key in node.properties
              ? `${key} is already set`
              : `Add "${key}" (not read by ${ENGINE_LABEL[engine]})`
          }
          onSelect={(key) => {
            if (!key || key in node.properties) return;
            edit((text) => setNodeProperty(text, node.iStarId, key, ''));
          }}
        />
      </div>

      {usedVariables.length > 0 && (
        <div className='space-y-1'>
          <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
            Variables
          </span>
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
  input,
  validate,
  notApplying,
  notReadBy,
  onChange,
}: {
  name: string;
  value: string | undefined;
  engineKnows: boolean;
  /** how to edit it (Edge engines); default: by name (numbers, long text) */
  input?: PropertyInput;
  /** set, but not read with the element's other properties (bounds on a bool resource) */
  notApplying?: string | null;
  /** what the engine would reject in a value (null when fine) */
  validate?: (value: string) => string | null;
  /** why the engine ignores this property and where it would be read, when it does not read it */
  notReadBy: string | null;
  onChange: (value: string | null) => void;
}) {
  const draft = useDraft(value ?? '', (next) =>
    onChange(next === '' && value === undefined ? null : next),
  );
  const kind =
    input?.kind === 'integer' || input?.kind === 'number'
      ? input.kind
      : input
        ? undefined
        : NUMERIC_KEYS[name];
  const signed = input?.kind === 'integer' && input.min === undefined;
  const invalid =
    !!draft.draft &&
    ((kind === 'number' && !/^\d+(\.\d+)?$/.test(draft.draft)) ||
      (kind === 'integer' &&
        !(signed ? /^-?\d+$/ : /^\d+$/).test(draft.draft)));
  const long = input
    ? input.kind === 'long'
    : name === 'Description' || name === 'assertion' || name === 'maintain';
  const note = notReadBy ?? notApplying ?? null;
  // checked as typed: a select's value, or the text being edited
  const current = input?.kind === 'select' ? (value ?? '') : draft.draft;
  const error =
    (invalid
      ? kind === 'integer'
        ? 'Use a whole number'
        : 'Use a non-negative number'
      : null) ??
    validate?.(current) ??
    null;
  return (
    // a row of the properties grid (its columns: name, input, remove)
    <div className='col-span-3 grid grid-cols-subgrid items-start gap-y-1.5'>
      <span
        className={cx(
          'truncate pt-1.5 font-mono text-xs',
          note ? 'text-caution' : engineKnows ? 'text-ink' : 'text-ink-muted',
        )}
        title={
          note
            ? `${name}: ${note}`
            : engineKnows
              ? `${name} (read by this engine)`
              : name
        }
      >
        {name}
      </span>
      {input?.kind === 'select' ? (
        <select
          className={cx(
            inputClass,
            'font-mono text-xs',
            error && 'border-danger',
          )}
          aria-invalid={!!error}
          value={value ?? ''}
          aria-label={name}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : e.target.value)
          }
        >
          {/* a needed choice with no "not set" option: ask for one */}
          {value === undefined &&
            !input.options.some((o) => o.value === '') && (
              <option value='' disabled>
                choose…
              </option>
            )}
          {/* a value the options do not list stays visible */}
          {value !== undefined &&
            value !== '' &&
            !input.options.some((o) => o.value === value) && (
              <option value={value}>{value} (not an option)</option>
            )}
          {input.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : long ? (
        <textarea
          rows={name === 'Description' ? 2 : 1}
          className={cx(
            inputClass,
            'resize-y font-mono text-xs',
            error && 'border-danger',
          )}
          aria-invalid={!!error}
          value={draft.draft}
          placeholder={
            value === undefined
              ? input && 'placeholder' in input && input.placeholder
                ? input.placeholder
                : 'not set'
              : ''
          }
          onChange={(e) => draft.change(e.target.value)}
          onBlur={draft.flush}
        />
      ) : (
        <input
          className={cx(
            inputClass,
            'font-mono text-xs',
            error && 'border-danger',
          )}
          value={draft.draft}
          placeholder={value === undefined ? 'not set' : ''}
          inputMode={
            kind === 'integer' ? 'numeric' : kind ? 'decimal' : undefined
          }
          aria-invalid={!!error}
          title={error ?? undefined}
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
      {error && (
        <span
          role='alert'
          className='col-span-2 col-start-2 -mt-0.5 text-2xs text-danger'
        >
          {error}
        </span>
      )}
      {note && (
        <span className='col-span-2 col-start-2 -mt-0.5 text-2xs text-caution'>
          {note}
        </span>
      )}
    </div>
  );
}

/** "#abc", "#aabbcc" or "rgb(…)" as "#aabbcc" (what a colour input takes); null otherwise. */
const toHex = (color: string): string | null => {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if (rgb)
    return `#${rgb
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`;
  return null;
};

/** The element's fill: a colour picker, its hex value, and a reset to the default fill. */
function ColorField({
  color,
  fallback,
  onChange,
}: {
  color: string | null;
  fallback: string;
  onChange: (color: string | null) => void;
}) {
  const shown = (color && toHex(color)) ?? toHex(fallback) ?? '#ffffff';
  return (
    <div className='space-y-1'>
      <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
        Color
      </span>
      <div className='flex items-center gap-2'>
        <input
          type='color'
          aria-label='Element color'
          value={shown}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className='h-7 w-10 cursor-pointer rounded border border-line-strong bg-white p-0.5'
        />
        <span className='font-mono text-xs text-ink-soft'>
          {color
            ? (toHex(color)?.toUpperCase() ?? color)
            : `default (${fallback.toUpperCase()})`}
        </span>
        {color && (
          <button
            type='button'
            onClick={() => onChange(null)}
            className='ml-auto rounded px-1.5 py-0.5 text-2xs text-ink-muted hover:bg-panel hover:text-ink'
            title='Back to the default fill'
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
