'use client';

import { Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setLineMarks, type LineMark } from '@/lib/workbench/codemirror';
import { agentLineMarks } from '@/lib/workbench/agentChanges';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import { notationRange } from '@/lib/workbench/poolDocuments';
import {
  lineKeys,
  lineOwners,
  notationDocument,
  notationReading,
  notationEditOperations,
  writtenIdChanges,
} from '@/lib/workbench/notationDocument';
import { type AnyDialect, type DocumentTree } from '@goal-controller/dialect';
import type { DocumentBase } from '@goal-controller/goal-language';
import AgentChangeLegend from './AgentChangeLegend';
import CodeEditor from '../../CodeEditor';
import { useSelection, useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';
import { useEditModel } from '../shared/inspector';

const DOCUMENT_URI = 'file:///model.notation';
const EDIT_DELAY_MS = 300;
/** How long a done edit waits for the tree it makes before the text is read again regardless. */
const STALE_TREE_MS = 2000;

/**
 * The whole model as a definition's text (an engine's notation, or a dialect's
 * lines). Elements are created, removed and edited here (goal-controller#518):
 * each line starts with its kind's word and names its element by its id
 * (`goal G1: …`, or the first characters of its piStar id); a new line
 * creates its element (in the actor of the line above, its short id then
 * written on the line), a line removed removes it (its links stay, as
 * orphans), each edit one undo step. Links and refinements are drawn in the
 * diagram. Every syntax decision comes from the definition; its language
 * support (local, or a language server) checks the text against the model.
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
  const edit = useEditModel();
  const latestEdit = useRef(edit);
  latestEdit.current = edit;

  const canonical = useMemo(
    () => (tree ? notationDocument(definition, tree) : { text: '', ids: [] }),
    [definition, tree],
  );
  // the view's own edits are not written back over what is being typed
  const [doc, setDoc] = useState(canonical.text);
  // set right before dispatching this editor's own edit, so the sync below
  // doesn't fight the user's typing; cleared once the model change it
  // caused (or its rejection) is seen
  const ownEdit = useRef(false);
  // the text the model has, line by line, once this editor's last edits are
  // made (null: the one written from the tree): what is typed next is read
  // against it, so a line keeps the element it had there; the text isn't
  // written over with the model's own after this editor's edits
  const base = useRef<DocumentBase | null>(null);
  useEffect(() => {
    if (ownEdit.current) {
      ownEdit.current = false;
      return;
    }
    base.current = null;
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
  const latestView = useRef(view);
  latestView.current = view;
  // an edit in flight, or done but not yet in the tree: the text is read
  // again after (a line it created an element for names it only then, and
  // would create another)
  const inFlight = useRef(false);
  const staleTree = useRef<DocumentTree | null>(null);
  const again = useRef(false);
  // what was last typed (the editor's text, when it has one)
  const typed = useRef<string | null>(null);
  const flush = () => {
    const current = latestTree.current;
    const editor = latestView.current;
    const value = editor?.state.doc.toString() ?? typed.current;
    if (!current || value === null) return;
    if (inFlight.current || current === staleTree.current) {
      again.current = true;
      return;
    }
    staleTree.current = null;
    const reading = notationReading(definition, value, current, {
      newId: () => crypto.randomUUID(),
      ...(base.current && { base: base.current }),
    });
    const { edits } = reading;
    if (edits.length === 0) return;
    const operations = notationEditOperations(edits, {
      model: latest.current.session.store.getModel(),
      tree: current,
    });
    ownEdit.current = true;
    inFlight.current = true;
    void latestEdit
      .current(...operations)
      .then((result) => {
        if (!result.ok) {
          ownEdit.current = false;
          return;
        }
        base.current = reading.base;
        staleTree.current = current;
        // a model change no tree follows (none should): read on anyway
        setTimeout(() => {
          if (staleTree.current !== current) return;
          staleTree.current = null;
          if (again.current && !inFlight.current) {
            again.current = false;
            flush();
          }
        }, STALE_TREE_MS);
        // a line that created its element without an id gets the one it
        // shows, so typing on renames it rather than creating another
        const now = latestView.current;
        const changes = now
          ? writtenIdChanges(definition, value, now.state.doc.toString(), edits)
          : [];
        if (now && changes.length)
          now.dispatch({
            changes,
            annotations: Transaction.addToHistory.of(false),
          });
      })
      .finally(() => {
        inFlight.current = false;
        if (again.current && latestTree.current !== staleTree.current) {
          again.current = false;
          flush();
        }
      });
  };
  // the tree the last edit made: what was typed meanwhile is read now
  useEffect(() => {
    if (!again.current || inFlight.current || tree === staleTree.current)
      return;
    again.current = false;
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);
  const onChange = (value: string) => {
    typed.current = value;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      flush();
    }, EDIT_DELAY_MS);
  };

  // each line's element key, and the element it is or is under, read once
  // per document text, tree and definition: a cursor move or a selection
  // reuses them (a line names its element by its id, a written or a short
  // one; a repeated scoped id's key is its goal's)
  const keysCache = useRef<{
    text: string;
    tree: unknown;
    definition: AnyDialect;
    keys: (string | null)[];
    owners: (string | null)[];
  } | null>(null);
  const linesOf = (text: string) => {
    const tree = latestTree.current;
    const cached = keysCache.current;
    if (
      cached?.text === text &&
      cached.tree === tree &&
      cached.definition === definition
    )
      return cached;
    const lines = text.split('\n');
    const known = tree ?? (() => false);
    const next = {
      text,
      tree,
      definition,
      keys: lineKeys(definition, lines, known),
      owners: lineOwners(definition, lines, known),
    };
    keysCache.current = next;
    return next;
  };
  const keysOf = (text: string): (string | null)[] => linesOf(text).keys;
  const latestLinesOf = useRef(linesOf);
  latestLinesOf.current = linesOf;

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
          latestLinesOf.current(doc.toString()).owners[line - 1] ?? null;
        const node = id ? latestTree.current?.nodes.get(id) : undefined;
        // the key the line names (a repeated scoped id's is its goal's)
        if (node && id !== latestSelected.current) {
          latest.current.select(id, 'notation');
        }
      }),
    ],
    [support, selectable],
  );

  // the selected element's line: highlighted, and revealed unless chosen here
  // (only in a selectable notation); the agent's changes: a NEW/EDITED mark
  // and badge on every element line its id is in (every notation, selectable
  // or not — a KAOS/NFR/piStar-ext model is marked the same way)
  useEffect(() => {
    if (!view) return;
    const document = view.state.doc;
    const text = document.toString();
    const keys = keysOf(text);
    const marks: LineMark[] = [];
    const line = selectable && selected ? keys.indexOf(selected) + 1 : 0;
    if (line) marks.push({ line, className: 'cm-trace-primary' });
    marks.push(
      ...agentLineMarks(
        keys,
        (key) => latestTree.current?.nodes.get(key)?.iStarId,
        wb.agentChanges,
      ),
    );
    view.dispatch({
      effects: [
        setLineMarks.of(marks),
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
  }, [view, selectSeq, doc, wb.agentChanges]);

  // a model field's range another tab asked to show (go-to-definition, a problem)
  useEffect(() => {
    const request = wb.revealed;
    if (!view || !tree || !request?.document.startsWith('model:')) return;
    const range = notationRange(
      definition,
      tree,
      view.state.doc.toString(),
      request,
    );
    if (!range) return;
    view.dispatch({
      selection: { anchor: range.from, head: range.to },
      effects: EditorView.scrollIntoView(range.from, { y: 'center' }),
    });
    view.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, wb.revealed]);

  return (
    <div className='flex h-full flex-col'>
      <div className='min-h-0 flex-1'>
        <CodeEditor
          value={doc}
          language='text'
          ariaLabel={`Goal model notation (${definition.name})`}
          onChange={onChange}
          readOnly={modelReadOnly}
          extensions={extensions}
          onReady={setView}
        />
      </div>
      <AgentChangeLegend />
    </div>
  );
}
