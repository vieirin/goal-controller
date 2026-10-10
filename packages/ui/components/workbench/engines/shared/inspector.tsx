'use client';

import { ArrowUpRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GoalViewNode } from '@goal-controller/goal-tree';
import { constructDefinition } from '@goal-controller/dialect';
import {
  checkContextOf,
  elementLine,
  isValidName,
} from '@goal-controller/goal-language';
import { KNOWN_PROPERTIES } from '@/lib/models/knownProperties';
import type { TransformEngine } from '@/lib/types';
import {
  inputOf,
  type NodeKindKey,
  type PropertyInput,
  type PropertySpec,
} from '@/lib/workbench/edgeProperties';
import type { AnalyzeResponse } from '@/lib/workbench/types';
import { contextOf } from '@/lib/workbench/notationDocument';
import {
  ENGINE_LABEL,
  notationDefinitionOf,
} from '@/lib/workbench/engineDialects';
import {
  nodeTone,
  setNodeColor,
  setNodeProperty,
  setNodeText,
  setRefinement,
} from '@/lib/workbench/pistar';
import { useSelection, useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';
import { CreatableSelect, Button, NodeChip, Segmented, cx } from '../../ui';

/**
 * The inspector pieces every engine's inspector is built from (engines/<engine>/): the
 * selected node, its name, refinement, qualifications, colour, properties and variables,
 * and the read-only summary. What an engine adds (the Edge notation editor) lives with it.
 */

/**
 * Local text state that commits after a short pause. While it is being edited, the value
 * coming back is not taken: the tree is computed on the server, so it echoes a commit a
 * request later and would overwrite what was typed since. It is taken again once it
 * catches up with the draft (or shortly after the field is left).
 */
export const useDraft = (
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

const KIND_PLURAL: Record<NodeKindKey, string> = {
  goal: 'goals',
  task: 'tasks',
  resource: 'resources',
  quality: 'qualities',
};
const listKinds = (kinds: NodeKindKey[]): string =>
  kinds.map((k) => KIND_PLURAL[k]).join(kinds.length === 2 ? ' and ' : ', ');

/** Where each engine declares the properties it reads, per element kind, and maps them. */
type EngineKeys = {
  /** where the keys are declared */
  file: string;
  lists: Partial<Record<NodeKindKey, string>>;
  /** where they are read */
  mapper: string;
  map: Record<NodeKindKey, string>;
};

const ENGINE_KEYS: Record<TransformEngine, EngineKeys> = {
  ...(Object.fromEntries(
    (['edge', 'edgev2'] as const).map((engine) => [
      engine,
      {
        file: 'packages/lib/src/engines/edgeFamily/properties.ts',
        lists: {
          goal: 'edgeProperties.goal',
          task: 'edgeProperties.task',
          resource: 'edgeProperties.resource',
          quality: 'edgeProperties.quality',
        },
        mapper: `packages/lib/src/engines/${engine === 'edge' ? 'edge' : 'edgeV2'}/mapper.ts`,
        map: {
          goal: 'mapGoalProps',
          task: 'mapTaskProps',
          resource: 'mapResourceProps',
          quality: 'mapGoalProps',
        },
      },
    ]),
  ) as Record<'edge' | 'edgev2', EngineKeys>),
  mutrose: {
    file: 'packages/lib/src/engines/mutrose/definition.ts',
    lists: { goal: 'goalProperties', task: 'taskProperties' },
    mapper: 'packages/lib/src/engines/mutrose/mapper.ts',
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
      quality: 'mapGoalProps',
    },
  },
  goda: {
    file: 'packages/lib/src/engines/goda/definition.ts',
    lists: { goal: 'goalProperties', task: 'taskProperties' },
    mapper: 'packages/lib/src/engines/goda/mapper.ts',
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
      quality: 'mapGoalProps',
    },
  },
  sleec: {
    file: 'packages/lib/src/engines/sleec/mapper.ts',
    lists: {
      goal: 'SLEEC_GOAL_KEYS',
      task: 'SLEEC_TASK_KEYS',
      quality: 'SLEEC_QUALITY_KEYS',
    },
    mapper: 'packages/lib/src/engines/sleec/mapper.ts',
    map: {
      goal: 'mapGoalProps',
      task: 'mapTaskProps',
      resource: 'mapResourceProps',
      quality: 'mapGoalProps',
    },
  },
};

/** What to change so the engine reads a property on this kind of element. */
const howToAccept = (
  key: string,
  kind: NodeKindKey,
  engine: TransformEngine,
): string => {
  const { file, lists, mapper, map } = ENGINE_KEYS[engine];
  const list = lists[kind];
  const where = mapper === file ? '' : ` in ${mapper}`;
  return list
    ? `To make ${ENGINE_LABEL[engine]} read it here, add '${key}' to ${list} in ${file} and use it in ${map[kind]}${where}.`
    : `${ENGINE_LABEL[engine]} skips ${KIND_PLURAL[kind]} (skipResource in ${file}).`;
};

/**
 * Why the engine ignores a property here, where it is read instead (another kind of element,
 * another engine), and which structure to update for the engine to read it here.
 */
export const whereAccepted = (
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

export function Field({
  label,
  hint,
  hintTone = 'muted',
  children,
}: {
  label: string;
  hint?: ReactNode;
  /** `error`: the hint says what is wrong with the value */
  hintTone?: 'muted' | 'error';
  children: ReactNode;
}) {
  return (
    <label className='block space-y-1'>
      <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
        {label}
      </span>
      {children}
      {hint && (
        <span
          role={hintTone === 'error' ? 'alert' : undefined}
          className={cx(
            'block whitespace-pre-line text-2xs',
            hintTone === 'error' ? 'text-danger' : 'text-ink-muted',
          )}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-line-strong bg-white px-2 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:border-trace focus:outline-none';

const kindLabelOf = (node: GoalViewNode): string =>
  node.kind === 'goal'
    ? 'Goal'
    : node.kind === 'task'
      ? 'Task'
      : node.kind === 'resource'
        ? 'Resource'
        : 'Quality';

/** Chip, kind and construct, with a jump to the node's lines in the output. */
export function NodeHeader({ node }: { node: GoalViewNode }) {
  const wb = useWorkbench();
  const tone = nodeTone(node);
  const construct = node.construct
    ? constructDefinition(notationDefinitionOf(wb.engine), node.construct)
    : undefined;
  const traceLines =
    wb.trace?.lines.filter((line) => line.primary.includes(node.key)).length ??
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
        {construct && (
          <p className='mt-1 text-[13px] text-ink-soft'>
            <b className={tone === 'or' ? 'text-or' : 'text-and'}>
              {construct.label}
            </b>{' '}
            — {construct.help}
          </p>
        )}
      </div>
      {traceLines > 0 && (
        <Button
          variant='outline'
          onClick={() => {
            wb.setOutputTab('output');
            wb.select(node.key, 'inspector');
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
export function QualificationChips({ ids }: { ids: readonly string[] }) {
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

export const qualificationLabel = (node: GoalViewNode) =>
  node.kind === 'quality' ? 'Qualifies' : 'Qualified by';
export const qualificationIds = (node: GoalViewNode) =>
  node.kind === 'quality' ? node.qualifies : node.qualities;

/** Read-only view of a node: what is set, nothing to edit. */
export function NodeSummary({ node }: { node: GoalViewNode }) {
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

/** A property value's editor, in place of the row's default input. */
export type PropertyEditor = (props: {
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) => ReactNode;

export function PropertyRow({
  name,
  value,
  engineKnows,
  input,
  validate,
  notApplying,
  notReadBy,
  editor,
  onChange,
}: {
  name: string;
  value: string | undefined;
  engineKnows: boolean;
  /** edits the value instead of the default input (e.g. an engine's value language) */
  editor?: PropertyEditor;
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
      ) : editor ? (
        editor({
          value: draft.draft,
          placeholder:
            value === undefined
              ? input && 'placeholder' in input && input.placeholder
                ? input.placeholder
                : 'not set'
              : '',
          invalid: !!error,
          onChange: draft.change,
          onBlur: draft.flush,
        })
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
export function ColorField({
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

/**
 * The selected node, for an engine's inspector: what to say with no model or no
 * selection, and the read-only summary (the same for every engine); otherwise `children`
 * renders the engine's editor, keyed by node so its drafts start over.
 */
export function SelectedNode({
  children,
}: {
  children: (node: GoalViewNode) => ReactNode;
}) {
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
    <NodeSummary key={node.key} node={node} />
  ) : (
    children(node)
  );
}

/** Writes an edit of the model text, as the inspector's. */
export const useEditModel = () => {
  const wb = useWorkbench();
  return (update: (text: string) => string) =>
    wb.setText(update(wb.text), 'inspector');
};

export function NameField({ node }: { node: GoalViewNode }) {
  const definition = notationDefinitionOf(useWorkbench().engine);
  const edit = useEditModel();
  const name = useDraft(node.name, (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        elementLine(definition, {
          id: node.id,
          name: next,
          notation: node.notation,
        }),
      ),
    ),
  );
  const valid = isValidName(definition, node.kind, name.draft);
  return (
    <Field
      label='Name'
      hint={
        !valid
          ? 'Only letters, spaces, hyphens and apostrophes are allowed in names.'
          : undefined
      }
    >
      <input
        className={cx(inputClass, !valid && 'border-caution')}
        value={name.draft}
        onChange={(e) => name.change(e.target.value)}
        onBlur={name.flush}
      />
    </Field>
  );
}

export function RefinementField({ node }: { node: GoalViewNode }) {
  const edit = useEditModel();
  if (node.kind !== 'goal' || node.children.length === 0) return null;
  return (
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
  );
}

export function QualificationField({ node }: { node: GoalViewNode }) {
  if (qualificationIds(node).length === 0) return null;
  return (
    <Field
      label={qualificationLabel(node)}
      hint='Qualification links in the diagram: a Quality qualifies an element, it does not refine it.'
    >
      <QualificationChips ids={qualificationIds(node)} />
    </Field>
  );
}

/** The element's fill, with what the diagram draws when none is saved. */
export function NodeColorField({
  node,
  fallback,
}: {
  node: GoalViewNode;
  fallback: string;
}) {
  const edit = useEditModel();
  return (
    <ColorField
      color={node.color}
      fallback={fallback}
      onChange={(color) =>
        edit((text) => setNodeColor(text, node.iStarId, color))
      }
    />
  );
}

/**
 * The node's custom properties: what the engine reads and what it ignores (and where it
 * would be read). `specs`, when the engine has them, say how each is edited, whether it
 * applies given the others, and what the engine would reject.
 */
export function PropertiesField({
  node,
  engine,
  specs = [],
  editorFor,
}: {
  node: GoalViewNode;
  engine: TransformEngine;
  specs?: readonly PropertySpec[];
  /** a key's editor, when the engine has one for it */
  editorFor?: (key: string) => PropertyEditor | undefined;
}) {
  const wb = useWorkbench();
  const { tree } = wb;
  const edit = useEditModel();
  // what the engine reads: independent of the model, so also known in the piStar view (no analysis)
  const knownProperties =
    KNOWN_PROPERTIES[engine] ?? wb.analysis?.knownProperties;
  const allKnown: Record<TransformEngine, AnalyzeResponse['knownProperties']> =
    KNOWN_PROPERTIES;
  const known = useMemo(
    () => knownProperties?.[node.kind] ?? [],
    [knownProperties, node.kind],
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
  // what a validate function is given: this node's id, and the model it is in
  // (other elements' kinds for dependsOn, the whole tree for MutRoSe's scoping)
  const checkContext = useMemo(
    () =>
      checkContextOf(
        tree
          ? contextOf(
              notationDefinitionOf(engine),
              tree,
              [],
              wb.projectResources,
            )
          : { elements: {}, variables: [] },
        node.key,
      ),
    [engine, node.key, tree, wb.projectResources],
  );
  const suggestions = known.filter(
    (k) => k !== 'root' && !keys.includes(k) && applies(k),
  );

  return (
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
                      { ...node.properties, [key]: value },
                      checkContext,
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
                    node.kind,
                    engine,
                    knownProperties,
                    allKnown,
                  )
                : null
            }
            editor={editorFor?.(key)}
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
  );
}

/** The variables the generated model has for this node, edited in the Variables panel. */
export function VariablesField({ node }: { node: GoalViewNode }) {
  const wb = useWorkbench();
  const usedVariables = wb.variables.filter((v) => v.usedBy.includes(node.id));
  if (usedVariables.length === 0) return null;
  return (
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
  );
}
