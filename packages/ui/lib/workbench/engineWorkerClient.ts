/**
 * The main-thread side of the engine worker (goal-controller#413): one
 * worker per `WorkbenchProvider`, its mirror reconnected to the session's
 * dispatcher whenever the session changes (a new model opened). Analysis
 * results arrive as they're ready; a transform is request/response, keyed
 * by a request id so several in flight (Run, then live mode) don't cross.
 * A crash (`onerror`/`onmessageerror`, goal-controller#432 review) fails
 * every pending transform, surfaces as `crashed`, and respawns the worker.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectDispatcher, type ActionDispatcher } from '@istar-ts/actions';
import type { TransformEngine } from '@/lib/types';
import type { AnalyzeResponse } from './types';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
  TransformOutcome,
  TransformRequestOptions,
} from './engineWorkerProtocol';

export type EngineAnalysis =
  | { readonly ok: true; readonly key: string; readonly data: AnalyzeResponse }
  | { readonly ok: false; readonly key: string; readonly message: string };

/** A worker crash, with a fresh identity each time so a repeat is still a change. */
export type EngineWorkerCrash = {
  readonly message: string;
  readonly at: number;
};

export type EngineWorkerClient = {
  /** the worker's latest analysis, by key (`analysisKey`); none until the first */
  readonly analysis: EngineAnalysis | null;
  /** runs a transform in the worker, against its mirror's current model */
  readonly transform: (
    options: Omit<TransformRequestOptions, 'requestId'>,
  ) => Promise<TransformOutcome>;
  /** the worker's last crash, if any; a new one is always a new object */
  readonly crashed: EngineWorkerCrash | null;
};

/** `connect` is sent with its port instead, by the reconnect effect below. */
type EngineWorkerCommand = Exclude<EngineWorkerRequest, { type: 'connect' }>;

const spawnWorker = (): Worker =>
  new Worker(new URL('./engineWorker.ts', import.meta.url), {
    type: 'module',
  });

/**
 * Connects `dispatcher` to a dedicated engine worker: analysis reruns there
 * on every `sourceModelChanged`, debounced; `transform` runs there once per
 * call. No worker where the page is prerendered (`typeof Worker ===
 * 'undefined'`): `analysis` stays null and `transform` rejects every call.
 */
export const useEngineWorker = (
  dispatcher: ActionDispatcher<string, string>,
  engine: TransformEngine,
  pistar: boolean,
): EngineWorkerClient => {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(
    new Map<
      number,
      { sessionId: number; resolve: (outcome: TransformOutcome) => void }
    >(),
  );
  const nextRequestId = useRef(0);
  const latestRequestId = useRef(0);
  const sessionId = useRef(0);
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null);
  const [crashed, setCrashed] = useState<EngineWorkerCrash | null>(null);
  // bumped to respawn the worker (its creation effect below keys on it)
  const [workerVersion, setWorkerVersion] = useState(0);

  useEffect(() => {
    if (typeof Worker === 'undefined') return undefined;
    const worker = spawnWorker();
    const crash = (message: string): void => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      for (const [requestId, entry] of pending.current) {
        entry.resolve({
          requestId,
          modelSignature: null,
          ok: false,
          error: message,
        });
      }
      pending.current.clear();
      setCrashed({ message, at: Date.now() });
      setWorkerVersion((version) => version + 1);
    };
    worker.onmessage = (event: MessageEvent<EngineWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'analyzed') {
        setAnalysis({ ok: true, key: message.key, data: message.data });
        return;
      }
      if (message.type === 'analyzeFailed') {
        setAnalysis({ ok: false, key: message.key, message: message.message });
        return;
      }
      const { outcome } = message;
      const entry = pending.current.get(outcome.requestId);
      if (!entry) return;
      pending.current.delete(outcome.requestId);
      // dropped: a later request already superseded this one, or the
      // session (an opened/closed model) it was sent for is gone
      if (
        entry.sessionId !== sessionId.current ||
        outcome.requestId !== latestRequestId.current
      )
        return;
      entry.resolve(outcome);
    };
    worker.onerror = (event: ErrorEvent) => {
      crash(event.message || 'the engine worker crashed');
      event.preventDefault();
    };
    worker.onmessageerror = () => {
      crash('the engine worker sent a message the main thread could not read');
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [workerVersion]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return undefined;
    sessionId.current += 1;
    const { port1, port2 } = new MessageChannel();
    const disconnect = connectDispatcher<string, string, MessageEvent>(
      port1,
      dispatcher,
    );
    worker.postMessage({ type: 'connect' } satisfies EngineWorkerRequest, [
      port2,
    ]);
    return () => disconnect();
  }, [dispatcher, workerVersion]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const message: EngineWorkerCommand = { type: 'configure', engine, pistar };
    worker.postMessage(message);
  }, [engine, pistar, workerVersion]);

  const transform = useCallback(
    (
      options: Omit<TransformRequestOptions, 'requestId'>,
    ): Promise<TransformOutcome> => {
      const worker = workerRef.current;
      if (!worker)
        return Promise.resolve({
          requestId: -1,
          modelSignature: null,
          ok: false,
          error: 'the engine worker is not available in this environment',
        });
      const requestId = (nextRequestId.current += 1);
      latestRequestId.current = requestId;
      return new Promise((resolve) => {
        pending.current.set(requestId, {
          sessionId: sessionId.current,
          resolve,
        });
        const message: EngineWorkerCommand = {
          type: 'transform',
          options: { ...options, requestId },
        };
        worker.postMessage(message);
      });
    },
    [],
  );

  return { analysis, transform, crashed };
};
