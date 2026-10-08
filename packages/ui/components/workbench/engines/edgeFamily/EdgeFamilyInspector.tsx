'use client';

import type { GoalViewNode, ViewConstruct } from '@goal-controller/goal-tree';
import {
  DEFAULT_ELEMENT_FILL,
  EDGE_RESOURCE_FILL,
  PROPERTY_SPECS,
} from '@/lib/workbench/edgeProperties';
import { composeNodeText, nodeTone, setNodeText } from '@/lib/workbench/pistar';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
} from '@goal-controller/rt-language/constructs';
import {
  MISSING_FROM_NOTATION,
  NOT_A_CHILD,
} from '@goal-controller/rt-language/structure';
import { useWorkbench } from '../../WorkbenchContext';
import { NodeChip, cx } from '../../ui';
import {
  Field,
  NameField,
  NodeColorField,
  NodeHeader,
  PropertiesField,
  QualificationField,
  RefinementField,
  VariablesField,
  inputClass,
  useDraft,
  useEditModel,
} from '../shared/inspector';

/** A notation operator the engine reads, offered as a button that writes it over the children. */
export type NotationOperator = {
  op: string;
  construct: ViewConstruct;
  /** default: the construct's label and help */
  title?: string;
  /** the notation it writes; default: the children joined by `op` */
  notation?: (children: readonly string[]) => string;
};

/** A goal's execution notation ("G2;G3"), with the operators this engine reads. */
function NotationField({
  node,
  operators,
}: {
  node: GoalViewNode;
  operators: readonly NotationOperator[];
}) {
  const wb = useWorkbench();
  const { tree } = wb;
  const edit = useEditModel();
  const notation = useDraft(node.notation ?? '', (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        composeNodeText(node.id, node.name, next || null),
      ),
    ),
  );
  // what the engine's grammar reads in the saved notation
  const draftConstruct = node.construct;
  const listed = node.order;
  const pursueable = node.children.filter(
    (id) => tree?.nodes.get(id)?.kind !== 'resource',
  );
  const notChildren = listed.filter((id) => !pursueable.includes(id));
  const missing =
    listed.length > 0 ? pursueable.filter((id) => !listed.includes(id)) : [];
  // what is wrong with the saved notation, shown when hovering the field
  const saved = notation.draft.trim() === (node.notation ?? '');
  const errors = saved
    ? [
        ...(node.notationError
          ? [`Not valid for this engine: ${node.notationError}`]
          : []),
        ...notChildren.map((id) => `${id}: ${NOT_A_CHILD}`),
      ]
    : [];
  const problems = [
    ...errors,
    ...(saved ? missing.map((id) => `${id}: ${MISSING_FROM_NOTATION}`) : []),
  ];

  return (
    <Field
      label='Execution notation'
      hintTone={errors.length > 0 ? 'error' : 'muted'}
      hint={
        !saved
          ? // the grammar reads it once it is saved
            'Checking the notation…'
          : errors.length > 0
            ? errors.join('\n')
            : notation.draft.trim()
              ? draftConstruct
                ? `${CONSTRUCT_LABEL[draftConstruct]} — ${CONSTRUCT_HELP[draftConstruct]}`
                : 'No operator this engine understands.'
              : `No notation: ${node.relation === 'or' ? 'alternative' : 'interleaved'} by default.`
      }
    >
      <input
        className={cx(
          inputClass,
          'font-mono',
          problems.length > 0 &&
            (errors.length > 0 ? '!border-danger' : '!border-caution'),
        )}
        title={problems.length > 0 ? problems.join('\n') : undefined}
        aria-invalid={problems.length > 0 || undefined}
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
                missing.includes(id) && 'rounded ring-1 ring-caution',
              )}
              title={missing.includes(id) ? MISSING_FROM_NOTATION : undefined}
            >
              <NodeChip
                id={id}
                tone={nodeTone(tree?.nodes.get(id))}
                onClick={() => wb.select(id, 'inspector')}
              />
            </span>
          ))}
          {notChildren.map((id) => (
            <span
              key={id}
              className='rounded bg-danger-soft px-1 font-mono text-2xs text-danger'
              title={NOT_A_CHILD}
            >
              {id}?
            </span>
          ))}
        </div>
      )}
      {pursueable.length > 1 && (
        <div className='flex flex-wrap gap-1 pt-1'>
          {operators.map(({ op, construct, title, notation: write }) => (
            <button
              key={`${op}-${construct}`}
              type='button'
              title={
                title ??
                `${CONSTRUCT_LABEL[construct]}: ${CONSTRUCT_HELP[construct]}`
              }
              onClick={() =>
                notation.change(write ? write(pursueable) : pursueable.join(op))
              }
              className='rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink'
            >
              <span className='font-mono font-semibold'>{op}</span>{' '}
              {CONSTRUCT_LABEL[construct]}
            </button>
          ))}
          {draftConstruct === 'degradation' && !/@\d/.test(notation.draft) && (
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
        </div>
      )}
    </Field>
  );
}

/**
 * The node editor of the Edge engines (Edge, EdgeV2): they read the same elements and
 * properties (PROPERTY_SPECS), and differ in the notation operators each declares.
 */
export default function EdgeFamilyInspector({
  node,
  engine,
  operators,
}: {
  node: GoalViewNode;
  engine: 'edge' | 'edgev2';
  operators: readonly NotationOperator[];
}) {
  return (
    <div className='space-y-4 p-4'>
      <NodeHeader node={node} />
      <NameField node={node} />
      {node.kind === 'goal' && (
        <NotationField node={node} operators={operators} />
      )}
      <RefinementField node={node} />
      <QualificationField node={node} />
      <NodeColorField
        node={node}
        // Edge resources are drawn yellow when no colour is saved
        fallback={
          node.kind === 'resource' ? EDGE_RESOURCE_FILL : DEFAULT_ELEMENT_FILL
        }
      />
      <PropertiesField
        node={node}
        engine={engine}
        specs={PROPERTY_SPECS[engine][node.kind]}
      />
      <VariablesField node={node} />
    </div>
  );
}
