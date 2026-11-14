'use client';

import { contextFromView } from '@goal-controller/goal-language';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { dialectTree } from '@/lib/workbench/dialects';
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from '../definition/NotationEditor';
import { LanguageSupportContext } from '../definition/useLanguageSupport';
import { usePistarExt } from './usePistarExt';

/**
 * The model as piStar-ext's lines: each element's stereotype and tagged value before its
 * kind's word, its id (the one its name starts with, else its piStar id's first
 * characters) and name, an actor's elements under it. A line is its element's by its id
 * (goal-controller#518): elements are added, removed and edited here, links drawn in the
 * diagram.
 */
export default function PistarExtNotationView() {
  const { session } = useWorkbench();
  const model = session.store.getModel();
  // the dialect with what the model adds
  const { definition } = usePistarExt();
  // the last tree read stays while the model is being fixed (the store
  // keeps its last valid model, so this comes free of any parse, #449)
  const last = useRef<ReturnType<typeof dialectTree> | null>(null);
  const tree = useMemo(() => {
    try {
      last.current = dialectTree(model);
    } catch {
      // kept
    }
    return last.current;
  }, [model]);
  // no engine: no checks; the text is checked against the model's elements
  // by piStar-ext's language services (the shared one)
  const support = useContext(LanguageSupportContext)('pistarext', definition);
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
