/**
 * The model worker's host, in-process (goal-controller#434): for where there
 * is no `Worker` (jsdom, Node). Messages are cloned as `postMessage` would
 * clone them, and each session still runs over its own `MessagePort`, so the
 * main thread's side works exactly as it does over a real worker. The host
 * is imported on first use: a page with workers never loads it.
 *
 * `terminate()` (goal-controller#469's crash recovery) drops the shared host:
 * the next spawned local worker starts with no sessions, as a real crash
 * would leave none alive either.
 */
import type { ModelWorkerEndpoint } from './modelWorkerClient';

type LocalHost = ReturnType<
  typeof import('./modelWorkerHost').createModelWorkerHost
>;

let host: Promise<LocalHost> | null = null;

const localHost = (): Promise<LocalHost> =>
  (host ??= import('./modelWorkerHost').then(({ createModelWorkerHost }) =>
    createModelWorkerHost(),
  ));

export const createLocalModelWorker = (): ModelWorkerEndpoint => {
  const endpoint: ModelWorkerEndpoint = {
    onmessage: null,
    // the in-process host never fails to parse or throws past its own
    // try/catch, so neither ever fires here; real worker-only paths
    onerror: null,
    onmessageerror: null,
    postMessage(message, transfer) {
      const data = structuredClone(message);
      void localHost().then((local) =>
        local.onMessage({ data, ports: transfer }),
      );
    },
    terminate() {
      host = null;
    },
  };
  return endpoint;
};

/** The sessions the in-process host has open (the tests check a switch closes one). */
export const localModelWorkerSessions = async (): Promise<readonly number[]> =>
  (await localHost()).openSessions();
