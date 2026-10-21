'use client';

import { goalView, type GoalView } from '@goal-controller/goal-tree';
import { contextFromView } from '@goal-controller/goal-language';
import type { AnyDialect } from '@goal-controller/dialect';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { parseModel } from '@/lib/workbench/dialects';
import {
  FRAMEWORK_DIALECTS,
  type FrameworkMode,
} from '@/lib/workbench/frameworkModes';
import { withFrameworkIds } from '@/lib/workbench/frameworkOpen';
import { useWorkbench } from '../../WorkbenchContext';
import { Button } from '../../ui';
import NotationEditor from '../definition/NotationEditor';
import { LanguageSupportContext } from '../definition/useLanguageSupport';
import { useProfiledDefinition } from './useProfiledDefinition';

/**
 * A KAOS or NFR model as its framework's lines (goal-controller#171): each
 * element by its id (KAOS `G1`, `A1`, `DP1`; NFR `S1`, `O1`, `C1`), its
 * name to the line's end, its properties under it, a refinement's children
 * under what they refine (a KAOS hub is an AND). Names and properties are
 * edited here, elements and links in the diagram; the shared goal language
 * checks the text (no engine: no named checks). A model whose elements have
 * no ids (DSM3's own files) is offered them, one undoable edit.
 */
export default function FrameworkNotationView({
  mode,
  definition: given = FRAMEWORK_DIALECTS[mode],
}: {
  mode: FrameworkMode;
  /** the dialect its lines are read in: its framework's, or its engine's (nfrprop's labels) */
  definition?: AnyDialect;
}) {
  const wb = useWorkbench();
  const { text, projectResources } = wb;
  // with the vocabulary profile the model records (a CAIRIS model's, #192)
  const definition = useProfiledDefinition(given, text);
  // the last view read stays while the model is being fixed
  const last = useRef<GoalView | null>(null);
  const tree = useMemo(() => {
    try {
      last.current = goalView(parseModel(text) as never, definition);
    } catch {
      // kept
    }
    return last.current;
  }, [text, definition]);
  const support = useContext(LanguageSupportContext)(mode, definition);
  // with the project's resources: the entries a keyed key names
  // (`Probability[e1]`, goal-controller#354), checked and completed
  useEffect(() => {
    if (tree)
      support.setContext({
        ...contextFromView(definition, tree, []),
        ...(projectResources && { projectResources }),
      });
  }, [tree, support, definition, projectResources]);
  // DSM3's own files name no element with an id: one click gives them theirs
  const withIds = useMemo(
    () => withFrameworkIds(text, definition),
    [text, definition],
  );
  const prefixes = [
    ...new Set(
      Object.values(definition.elements).flatMap((e) =>
        e?.prefix ? [`${e.prefix}…`] : [],
      ),
    ),
  ].join(', ');
  return (
    <div className='flex h-full flex-col'>
      {withIds && (
        <div
          role='status'
          className='flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-1.5 text-[13px] text-ink-soft'
        >
          <span className='mr-auto'>
            Some elements have no id, so no line can name them.
          </span>
          <Button
            variant='outline'
            onClick={() => wb.setText(withIds, 'convert')}
          >
            Give every element an id ({prefixes})
          </Button>
        </div>
      )}
      <div className='min-h-0 flex-1'>
        <NotationEditor
          definition={definition}
          tree={tree}
          support={support}
          selectable={false}
        />
      </div>
    </div>
  );
}
