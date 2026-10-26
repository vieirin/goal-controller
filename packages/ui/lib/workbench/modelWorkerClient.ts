/**
 * The page's one model worker (goal-controller#434): every session
 * (modelSession.ts) is opened in it, each over a port of its own. Spawned on
 * the first session, and kept for the page's lifetime: a provider unmounted
 * by Strict Mode and mounted again keeps its sessions. Where there is no
 * `Worker` (the tests), the same host runs in-process (modelWorkerLocal.ts),
 * over the same ports.
 *
 * Crash recovery (goal-controller#469, #479): an `onerror`/`onmessageerror`,
 * a stuck dispatch's own ack deadline (`reportModelWorkerHang`,
 * `modelSession.ts`), or a manual `restartModelWorker` call tells every
 * `onModelWorkerCrash` listener (one per open session): the next
 * `modelWorker()` call spawns a fresh one. A slow-but-alive dispatch is a
 * different, non-fatal thing (`onModelWorkerSlow`, shown as a dismiss-free
 * notice with a "restart" action instead): a dispatch's own ack already
 * proves the worker is alive long before it finishes applying, so a big
 * `replaceModel`, import or Propose batch is never mistaken for a crash
 * (goal-controller#479 review).
 */
import type { ModelWorkerRequest } from './modelWorkerProtocol';
import { createLocalModelWorker } from './modelWorkerLocal';

/** What a session needs of the model worker: a real one fits. */
export type ModelWorkerEndpoint = {
  postMessage(message: ModelWorkerRequest, transfer: MessagePort[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
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

type SlowListener = (slow: boolean) => void;

const slowListeners = new Set<SlowListener>();

/**
 * Hears a dispatch that's gone slow (goal-controller#479): `true` once it's
 * been pending a while, `false` once it settles (or the worker is replaced
 * by a crash). Not fatal on its own — the worker's dispatcher is
 * single-threaded, so a big `replaceModel`, import or Propose batch looks
 * exactly like this while it applies.
 */
export const onModelWorkerSlow = (listener: SlowListener): (() => void) => {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
};

/** Tells every `onModelWorkerSlow` listener (`modelSession.ts`'s own timer). */
export const notifyModelWorkerSlow = (slow: boolean): void => {
  for (const listener of slowListeners) listener(slow);
};

let shared: ModelWorkerEndpoint | null = null;

/**
 * `worker`'s own identity is checked against `shared` (goal-controller#479
 * review): an error delivered late, after a prior crash already respawned a
 * new one, must not tear down a worker that isn't the dead one.
 */
const crash = (worker: ModelWorkerEndpoint, message: string): void => {
  if (worker !== shared) return;
  shared = null;
  worker.terminate();
  notifyModelWorkerSlow(false);
  for (const listener of crashListeners) listener(message);
};

const spawn = (): ModelWorkerEndpoint => {
  const worker: ModelWorkerEndpoint =
    typeof Worker === 'undefined'
      ? createLocalModelWorker()
      : new Worker(new URL('./modelWorker.ts', import.meta.url), {
          type: 'module',
        });
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    crash(worker, event.message || 'the model worker crashed');
  };
  worker.onmessageerror = () => {
    crash(
      worker,
      'the model worker sent a message the main thread could not read',
    );
  };
  return worker;
};

export const modelWorker = (): ModelWorkerEndpoint => (shared ??= spawn());

/**
 * A dispatch's own ack never arrived within its deadline
 * (`modelSession.ts`'s `HANG_DEADLINE_MS`): the worker is genuinely gone,
 * not just busy (an ack is sent before a message is applied, so a slow
 * apply never triggers this). A no-op once the worker named has already
 * been replaced by some other recovery.
 */
export const reportModelWorkerHang = (message: string): void => {
  if (shared) crash(shared, message);
};

/** The "Restart editor" action on the slow notice: the same recovery a real crash takes, on demand. */
export const restartModelWorker = (): void => {
  if (shared)
    crash(shared, 'The editor was restarted; undo history was reset.');
};
