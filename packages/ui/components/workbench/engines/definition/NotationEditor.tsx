'use client';

import { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setLineMarks } from '@/lib/workbench/codemirror';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import {
  applyNotationEdits,
  lineKeys,
  notationDocument,
  notationEdits,
} from '@/lib/workbench/notationDocument';
import { type AnyDialect, type DocumentTree } from '@goal-controller/dialect';
import CodeEditor from '../../CodeEditor';
import { useSelection, useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';

const DOCUMENT_URI = 'file:///model.notation';
const EDIT_DELAY_MS = 300;

/**
 * The whole model as a definition's text (an engine's notation, or a dialect's
 * lines). Names, notations and properties are edited here, structure in the
 * diagram: a line's text is written to its element like the inspector writes it.
 * Every syntax decision comes from the definition; its language support (local,
 * or a language server) checks the text against the diagram's structure.
 * `selectable`: the tree's ids are the workbench's selection (an engine's view).
 */
export default function NotationEditor({
  definition,
  tree,
  support,
  selectable,
}: {
  definition: AnyDialect;
  tree: DocumentTree | null;
  support: LanguageSupport;
  selectable: boolean;
}) {
  const wb = useWorkbench();
  const { modelReadOnly } = useShell();
  const { selected, selectOrigin, selectSeq } = useSelection();
  const latestTree = useRef(tree);
  latestTree.current = tree;
  const latest = useRef(wb);
  latest.current = wb;
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  const [view, setView] = useState<EditorView | null>(null);

  const canonical = useMemo(
    () => (tree ? notationDocument(definition, tree) : { text: '', ids: [] }),
    [definition, tree],
  );
  // the view's own edits are not written back over what is being typed
  const [doc, setDoc] = useState(canonical.text);
  useEffect(() => {
    if (wb.changeSource === 'notation') return;
    setDoc(canonical.text);
    // same text as before (e.g. undo after typing an unknown id): still reset the editor
    const shown = view?.state.doc.toString();
    if (view && shown !== undefined && shown !== canonical.text) {
      view.dispatch({
        changes: { from: 0, to: shown.length, insert: canonical.text },
        selection: {
          anchor: Math.min(
            view.state.selection.main.head,
            canonical.text.length,
          ),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  // text → model, debounced; lines map to elements by their id
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  const onChange = (value: string) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      const { text, setText } = latest.current;
      const current = latestTree.current;
      if (!current) return;
      const edits = notationEdits(definition, value, current);
      if (edits.length === 0) return;
      setText(applyNotationEdits(text, edits), 'notation');
    }, EDIT_DELAY_MS);
  };

  // each line's element key, read once per document text, tree and
  // definition: a cursor move or a selection reuses it (a repeated scoped
  // id's key is its goal's)
  const keysCache = useRef<{
    text: string;
    tree: unknown;
    definition: AnyDialect;
    keys: (string | null)[];
  } | null>(null);
  const keysOf = (text: string): (string | null)[] => {
    const tree = latestTree.current;
    const cached = keysCache.current;
    if (
      cached?.text === text &&
      cached.tree === tree &&
      cached.definition === definition
    )
      return cached.keys;
    const keys = lineKeys(
      definition,
      text.split('\n'),
      (key) => !!tree?.nodes.has(key),
    );
    keysCache.current = { text, tree, definition, keys };
    return keys;
  };
  const latestKeysOf = useRef(keysOf);
  latestKeysOf.current = keysOf;

  // cursor on a line → select its element
  const extensions = useMemo(
    () => [
      support.documentExtension(DOCUMENT_URI),
      EditorView.updateListener.of((update) => {
        if (
          !selectable ||
          !update.selectionSet ||
          !update.transactions.some((tr) => tr.isUserEvent('select'))
        )
          return;
        const { doc } = update.state;
        // a property line belongs to the element line above it
        const line = doc.lineAt(update.state.selection.main.head).number;
        // its key, or the element line's above it
        const id =
          latestKeysOf
            .current(doc.toString())
            .slice(0, line)
            .filter((key): key is string => key !== null)
            .at(-1) ?? null;
        const node = id ? latestTree.current?.nodes.get(id) : undefined;
        // the key the line names (a repeated scoped id's is its goal's)
        if (node && id !== latestSelected.current) {
          latest.current.select(id, 'notation');
        }
      }),
    ],
    [definition, support, selectable],
  );

  // the selected element's line: highlighted, and revealed unless chosen here
  useEffect(() => {
    if (!view || !selectable) return;
    const document = view.state.doc;
    const keys = selected ? keysOf(document.toString()) : [];
    // 1-based; 0: the selected element has no line
    const line = keys.indexOf(selected) + 1;
    view.dispatch({
      effects: [
        setLineMarks.of(line ? [{ line, className: 'cm-trace-primary' }] : []),
        ...(line && selectOrigin !== 'notation'
          ? [
              EditorView.scrollIntoView(document.line(line).from, {
                y: 'center',
              }),
            ]
          : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectSeq, doc]);

  return (
    <CodeEditor
      value={doc}
      language='text'
      ariaLabel={`Goal model notation (${definition.name})`}
      onChange={onChange}
      readOnly={modelReadOnly}
      extensions={extensions}
      onReady={setView}
    />
  );
}
