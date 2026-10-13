'use client';

import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useState } from 'react';
import { formatOf, sourceLabel } from '@/lib/project';
import { isDialectEngine } from '@/lib/workbench/engineDialects';
import { useOptionalLanguageSupport } from './engines/definition/useLanguageSupport';
import CodeEditor, { type CodeLanguage } from './CodeEditor';
import { useWorkbench } from './WorkbenchContext';
import { Button } from './ui';

/**
 * A project resource's file (goal-controller#25), in the editor its format
 * declares: what its engine's parser finds wrong underlined, edits saved to
 * the project when it can be written (a read-only one offers a browser copy).
 */
export default function ResourceView({ path }: { path: string }) {
  const wb = useWorkbench();
  const [view, setView] = useState<EditorView | null>(null);
  const slot = wb.resourceSlots.find((s) => s.paths.includes(path));
  const listed = wb.listing.find((file) => file.path === path);
  const text = wb.resourceTexts[path];
  // a resource is edited; the project's other files (its outputs, notes) are shown
  const readOnly = !slot || (wb.project?.store.readOnly ?? true);
  const language: CodeLanguage = slot?.definition.format ?? formatOf(path);
  const label = slot
    ? slot.definition.label
    : listed?.role === 'output'
      ? 'Output'
      : 'File';
  // the engine's services across the project's files (a definition pool's)
  const support = useOptionalLanguageSupport(
    isDialectEngine(wb.engine) ? wb.engine : null,
  );
  const extensions = useMemo(
    () => (slot ? (support?.resourceExtension?.(path) ?? []) : []),
    [support, slot, path],
  );
  // a range another tab asked to show here (go-to-definition, a problem)
  useEffect(() => {
    const request = wb.revealed;
    if (!view || request?.document !== path) return;
    const length = view.state.doc.length;
    view.dispatch({
      selection: {
        anchor: Math.min(request.from, length),
        head: Math.min(request.to, length),
      },
      effects: EditorView.scrollIntoView(Math.min(request.from, length), {
        y: 'center',
      }),
    });
    view.focus();
  }, [view, wb.revealed, path]);
  const diagnostics = useMemo(
    () =>
      (slot ? (wb.parsedResources[slot.kind]?.diagnostics ?? []) : []).filter(
        (d) => d.path === path,
      ),
    [wb.parsedResources, slot, path],
  );

  // the parser's problems, underlined
  useEffect(() => {
    if (!view) return;
    const length = view.state.doc.length;
    const marks: Diagnostic[] = diagnostics.map((d) => {
      const from = Math.min(d.from, length);
      return {
        from,
        to: Math.min(Math.max(d.to, from), length),
        severity: d.severity,
        message: d.message,
      };
    });
    view.dispatch(setDiagnostics(view.state, marks));
  }, [view, diagnostics, text]);

  if (text === undefined)
    return <p className='p-4 text-[13px] text-ink-muted'>Reading {path}…</p>;
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b border-line px-3 py-1.5 text-2xs text-ink-muted'>
        <span className='font-semibold uppercase tracking-wider'>{label}</span>
        <span className='truncate font-mono'>{path}</span>
        {!slot ? (
          <span className='ml-auto truncate'>read only</span>
        ) : readOnly ? (
          <Button className='ml-auto' onClick={() => void wb.copyToBrowser()}>
            Make a browser copy to edit
          </Button>
        ) : (
          <span className='ml-auto truncate'>
            saved to{' '}
            {wb.project ? sourceLabel(wb.project.source) : 'the project'}
          </span>
        )}
      </div>
      <div className='min-h-0 flex-1'>
        <CodeEditor
          value={text}
          language={language}
          ariaLabel={`${label}: ${path}`}
          readOnly={readOnly}
          onChange={(value) => wb.setResourceText(path, value)}
          extensions={extensions}
          onReady={setView}
        />
      </div>
    </div>
  );
}
