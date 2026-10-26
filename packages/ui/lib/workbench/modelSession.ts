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
  type ModelSourceChangedAction,
} from '@istar-ts/actions';
import {
  DEFAULT_PALETTE,
  toPistar,
  type AnyPaletteDescription,
  type GoalDiagnostic,
  type ModelStore,
} from '@istar-ts/core';
import type { GModelSizeOverrides } from '@istar-ts/gmodel';
import type { IstarSurface } from '@istar-ts/react';
import type { AnyModel } from '@goal-controller/lib';
import { emptyModel, metamodelFor } from './dialects';
import { isGuardRejection } from './guardDiagnostics';
import { readModelText, type ModelMode } from './pistar';
import {
  MODEL_WORKER_PONG_TIMEOUT_MS,
  MODEL_WORKER_SLOW_MS,
  modelWorker,
  onModelWorkerCrash,
  pingModelWorker,
} from './modelWorkerClient';
import {
  changeTextOf,
  isModelSessionReport,
  isModelSessionToolCall,
  type ModelSessionControl,
  type ModelSessionToolCall,
  type ModelWorkerOpen,
} from './modelWorkerProtocol';
import type { WorkspaceTool } from './agent/hostTools';

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
   * The mirror of the worker's store (`createMirrorStore`): read-only (each
   * mutation throws a `ModelOperationError`), edits go through `dispatcher`.
   * Until the worker answers, the model as the main thread read it.
   */
  readonly store: ModelStore<string, string>;
  /**
   * The worker's dispatcher: `dispatch` resolves once `store` shows what the
   * action did (a rejected one changes nothing, mirror included). A GLSP
   * server hosted over it tracks its dirty state from the `setDirtyState`
   * notifications it relays (`withDirtyState`).
   */
  readonly dispatcher: ActionDispatcher<string, string>;
  /** the dispatcher, tagged with the surface that sends through it */
  dispatcherFor(surface: IstarSurface): ActionDispatcher<string, string>;
  /** resolves once `store` shows the worker's own model */
  readonly ready: Promise<void>;
  /**
   * Resolves once `store` shows every change the worker made before now,
   * whoever made it (the agent's session, on a port of its own).
   */
  synced(): Promise<void>;
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
   * `wb.setText`'s raw write: `apply`, `text` (it parses: the main thread
   * read it) into the worker's store as one undoable edit, `text` kept as
   * written; otherwise (a text that doesn't parse, a guard's rejection) the
   * model stays and the next derived text only takes its indentation from
   * `text`.
   */
  write(text: string, apply: boolean): void;
  /**
   * Serves the worker's dispatcher on `port` (the engine worker's mirror,
   * goal-controller#413) until the returned function is called, or the
   * session is disposed.
   */
  serve(port: MessagePort): () => void;
  /**
   * Serves the agent's GLSP/MCP session on `port`, in the worker
   * (`serveGlspMcpSession`, agent/glspSession.ts), until the returned function is
   * called or the session is disposed: `tools` (the host tools that read
   * the main thread's workspace) are served with the worker's own, each
   * call run here.
   */
  serveAgent(port: MessagePort, tools: readonly WorkspaceTool[]): () => void;
  /**
   * Fires once if the model worker crashes while this session is open
   * (goal-controller#469), with an error describing it: every in-flight
   * `dispatch`/`synced()` wait already rejects with the same error. Already
   * crashed: the listener runs at once. For a consumer that opens its own
   * port into the worker next to this session's (the agent's drawer,
   * `glspSession.ts`), so its own pending calls can reject too.
   */
  onCrash(listener: (error: Error) => void): () => void;
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

let sessions = 0;

/**
 * Opens a session on `text` in the model worker. `seed`: the model as the
 * main thread read it (default: read here), shown until the worker answers.
 * `connect: false` (a server prerender): no worker, the seed only.
 * `onReport`: the active mode's guard diagnostics, in report mode
 * (goal-controller#471) — after this session's model is opened, and again
 * after every `setMode`.
 */
export const createModelSession = (
  text: string,
  onChange: (change: ModelChanged) => void,
  onReport: (diagnostics: readonly GoalDiagnostic[]) => void,
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
  // the agents' tools the worker calls back (`serveAgent`), by agent
  const agentTools = new Map<number, readonly WorkspaceTool[]>();
  const answer = ({ agent, call, name, args }: ModelSessionToolCall): void => {
    const tool = agentTools.get(agent)?.find((each) => each.name === name);
    try {
      if (!tool) throw new Error(`no host tool ${name}`);
      post({ type: 'toolResult', call, result: tool.handler(args) });
    } catch (error) {
      post({
        type: 'toolResult',
        call,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  // the report (goal-controller#471) and the tool calls: not JSON-RPC
  // frames, so they reach their own listener rather than the remote
  // dispatcher's `onmessage`
  channel?.port1.addEventListener('message', (event: MessageEvent) => {
    if (isModelSessionReport(event.data)) onReport(event.data.diagnostics);
    else if (isModelSessionToolCall(event.data)) answer(event.data);
  });
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

  // crash recovery (goal-controller#469): once the worker crashes, every
  // listener here (an in-flight dispatch's own race below, or a consumer's
  // `onCrash`, e.g. the agent drawer's own port) hears the same error, once;
  // `crashError` makes every dispatch after that reject immediately instead
  // of trying a dead port
  let crashError: Error | null = null;
  const crashListeners = new Set<(error: Error) => void>();
  const stopWatchingForCrash = channel
    ? onModelWorkerCrash((message) => {
        if (disposed || crashError) return;
        crashError = new Error(message);
        for (const listener of crashListeners) listener(crashError);
      })
    : null;
  const raceCrash = <T>(pending: Promise<T>): Promise<T> => {
    if (crashError) return Promise.reject(crashError);
    return new Promise<T>((resolve, reject) => {
      const onCrashed = (error: Error): void => {
        crashListeners.delete(onCrashed);
        reject(error);
      };
      crashListeners.add(onCrashed);
      pending.then(
        (value) => {
          crashListeners.delete(onCrashed);
          resolve(value);
        },
        (error) => {
          crashListeners.delete(onCrashed);
          reject(error);
        },
      );
    });
  };

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
  // the seed until the worker answers (no empty flash on open), kept if the
  // worker's model is equal; each file is read with the metamodel it is
  // written in, so the mirror follows a conversion to another framework or
  // dialect, and an undo across it (`metamodelFor`)
  const mirror = createMirrorStore<string, string>(mirrorRemote, {
    initial: seed,
    metamodelFor,
    fileMetamodel: true,
  });

  // the surface a sourceModelChanged came from, from the dispatch's own
  // origin (istar-ts#213): survives the round trip to the worker
  const surfaceOf = (origin: string | undefined): IstarSurface | null =>
    origin === 'canvas' || origin === 'inspector' ? origin : null;
  const unsubscribe = remote.subscribe((action) => {
    if (disposed) return;
    for (const listener of toMirror) listener(action);
    if (action.kind === 'sourceModelChanged') {
      const model = mirror.getModel();
      onChange({
        model,
        action,
        surface: surfaceOf(action.origin),
        text: changeTextOf(action) ?? toPistar(model),
      });
    }
    for (const listener of subscribers) listener(action);
  });

  const dispatcher: ActionDispatcher<string, string> = {
    async dispatch<A extends IstarAction<string, string>>(
      action: A,
      dispatchOptions?: DispatchOptions,
    ) {
      // a dispatch this slow pings the worker (goal-controller#469): a
      // healthy one answers long before this fires, so it never sends one;
      // no pong within its own deadline is the crash path's job, not this
      // dispatch's — it just rides whatever `raceCrash` below does with it
      const slow = setTimeout(
        () => pingModelWorker(MODEL_WORKER_PONG_TIMEOUT_MS),
        MODEL_WORKER_SLOW_MS,
      );
      try {
        const result = await raceCrash(
          remote.dispatch(action, dispatchOptions),
        );
        await raceCrash(mirror.synced());
        return result;
      } finally {
        clearTimeout(slow);
      }
    },
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
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

  let palette: AnyPaletteDescription = DEFAULT_PALETTE;
  let sizes: GModelSizeOverrides | undefined;
  let served = 0;
  let agents = 0;
  return {
    id,
    store: mirror,
    dispatcher,
    dispatcherFor: (tag) => surfaces[tag],
    ready: mirror.ready,
    synced: async () => {
      // answered after every change the worker sent before it
      await dispatcher.dispatch({
        kind: 'requestTypeHints',
        requestId: 'synced',
      });
    },
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
    write: (written, apply) => post({ type: 'write', text: written, apply }),
    serve: (port) => {
      const serveId = (served += 1);
      post({ type: 'serve', id: serveId }, [port]);
      return () => post({ type: 'unserve', id: serveId });
    },
    serveAgent: (port, tools) => {
      const agent = (agents += 1);
      agentTools.set(agent, tools);
      post(
        {
          type: 'agent',
          id: agent,
          tools: tools.map(
            ({ name, title, description, inputSchema, readOnly }) => ({
              name,
              title,
              description,
              inputSchema,
              readOnly,
            }),
          ),
        },
        [port],
      );
      return () => {
        agentTools.delete(agent);
        post({ type: 'unagent', id: agent });
      };
    },
    onCrash: (listener) => {
      if (crashError) {
        listener(crashError);
        return () => {};
      }
      crashListeners.add(listener);
      return () => {
        crashListeners.delete(listener);
      };
    },
    get disposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) return;
      post({ type: 'close' });
      disposed = true;
      stopWatchingForCrash?.();
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
