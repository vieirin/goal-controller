/**
 * The main-thread side of the engine worker (goal-controller#413): one
 * worker per `WorkbenchProvider`, its mirror reconnected to the session's
 * dispatcher whenever the session changes (a new model opened). The
 * dispatcher is the model worker's (goal-controller#434): the engine
 * worker's port is served there directly (`ModelSession.serve`), so the
 * model's changes never pass through the main thread on their way. Analysis
 * outcomes are handed to `onAnalysis` as they arrive; a transform is
 * request/response, keyed by a request id. Every transform settles exactly
 * once (`settle`, goal-controller#432 review): with the worker's outcome, a
 * failure if the worker crashes, or `cancelled` when a newer request
 * supersedes it, the session it was sent for goes away, or the provider
 * unmounts. A crash (`onerror`/`onmessageerror`, or no `pong` to a `probe`)
 * is reported to `onAnalysis` too, and respawns the worker.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TransformEngine } from '@/lib/types';
import type { AnalyzeResponse } from './types';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
  TransformOutcome,
  TransformRequestOptions,
} from './engineWorkerProtocol';

/** what the worker says about analysis: a result or a failure for a key, or that it died */
export type EngineAnalysisOutcome =
  | {
      readonly kind: 'analyzed';
      readonly key: string;
      readonly data: AnalyzeResponse;
    }
  | { readonly kind: 'failed'; readonly key: string; readonly message: string }
  | { readonly kind: 'crashed'; readonly message: string };

/** why a transform was settled without the worker's answer */
export type TransformCancelReason = 'superseded' | 'session' | 'unmounted';

export type EngineTransformResult =
  | { readonly status: 'done'; readonly outcome: TransformOutcome }
  | { readonly status: 'cancelled'; readonly reason: TransformCancelReason };

export type EngineWorkerClient = {
  /** runs a transform in the worker, against its mirror's current model */
  readonly transform: (
    options: Omit<TransformRequestOptions, 'requestId'>,
  ) => Promise<EngineTransformResult>;
  /**
   * asks the worker for a `pong`; none within `timeoutMs` and the worker is
   * treated as crashed (it's single-threaded: busy that long is hung). One
   * probe at a time: a call while one is out is a no-op.
   */
  readonly probe: (timeoutMs: number) => void;
  /** transforms sent and not settled yet (what the tests check is never leaked) */
  readonly pendingTransforms: () => number;
};

/** `connect` is sent with its port instead, by the reconnect effect below. */
type EngineWorkerCommand = Exclude<EngineWorkerRequest, { type: 'connect' }>;

type PendingTransform = {
  readonly resolve: (result: EngineTransformResult) => void;
};

const spawnWorker = (): Worker =>
  new Worker(new URL('./engineWorker.ts', import.meta.url), {
    type: 'module',
  });

const failed = (requestId: number, error: string): EngineTransformResult => ({
  status: 'done',
  outcome: { requestId, modelSignature: null, ok: false, error },
});

/**
 * Links a port to the model's dispatcher until the returned function is
 * called: the engine worker's mirror follows the dispatcher over it.
 * `ModelSession.serve`, or `connectDispatcher` over a dispatcher at hand.
 */
export type ConnectModel = (port: MessagePort) => () => void;

/**
 * Connects the model (`connect`) to a dedicated engine worker: analysis reruns there
 * on every `sourceModelChanged`, debounced; `transform` runs there once per
 * call. No worker where the page is prerendered (`typeof Worker ===
 * 'undefined'`): `onAnalysis` is never called and every `transform` fails.
 */
export const useEngineWorker = (
  connect: ConnectModel,
  engine: TransformEngine,
  pistar: boolean,
  onAnalysis: (outcome: EngineAnalysisOutcome) => void,
  /** the open model's root metamodel (`rootMetamodelOf(model).name`, goal-controller#467) */
  metamodelName: string,
): EngineWorkerClient => {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, PendingTransform>());
  const nextRequestId = useRef(0);
  const probing = useRef<{
    readonly id: number;
    readonly timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const nextProbeId = useRef(0);
  // the current worker's crash path, for a probe that times out
  const crashRef = useRef<((message: string) => void) | null>(null);
  // the latest callback, so the worker's handlers never need re-binding
  const onAnalysisRef = useRef(onAnalysis);
  useEffect(() => {
    onAnalysisRef.current = onAnalysis;
  });
  // bumped to respawn the worker (its creation effect below keys on it)
  const [workerVersion, setWorkerVersion] = useState(0);

  // the one place a pending transform is resolved and forgotten
  const settle = useCallback(
    (requestId: number, result: EngineTransformResult): void => {
      const entry = pending.current.get(requestId);
      if (!entry) return;
      pending.current.delete(requestId);
      entry.resolve(result);
    },
    [],
  );
  const settleAll = useCallback(
    (result: (requestId: number) => EngineTransformResult): void => {
      for (const requestId of pending.current.keys())
        settle(requestId, result(requestId));
    },
    [settle],
  );
  const stopProbing = useCallback((): void => {
    if (probing.current) clearTimeout(probing.current.timer);
    probing.current = null;
  }, []);

  useEffect(() => {
    if (typeof Worker === 'undefined') return undefined;
    const worker = spawnWorker();
    const crash = (message: string): void => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      stopProbing();
      worker.terminate();
      settleAll((requestId) => failed(requestId, message));
      onAnalysisRef.current({ kind: 'crashed', message });
      setWorkerVersion((version) => version + 1);
    };
    crashRef.current = crash;
    worker.onmessage = (event: MessageEvent<EngineWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'analyzed') {
        onAnalysisRef.current({
          kind: 'analyzed',
          key: message.key,
          data: message.data,
        });
        return;
      }
      if (message.type === 'analyzeFailed') {
        onAnalysisRef.current({
          kind: 'failed',
          key: message.key,
          message: message.message,
        });
        return;
      }
      if (message.type === 'pong') {
        if (probing.current?.id === message.id) stopProbing();
        return;
      }
      // none pending: it was already cancelled (superseded, or its session gone)
      settle(message.outcome.requestId, {
        status: 'done',
        outcome: message.outcome,
      });
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
      if (workerRef.current === worker) {
        workerRef.current = null;
        stopProbing();
        settleAll(() => ({ status: 'cancelled', reason: 'unmounted' }));
      }
    };
  }, [workerVersion, settle, settleAll, stopProbing]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return undefined;
    const { port1, port2 } = new MessageChannel();
    const disconnect = connect(port1);
    worker.postMessage(
      { type: 'connect', metamodelName } satisfies EngineWorkerRequest,
      [port2],
    );
    return () => {
      disconnect();
      // the model they were asked for is gone: their answers would label
      // a run of the next one
      settleAll(() => ({ status: 'cancelled', reason: 'session' }));
    };
    // a new metamodelName (the root metamodel changed, goal-controller#467)
    // reconnects with a fresh mirror built for it, the same as a session
    // change: the worker can't be handed a live `Metamodel`, so this is the
    // only way it learns of the change
  }, [connect, metamodelName, workerVersion, settleAll]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const message: EngineWorkerCommand = { type: 'configure', engine, pistar };
    worker.postMessage(message);
  }, [engine, pistar, workerVersion]);

  const transform = useCallback(
    (
      options: Omit<TransformRequestOptions, 'requestId'>,
    ): Promise<EngineTransformResult> => {
      const worker = workerRef.current;
      if (!worker)
        return Promise.resolve(
          failed(-1, 'the engine worker is not available in this environment'),
        );
      // only the latest request's answer is wanted (the worker answers in order)
      settleAll(() => ({ status: 'cancelled', reason: 'superseded' }));
      const requestId = (nextRequestId.current += 1);
      return new Promise((resolve) => {
        pending.current.set(requestId, { resolve });
        const message: EngineWorkerCommand = {
          type: 'transform',
          options: { ...options, requestId },
        };
        worker.postMessage(message);
      });
    },
    [settleAll],
  );

  const probe = useCallback((timeoutMs: number): void => {
    const worker = workerRef.current;
    if (!worker || probing.current) return;
    const id = (nextProbeId.current += 1);
    probing.current = {
      id,
      timer: setTimeout(
        () =>
          crashRef.current?.(
            `The engine worker stopped responding (no reply in ${timeoutMs / 1000}s); it was restarted.`,
          ),
        timeoutMs,
      ),
    };
    const message: EngineWorkerCommand = { type: 'ping', id };
    worker.postMessage(message);
  }, []);

  const pendingTransforms = useCallback(() => pending.current.size, []);

  return { transform, probe, pendingTransforms };
};
