/// <reference lib="webworker" />
/**
 * The engine worker (goal-controller#413): a read-only mirror of the
 * workbench's model, following the session's dispatcher over a
 * `MessagePort` (`connectDispatcher`/`createMirrorStore`, @istar-ts/actions).
 * Analysis reruns on its own, debounced the way `debouncedText` was on the
 * main thread; a transform runs once per `transform` request. Both read the
 * mirror's model, serialized to piStar JSON once per run: `analyze` and
 * `transform` only take text, not a model object.
 *
 * `analyze()` runs in a nested `analysisWorker.ts`, not on this thread
 * (goal-controller#437): this thread's `ping` handler is a plain, instant
 * `postMessage`, so it is never delayed by how long the analysis underneath
 * takes. Before this, `runAnalysis` ran `analyze()` synchronously here, so a
 * `ping` arriving mid-analysis queued behind it; an analysis slower than
 * `ANALYSIS_UNRESPONSIVE_MS` (goal-controller#432's backstop) missed its
 * `pong` deadline and was killed and respawned as if it had hung.
 *
 * Where nested dedicated workers aren't available (`typeof Worker ===
 * 'undefined'`, as `engineWorkerClient.ts` and `goalLsp.ts` also check),
 * `analyze()` falls back to running inline on this thread, the pre-#437
 * behaviour, rather than throwing and crash-looping this worker.
 *
 * A request that supersedes one still in flight terminates and respawns the
 * nested worker instead of queuing behind it: the worker runs one message
 * at a time, so without this, fast typing during a long analysis builds a
 * backlog that finishes stale request after stale request before ever
 * reaching the freshest one.
 */
import {
  createMirrorStore,
  createRemoteDispatcher,
  type MirrorStore,
} from '@istar-ts/actions';
import { toPistar } from '@istar-ts/core';
import { analyze } from '@/services/analyze';
import { transform } from '@/services/transform';
import type { TransformEngine } from '@/lib/types';
import { analysisKey, modelSignature } from './signature';
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from './analysisWorker';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
  TransformOutcome,
  TransformRequestOptions,
} from './engineWorkerProtocol';

const ANALYSIS_DEBOUNCE_MS = 400;

const scope = self as unknown as DedicatedWorkerGlobalScope;

const post = (message: EngineWorkerResponse): void =>
  scope.postMessage(message);

let mirror: MirrorStore<string, string> | null = null;
let engine: TransformEngine = 'edgev2';
let pistar = false;
let analysisTimer: ReturnType<typeof setTimeout> | null = null;

let analysisWorker: Worker | null = null;
let nextAnalysisRequestId = 0;
// the request this thread is still waiting an answer for; a response for
// any other id is stale (a model or engine change moved on without it) and
// is dropped
let pendingAnalysis: {
  readonly requestId: number;
  readonly key: string;
} | null = null;

const spawnAnalysisWorker = (): Worker => {
  const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
    const message = event.data;
    if (!pendingAnalysis || message.requestId !== pendingAnalysis.requestId)
      return;
    const { key } = pendingAnalysis;
    pendingAnalysis = null;
    if (message.ok) post({ type: 'analyzed', key, data: message.data });
    else post({ type: 'analyzeFailed', key, message: message.message });
  };
  // a crash in the analysis worker itself (not an engine throw, which
  // `analysisWorker.ts` already catches and reports as `ok: false`): fail
  // the analysis this thread is waiting for, and spawn a fresh one for the
  // next request
  worker.onerror = (event: ErrorEvent) => {
    if (analysisWorker !== worker) return;
    analysisWorker = null;
    worker.terminate();
    if (!pendingAnalysis) return;
    const { key } = pendingAnalysis;
    pendingAnalysis = null;
    post({
      type: 'analyzeFailed',
      key,
      message: event.message || 'the analysis worker crashed',
    });
  };
  return worker;
};

const runAnalysis = (): void => {
  if (!mirror || pistar) return;
  const text = toPistar(mirror.getModel());
  const key = analysisKey(text, engine);
  if (typeof Worker === 'undefined') {
    pendingAnalysis = null;
    try {
      post({ type: 'analyzed', key, data: analyze(text, engine) });
    } catch (error) {
      post({
        type: 'analyzeFailed',
        key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }
  // a newer request supersedes one still in flight: the nested worker runs
  // one message at a time, so reusing it would queue this request behind
  // the stale one instead of starting it now
  if (pendingAnalysis && analysisWorker) {
    analysisWorker.terminate();
    analysisWorker = null;
  }
  const requestId = (nextAnalysisRequestId += 1);
  pendingAnalysis = { requestId, key };
  analysisWorker ??= spawnAnalysisWorker();
  analysisWorker.postMessage({
    requestId,
    text,
    engine,
  } satisfies AnalysisWorkerRequest);
};

const scheduleAnalysis = (): void => {
  if (analysisTimer !== null) clearTimeout(analysisTimer);
  analysisTimer = setTimeout(runAnalysis, ANALYSIS_DEBOUNCE_MS);
};

const connect = (port: MessagePort): void => {
  mirror?.dispose();
  if (analysisTimer !== null) clearTimeout(analysisTimer);
  const remote = createRemoteDispatcher<string, string, MessageEvent>(port);
  const next = createMirrorStore<string, string>(remote);
  mirror = next;
  next.subscribe(scheduleAnalysis);
  void next.ready.then(scheduleAnalysis);
};

const runTransform = (options: TransformRequestOptions): void => {
  const { requestId, ...rest } = options;
  let modelJson: string | null = null;
  let outcome: TransformOutcome;
  try {
    if (!mirror) throw new Error('the engine worker has no mirror to read yet');
    modelJson = toPistar(mirror.getModel());
    const result = transform({ ...rest, modelJson });
    outcome = {
      requestId,
      modelSignature: modelSignature(modelJson),
      ok: true,
      files: result.files,
      report: result.report,
    };
  } catch (error) {
    outcome = {
      requestId,
      modelSignature: modelJson === null ? null : modelSignature(modelJson),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  post({ type: 'transformed', outcome });
};

scope.onmessage = (event: MessageEvent<EngineWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'connect') {
    const port = event.ports[0];
    if (port) connect(port);
    return;
  }
  if (message.type === 'configure') {
    engine = message.engine;
    pistar = message.pistar;
    scheduleAnalysis();
    return;
  }
  if (message.type === 'ping') {
    post({ type: 'pong', id: message.id });
    return;
  }
  runTransform(message.options);
};
