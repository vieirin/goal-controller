'use client';

import { serializeModel } from '@/lib/workbench/pistar';
import { emptyModel, parseModel } from '@/lib/workbench/dialects';
import type { IstarModel, ModelChangeEvent } from '@istar-ts/core';
import {
  IstarCanvas,
  IstarPalette,
  IstarProvider,
  useIstarEditor,
  useIstarStore,
  type IstarCanvasHandle,
  type IstarExtension,
} from '@istar-ts/react';
import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useSelection, useWorkbench } from '../../WorkbenchContext';
import { useShell } from '../../shell';

/**
 * The goal model as an editable iStar diagram (@istar-ts/react), kept in sync
 * with the workbench: edits are written to the model text, text changes from
 * elsewhere reload the diagram, and the selection follows the workbench's.
 * Each mode's diagram (engines/<engine>/, engines/pistar/) declares what it adds.
 */

/** Why an edit is taken back out (shown as an error notice), or null to keep it. */
export type RejectEdit = (event: ModelChangeEvent) => string | null;

/** The model, read with the dialect it records (if any). */
const tryParse = (text: string): IstarModel | null => {
  if (!text.trim()) return emptyModel();
  try {
    return parseModel(text);
  } catch {
    return null;
  }
};

/**
 * Keeps the diagram fitted to its container until the user pans or zooms it: the
 * canvas fits itself once, early, while the workbench panels are often still growing
 * (worse without the palette, in read-only), and it does not follow later size changes.
 * Opening another file or toggling read-only fits it again. Until the nodes are
 * measured the fit reports no change, so it is retried for a moment.
 */
function useAutoFit(
  canvas: RefObject<IstarCanvasHandle | null>,
  container: RefObject<HTMLDivElement | null>,
  resetKey: string,
  shown: boolean,
) {
  const userMoved = useRef(false);
  useEffect(() => {
    const el = container.current;
    if (!el || !shown) return undefined;
    userMoved.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const fit = () => {
      clearTimeout(timer);
      if (userMoved.current) return;
      void canvas.current?.fitView().then((moved) => {
        // nodes not measured yet: try again shortly
        if (!moved && tries < 20) {
          tries += 1;
          timer = setTimeout(fit, 100);
        }
      });
    };
    const settle = () => {
      clearTimeout(timer);
      tries = 0;
      // wait for the panels to stop moving
      timer = setTimeout(fit, 120);
    };
    const observer = new ResizeObserver(settle);
    observer.observe(el);
    settle();
    // panning or zooming by hand (wheel, dragging the paper, the zoom buttons) keeps the view
    const onUserMove = (event: Event) => {
      const target = event.target as Element;
      if (
        event.type === 'wheel' ||
        target.closest('.react-flow__pane, .react-flow__controls')
      )
        userMoved.current = true;
    };
    el.addEventListener('wheel', onUserMove, { passive: true });
    el.addEventListener('pointerdown', onUserMove);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      el.removeEventListener('wheel', onUserMove);
      el.removeEventListener('pointerdown', onUserMove);
    };
  }, [canvas, container, resetKey, shown]);
}

/** True when the element is drawn inside the visible part of the diagram. */
const isInView = (iStarId: string): boolean => {
  const node = document.querySelector(
    `.istar-canvas .react-flow__node[data-id="${CSS.escape(iStarId)}"]`,
  );
  const pane = node?.closest('.react-flow');
  if (!node || !pane) return false;
  const a = node.getBoundingClientRect();
  const b = pane.getBoundingClientRect();
  return (
    a.left >= b.left &&
    a.right <= b.right &&
    a.top >= b.top &&
    a.bottom <= b.bottom
  );
};

/** Hands the editor's notice function to the canvas, which sits outside the provider. */
function NotifyBridge({
  notify,
}: {
  notify: RefObject<((message: string) => void) | null>;
}) {
  const editor = useIstarEditor();
  useEffect(() => {
    notify.current = (message) => editor.notify(message, 'error');
    return () => {
      notify.current = null;
    };
  }, [editor, notify]);
  return null;
}

/** Two-way selection sync between the diagram (piStar ids) and the workbench (RT ids). */
function SelectionSync({
  canvas,
}: {
  canvas: RefObject<IstarCanvasHandle | null>;
}) {
  const wb = useWorkbench();
  const { selection, select } = useIstarEditor();
  const latest = useRef(wb);
  latest.current = wb;
  const sel = useSelection();
  const latestSel = useRef(sel);
  latestSel.current = sel;

  // workbench → diagram
  useEffect(() => {
    if (sel.selectOrigin === 'canvas') return;
    const iStarId = sel.selected
      ? (wb.tree?.nodes.get(sel.selected)?.iStarId ?? null)
      : null;
    const current = selection?.type === 'element' ? selection.id : null;
    if (iStarId !== current)
      select(iStarId ? { type: 'element', id: iStarId } : null);
    // bring a node selected elsewhere into view, keeping the zoom
    if (iStarId && !isInView(iStarId))
      void canvas.current?.centerOn(iStarId, { duration: 200 });
    // only when the workbench selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.selectSeq]);

  // diagram → workbench, only when the diagram's selection actually changes
  // (on mount it starts empty, which must not clear the workbench's selection)
  const previous = useRef(selection);
  // an element just added to the diagram isn't in the tree until it's rebuilt from the new text
  const unresolved = useRef<string | null>(null);
  const tree = wb.tree;
  useEffect(() => {
    const changed = previous.current !== selection;
    if (!changed && !unresolved.current) return;
    previous.current = selection;
    if (selection?.type === 'link') return;
    const iStarId = selection?.type === 'element' ? selection.id : null;
    const id = iStarId ? (tree?.byIStarId.get(iStarId)?.key ?? null) : null;
    unresolved.current = iStarId && !id ? iStarId : null;
    if (!changed && !id) return;
    if (id !== latestSel.current.selected) latest.current.select(id, 'canvas');
  }, [selection, tree]);

  return null;
}

export default function WorkbenchCanvas({
  extensions,
  aside,
  rejectEdit,
  paletteOnTop = false,
  paletteEnd,
  fitKey = '',
}: {
  /** a module-level constant: the provider rebuilds its registry when it changes */
  extensions: readonly IstarExtension[];
  /** beside the canvas (piStar mode: the editor's own inspector) */
  aside?: ReactNode;
  /** edits the mode does not allow are undone right away, with this notice */
  rejectEdit?: RejectEdit;
  /** the palette as a bar on top (piStar mode); otherwise on the left, on top in full screen */
  paletteOnTop?: boolean;
  /** fits the diagram again when it changes (a different palette) */
  fitKey?: string;
  /** controls at the end of the palette bar, when it is on top (a dialect's "Add new") */
  paletteEnd?: ReactNode;
}) {
  const wb = useWorkbench();
  const { modelFullscreen, modelReadOnly } = useShell();
  const parsed = useMemo(() => tryParse(wb.text), [wb.text]);
  const reject = useRef(rejectEdit);
  reject.current = rejectEdit;
  const notify = useRef<((message: string) => void) | null>(null);
  const canvas = useRef<IstarCanvasHandle>(null);
  const shown = !!wb.text.trim();

  const container = useRef<HTMLDivElement>(null);
  useAutoFit(
    canvas,
    container,
    `${wb.fileName}|${modelReadOnly}|${fitKey}`,
    shown,
  );
  const { store } = useIstarStore(() => parsed ?? emptyModel());
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
        const rejected =
          event.source === 'edit' ? (reject.current?.(event) ?? null) : null;
        if (rejected) {
          queueMicrotask(() => {
            store.undo();
            notify.current?.(rejected);
          });
          return;
        }
        const current = latest.current;
        const text = serializeModel(event.model, current.text);
        written.current = text;
        current.setText(text, 'canvas');
      }),
    [store],
  );

  // what the canvas badges: the elements' errors and warnings, by the diagram's ids
  const diagnostics = useMemo(
    () =>
      wb.problems.flatMap((problem) => {
        if (problem.severity !== 'error' && problem.severity !== 'warning')
          return [];
        const iStarId = problem.elementId
          ? wb.tree?.nodes.get(problem.elementId)?.iStarId
          : undefined;
        return iStarId ? [{ ...problem, elementId: iStarId }] : [];
      }),
    [wb.problems, wb.tree],
  );

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
    return (
      <div className='grid h-full place-items-center text-sm text-ink-muted'>
        The goal model appears once a model is open.
      </div>
    );
  }

  return (
    <div
      ref={container}
      className='relative h-full'
      onKeyDownCapture={onKeyDownCapture}
    >
      <IstarProvider
        store={store}
        diagnostics={diagnostics}
        extensions={extensions}
        readOnly={!parsed || modelReadOnly}
      >
        <SelectionSync canvas={canvas} />
        <NotifyBridge notify={notify} />
        {/* piStar mode and full screen: piStar's bar on top; read-only has none */}
        {paletteEnd &&
        !modelReadOnly &&
        parsed &&
        (paletteOnTop || modelFullscreen) ? (
          // istar-ts's own bar, placed here with the controls after it
          <div className='flex h-full flex-col'>
            <div className='flex items-stretch'>
              <IstarPalette
                orientation='horizontal'
                flyout='below'
                className='min-w-0 flex-1'
              />
              {paletteEnd}
            </div>
            <IstarCanvas
              ref={canvas}
              fitView
              aside={aside}
              palette={false}
              className='min-h-0 flex-1'
            />
          </div>
        ) : (
          <IstarCanvas
            ref={canvas}
            fitView
            aside={aside}
            palette={
              modelReadOnly
                ? false
                : paletteOnTop || modelFullscreen
                  ? 'top'
                  : 'left'
            }
            className='h-full'
          />
        )}
      </IstarProvider>
      {!parsed && (
        <div className='pointer-events-none absolute inset-x-3 top-3 rounded-md bg-caution-soft px-3 py-1.5 text-2xs text-caution'>
          The model text doesn’t parse — showing the last valid diagram,
          read-only until it’s fixed.
        </div>
      )}
    </div>
  );
}
