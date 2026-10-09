'use client';

import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useState } from 'react';
import { sourceLabel } from '@/lib/project';
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
  const text = wb.resourceTexts[path];
  const readOnly = wb.project?.store.readOnly ?? true;
  const language: CodeLanguage = slot?.definition.format ?? 'text';
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

  if (!slot || text === undefined)
    return <p className='p-4 text-[13px] text-ink-muted'>Reading {path}…</p>;
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b border-line px-3 py-1.5 text-2xs text-ink-muted'>
        <span className='font-semibold uppercase tracking-wider'>
          {slot.definition.label}
        </span>
        <span className='truncate font-mono'>{path}</span>
        {readOnly ? (
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
          ariaLabel={`${slot.definition.label}: ${path}`}
          readOnly={readOnly}
          onChange={(value) => wb.setResourceText(path, value)}
          onReady={setView}
        />
      </div>
    </div>
  );
}
