/**
 * The RT notation language server: a Langium server in a Web Worker, reached
 * by @codemirror/lsp-client over postMessage.
 */
import {
  LSPClient,
  languageServerExtensions,
  type Transport,
} from '@codemirror/lsp-client';

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

export const createRtClient = (): { client: LSPClient; worker: Worker } => {
  const worker = new Worker(new URL('./rtWorker.ts', import.meta.url), {
    type: 'module',
  });
  const client = new LSPClient({
    rootUri: 'file:///',
    extensions: languageServerExtensions(),
  }).connect(workerTransport(worker));
  return { client, worker };
};
