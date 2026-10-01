'use client';

import { EDGE_RESOURCE_FILL } from '@/lib/workbench/edgeProperties';
import { nextRtId, serializeModel } from '@/lib/workbench/pistar';
import type { Severity } from '@/lib/workbench/types';
import {
  createEmptyModel,
  isActor,
  parsePistar,
  type IstarModel,
} from '@istar-ts/core';
import {
  DefaultElementComponent,
  elementIcon,
  IstarCanvas,
  IstarInspector,
  IstarProvider,
  useIstarEditor,
  useIstarStore,
  type ElementComponentProps,
  type IstarCanvasHandle,
  type IstarExtension,
} from '@istar-ts/react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import { useSelection, useWorkbench } from './WorkbenchContext';
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
          title={
            severity === 'error'
              ? 'Has errors — see Problems'
              : 'Has warnings — see Problems'
          }
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

/** What an Edge resource variable is, for its badge: "bool = true", "int 0..5 = 5"; and what is wrong with it. */
const resourceVariable = (
  properties: Readonly<Record<string, string>> | undefined,
): { label: string; issue: string | null } => {
  const { type, initialValue, lowerBound, upperBound } = properties ?? {};
  if (type === 'bool') {
    const ok = initialValue === 'true' || initialValue === 'false';
    return {
      label: `bool = ${initialValue ?? '?'}`,
      issue: ok ? null : 'the initial value must be true or false',
    };
  }
  if (type === 'int') {
    const whole = (v: string | undefined): number | null =>
      v !== undefined && /^-?\d+$/.test(v) ? Number(v) : null;
    const low = whole(lowerBound);
    const high = whole(upperBound);
    const value = whole(initialValue);
    const label = `int ${lowerBound ?? '?'}..${upperBound ?? '?'} = ${initialValue ?? '?'}`;
    if (low === null || high === null || value === null)
      return { label, issue: 'needs whole-number bounds and initial value' };
    if (low > high)
      return { label, issue: 'the lower bound is above the upper bound' };
    if (value < low || value > high)
      return { label, issue: 'the initial value is outside the bounds' };
    return { label, issue: null };
  }
  return {
    label: type ? `${type}?` : 'no type',
    issue: 'the type must be bool or int',
  };
};

/**
 * Edge resources are variables: drawn yellow unless they have a colour of their own (nothing
 * is written to the file), with a badge at the bottom showing the type and initial value.
 */
function EdgeResource(props: ElementComponentProps): ReactElement {
  const element = props.element.display?.backgroundColor
    ? props.element
    : {
        ...props.element,
        display: {
          ...props.element.display,
          backgroundColor: EDGE_RESOURCE_FILL,
        },
      };
  const { label, issue } = resourceVariable(props.element.customProperties);
  return (
    <div className='relative h-full w-full'>
      <ElementWithProblems {...props} element={element} />
      <span
        className={`pointer-events-none absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border bg-white px-1.5 font-mono text-[10px] leading-4 ${issue ? 'border-danger text-danger' : 'border-ink-muted text-ink-soft'}`}
        title={issue ? `${label}: ${issue}` : label}
      >
        {label}
      </span>
    </div>
  );
}

/** The Resource palette icon with a bubble below it naming the variable type, like the badge on resources. */
function ResourceToolIcon({ type }: { type: 'bool' | 'int' }): ReactElement {
  return (
    <span className='relative inline-flex flex-col items-center'>
      {elementIcon('istar.Resource')}
      <span className='-mt-2 rounded-full border border-ink-muted bg-white px-1 font-mono text-[9px] leading-3 text-ink-soft'>
        {type}
      </span>
    </span>
  );
}

/**
 * Edge and EdgeV2 read goals, tasks and resources in an actor, linked by And/Or
 * refinement and Needed-By: the palette offers only those (other kinds fail to convert).
 */
const edgePalette: IstarExtension = {
  name: 'edge-palette',
  elements: {
    // Actor alone: no Actor/Agent/Role dropdown
    'istar.Actor': { palette: { group: undefined } },
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
    'istar.Quality': { palette: false },
    // resources are the engine's variables: one tool per type, with valid properties preset
    // after Task (default order 36): Goal, Task, then Resource
    'istar.Resource': {
      component: EdgeResource,
      palette: [
        {
          label: 'Boolean',
          title: 'Boolean resource: click on an actor to add it (starts true)',
          icon: <ResourceToolIcon type='bool' />,
          group: 'resource',
          order: 37,
          properties: { type: 'bool', initialValue: 'true' },
        },
        {
          label: 'Integer',
          title:
            'Integer resource: click on an actor to add it (0 to 5, starts at 5)',
          icon: <ResourceToolIcon type='int' />,
          group: 'resource',
          order: 37,
          properties: {
            type: 'int',
            initialValue: '5',
            lowerBound: '0',
            upperBound: '5',
          },
        },
      ],
    },
  },
  paletteGroups: {
    resource: { label: 'Resource', title: 'Add a Boolean or Integer resource' },
  },
  links: {
    'istar.IsALink': { palette: false },
    'istar.ParticipatesInLink': { palette: false },
    'istar.DependencyLink': { palette: false },
    'istar.ContributionLink': { palette: false },
    'istar.QualificationLink': { palette: false },
  },
};

/**
 * The engines read an RT id at the start of each name ("G3: …"): new elements get the
 * next free one. Qualities are goals to the engines, so they share the G numbering.
 */
const rtNumbering: IstarExtension = {
  name: 'rt-numbering',
  elements: {
    'istar.Goal': {
      defaultName: ({ model }) => `${nextRtId(model, 'istar.Goal')}: Goal`,
    },
    'istar.Quality': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Quality')}: Quality`,
    },
    'istar.Task': {
      defaultName: ({ model }) => `${nextRtId(model, 'istar.Task')}: Task`,
    },
    'istar.Resource': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Resource')}: Resource`,
    },
  },
};

// stable arrays: the provider rebuilds its registry when the extensions change
const WORKBENCH_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  rtNumbering,
];
const EDGE_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  rtNumbering,
  edgePalette,
];
const NO_EXTENSIONS: readonly IstarExtension[] = [];
const PISTAR_EDGE_PALETTE: readonly IstarExtension[] = [
  rtNumbering,
  edgePalette,
];
// the piStar view of a model that is for an engine still numbers new elements (G4: …)
const PISTAR_NUMBERED: readonly IstarExtension[] = [rtNumbering];

const tryParse = (text: string): IstarModel | null => {
  if (!text.trim()) return createEmptyModel();
  try {
    return parsePistar(text);
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

/** Hands the editor's notice function to DiagramView, which sits outside the provider. */
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
  useEffect(() => {
    if (previous.current === selection) return;
    previous.current = selection;
    const { tree, select: selectNode } = latest.current;
    const { selected } = latestSel.current;
    const id =
      selection?.type === 'element'
        ? (tree?.byIStarId.get(selection.id)?.id ?? null)
        : null;
    if (selection?.type === 'link') return;
    if (id !== selected) selectNode(id, 'canvas');
  }, [selection]);

  return null;
}

export default function DiagramView() {
  const wb = useWorkbench();
  const { modelFullscreen, modelReadOnly, pistarMode, enginePalette } =
    useShell();
  const parsed = useMemo(() => tryParse(wb.text), [wb.text]);
  // piStar mode: the library as it ships (no extensions, default palette)
  // (optionally with the palette of the engine the file records)
  const extensions = pistarMode
    ? enginePalette &&
      (wb.recordedEngine === 'edge' || wb.recordedEngine === 'edgev2')
      ? PISTAR_EDGE_PALETTE
      : wb.recordedEngine
        ? PISTAR_NUMBERED
        : NO_EXTENSIONS
    : wb.engine === 'sleec'
      ? WORKBENCH_EXTENSIONS
      : EDGE_EXTENSIONS;
  const paletteKind = pistarMode
    ? 'pistar'
    : wb.engine === 'sleec'
      ? 'full'
      : 'edge';
  // the Edge engines build one goal tree from one actor
  const oneActor = useRef(false);
  oneActor.current = paletteKind === 'edge';
  const notify = useRef<((message: string) => void) | null>(null);
  const canvas = useRef<IstarCanvasHandle>(null);
  const shown = !!wb.text.trim();

  const container = useRef<HTMLDivElement>(null);
  useAutoFit(
    canvas,
    container,
    `${wb.fileName}|${modelReadOnly}|${paletteKind}`,
    shown,
  );
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
        // Edge engines: a second actor is taken back out right away
        if (
          oneActor.current &&
          event.source === 'edit' &&
          event.changes.some(
            (change) =>
              change.type === 'addElement' &&
              isActor(event.model.elements.get(change.id)),
          ) &&
          [...event.model.elements.values()].filter(isActor).length > 1
        ) {
          queueMicrotask(() => {
            store.undo();
            notify.current?.(
              'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.',
            );
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

  const severities = useMemo(() => {
    const map = new Map<string, Severity>();
    for (const problem of wb.problems) {
      if (!problem.nodeId || problem.severity === 'info') continue;
      const iStarId = wb.tree?.nodes.get(problem.nodeId)?.iStarId;
      if (iStarId && map.get(iStarId) !== 'error')
        map.set(iStarId, problem.severity);
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
      <SeverityContext.Provider value={severities}>
        <IstarProvider
          store={store}
          extensions={extensions}
          readOnly={!parsed || modelReadOnly}
        >
          <SelectionSync canvas={canvas} />
          <NotifyBridge notify={notify} />
          {/* piStar mode and full screen: piStar's bar on top; read-only has none */}
          <IstarCanvas
            ref={canvas}
            fitView
            aside={
              pistarMode && !wb.recordedEngine ? <IstarInspector /> : undefined
            }
            palette={
              modelReadOnly
                ? false
                : pistarMode || modelFullscreen
                  ? 'top'
                  : 'left'
            }
            className='h-full'
          />
        </IstarProvider>
      </SeverityContext.Provider>
      {!parsed && (
        <div className='pointer-events-none absolute inset-x-3 top-3 rounded-md bg-caution-soft px-3 py-1.5 text-2xs text-caution'>
          The model text doesn’t parse — showing the last valid diagram,
          read-only until it’s fixed.
        </div>
      )}
    </div>
  );
}
