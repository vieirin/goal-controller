/**
 * The goal language server: a Langium server in a Web Worker, reached by
 * @codemirror/lsp-client over postMessage. One client for the page: the
 * Notation view and the inspector's fields are documents of the same server.
 */
import {
  LSPClient,
  languageServerExtensions,
  type Transport,
} from '@codemirror/lsp-client';
import {
  GOAL_CONTEXT_NOTIFICATION,
  type GoalContextParams,
} from '@goal-controller/goal-language/light';

export { fieldUri as goalFieldUri } from '@goal-controller/goal-language/light';

/** lsp-client speaks JSON strings; the worker's BrowserMessageReader/Writer post objects. */
const workerTransport = (worker: Worker): Transport => {
  const handlers = new Set<(value: string) => void>();
  worker.onmessage = (event: MessageEvent) => {
    const message = JSON.stringify(event.data);
    for (const handler of handlers) handler(message);
  };
  return {
    send: (message) => worker.postMessage(JSON.parse(message)),
    subscribe: (handler) => handlers.add(handler),
    unsubscribe: (handler) => handlers.delete(handler),
  };
};

/** What a server publishes for a document (LSP's `publishDiagnostics`). */
export type PublishedDiagnostics = {
  uri: string;
  diagnostics: readonly {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    severity?: number;
    message: string;
    data?: unknown;
  }[];
};

type DiagnosticsListener = (params: PublishedDiagnostics) => void;
const listeners = new WeakMap<LSPClient, Set<DiagnosticsListener>>();

/**
 * A client of a language server the workbench runs (the shared goal-language
 * worker, an engine's own server): lsp-client's features, and the diagnostics
 * it publishes handed to `onClientDiagnostics` too (the editor still shows
 * them: lsp-client's own handler runs after).
 */
export const serviceClient = (transport: Transport): LSPClient =>
  new LSPClient({
    rootUri: 'file:///',
    extensions: languageServerExtensions(),
    notificationHandlers: {
      'textDocument/publishDiagnostics': (client, params) => {
        listeners.get(client)?.forEach((listener) => listener(params));
        // not handled: lsp-client shows them in the editor too
        return false;
      },
    },
  }).connect(transport);

/** Listens to what a service's server publishes. */
export const onClientDiagnostics = (
  client: LSPClient,
  listener: DiagnosticsListener,
): (() => void) => {
  const known = listeners.get(client) ?? new Set<DiagnosticsListener>();
  listeners.set(client, known);
  known.add(listener);
  return () => known.delete(listener);
};

let shared: LSPClient | null | undefined;
const failures = new Set<() => void>();

const fail = (why: unknown) => {
  console.error('[goal language server] not started: local support used', why);
  shared = null;
  for (const listener of failures) listener();
};

/**
 * The page's client, or null when the worker can't start (the views then
 * use the local support; the page doesn't break).
 */
export const goalClient = (): LSPClient | null => {
  if (shared !== undefined) return shared;
  try {
    const worker = new Worker(new URL('./goalWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onerror = (event) => fail(event.message || event);
    shared = serviceClient(workerTransport(worker));
  } catch (error) {
    fail(error);
  }
  return shared ?? null;
};

/** Called when the server fails after it was handed out. */
export const onGoalServerFailure = (listener: () => void): (() => void) => {
  failures.add(listener);
  return () => failures.delete(listener);
};

let sentFrom: readonly unknown[] = [];

/** Sends `goal/context` once per change of what it is built from (by identity). */
export const sendGoalContext = (
  client: LSPClient,
  sources: readonly unknown[],
  build: () => GoalContextParams,
): void => {
  if (
    sources.length === sentFrom.length &&
    sources.every((source, i) => source === sentFrom[i])
  )
    return;
  sentFrom = sources;
  const params = build();
  void client.initializing.then(() =>
    client.notification(GOAL_CONTEXT_NOTIFICATION, params),
  );
};
