/**
 * The model worker's host, in-process (goal-controller#434): for where there
 * is no `Worker` (jsdom, Node). Messages are cloned as `postMessage` would
 * clone them, and each session still runs over its own `MessagePort`, so the
 * main thread's side works exactly as it does over a real worker. The host
 * is imported on first use: a page with workers never loads it.
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

export const createLocalModelWorker = (): ModelWorkerEndpoint => ({
  postMessage(message, transfer) {
    const data = structuredClone(message);
    void localHost().then((local) =>
      local.onMessage({ data, ports: transfer }),
    );
  },
});

/** The sessions the in-process host has open (the tests check a switch closes one). */
export const localModelWorkerSessions = async (): Promise<readonly number[]> =>
  (await localHost()).openSessions();
