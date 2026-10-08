'use client';

import type { LSPClient } from '@codemirror/lsp-client';
import { EditorView } from '@codemirror/view';
import { CONTEXT_NOTIFICATION } from '@goal-controller/rt-language/context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setLineMarks } from '@/lib/workbench/codemirror';
import {
  lineId,
  notationDocument,
  notationEdits,
  notationContext,
} from '@/lib/workbench/notation';
import { setNodeText } from '@/lib/workbench/pistar';
import { createRtClient } from '@/lib/workbench/rtLsp';
import CodeEditor from '../../CodeEditor';
import { useSelection, useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';

const DOCUMENT_URI = 'file:///model.rt';
const EDIT_DELAY_MS = 300;

/**
 * The whole model as RT text (EdgeLangium). Names and notations are edited
 * here, structure in the diagram: a line's text is written to its element
 * like the inspector writes it, and the language server (a Langium worker)
 * checks the text against the diagram's structure.
 */
export default function NotationView() {
  const wb = useWorkbench();
  const { modelReadOnly } = useShell();
  const { selected, selectOrigin, selectSeq } = useSelection();
  const { tree } = wb;
  const latest = useRef(wb);
  latest.current = wb;
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  const [view, setView] = useState<EditorView | null>(null);

  const canonical = useMemo(
    () => (tree ? notationDocument(tree) : { text: '', ids: [] }),
    [tree],
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

  // one language server per view
  const [client, setClient] = useState<LSPClient | null>(null);
  useEffect(() => {
    const { client: next, worker } = createRtClient();
    setClient(next);
    return () => {
      next.disconnect();
      worker.terminate();
    };
  }, []);
  const variableNames = useMemo(
    () =>
      wb.variables
        .filter((variable) => variable.kind === 'context')
        .map((variable) => variable.name),
    [wb.variables],
  );
  useEffect(() => {
    if (!client || !tree) return;
    const context = notationContext(tree, variableNames);
    void client.initializing.then(() =>
      client.notification(CONTEXT_NOTIFICATION, context),
    );
  }, [client, tree, variableNames]);

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
      const { text, tree: current, setText } = latest.current;
      if (!current) return;
      const edits = notationEdits(value, current);
      if (edits.length === 0) return;
      setText(
        edits.reduce(
          (model, edit) => setNodeText(model, edit.iStarId, edit.text),
          text,
        ),
        'notation',
      );
    }, EDIT_DELAY_MS);
  };

  // cursor on a line → select its element
  const extensions = useMemo(
    () => [
      ...(client ? [client.plugin(DOCUMENT_URI, 'rt-notation')] : []),
      EditorView.updateListener.of((update) => {
        if (
          !update.selectionSet ||
          !update.transactions.some((tr) => tr.isUserEvent('select'))
        )
          return;
        const { state } = update;
        const id = lineId(state.doc.lineAt(state.selection.main.head).text);
        const node = id ? latest.current.tree?.nodes.get(id) : undefined;
        if (node && node.id !== latestSelected.current) {
          latest.current.select(node.id, 'notation');
        }
      }),
    ],
    [client],
  );

  // the selected element's line: highlighted, and revealed unless chosen here
  useEffect(() => {
    if (!view) return;
    const document = view.state.doc;
    let line = 0;
    for (let n = 1; n <= document.lines && selected; n++) {
      if (lineId(document.line(n).text) === selected) {
        line = n;
        break;
      }
    }
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

  if (!client) return null;
  return (
    <CodeEditor
      value={doc}
      language='rt'
      ariaLabel='Goal model notation (RT)'
      onChange={onChange}
      readOnly={modelReadOnly}
      extensions={extensions}
      onReady={setView}
    />
  );
}
