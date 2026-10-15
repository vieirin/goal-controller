'use client';

import type { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useState } from 'react';
import { sourceLabel } from '@/lib/project';
import { nativeLanguageExtension } from '@/lib/workbench/codemirror';
import CodeEditor, { type CodeLanguage } from './CodeEditor';
import { useWorkbench } from './WorkbenchContext';
import { Button } from './ui';

/** The editor's language for a native format: XML for XMI and XML, JSON, or the text's own. */
const LANGUAGE: Record<string, CodeLanguage> = {
  xmi: 'xml',
  xml: 'xml',
  json: 'json',
  text: 'text',
};

/**
 * A model's native file (goal-controller#143), in its format's editor: read
 * only when its dialect writes it (the model is edited, the file follows),
 * edited when it only reads it (then the model is re-imported from it).
 * When it isn't in sync with the model: why, and the two ways out.
 */
export default function NativeView({ path }: { path: string }) {
  const wb = useWorkbench();
  const [view, setView] = useState<EditorView | null>(null);
  const state = wb.nativeStates.find((s) => s.slot.path === path);
  const definition = state?.slot.definition;
  const writes = !!definition?.write;
  const storeReadOnly = wb.project?.store.readOnly ?? true;
  const language = definition?.language;
  const extensions = useMemo(
    () => (language ? nativeLanguageExtension(language) : []),
    [language],
  );
  // a range another tab asked to show here (a problem)
  useEffect(() => {
    const request = wb.revealed;
    if (!view || request?.document !== path) return;
    view.focus();
  }, [view, wb.revealed, path]);

  if (!state || !definition)
    return <p className='p-4 text-[13px] text-ink-muted'>Reading {path}…</p>;
  const { sync } = state;
  const status = state.following
    ? state.write && state.write.text === null
      ? 'not written: see Problems'
      : `follows the model${storeReadOnly ? '' : `, saved to ${wb.project ? sourceLabel(wb.project.source) : 'the project'}`}`
    : sync?.state === 'in-sync'
      ? 'in sync with the model'
      : sync?.state === 'unreadable'
        ? `doesn't read: ${sync.why}`
        : sync
          ? `out of sync: ${sync.why}`
          : '';
  const outOfSync = sync !== null && sync.state !== 'in-sync';
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b border-line px-3 py-1.5 text-2xs text-ink-muted'>
        <span className='font-semibold uppercase tracking-wider'>
          {definition.label}
        </span>
        <span className='truncate font-mono'>{path}</span>
        <span
          className={`ml-auto truncate ${outOfSync ? 'text-caution' : ''}`}
          role='status'
        >
          {status}
        </span>
        {writes && outOfSync && (
          <Button onClick={() => wb.regenerateNative(path)}>
            Regenerate from the model
          </Button>
        )}
        {sync?.state === 'out-of-sync' && (
          <Button onClick={() => wb.reimportModel(path)}>
            Re-import the model
          </Button>
        )}
        {!writes && storeReadOnly && (
          <Button onClick={() => void wb.copyToBrowser()}>
            Make a browser copy to edit
          </Button>
        )}
      </div>
      <div className='min-h-0 flex-1'>
        <CodeEditor
          value={state.text}
          language={LANGUAGE[definition.format] ?? 'text'}
          ariaLabel={`${definition.label}: ${path}`}
          readOnly={writes || storeReadOnly}
          onChange={(value) => wb.setResourceText(path, value)}
          extensions={extensions}
          onReady={setView}
        />
      </div>
    </div>
  );
}
