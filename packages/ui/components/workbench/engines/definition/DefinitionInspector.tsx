'use client';

import type { GoalViewNode } from '@goal-controller/goal-tree';
import {
  constructHint,
  elementLine,
  fillOf,
  operatorsFor,
  propertyOf,
  relationMismatch,
  valueOf,
  type Severity,
} from '@goal-controller/definitions';
import { useMemo } from 'react';
import {
  ENGINE_DEFINITIONS,
  type DefinedEngine,
} from '@/lib/workbench/definitions';
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
  SelectedNode,
  VariablesField,
  inputClass,
  useDraft,
  useEditModel,
  type PropertyEditor,
} from '../shared/inspector';
import DefinitionValueEditor from './DefinitionValueEditor';
import { useLanguageSupport } from './useLanguageSupport';

/** Value configs edited in the engine's value language (one-line editors with its support). */
const LANGUAGE_VALUES = new Set(['expression', 'refList', 'pairList']);

const BUTTON =
  'rounded border border-line bg-white px-1.5 py-0.5 text-2xs text-ink-soft hover:border-trace hover:text-ink';

/** A goal's notation, with the operators, constructs and problems its definition declares. */
function NotationField({
  node,
  engine,
}: {
  node: GoalViewNode;
  engine: DefinedEngine;
}) {
  const definition = ENGINE_DEFINITIONS[engine];
  const { problems, notation: notationDefinition } = definition;
  const operators = useMemo(() => operatorsFor(definition), [definition]);
  const wb = useWorkbench();
  const { tree } = wb;
  const edit = useEditModel();
  const notation = useDraft(node.notation ?? '', (next) =>
    edit((text) =>
      setNodeText(
        text,
        node.iStarId,
        elementLine(definition, {
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
  const operandKinds: readonly string[] = notationDefinition.operand.kinds;
  const operands = node.children.filter((id) =>
    operandKinds.includes(tree?.nodes.get(id)?.kind ?? ''),
  );
  const notChildren = listed.filter((id) => !operands.includes(id));
  const missing =
    listed.length > 0 ? operands.filter((id) => !listed.includes(id)) : [];
  // what is wrong with the saved notation, shown when hovering the field
  const saved = notation.draft.trim() === (node.notation ?? '');
  const mismatch = relationMismatch(definition, node.construct, node.relation);
  const issues: Array<{ severity: Severity; message: string }> = saved
    ? [
        ...(node.notationError
          ? [
              {
                severity: 'error' as const,
                message: `Not valid for this engine: ${node.notationError}`,
              },
            ]
          : []),
        ...notChildren.map((id) => ({
          severity: problems.notAChild.severity,
          message: `${id}: ${problems.notAChild.message}`,
        })),
        ...(mismatch
          ? [
              {
                severity: problems.relationMismatch.severity,
                message: mismatch,
              },
            ]
          : []),
        ...missing.map((id) => ({
          severity: problems.missingFromNotation.severity,
          message: `${id}: ${problems.missingFromNotation.message}`,
        })),
      ]
    : [];
  const errors = issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
  const messages = issues.map((issue) => issue.message);
  const fallback =
    notationDefinition.defaultConstruct[node.relation === 'or' ? 'or' : 'and'];

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
                ? constructHint(definition, draftConstruct)
                : 'No operator this engine understands.'
              : `No notation: ${fallback} by default.`
      }
    >
      <input
        className={cx(
          inputClass,
          'font-mono',
          messages.length > 0 &&
            (errors.length > 0 ? '!border-danger' : '!border-caution'),
        )}
        value={notation.draft}
        placeholder={
          operands.join(operators.constructs[0]?.symbol ?? ' ') || undefined
        }
        title={messages.length > 0 ? messages.join('\n') : undefined}
        aria-invalid={messages.length > 0 || undefined}
        onChange={(e) => notation.change(e.target.value)}
        onBlur={notation.flush}
        spellCheck={false}
      />
      {operands.length > 0 && (
        <div className='flex flex-wrap items-center gap-1 pt-1'>
          <span className='text-2xs text-ink-muted'>Children:</span>
          {operands.map((id) => (
            <span
              key={id}
              className={cx(
                missing.includes(id) && 'rounded ring-1 ring-caution',
              )}
              title={
                missing.includes(id)
                  ? problems.missingFromNotation.message
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
          {notChildren.map((id) => (
            <span
              key={id}
              className='rounded bg-danger-soft px-1 font-mono text-2xs text-danger'
              title={problems.notAChild.message}
            >
              {id}?
            </span>
          ))}
        </div>
      )}
      {operands.length > 1 && (
        <div className='flex flex-wrap gap-1 pt-1'>
          {operators.constructs.map((button) => (
            <button
              key={`${button.symbol}-${button.construct}`}
              type='button'
              title={button.title}
              onClick={() => notation.change(button.write(operands))}
              className={BUTTON}
            >
              <span className='font-mono font-semibold'>{button.symbol}</span>{' '}
              {button.label}
            </button>
          ))}
          {operators.arguments
            .filter(
              (button) =>
                draftConstruct &&
                button.appliesTo.includes(draftConstruct) &&
                !button.present(notation.draft),
            )
            .map((button) => (
              <button
                key={button.symbol}
                type='button'
                title={button.title}
                onClick={() => notation.change(button.write(notation.draft))}
                className={BUTTON}
              >
                <span className='font-mono font-semibold'>{button.text}</span>{' '}
                {button.label}
              </button>
            ))}
        </div>
      )}
    </Field>
  );
}

/** The node editor an engine's definition gives: its notation, properties and fills. */
function DefinitionNode({
  node,
  engine,
}: {
  node: GoalViewNode;
  engine: DefinedEngine;
}) {
  const definition = ENGINE_DEFINITIONS[engine];
  const support = useLanguageSupport(engine);
  // the keys whose values are written in the engine's value languages
  const editorFor = (key: string): PropertyEditor | undefined => {
    const property = propertyOf(definition, node.kind, key);
    if (
      !property ||
      !LANGUAGE_VALUES.has(valueOf(property, node.properties).type)
    )
      return undefined;
    return function ValueEditor(props) {
      return (
        <DefinitionValueEditor
          support={support}
          id={node.id}
          property={key}
          {...props}
        />
      );
    };
  };
  return (
    <div className='space-y-4 p-4'>
      <NodeHeader node={node} />
      <NameField node={node} />
      {node.kind === 'goal' && <NotationField node={node} engine={engine} />}
      <RefinementField node={node} />
      <QualificationField node={node} />
      <NodeColorField node={node} fallback={fillOf(definition, node.kind)} />
      <PropertiesField
        node={node}
        engine={engine}
        specs={PROPERTY_SPECS[engine][node.kind]}
        editorFor={editorFor}
      />
      <VariablesField node={node} />
    </div>
  );
}

/** The selected node's editor, built from the engine's definition. */
export default function DefinitionInspector({
  engine,
}: {
  engine: DefinedEngine;
}) {
  return (
    <SelectedNode>
      {(node) => <DefinitionNode key={node.id} node={node} engine={engine} />}
    </SelectedNode>
  );
}
