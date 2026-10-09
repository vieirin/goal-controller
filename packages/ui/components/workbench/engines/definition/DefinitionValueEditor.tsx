'use client';

import { EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder as placeholderText,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { workbenchTheme } from '@/lib/workbench/codemirror';
import type { LanguageSupport } from '@/lib/workbench/languageSupport';
import { cx } from '../../ui';
import { inputClass } from '../shared/inspector';

/**
 * A property value as a one-line editor with the engine's language support (its
 * value language, lint and completion; a language server's when there is one):
 * the field's document is one element's property.
 */
export default function DefinitionValueEditor({
  support,
  id,
  property,
  value,
  placeholder,
  invalid,
  onChange,
  onBlur,
}: {
  support: LanguageSupport;
  /** the element's id */
  id: string;
  property: string;
  value: string;
  placeholder?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onBlur });
  latest.current = { onChange, onBlur };

  useEffect(() => {
    if (!host.current) return undefined;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          workbenchTheme,
          support.fieldExtension(id, property),
          placeholderText(placeholder ?? ''),
          EditorView.contentAttributes.of({ 'aria-label': property }),
          // one line: Enter commits instead of breaking the value
          Prec.highest(
            keymap.of([
              {
                key: 'Enter',
                run: (target) => {
                  target.contentDOM.blur();
                  return true;
                },
              },
            ]),
          ),
          EditorState.transactionFilter.of((tr) =>
            tr.newDoc.lines > 1 ? [] : tr,
          ),
          // only what is typed here (incl. completions); values set from outside
          // must not be written back
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              update.transactions.some(
                (tr) =>
                  tr.isUserEvent('input') ||
                  tr.isUserEvent('delete') ||
                  tr.isUserEvent('move') ||
                  tr.isUserEvent('undo') ||
                  tr.isUserEvent('redo'),
              )
            ) {
              latest.current.onChange(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur: () => latest.current.onBlur(),
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // a new document per element and property
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [support, id, property]);

  // the value changed elsewhere (undo, the Notation view)
  useEffect(() => {
    const editor = view.current;
    const shown = editor?.state.doc.toString();
    if (editor && shown !== undefined && shown !== value && !editor.hasFocus) {
      editor.dispatch({
        changes: { from: 0, to: shown.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={host}
      className={cx(
        inputClass,
        'min-h-[1.75rem] px-1 py-0 font-mono text-xs [&_.cm-editor]:bg-transparent [&_.cm-focused]:outline-none [&_.cm-gutters]:hidden',
        invalid && '!border-danger',
      )}
    />
  );
}
