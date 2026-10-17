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
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from '../definition/NotationEditor';
import { LanguageSupportContext } from '../definition/useLanguageSupport';

/**
 * A KAOS or NFR model as its framework's lines (goal-controller#171): each
 * element by its id (KAOS `G1`, `A1`, `DP1`; NFR `S1`, `O1`, `C1`), its
 * name to the line's end, its properties under it, a refinement's children
 * under what they refine (a KAOS hub is an AND). Names and properties are
 * edited here, elements and links in the diagram; the shared goal language
 * checks the text (no engine: no named checks).
 */
export default function FrameworkNotationView({
  mode,
}: {
  mode: FrameworkMode;
}) {
  const { text } = useWorkbench();
  const definition: AnyDialect = FRAMEWORK_DIALECTS[mode];
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
  useEffect(() => {
    if (tree) support.setContext(contextFromView(definition, tree, []));
  }, [tree, support, definition]);
  return (
    <NotationEditor
      definition={definition}
      tree={tree}
      support={support}
      selectable={false}
    />
  );
}
