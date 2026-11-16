'use client';

import { goalView, type GoalView } from '@goal-controller/goal-tree';
import { contextFromView } from '@goal-controller/goal-language';
import type { AnyDialect } from '@goal-controller/dialect';
import { useContext, useEffect, useMemo, useRef } from 'react';
import {
  FRAMEWORK_DIALECTS,
  type FrameworkMode,
} from '@/lib/workbench/frameworkModes';
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from '../definition/NotationEditor';
import { LanguageSupportContext } from '../definition/useLanguageSupport';
import { useProfiledDefinition } from './useProfiledDefinition';

/**
 * A KAOS or NFR model as its framework's lines (goal-controller#171): each
 * element by its kind's word and its id (the one its name starts with, else
 * its piStar id's first characters, goal-controller#518:
 * `behavioral_goal 7857cb00: Achieve [Manual Backup]`), its name to the
 * line's end, its properties under it, a refinement's children under what
 * they refine (a KAOS hub is an AND). Elements are added, removed and edited
 * here, links in the diagram; the shared goal language checks the text (no
 * engine: no named checks).
 */
export default function FrameworkNotationView({
  mode,
  definition: given = FRAMEWORK_DIALECTS[mode],
}: {
  mode: FrameworkMode;
  /** the dialect its lines are read in: its framework's, or its engine's (nfrprop's labels) */
  definition?: AnyDialect;
}) {
  const { session, projectResources } = useWorkbench();
  const model = session.store.getModel();
  // with the vocabulary profile the model records (a CAIRIS model's, #192)
  const definition = useProfiledDefinition(given, model);
  // the last view read stays while the model is being fixed (the store
  // keeps its last valid model, so this comes free of any parse, #449)
  const last = useRef<GoalView | null>(null);
  const tree = useMemo(() => {
    try {
      last.current = goalView(model, definition);
    } catch {
      // kept
    }
    return last.current;
  }, [model, definition]);
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
  return (
    <div className='flex h-full flex-col'>
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
