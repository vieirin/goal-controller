'use client';

import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import {
  IstarCanvas,
  IstarPalette,
  IstarProvider,
  paletteDescriptionFor,
  registrySizes,
  useIstarEditor,
  type IstarCanvasHandle,
  type IstarExtension,
} from '@istar-ts/react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  useSelectPart,
  useSelection,
  useWorkbench,
} from '../../WorkbenchContext';
import { dialectOf } from '@/lib/workbench/engineDialects';
import {
  analysisDiagnostics,
  SELECTION_ATTRIBUTE,
  selectionStyle,
  shownCase,
  shownStep,
} from '@/lib/workbench/analysis';
import { useShell } from '../../shell';
import type { ModelSession } from '@/lib/workbench/modelSession';

/**
 * The goal model as an editable iStar diagram (@istar-ts/react), a client of
 * the workbench's store and dispatcher (#410): its edits are actions on the
 * model, the text follows from it, and the selection follows the workbench's.
 * Each mode's diagram (engines/<engine>/, engines/pistar/) declares what it adds.
 */

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
  onReady: () => void,
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
        if (moved) onReady();
        else if (tries < 20) {
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

/**
 * Gives the workbench's dispatcher the palette this canvas draws (its registry,
 * with the mode's extensions), before the editor asks for it: the dispatcher
 * is the workbench's, not one the editor made over its own registry. Kept
 * explicit (not `paletteFromMetamodel`'s default) so entries keep their short
 * labels ("And"/"Or") instead of the default's full kind labels (#411).
 *
 * Also gives it the registry's sizes (`registrySizes`): a GLSP contribution
 * hosted over this session (#414) needs them so its GModel's node sizes and
 * actor boundaries match what this canvas draws (istar-ts#154), reused as is
 * rather than re-derived.
 */
function PaletteBridge({
  session,
  extensions,
}: {
  session: ModelSession;
  extensions: readonly IstarExtension<string, string>[];
}) {
  const { registry } = useIstarEditor();
  // layout: before the provider's effect requests it
  useLayoutEffect(() => {
    session.setPalette(paletteDescriptionFor(registry, extensions));
    session.setSizes(registrySizes(registry));
    return () => {
      session.setPalette(null);
      session.setSizes(undefined);
    };
  }, [session, registry, extensions]);
  return null;
}

/**
 * Gives the session the mode's guards (oneActorOnly, an edgeV2 check,
 * goal-controller#412): rejected before an edit applies, not undone after.
 * The session's own per-mode registry (`WorkbenchContext`, goal-controller#439
 * review) already sets these by `wb.mode`, so they stay in force even while
 * no diagram is mounted (the Source tab); this only reaffirms the same ones
 * on each render of the mode's diagram, and must not clear them on unmount —
 * that would undo the registry's own, read fresh by the dispatcher on the
 * very next edit, from whatever surface (the Inspector) is still mounted.
 */
function GuardsBridge({
  session,
  guards,
  postGuards,
}: {
  session: ModelSession;
  guards: readonly ActionGuard<string, string>[];
  postGuards: readonly ActionPostGuard<string, string>[];
}) {
  useLayoutEffect(() => {
    session.setGuards(guards);
  }, [session, guards]);
  useLayoutEffect(() => {
    session.setPostGuards(postGuards);
  }, [session, postGuards]);
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
  const selectPart = useSelectPart();

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
    // a link or an actor, in a dialect that gives them properties (goal-controller#107)
    const dialect = dialectOf(latest.current.engine);
    if (selection?.type === 'link') {
      if (changed && dialect?.links)
        selectPart({ type: 'link', id: selection.id });
      return;
    }
    const iStarId = selection?.type === 'element' ? selection.id : null;
    const id = iStarId ? (tree?.byIStarId.get(iStarId)?.key ?? null) : null;
    if (
      iStarId &&
      !id &&
      dialect?.actors &&
      tree?.actors.some((actor) => actor.iStarId === iStarId)
    ) {
      unresolved.current = null;
      if (changed) selectPart({ type: 'actor', id: iStarId });
      return;
    }
    unresolved.current = iStarId && !id ? iStarId : null;
    if (!changed && !id) return;
    if (id !== latestSel.current.selected) latest.current.select(id, 'canvas');
  }, [selection, tree, selectPart]);

  return null;
}

const NO_GUARDS: readonly ActionGuard<string, string>[] = [];
const NO_POST_GUARDS: readonly ActionPostGuard<string, string>[] = [];

export default function WorkbenchCanvas({
  extensions,
  aside,
  guards = NO_GUARDS,
  postGuards = NO_POST_GUARDS,
  paletteOnTop = false,
  paletteEnd,
  fitKey = '',
}: {
  /** a module-level constant: the provider rebuilds its registry when it changes */
  extensions: readonly IstarExtension<string, string>[];
  /** beside the canvas (piStar mode: the editor's own inspector) */
  aside?: ReactNode;
  /** the mode's rules, rejected before they apply (oneActorOnly, goal-controller#412) */
  guards?: readonly ActionGuard<string, string>[];
  /** like `guards`, checked after the operation applies (an edgeV2 check, #412) */
  postGuards?: readonly ActionPostGuard<string, string>[];
  /** the palette as a bar on top (piStar mode); otherwise on the left, on top in full screen */
  paletteOnTop?: boolean;
  /** fits the diagram again when it changes (a different palette) */
  fitKey?: string;
  /** controls at the end of the palette bar, when it is on top (a dialect's "Add new") */
  paletteEnd?: ReactNode;
}) {
  const wb = useWorkbench();
  const { modelFullscreen, modelReadOnly } = useShell();
  // the store keeps the last model that parsed: shown, read-only, while the text doesn't
  const parsed = !wb.jsonError;
  const { session } = wb;
  const canvas = useRef<IstarCanvasHandle>(null);
  const shown = !!wb.text.trim();

  const container = useRef<HTMLDivElement>(null);
  // the e2e smoke's ready signal (#454): set once this canvas has laid out its
  // nodes, so tests wait for it instead of racing `.react-flow__pane`
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    setCanvasReady(false);
  }, [session.id]);
  useAutoFit(
    canvas,
    container,
    `${wb.fileName}|${modelReadOnly}|${fitKey}`,
    shown,
    () => setCanvasReady(true),
  );

  // what the canvas badges: the elements' errors and warnings, by the diagram's
  // ids; and an analysis's values on its elements and actors, while the model is
  // the one it ran on (goal-controller#107)
  const diagnostics = useMemo(
    () => [
      ...wb.problems.flatMap((problem) => {
        if (problem.severity !== 'error' && problem.severity !== 'warning')
          return [];
        const iStarId = problem.elementId
          ? wb.tree?.nodes.get(problem.elementId)?.iStarId
          : undefined;
        return iStarId ? [{ ...problem, elementId: iStarId }] : [];
      }),
      ...(wb.analysisStale
        ? []
        : analysisDiagnostics(
            shownCase(wb.analysisRun),
            shownStep(wb.analysisRun)?.index,
          )),
    ],
    [wb.problems, wb.tree, wb.analysisRun, wb.analysisStale],
  );
  // a case that is a selection (a variant, goal-controller#152): the rest dimmed
  const selection = useMemo(
    () => (wb.analysisStale ? null : selectionStyle(shownCase(wb.analysisRun))),
    [wb.analysisRun, wb.analysisStale],
  );

  // one undo history for the whole workbench, the dispatcher's: ⌘Z here is a
  // glspUndo, whichever editor made the edit (not caught again by the workbench's)
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (modelReadOnly || !(event.metaKey || event.ctrlKey)) return;
    if ((event.target as HTMLElement).closest('input, textarea')) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopPropagation();
    void session.dispatcherFor('canvas').dispatch({
      kind: key === 'y' || event.shiftKey ? 'glspRedo' : 'glspUndo',
    });
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
      data-workbench-ready={canvasReady}
      {...(selection && { [SELECTION_ATTRIBUTE]: '' })}
    >
      {selection && <style>{selection}</style>}
      <IstarProvider
        // a new session is another model: the editor starts over
        key={session.id}
        store={session.store}
        dispatcher={session.dispatcherFor('canvas')}
        dispatcherFor={session.dispatcherFor}
        diagnostics={diagnostics}
        extensions={extensions}
        readOnly={!parsed || modelReadOnly}
      >
        <PaletteBridge session={session} extensions={extensions} />
        <SelectionSync canvas={canvas} />
        <GuardsBridge
          session={session}
          guards={guards}
          postGuards={postGuards}
        />
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
