'use client';

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from '@codemirror/language';
import { lintGutter } from '@codemirror/lint';
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import {
  lineMarksField,
  prismLanguage,
  rangeMarksField,
  rtLanguage,
  workbenchTheme,
} from '@/lib/workbench/codemirror';

export type CodeLanguage = 'json' | 'prism' | 'rt' | 'text';

type CodeEditorProps = {
  value: string;
  language: CodeLanguage;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  /** extra extensions (must be stable — memoise them) */
  extensions?: Extension;
  onReady?: (view: EditorView | null) => void;
  ariaLabel: string;
};

const languageExtension = (language: CodeLanguage): Extension =>
  language === 'json'
    ? json()
    : language === 'prism'
      ? prismLanguage
      : language === 'rt'
        ? rtLanguage
        : [];

export default function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  extensions,
  onReady,
  ariaLabel,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const extra = useRef(new Compartment());
  const editable = useRef(new Compartment());

  // create once
  useEffect(() => {
    if (!host.current) return undefined;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        drawSelection(),
        highlightActiveLine(),
        history(),
        indentOnInput(),
        bracketMatching(),
        search({ top: true }),
        highlightSelectionMatches(),
        lintGutter(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
        ]),
        languageExtension(language),
        workbenchTheme,
        lineMarksField,
        rangeMarksField,
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        editable.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        extra.current.of(extensions ?? []),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            update.transactions.some(
              (tr) =>
                tr.isUserEvent('input') ||
                tr.isUserEvent('delete') ||
                tr.isUserEvent('undo') ||
                tr.isUserEvent('redo') ||
                tr.isUserEvent('move'),
            )
          ) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    onReady?.(view.current);
    return () => {
      onReady?.(null);
      view.current?.destroy();
      view.current = null;
    };
    // language and aria label are fixed per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external value changes (keep the view, replace the document)
  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const doc = current.state.doc.toString();
    if (doc !== value) {
      const head = Math.min(current.state.selection.main.head, value.length);
      current.dispatch({
        changes: { from: 0, to: doc.length, insert: value },
        selection: { anchor: head },
      });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: extra.current.reconfigure(extensions ?? []),
    });
  }, [extensions]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  return <div ref={host} className='h-full min-h-0 overflow-hidden' />;
}
