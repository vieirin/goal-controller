/**
 * The page's one model worker (goal-controller#434): every session
 * (modelSession.ts) is opened in it, each over a port of its own. Spawned on
 * the first session, and kept for the page's lifetime: a provider unmounted
 * by Strict Mode and mounted again keeps its sessions. Where there is no
 * `Worker` (the tests), the same host runs in-process (modelWorkerLocal.ts),
 * over the same ports.
 */
import type { ModelWorkerOpen } from './modelWorkerProtocol';
import { createLocalModelWorker } from './modelWorkerLocal';

/** What a session needs of the model worker: a real one fits. */
export type ModelWorkerEndpoint = {
  postMessage(message: ModelWorkerOpen, transfer: MessagePort[]): void;
};

const spawn = (): ModelWorkerEndpoint => {
  if (typeof Worker === 'undefined') return createLocalModelWorker();
  const worker = new Worker(new URL('./modelWorker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onerror = (event: ErrorEvent) => {
    console.error(`The model worker failed: ${event.message}`);
  };
  return worker;
};

let shared: ModelWorkerEndpoint | null = null;

export const modelWorker = (): ModelWorkerEndpoint => (shared ??= spawn());
