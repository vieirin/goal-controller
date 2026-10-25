/**
 * The open model's store and action dispatcher (goal-controller#410): the
 * workbench owns them, every editor is a client of the dispatcher, and the
 * piStar text is derived from the model on each `sourceModelChanged`. One
 * session per opened model: opening another starts a new one (its history
 * empty, as `store.load` would leave it), so the store a render sees and the
 * mode it renders it in change in the same React update (#419).
 */
import {
  createActionDispatcher,
  type ActionDispatcher,
  type DispatchOptions,
  type IstarAction,
  type ModelSourceChangedAction,
} from '@istar-ts/actions';
import {
  createModelStore,
  DEFAULT_PALETTE,
  type AnyPaletteDescription,
  type ModelChangeEvent,
  type ModelStore,
} from '@istar-ts/core';
import type { IstarSurface } from '@istar-ts/react';
import type { AnyModel } from '@goal-controller/lib';
import { pistarExtMetamodelGuard } from './dialects';

/** A change of the model made through the dispatcher, or by undo/redo. */
export type ModelChanged = {
  readonly model: AnyModel;
  readonly action: ModelSourceChangedAction;
  /** the surface whose dispatcher sent it (none: the base dispatcher) */
  readonly surface: IstarSurface | null;
};

export type ModelSession = {
  /** a new one per opened model (a key for what renders it) */
  readonly id: number;
  readonly store: ModelStore<string, string>;
  readonly dispatcher: ActionDispatcher<string, string>;
  /** the dispatcher, tagged with the surface that sends through it */
  dispatcherFor(surface: IstarSurface): ActionDispatcher<string, string>;
  /**
   * Runs `edit` on the store without telling the session's listener: the
   * text was written first (`wb.setText`), so it is not derived again.
   */
  quietly<T>(edit: () => T): T;
  /**
   * What `requestContextActions` answers: the palette of the canvas showing
   * the model (its registry and extensions, `paletteDescriptionFor`); none,
   * iStar 2.0's. The dispatcher reads it on each request.
   */
  setPalette(palette: AnyPaletteDescription | null): void;
  /** the store's edits (not undo, redo or load), but the quiet ones */
  subscribeEdits(
    listener: (event: ModelChangeEvent<string, string>) => void,
  ): () => void;
  dispose(): void;
};

let sessions = 0;

export const createModelSession = (
  model: AnyModel,
  onChange: (change: ModelChanged) => void,
): ModelSession => {
  const store = createModelStore(model);
  // the palette the canvas showing this model draws (its registry and
  // extensions, PaletteBridge): the dispatcher asks for it on each request
  // (istar-ts#202), so a dialect change doesn't need a new dispatcher
  let palette: AnyPaletteDescription = DEFAULT_PALETTE;
  // sendModel: each sourceModelChanged carries the model and canUndo/canRedo,
  // for a mirror that follows it from another thread (the engine worker, #413)
  const dispatcher = createActionDispatcher(store, {
    palette: () => palette,
    guards: [pistarExtMetamodelGuard],
    sendModel: true,
  });
  // the surface a sourceModelChanged came from, from the dispatch's own
  // origin (istar-ts#213): survives a round trip, unlike a synchronous tag
  const surfaceOf = (origin: string | undefined): IstarSurface | null =>
    origin === 'canvas' || origin === 'inspector' ? origin : null;
  let quiet = false;
  const unsubscribe = dispatcher.subscribe((action) => {
    if (action.kind !== 'sourceModelChanged' || quiet) return;
    onChange({
      model: store.getModel(),
      action,
      surface: surfaceOf(action.origin),
    });
  });
  const tagged = (tag: IstarSurface): ActionDispatcher<string, string> => ({
    dispatch<A extends IstarAction<string, string>>(
      action: A,
      options?: DispatchOptions,
    ) {
      return dispatcher.dispatch(action, { ...options, origin: tag });
    },
    subscribe: (listener) => dispatcher.subscribe(listener),
  });
  const surfaces: Readonly<
    Record<IstarSurface, ActionDispatcher<string, string>>
  > = {
    canvas: tagged('canvas'),
    inspector: tagged('inspector'),
  };
  return {
    id: (sessions += 1),
    store,
    dispatcher,
    dispatcherFor: (tag) => surfaces[tag],
    quietly: (edit) => {
      const outer = quiet;
      quiet = true;
      try {
        return edit();
      } finally {
        quiet = outer;
      }
    },
    setPalette: (next) => {
      palette = next ?? DEFAULT_PALETTE;
    },
    subscribeEdits: (listener) =>
      store.subscribe((event) => {
        if (event.source === 'edit' && !quiet) listener(event);
      }),
    dispose: () => {
      unsubscribe();
      dispatcher.dispose();
    },
  };
};
