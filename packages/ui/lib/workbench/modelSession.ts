/**
 * The open model's session (goal-controller#410, #434): its store and action
 * dispatcher live in the model worker (modelWorkerHost.ts), with the mode's
 * guards; the main thread holds a mirror of the store
 * (`createMirrorStore`, @istar-ts/actions), and every editor is a client of
 * the worker's dispatcher through it. The piStar text is derived in the
 * worker on each `sourceModelChanged` and arrives with it. One session per
 * opened model: opening another starts a new one (its history empty, as
 * `store.load` would leave it), so the store a render sees and the mode it
 * renders it in change in the same React update (#419).
 */
import {
  createMirrorStore,
  createRemoteDispatcher,
  type ActionDispatcher,
  type ActionListener,
  type DispatchOptions,
  type IstarAction,
  type MirrorStore,
  type ModelSourceChangedAction,
  type StoreActionDispatcher,
} from '@istar-ts/actions';
import {
  canLink,
  DEFAULT_PALETTE,
  ModelOperationError,
  toPistar,
  type AnyMetamodel,
  type AnyPaletteDescription,
  type GoalDiagnostic,
  type ModelListener,
  type ModelStore,
} from '@istar-ts/core';
import type { GModelSizeOverrides } from '@istar-ts/gmodel';
import type { IstarSurface } from '@istar-ts/react';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, rootMetamodelOf } from './dialects';
import { isGuardRejection } from './guardDiagnostics';
import { readModelText, type ModelMode } from './pistar';
import { modelWorker } from './modelWorkerClient';
import {
  changeExtrasOf,
  type ModelSessionControl,
  type ModelWorkerOpen,
} from './modelWorkerProtocol';

/** A change of the model made through the dispatcher, or by undo/redo. */
export type ModelChanged = {
  readonly model: AnyModel;
  readonly action: ModelSourceChangedAction;
  /** the surface whose dispatcher sent it (none: the base dispatcher) */
  readonly surface: IstarSurface | null;
  /**
   * The model's text, derived in the worker: the text it was opened or
   * written as, if it is one of the history's (undo, redo), byte for byte.
   */
  readonly text: string;
};

export type ModelSession = {
  /** a new one per opened model (a key for what renders it) */
  readonly id: number;
  /**
   * The mirror of the worker's store: read-only (each mutation throws),
   * edits go through `dispatcher`. Until the worker answers, the model as
   * the main thread read it.
   */
  readonly store: ModelStore<string, string>;
  /**
   * The worker's dispatcher: `dispatch` resolves once `store` shows what the
   * action did (a rejected one changes nothing, mirror included). A
   * `StoreActionDispatcher`: a GLSP server hosted over this session
   * (goal-controller#414, agent/glspSession.ts) reads `isDirty` at runtime.
   */
  readonly dispatcher: StoreActionDispatcher<string, string>;
  /** the dispatcher, tagged with the surface that sends through it */
  dispatcherFor(surface: IstarSurface): ActionDispatcher<string, string>;
  /** resolves once `store` shows the worker's own model */
  readonly ready: Promise<void>;
  /** the mode whose guards the worker's dispatcher runs (`guardsForMode`) */
  setMode(mode: ModelMode): void;
  /**
   * What `requestContextActions` answers: the palette of the canvas showing
   * the model (its registry and extensions, `paletteDescriptionFor`); none,
   * iStar 2.0's. Sent to the worker, ahead of the canvas's own request.
   */
  setPalette(palette: AnyPaletteDescription | null): void;
  /** The palette last given to `setPalette` (`DEFAULT_PALETTE` if none): for a GLSP
   * contribution built over this session (goal-controller#414), the same one the canvas draws. */
  getPalette(): AnyPaletteDescription;
  /**
   * The canvas's registry sizes (`registrySizes`, goal-controller#414): a GLSP
   * contribution needs them so its GModel's node sizes and actor boundaries
   * match what the canvas draws. None, between (the metamodel's own defaults).
   */
  setSizes(sizes: GModelSizeOverrides | undefined): void;
  getSizes(): GModelSizeOverrides | undefined;
  /**
   * `wb.setText`'s raw write: `model` (`text` as the main thread read it)
   * into the worker's store as one undoable edit, `text` kept as written;
   * none (a text that doesn't parse, a guard's rejection), the model stays
   * and the next derived text only takes its indentation from `text`.
   */
  write(text: string, model: AnyModel | null): void;
  /**
   * Serves the worker's dispatcher on `port` (the engine worker's mirror,
   * goal-controller#413) until the returned function is called, or the
   * session is disposed.
   */
  serve(port: MessagePort): () => void;
  /** set once `dispose` runs: `startSession` disposes the old one synchronously */
  readonly disposed: boolean;
  /** closes the worker's session: its store, dispatcher and connections */
  dispose(): void;
};

/** Where no worker is (the server's prerender): every action is rejected. */
const offline: ActionDispatcher<string, string> = {
  dispatch: () =>
    Promise.resolve({
      ok: false,
      diagnostics: [
        {
          elementId: '',
          severity: 'error',
          message: 'There is no model worker here.',
          source: 'workbench',
        },
      ],
    }),
  subscribe: () => () => {},
};

const readOnly = (): never => {
  throw new ModelOperationError(
    "the workbench's store is a mirror of the model worker's: dispatch the edit",
  );
};

let sessions = 0;

/**
 * Opens a session on `text` in the model worker. `seed`: the model as the
 * main thread read it (default: read here), shown until the worker answers.
 * `connect: false` (a server prerender): no worker, the seed only.
 */
export const createModelSession = (
  text: string,
  onChange: (change: ModelChanged) => void,
  options: { readonly seed?: AnyModel; readonly connect?: boolean } = {},
): ModelSession => {
  const id = (sessions += 1);
  const connect = options.connect ?? true;
  const seed =
    options.seed ??
    (() => {
      const read = readModelText(text);
      return 'model' in read ? read.model : emptyModel();
    })();
  const channel = connect ? new MessageChannel() : null;
  const remote = channel
    ? createRemoteDispatcher<string, string, MessageEvent>(channel.port1)
    : offline;
  if (channel)
    modelWorker().postMessage(
      { type: 'open', session: id, text } satisfies ModelWorkerOpen,
      [channel.port2],
    );
  let disposed = false;
  const post = (
    message: ModelSessionControl,
    transfer: MessagePort[] = [],
  ): void => {
    if (!disposed) channel?.port1.postMessage(message, transfer);
  };

  // the metamodels the models are read with, by the key the worker tags
  // each change with (ModelChangeExtras): the opened model's is 0
  const metamodels: AnyMetamodel[] = [];
  const metamodelKey = (model: AnyModel): number => {
    const metamodel = rootMetamodelOf(model);
    const known = metamodels.indexOf(metamodel);
    return known >= 0 ? known : metamodels.push(metamodel) - 1;
  };
  metamodelKey(seed);

  // the remote's notifications reach the mirror first, then the session's
  // listener, then the dispatcher's own subscribers: each sees the model
  // the change made
  const toMirror = new Set<ActionListener<string, string>>();
  const subscribers = new Set<ActionListener<string, string>>();
  const mirrorRemote: ActionDispatcher<string, string> = {
    dispatch: (action, dispatchOptions) =>
      remote.dispatch(action, dispatchOptions),
    subscribe: (listener) => {
      toMirror.add(listener);
      return () => {
        toMirror.delete(listener);
      };
    },
  };
  const storeListeners = new Set<ModelListener<string, string>>();
  // what `store` shows: the seed, until the mirror shows the worker's model
  let shown: AnyModel = seed;
  // the mirror's first model is the worker's read of the same text: the
  // seed stays shown if it is the same model, so opening one doesn't change
  // what every consumer holds (a re-render, a tree, a GLSP server's state)
  let seeded = true;
  let mirrorKey = 0;
  /**
   * A mirror reading the remote's files with the metamodel `key` names. The
   * mirror reads a file with its own metamodel while the file's
   * `"metamodel"` block is unchanged, and with `options.metamodel` (the
   * host) when it changes, so a conversion to another metamodel (a raw
   * write) needs a mirror of its own: the session follows with a new one.
   */
  const follow = (key: number): MirrorStore<string, string> => {
    const next = createMirrorStore<string, string>(mirrorRemote, {
      metamodel: metamodels[key],
      fileMetamodel: true,
    });
    next.subscribe((event) => {
      if (next !== mirror) return;
      const first = seeded;
      seeded = false;
      if (
        first &&
        event.source === 'load' &&
        toPistar(event.model) === toPistar(seed)
      )
        return;
      const previous = shown;
      shown = event.model;
      for (const listener of storeListeners) listener({ ...event, previous });
    });
    return next;
  };
  let mirror = follow(0);
  const ready = mirror.ready;

  // the surface a sourceModelChanged came from, from the dispatch's own
  // origin (istar-ts#213): survives the round trip to the worker
  const surfaceOf = (origin: string | undefined): IstarSurface | null =>
    origin === 'canvas' || origin === 'inspector' ? origin : null;
  // the worker's dirty state, as its setDirtyState notifications say
  let dirty = false;
  const unsubscribe = remote.subscribe((action) => {
    if (disposed) return;
    if (action.kind === 'setDirtyState') dirty = action.isDirty;
    const extras =
      action.kind === 'sourceModelChanged' ? changeExtrasOf(action) : null;
    if (
      extras &&
      extras.metamodelKey !== mirrorKey &&
      metamodels[extras.metamodelKey]
    ) {
      mirror.dispose();
      mirrorKey = extras.metamodelKey;
      mirror = follow(mirrorKey);
    }
    for (const listener of toMirror) listener(action);
    if (action.kind === 'sourceModelChanged')
      onChange({
        model: shown,
        action,
        surface: surfaceOf(action.origin),
        text: extras?.text ?? toPistar(shown),
      });
    for (const listener of subscribers) listener(action);
  });

  const dispatcher: StoreActionDispatcher<string, string> = {
    async dispatch<A extends IstarAction<string, string>>(
      action: A,
      dispatchOptions?: DispatchOptions,
    ) {
      const result = await remote.dispatch(action, dispatchOptions);
      await mirror.synced();
      return result;
    },
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    isDirty: () => dirty,
    // nothing of its own to stop: the session's `dispose` closes it all
    dispose: () => {},
  };
  const tagged = (tag: IstarSurface): ActionDispatcher<string, string> => ({
    dispatch<A extends IstarAction<string, string>>(
      action: A,
      dispatchOptions?: DispatchOptions,
    ) {
      return dispatcher.dispatch(action, { ...dispatchOptions, origin: tag });
    },
    subscribe: (listener) => dispatcher.subscribe(listener),
  });
  const surfaces: Readonly<
    Record<IstarSurface, ActionDispatcher<string, string>>
  > = {
    canvas: tagged('canvas'),
    inspector: tagged('inspector'),
  };

  const store: ModelStore<string, string> = {
    getModel: () => shown,
    subscribe: (listener) => {
      storeListeners.add(listener);
      return () => {
        storeListeners.delete(listener);
      };
    },
    canLink: (source, target, kind) => canLink(shown, source, target, kind),
    // one undo stack, the worker's: glspUndo/glspRedo
    undo: () => mirror.undo(),
    redo: () => mirror.redo(),
    canUndo: () => mirror.canUndo(),
    canRedo: () => mirror.canRedo(),
    addElement: readOnly,
    updateElement: readOnly,
    moveElement: readOnly,
    nestElement: readOnly,
    removeElement: readOnly,
    removeElements: readOnly,
    setCollapsed: readOnly,
    connect: readOnly,
    addDependency: readOnly,
    addLeg: readOnly,
    removeLeg: readOnly,
    updateLink: readOnly,
    disconnect: readOnly,
    updateDiagram: readOnly,
    replace: readOnly,
    load: readOnly,
    transaction: readOnly,
    clearHistory: readOnly,
  };

  let palette: AnyPaletteDescription = DEFAULT_PALETTE;
  let sizes: GModelSizeOverrides | undefined;
  let served = 0;
  return {
    id,
    store,
    dispatcher,
    dispatcherFor: (tag) => surfaces[tag],
    ready,
    setMode: (mode) => post({ type: 'mode', mode }),
    setPalette: (next) => {
      palette = next ?? DEFAULT_PALETTE;
      post({ type: 'palette', palette: next });
    },
    getPalette: () => palette,
    setSizes: (next) => {
      sizes = next;
    },
    getSizes: () => sizes,
    write: (written, model) =>
      post({
        type: 'write',
        text: written,
        apply: model !== null,
        metamodelKey: model ? metamodelKey(model) : mirrorKey,
      }),
    serve: (port) => {
      const serveId = (served += 1);
      post({ type: 'serve', id: serveId }, [port]);
      return () => post({ type: 'unserve', id: serveId });
    },
    get disposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) return;
      post({ type: 'close' });
      disposed = true;
      unsubscribe();
      mirror.dispose();
      channel?.port1.close();
    },
  };
};

/**
 * Dispatches `action` on `session`; if it's rejected, runs `onRejected` with
 * its diagnostics — but only if `session` is still the open model's (not
 * disposed by `startSession` swapping to another one while this dispatch was
 * in flight, goal-controller#431): a rejected edit on a file the user has
 * since navigated away from must not land on whatever is open now.
 *
 * `onRejected`'s second argument says whether a caller may still fall back to
 * applying the raw text unchecked (goal-controller#439 review): true for a
 * rejection the vocabulary itself made (an unparseable model, an unknown
 * action), false for one of goal-controller's own guards — falling back to
 * that would apply through the back door exactly what the guard just refused.
 */
export function dispatchOrFallback<A extends IstarAction<string, string>>(
  session: ModelSession,
  surface: IstarSurface,
  action: A,
  onRejected: (
    diagnostics: readonly GoalDiagnostic[],
    canFallBack: boolean,
  ) => void,
): void {
  void session
    .dispatcherFor(surface)
    .dispatch(action)
    .then((result) => {
      if (!result.ok && !session.disposed)
        onRejected(result.diagnostics, !isGuardRejection(result.diagnostics));
    });
}
