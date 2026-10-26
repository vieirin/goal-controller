/**
 * A liveness probe shared by the engine worker (goal-controller#432) and the
 * model worker (#469): both answer a `ping` with a `pong` of the same `id`,
 * instantly, as long as they're alive. `start(timeoutMs)` sends one and times
 * it out; `pong(id)` clears it if it matches the one outstanding; one probe
 * at a time, so a `start` while one is already out is a no-op.
 */
export type WorkerPing = {
  start(timeoutMs: number): void;
  pong(id: number): void;
  stop(): void;
};

export const createWorkerPing = (
  send: (id: number) => void,
  onTimeout: (timeoutMs: number) => void,
): WorkerPing => {
  let nextId = 0;
  let pending: {
    readonly id: number;
    readonly timer: ReturnType<typeof setTimeout>;
  } | null = null;
  const stop = (): void => {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  };
  return {
    start(timeoutMs) {
      if (pending) return;
      const id = (nextId += 1);
      pending = {
        id,
        timer: setTimeout(() => {
          pending = null;
          onTimeout(timeoutMs);
        }, timeoutMs),
      };
      send(id);
    },
    pong(id) {
      if (pending?.id === id) stop();
    },
    stop,
  };
};
