/// <reference lib="webworker" />
/**
 * The engine worker (goal-controller#413): a read-only mirror of the
 * workbench's model, following the session's dispatcher over a
 * `MessagePort` (`connectDispatcher`/`createMirrorStore`, @istar-ts/actions).
 * Analysis reruns on its own, debounced the way `debouncedText` was on the
 * main thread; a transform runs once per `transform` request. Both read the
 * mirror's model, serialized to piStar JSON once per run: `analyze` and
 * `transform` only take text, not a model object.
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
import { analysisKey } from './signature';
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

const runAnalysis = (): void => {
  if (!mirror || pistar) return;
  const text = toPistar(mirror.getModel());
  const key = analysisKey(text, engine);
  try {
    post({ type: 'analyzed', key, data: analyze(text, engine) });
  } catch (error) {
    post({
      type: 'analyzeFailed',
      key,
      message: error instanceof Error ? error.message : String(error),
    });
  }
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

const runTransform = (
  requestId: number,
  options: TransformRequestOptions,
): void => {
  let outcome: TransformOutcome;
  try {
    if (!mirror) throw new Error('the engine worker has no mirror to read yet');
    const modelJson = toPistar(mirror.getModel());
    const result = transform({ ...options, modelJson });
    outcome = { ok: true, files: result.files, report: result.report };
  } catch (error) {
    outcome = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  post({ type: 'transformed', requestId, outcome });
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
  runTransform(message.requestId, message.options);
};
