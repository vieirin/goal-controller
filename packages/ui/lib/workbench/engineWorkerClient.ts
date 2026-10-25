/**
 * The main-thread side of the engine worker (goal-controller#413): one
 * worker per `WorkbenchProvider`, its mirror reconnected to the session's
 * dispatcher whenever the session changes (a new model opened). Analysis
 * results arrive as they're ready; a transform is request/response, keyed
 * by a request id so several in flight (Run, then live mode) don't cross.
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

export type EngineWorkerClient = {
  /** the worker's latest analysis, by key (`analysisKey`); none until the first */
  readonly analysis: EngineAnalysis | null;
  /** runs a transform in the worker, against its mirror's current model */
  readonly transform: (
    options: TransformRequestOptions,
  ) => Promise<TransformOutcome>;
};

/** `connect` is sent with its port instead, by the reconnect effect below. */
type EngineWorkerCommand = Exclude<EngineWorkerRequest, { type: 'connect' }>;

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
    new Map<number, (outcome: TransformOutcome) => void>(),
  );
  const nextRequestId = useRef(0);
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') return undefined;
    const worker = new Worker(new URL('./engineWorker.ts', import.meta.url), {
      type: 'module',
    });
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
      const resolve = pending.current.get(message.requestId);
      pending.current.delete(message.requestId);
      resolve?.(message.outcome);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return undefined;
    const { port1, port2 } = new MessageChannel();
    const disconnect = connectDispatcher<string, string, MessageEvent>(
      port1,
      dispatcher,
    );
    worker.postMessage({ type: 'connect' } satisfies EngineWorkerRequest, [
      port2,
    ]);
    return () => disconnect();
  }, [dispatcher]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const message: EngineWorkerCommand = { type: 'configure', engine, pistar };
    worker.postMessage(message);
  }, [engine, pistar]);

  const transform = useCallback(
    (options: TransformRequestOptions): Promise<TransformOutcome> => {
      const worker = workerRef.current;
      if (!worker)
        return Promise.resolve({
          ok: false,
          error: 'the engine worker is not available in this environment',
        });
      const requestId = (nextRequestId.current += 1);
      return new Promise((resolve) => {
        pending.current.set(requestId, resolve);
        const message: EngineWorkerCommand = {
          type: 'transform',
          requestId,
          options,
        };
        worker.postMessage(message);
      });
    },
    [],
  );

  return { analysis, transform };
};
