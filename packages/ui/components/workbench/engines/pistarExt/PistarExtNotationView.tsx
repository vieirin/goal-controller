'use client';

import { contextFromView } from '@goal-controller/dialect';
import { useEffect, useMemo, useRef } from 'react';
import { dialectTree, parseModel } from '@/lib/workbench/dialects';
import { localLanguageSupport } from '@/lib/workbench/languageSupport';
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from '../definition/NotationEditor';
import { usePistarExt } from './usePistarExt';

/**
 * The model as piStar-ext's lines: each element's stereotype and tagged value before its
 * name, an actor's elements under it. A line is its element's by position (names carry no
 * ids), so lines are edited here, and elements added or removed in the diagram.
 */
export default function PistarExtNotationView() {
  const { text } = useWorkbench();
  // the dialect with what the model adds
  const { definition } = usePistarExt();
  // the last tree read stays while the model is being fixed
  const last = useRef<ReturnType<typeof dialectTree> | null>(null);
  const tree = useMemo(() => {
    try {
      last.current = dialectTree(parseModel(text));
    } catch {
      // kept
    }
    return last.current;
  }, [text]);
  // no engine: no checks; the text is checked against the model's elements
  const support = useMemo(
    () => localLanguageSupport(definition, {}),
    [definition],
  );
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
