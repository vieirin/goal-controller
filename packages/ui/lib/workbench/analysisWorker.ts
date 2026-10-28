/// <reference lib="webworker" />
/**
 * The analysis worker (goal-controller#437): `analyze()` is the only thing
 * slow enough to risk missing a `ping`'s `pong` within
 * `engineWorker.ts`'s `ANALYSIS_UNRESPONSIVE_MS` deadline, so it runs here
 * rather than on the engine worker's own thread. `engineWorker.ts` spawns
 * one of these and forwards it a request per analysis; its own thread is
 * freed as soon as `postMessage` returns, so a `ping` arriving while an
 * analysis is still running gets its `pong` immediately, however long the
 * analysis underneath takes.
 */
import { analyze } from '@/services/analyze';
import type { TransformEngine } from '@/lib/types';
import type { AnalyzeResponse } from './types';

/** Engine worker → analysis worker. */
export type AnalysisWorkerRequest = {
  readonly requestId: number;
  readonly text: string;
  readonly engine: TransformEngine;
};

/** Analysis worker → engine worker. A newer request makes an older one stale; `engineWorker.ts` drops it by id. */
export type AnalysisWorkerResponse = { readonly requestId: number } & (
  | { readonly ok: true; readonly data: AnalyzeResponse }
  | { readonly ok: false; readonly message: string }
);

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const { requestId, text, engine } = event.data;
  try {
    const data = analyze(text, engine);
    scope.postMessage({
      requestId,
      ok: true,
      data,
    } satisfies AnalysisWorkerResponse);
  } catch (error) {
    scope.postMessage({
      requestId,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    } satisfies AnalysisWorkerResponse);
  }
};
