'use client';

import type { GoalViewNode, ViewConstruct } from '@goal-controller/goal-tree';
import { elementLine, fillOf } from '@goal-controller/definitions';
import { ENGINE_DEFINITIONS } from '@/lib/workbench/definitions';
import { PROPERTY_SPECS } from '@/lib/workbench/edgeProperties';
import { nodeTone, setNodeText } from '@/lib/workbench/pistar';
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
  engine,
  operators,
}: {
  node: GoalViewNode;
  engine: 'edge' | 'edgev2';
  operators: readonly NotationOperator[];
}) {
  const { constructs } = ENGINE_DEFINITIONS[engine].notation;
  const wb = useWorkbench();
  const { tree } = wb;
  const edit = useEditModel();
  const notation = useDraft(node.notation ?? '', (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        elementLine(ENGINE_DEFINITIONS[engine], {
          id: node.id,
          name: node.name,
          notation: next || null,
        }),
      ),
    ),
  );
  // what the engine's grammar reads in the saved notation
  const draftConstruct = node.construct;
  const listed = node.order;
  const pursueable = node.children.filter(
    (id) => tree?.nodes.get(id)?.kind !== 'resource',
  );

  return (
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
                ? `${constructs[draftConstruct].label} — ${constructs[draftConstruct].help}`
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
          {operators.map(({ op, construct, title, notation: write }) => (
            <button
              key={`${op}-${construct}`}
              type='button'
              title={
                title ??
                `${constructs[construct].label}: ${constructs[construct].help}`
              }
              onClick={() =>
                notation.change(write ? write(pursueable) : pursueable.join(op))
              }
              className='rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink'
            >
              <span className='font-mono font-semibold'>{op}</span>{' '}
              {constructs[construct].label}
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
        <NotationField node={node} engine={engine} operators={operators} />
      )}
      <RefinementField node={node} />
      <QualificationField node={node} />
      <NodeColorField
        node={node}
        // Edge resources are drawn yellow when no colour is saved
        fallback={fillOf(ENGINE_DEFINITIONS[engine], node.kind)}
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
