/**
 * The page's one model worker (goal-controller#434): every session
 * (modelSession.ts) is opened in it, each over a port of its own. Spawned on
 * the first session, and kept for the page's lifetime: a provider unmounted
 * by Strict Mode and mounted again keeps its sessions. Where there is no
 * `Worker` (the tests), the same host runs in-process (modelWorkerLocal.ts),
 * over the same ports.
 *
 * Crash recovery (goal-controller#469): an `onerror`/`onmessageerror`, or a
 * `ping` (`pingModelWorker`, sent by a session whose dispatch has been slow
 * for a while) that gets no `pong` within its deadline, terminates the dead
 * worker and tells every `onModelWorkerCrash` listener (one per open
 * session, `modelSession.ts`): the next `modelWorker()` call spawns a fresh
 * one. The probe itself is `workerPing.ts`'s, shared with the engine
 * worker's (`engineWorkerClient.ts`).
 */
import type {
  ModelWorkerPong,
  ModelWorkerRequest,
} from './modelWorkerProtocol';
import { isModelWorkerPong } from './modelWorkerProtocol';
import { createLocalModelWorker } from './modelWorkerLocal';
import { createWorkerPing } from './workerPing';

/** What a session needs of the model worker: a real one fits. */
export type ModelWorkerEndpoint = {
  postMessage(message: ModelWorkerRequest, transfer: MessagePort[]): void;
  onmessage: ((event: MessageEvent<ModelWorkerPong>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  terminate(): void;
};

type CrashListener = (message: string) => void;

const crashListeners = new Set<CrashListener>();

/**
 * Hears every model-worker crash: the message is shown as the editor's
 * notice. By the time listeners run, `shared` is already cleared, so the
 * next `modelWorker()` call (from the session a listener opens to replace
 * this one) spawns a fresh worker.
 */
export const onModelWorkerCrash = (listener: CrashListener): (() => void) => {
  crashListeners.add(listener);
  return () => {
    crashListeners.delete(listener);
  };
};

let shared: ModelWorkerEndpoint | null = null;

const crash = (message: string): void => {
  const worker = shared;
  if (!worker) return;
  shared = null;
  pinger.stop();
  worker.terminate();
  for (const listener of crashListeners) listener(message);
};

const pinger = createWorkerPing(
  (id) => shared?.postMessage({ type: 'ping', id }, []),
  (timeoutMs) =>
    crash(
      `The model worker stopped responding (no reply in ${timeoutMs / 1000}s); it was restarted.`,
    ),
);

const spawn = (): ModelWorkerEndpoint => {
  const worker: ModelWorkerEndpoint =
    typeof Worker === 'undefined'
      ? createLocalModelWorker()
      : new Worker(new URL('./modelWorker.ts', import.meta.url), {
          type: 'module',
        });
  worker.onmessage = (event: MessageEvent) => {
    if (isModelWorkerPong(event.data)) pinger.pong(event.data.id);
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    crash(event.message || 'the model worker crashed');
  };
  worker.onmessageerror = () => {
    crash('the model worker sent a message the main thread could not read');
  };
  return worker;
};

export const modelWorker = (): ModelWorkerEndpoint => (shared ??= spawn());

/**
 * Asks the live worker for a `pong`; none within `timeoutMs` and it's
 * treated as crashed (it's single-threaded: busy that long on a dispatch is
 * hung). One ping at a time: a call while one is out is a no-op. A no-op too
 * where nothing has spawned a worker yet.
 */
export const pingModelWorker = (timeoutMs: number): void => {
  if (shared) pinger.start(timeoutMs);
};

/** How long a dispatch goes unanswered before a session pings the worker to check it's alive. */
export const MODEL_WORKER_SLOW_MS = 8_000;
/** How long that ping may go unanswered before the worker is treated as hung. */
export const MODEL_WORKER_PONG_TIMEOUT_MS = 4_000;
