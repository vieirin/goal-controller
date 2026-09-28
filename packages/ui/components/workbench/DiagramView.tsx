'use client';

import '@istar-ts/react/styles.css';
import { createEmptyModel, parsePistar, type IstarModel } from '@istar-ts/core';
import {
  DefaultElementComponent,
  IstarCanvas,
  IstarProvider,
  useIstarEditor,
  useIstarStore,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import { createContext, useContext, useEffect, useMemo, useRef, type KeyboardEvent, type ReactElement } from 'react';
import { serializeModel } from '@/lib/workbench/pistar';
import type { Severity } from '@/lib/workbench/types';
import { useWorkbench } from './WorkbenchContext';
import { useShell } from './shell';

/**
 * The goal model as an editable iStar diagram (@istar-ts/react), kept in sync
 * with the workbench: edits are written to the model text, text changes from
 * elsewhere reload the diagram, and the selection follows the workbench's.
 */

/** Worst problem severity per piStar id, for the badges on elements. */
const SeverityContext = createContext<ReadonlyMap<string, Severity>>(new Map());

function ElementWithProblems(props: ElementComponentProps): ReactElement {
  const severity = useContext(SeverityContext).get(props.element.id);
  return (
    <div className='relative h-full w-full'>
      <DefaultElementComponent {...props} />
      {severity && (
        <span
          className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-[1.5px] border-white ${severity === 'error' ? 'bg-danger' : 'bg-caution'}`}
          title={severity === 'error' ? 'Has errors — see Problems' : 'Has warnings — see Problems'}
        />
      )}
    </div>
  );
}

const problemBadges: IstarExtension = {
  name: 'problem-badges',
  elements: {
    'istar.Goal': { component: ElementWithProblems },
    'istar.Task': { component: ElementWithProblems },
    'istar.Resource': { component: ElementWithProblems },
    'istar.Quality': { component: ElementWithProblems },
  },
};
const EXTENSIONS = [problemBadges];

const tryParse = (text: string): IstarModel | null => {
  if (!text.trim()) return createEmptyModel();
  try {
    return parsePistar(text);
  } catch {
    return null;
  }
};

/** Two-way selection sync between the diagram (piStar ids) and the workbench (RT ids). */
function SelectionSync() {
  const wb = useWorkbench();
  const { selection, select } = useIstarEditor();
  const latest = useRef(wb);
  latest.current = wb;

  // workbench → diagram
  useEffect(() => {
    if (wb.selectOrigin === 'canvas') return;
    const iStarId = wb.selected ? (wb.tree?.nodes.get(wb.selected)?.iStarId ?? null) : null;
    const current = selection?.type === 'element' ? selection.id : null;
    if (iStarId !== current) select(iStarId ? { type: 'element', id: iStarId } : null);
    // only when the workbench selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wb.selectSeq]);

  // diagram → workbench, only when the diagram's selection actually changes
  // (on mount it starts empty, which must not clear the workbench's selection)
  const previous = useRef(selection);
  useEffect(() => {
    if (previous.current === selection) return;
    previous.current = selection;
    const { tree, selected, select: selectNode } = latest.current;
    const id = selection?.type === 'element' ? (tree?.byIStarId.get(selection.id)?.id ?? null) : null;
    if (selection?.type === 'link') return;
    if (id !== selected) selectNode(id, 'canvas');
  }, [selection]);

  return null;
}

export default function DiagramView() {
  const wb = useWorkbench();
  const { modelFullscreen, modelReadOnly } = useShell();
  const parsed = useMemo(() => tryParse(wb.text), [wb.text]);
  const { store } = useIstarStore(() => parsed ?? createEmptyModel());
  // the text this diagram last wrote, so its own edits are not loaded back
  const written = useRef<string | null>(null);
  const latest = useRef(wb);
  latest.current = wb;

  // model text → diagram (a new file, the source view, the inspector, undo)
  useEffect(() => {
    if (!parsed || wb.text === written.current) return;
    written.current = null;
    store.load(parsed);
  }, [parsed, wb.text, store]);

  // diagram → model text
  useEffect(
    () =>
      store.subscribe((event) => {
        if (event.source === 'load') return;
        const current = latest.current;
        const text = serializeModel(event.model, current.text);
        written.current = text;
        current.setText(text, 'canvas');
      }),
    [store],
  );

  const severities = useMemo(() => {
    const map = new Map<string, Severity>();
    for (const problem of wb.problems) {
      if (!problem.nodeId || problem.severity === 'info') continue;
      const iStarId = wb.tree?.nodes.get(problem.nodeId)?.iStarId;
      if (iStarId && map.get(iStarId) !== 'error') map.set(iStarId, problem.severity);
    }
    return map;
  }, [wb.problems, wb.tree]);

  // one undo history for the whole workbench: ⌘Z here undoes the model text, not just the diagram
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (modelReadOnly || !(event.metaKey || event.ctrlKey)) return;
    if ((event.target as HTMLElement).closest('input, textarea')) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopPropagation();
    if (key === 'y' || event.shiftKey) wb.redo();
    else wb.undo();
  };

  if (!wb.text.trim()) {
    return <div className='grid h-full place-items-center text-sm text-ink-muted'>The diagram appears once a model is open.</div>;
  }

  return (
    <div className='relative h-full' onKeyDownCapture={onKeyDownCapture}>
      <SeverityContext.Provider value={severities}>
        <IstarProvider store={store} extensions={EXTENSIONS} readOnly={!parsed || modelReadOnly}>
          <SelectionSync />
          {/* full screen has the width for piStar's horizontal bar; read-only has none */}
          <IstarCanvas fitView palette={modelReadOnly ? false : modelFullscreen ? 'top' : 'left'} className='h-full' />
        </IstarProvider>
      </SeverityContext.Provider>
      {!parsed && (
        <div className='pointer-events-none absolute inset-x-3 top-3 rounded-md bg-caution-soft px-3 py-1.5 text-2xs text-caution'>
          The model text doesn’t parse — showing the last valid diagram, read-only until it’s fixed.
        </div>
      )}
    </div>
  );
}
