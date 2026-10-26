/**
 * `engineWorker.ts`'s own logic (goal-controller#437, #467), not the
 * client's contract with it (that's `engineWorker.test.tsx`, which stubs out
 * the whole module behind a `FakeWorker`). This imports the real module, as
 * its own worker scope would (`self`/`postMessage`), and drives it by
 * calling `onmessage` directly; its nested analysis worker is the only thing
 * stubbed in most cases (so `analyze()` never actually runs), except where a
 * test needs a real analysis result (goal-controller#467's own cases: no
 * `Worker` at all, as the existing "runs analysis inline" case already does).
 *
 * The #437 point: `analyze()` is slow enough to risk missing a `ping`'s
 * `pong` deadline (`WorkbenchContext.tsx`'s `ANALYSIS_UNRESPONSIVE_MS`), so
 * it must not run on this thread. A `ping` sent while an analysis is still
 * outstanding must get an instant `pong`, never queued behind it.
 *
 * The #467 point: the mirror reads the remote with the connecting model's
 * own root metamodel (`rootMetamodelOf`, `dialects.ts`), not always iStar
 * 2.0 — a KAOS or NFR model (or a conversion between frameworks within one
 * connection) must parse and analyse for real, not as an empty model.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDispatcher, createActionDispatcher } from '@istar-ts/actions';
import { createModelStore } from '@istar-ts/core';
import type { AnyModel } from '@goal-controller/lib';
import {
  emptyModel,
  parseModel,
  rootMetamodelOf,
} from '@/lib/workbench/dialects';
import type { TransformEngine } from '@/lib/types';
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from '@/lib/workbench/analysisWorker';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
} from '@/lib/workbench/engineWorkerProtocol';
import type { AnalyzeResponse } from '@/lib/workbench/types';

const read = (path: string): string =>
  readFileSync(join(__dirname, '../../../../examples', path), 'utf8');

type Scope = {
  onmessage: ((event: MessageEvent<EngineWorkerRequest>) => void) | null;
};

const ANALYZED: AnalysisWorkerResponse & { ok: true } = {
  requestId: -1,
  ok: true,
  data: {
    success: true,
    variables: [],
    problems: [],
    knownProperties: { goal: [], task: [], resource: [], quality: [] },
  },
};

class FakeAnalysisWorker {
  onmessage: ((event: MessageEvent<AnalysisWorkerResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: AnalysisWorkerRequest[] = [];
  terminate = vi.fn();
  postMessage(data: AnalysisWorkerRequest): void {
    this.posted.push(data);
  }
  respond(message: AnalysisWorkerResponse): void {
    this.onmessage?.({
      data: message,
    } as MessageEvent<AnalysisWorkerResponse>);
  }
}

let analysisWorkers: FakeAnalysisWorker[] = [];
let posted: EngineWorkerResponse[] = [];

beforeEach(() => {
  analysisWorkers = [];
  posted = [];
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        const worker = new FakeAnalysisWorker();
        analysisWorkers.push(worker);
        return worker;
      }
    },
  );
  vi.spyOn(self, 'postMessage').mockImplementation(((
    message: EngineWorkerResponse,
  ) => {
    posted.push(message);
  }) as typeof self.postMessage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

/**
 * A dispatcher over `model`, as the model worker's own (`modelWorkerHost.ts`)
 * would serve the engine worker's mirror: `sendModel` so a change arrives
 * with its `newRoot` already, no `requestModel` round trip needed.
 */
const remoteFor = (model: AnyModel) =>
  createActionDispatcher(createModelStore(model), { sendModel: true });

/**
 * A fresh module instance, connected to a real dispatcher over `model`
 * (default: empty, iStar 2.0), as `connect` expects: the metamodel it is
 * given is `rootMetamodelOf(model)`'s name, the same choice the main thread
 * makes (goal-controller#467).
 */
const connectRaw = async (
  model: AnyModel = emptyModel(),
): Promise<{
  send: (message: EngineWorkerRequest) => void;
}> => {
  vi.resetModules();
  await import('@/lib/workbench/engineWorker');
  const scope = self as unknown as Scope;
  const { port1, port2 } = new MessageChannel();
  connectDispatcher(port1, remoteFor(model));
  const send = (message: EngineWorkerRequest): void => {
    scope.onmessage?.({
      data: message,
      ports: message.type === 'connect' ? [port2] : [],
    } as unknown as MessageEvent<EngineWorkerRequest>);
  };
  send({ type: 'connect', metamodelName: rootMetamodelOf(model).name });
  return { send };
};

const connected = async (
  model?: AnyModel,
): Promise<{
  send: (message: EngineWorkerRequest) => void;
}> => {
  const client = await connectRaw(model);
  // the mirror's handshake and the 400ms analysis debounce, both real time
  await vi.waitFor(() => expect(analysisWorkers).toHaveLength(1), {
    timeout: 2000,
    interval: 20,
  });
  return client;
};

const isAnalyzed = (
  message: EngineWorkerResponse,
): message is Extract<EngineWorkerResponse, { type: 'analyzed' }> =>
  message.type === 'analyzed';

/** Waits for the `count`-th real analysis (no nested worker) and returns its data. */
const nthAnalysis = async (count: number): Promise<AnalyzeResponse> => {
  await vi.waitFor(
    () =>
      expect(posted.filter(isAnalyzed).length).toBeGreaterThanOrEqual(count),
    { timeout: 2000, interval: 20 },
  );
  return posted.filter(isAnalyzed)[count - 1]!.data;
};

/** Runs analysis for real (no nested worker at all, goal-controller#437's inline path). */
const connectAndAnalyse = async (
  model: AnyModel,
  engine: TransformEngine,
): Promise<AnalyzeResponse> => {
  vi.stubGlobal('Worker', undefined);
  const { send } = await connectRaw(model);
  send({ type: 'configure', engine, pistar: false });
  return nthAnalysis(1);
};

describe("engineWorker.ts's own logic (#437)", () => {
  it('a ping is answered immediately even while an analysis is still outstanding', async () => {
    const { send } = await connected();
    expect(analysisWorkers[0]!.posted).toHaveLength(1);
    // the nested worker hasn't answered yet: analyze() would still be
    // "running" here if it ran on this thread
    expect(posted).toEqual([]);

    send({ type: 'ping', id: 1 });
    expect(posted).toEqual([{ type: 'pong', id: 1 }]);

    analysisWorkers[0]!.respond({
      ...ANALYZED,
      requestId: analysisWorkers[0]!.posted[0]!.requestId,
    });
    await vi.waitFor(() =>
      expect(posted.some((message) => message.type === 'analyzed')).toBe(true),
    );
  });

  it('a superseded analysis terminates the in-flight nested worker and respawns a fresh one, rather than queuing behind it', async () => {
    const { send } = await connected();
    const first = analysisWorkers[0]!.posted[0]!;

    // a second edit before the first analysis answers: the nested worker
    // is still mid-`analyze()`, so queuing a second message behind it
    // would run the stale request to completion before the fresh one
    // even starts
    send({ type: 'configure', engine: 'edgev2', pistar: false });
    await vi.waitFor(() => expect(analysisWorkers).toHaveLength(2));
    expect(analysisWorkers[0]!.terminate).toHaveBeenCalledTimes(1);
    const second = analysisWorkers[1]!.posted[0]!;
    expect(second.requestId).not.toBe(first.requestId);

    // the first (terminated) worker's response is still dropped by id,
    // belt-and-suspenders with the real `terminate()` discarding it
    analysisWorkers[0]!.respond({ ...ANALYZED, requestId: first.requestId });
    expect(posted).toEqual([]);

    analysisWorkers[1]!.respond({ ...ANALYZED, requestId: second.requestId });
    await vi.waitFor(() =>
      expect(
        posted.filter((message) => message.type === 'analyzed'),
      ).toHaveLength(1),
    );
  });

  it('three requests while the first is still running terminate the nested worker twice, applying only the last result', async () => {
    const { send } = await connected();
    const first = analysisWorkers[0]!.posted[0]!;

    send({ type: 'configure', engine: 'edgev2', pistar: false });
    await vi.waitFor(() => expect(analysisWorkers).toHaveLength(2));
    send({ type: 'configure', engine: 'goda', pistar: false });
    await vi.waitFor(() => expect(analysisWorkers).toHaveLength(3));

    expect(analysisWorkers[0]!.terminate).toHaveBeenCalledTimes(1);
    expect(analysisWorkers[1]!.terminate).toHaveBeenCalledTimes(1);
    expect(analysisWorkers[2]!.terminate).not.toHaveBeenCalled();

    const third = analysisWorkers[2]!.posted[0]!;
    // responses from the two terminated workers arrive late but are
    // dropped: only the third (current) request's result is applied
    analysisWorkers[0]!.respond({ ...ANALYZED, requestId: first.requestId });
    analysisWorkers[2]!.respond({ ...ANALYZED, requestId: third.requestId });
    await vi.waitFor(() =>
      expect(
        posted.filter((message) => message.type === 'analyzed'),
      ).toHaveLength(1),
    );
    expect(
      posted.filter((message) => message.type === 'analyzed'),
    ).toHaveLength(1);
  });

  it('a crash in the nested analysis worker fails the pending analysis and terminates it', async () => {
    const { send } = await connected();
    send({ type: 'ping', id: 1 });
    expect(posted).toContainEqual({ type: 'pong', id: 1 });

    analysisWorkers[0]!.onerror?.({
      message: 'boom',
    } as ErrorEvent);

    expect(analysisWorkers[0]!.terminate).toHaveBeenCalledTimes(1);
    expect(
      posted.filter((message) => message.type === 'analyzeFailed'),
    ).toHaveLength(1);
  });

  it('runs analysis inline, with no nested worker, when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    await connectRaw();

    await vi.waitFor(
      () =>
        expect(posted.some((message) => message.type === 'analyzed')).toBe(
          true,
        ),
      { timeout: 2000, interval: 20 },
    );
    expect(analysisWorkers).toHaveLength(0);
    expect(
      posted.filter((message) => message.type === 'analyzed'),
    ).toHaveLength(1);
  });
});

describe('the mirror reads the model with its own root metamodel (goal-controller#467)', () => {
  // kaosprop/nfrprop report no per-model variables or problems by design
  // (unlike a PRISM engine's, `services/analyze.ts`): a clean parse (no
  // "unknown element type" problem, the bug's own repro) is what shows the
  // real model got through, not the mirror's empty placeholder (which the
  // old, metamodel-less mirror could never even reach: its `ready` rejected
  // instead, so nothing would have been posted at all within the timeout).
  it('a KAOS model analyses cleanly, not as an empty one', async () => {
    const model = parseModel(read('kaos/kaos-welcome.txt'));
    const data = await connectAndAnalyse(model, 'kaosprop');
    expect(data.success).toBe(true);
    expect(data.problems).toEqual([]);
  });

  it('an NFR model analyses cleanly, not as an empty one', async () => {
    const model = parseModel(read('nfr/nfr-welcome.txt'));
    const data = await connectAndAnalyse(model, 'nfrprop');
    expect(data.success).toBe(true);
    expect(data.problems).toEqual([]);
  });

  it('an iStar 2.0 model is unchanged: its real, non-empty variables still come through', async () => {
    const model = parseModel(read('edge/simpleChoice.txt'));
    const data = await connectAndAnalyse(model, 'edgev2');
    expect(data.success).toBe(true);
    expect(data.variables.length).toBeGreaterThan(0);
  });

  it('switching an open project from NFR to KAOS rebuilds the mirror and updates the analysis', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.resetModules();
    await import('@/lib/workbench/engineWorker');
    const scope = self as unknown as Scope;
    const send = (
      message: EngineWorkerRequest,
      ports: MessagePort[] = [],
    ): void => {
      scope.onmessage?.({
        data: message,
        ports,
      } as unknown as MessageEvent<EngineWorkerRequest>);
    };

    const nfr = parseModel(read('nfr/nfr-welcome.txt'));
    const nfrPorts = new MessageChannel();
    connectDispatcher(nfrPorts.port1, remoteFor(nfr));
    send({ type: 'connect', metamodelName: rootMetamodelOf(nfr).name }, [
      nfrPorts.port2,
    ]);
    send({ type: 'configure', engine: 'nfrprop', pistar: false });
    const first = await nthAnalysis(1);
    expect(first.success).toBe(true);
    expect(first.problems).toEqual([]);

    const kaos = parseModel(read('kaos/kaos-welcome.txt'));
    const kaosPorts = new MessageChannel();
    connectDispatcher(kaosPorts.port1, remoteFor(kaos));
    send({ type: 'connect', metamodelName: rootMetamodelOf(kaos).name }, [
      kaosPorts.port2,
    ]);
    send({ type: 'configure', engine: 'kaosprop', pistar: false });
    const second = await nthAnalysis(2);
    expect(second.success).toBe(true);
    expect(second.problems).toEqual([]);
  });
});
