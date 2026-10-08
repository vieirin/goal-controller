/**
 * The RT notation language server: a Langium server in a Web Worker, reached
 * by @codemirror/lsp-client over postMessage.
 */
import {
  LSPClient,
  languageServerExtensions,
  type Transport,
} from '@codemirror/lsp-client';
import {
  CONTEXT_NOTIFICATION,
  type RtContextRecord,
} from '@goal-controller/rt-language/context';

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

let shared: LSPClient | null = null;

/**
 * The page's RT language server client: one worker for the Notation view and
 * the inspector's fields (each an open document of the same server).
 */
export const rtClient = (): LSPClient => {
  if (!shared) {
    const worker = new Worker(new URL('./rtWorker.ts', import.meta.url), {
      type: 'module',
    });
    // a server that fails to start would only time requests out
    worker.onerror = (event) =>
      console.error('[rt language server]', event.message, event);
    shared = new LSPClient({
      rootUri: 'file:///',
      extensions: languageServerExtensions(),
    }).connect(workerTransport(worker));
  }
  return shared;
};

let sentFrom: readonly unknown[] = [];

/** Sends `rt/context` once per change of what it is built from (by identity). */
export const sendRtContext = (
  client: LSPClient,
  sources: readonly unknown[],
  build: () => RtContextRecord,
): void => {
  if (
    sources.length === sentFrom.length &&
    sources.every((source, i) => source === sentFrom[i])
  )
    return;
  sentFrom = sources;
  const context = build();
  void client.initializing.then(() =>
    client.notification(CONTEXT_NOTIFICATION, context),
  );
};

/** An inspector field's document: the server reads it with the property's rule. */
export const rtFieldUri = (id: string, key: string): string =>
  `file:///fields/${encodeURIComponent(id)}/${key}.rtp`;
