/**
 * `engineWorker.ts`'s own logic (goal-controller#437), not the client's
 * contract with it (that's `engineWorker.test.tsx`, which stubs out the
 * whole module behind a `FakeWorker`). This imports the real module, as its
 * own worker scope would (`self`/`postMessage`), and drives it by calling
 * `onmessage` directly; its nested analysis worker is the only thing
 * stubbed, so `analyze()` never actually runs here.
 *
 * The point of the fix: `analyze()` is slow enough to risk missing a
 * `ping`'s `pong` deadline (`WorkbenchContext.tsx`'s
 * `ANALYSIS_UNRESPONSIVE_MS`), so it must not run on this thread. A `ping`
 * sent while an analysis is still outstanding must get an instant `pong`,
 * never queued behind it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDispatcher } from '@istar-ts/actions';
import { emptyModel } from '@/lib/workbench/dialects';
import { createModelSession } from '@/lib/workbench/modelSession';
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from '@/lib/workbench/analysisWorker';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
} from '@/lib/workbench/engineWorkerProtocol';

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

/** A fresh module instance, connected to a real dispatcher, as `connect` expects. */
const connectRaw = async (): Promise<{
  send: (message: EngineWorkerRequest) => void;
}> => {
  vi.resetModules();
  await import('@/lib/workbench/engineWorker');
  const scope = self as unknown as Scope;
  const session = createModelSession(emptyModel(), () => {});
  const { port1, port2 } = new MessageChannel();
  connectDispatcher(port1, session.dispatcher);
  const send = (message: EngineWorkerRequest): void => {
    scope.onmessage?.({
      data: message,
      ports: message.type === 'connect' ? [port2] : [],
    } as unknown as MessageEvent<EngineWorkerRequest>);
  };
  send({ type: 'connect' });
  return { send };
};

const connected = async (): Promise<{
  send: (message: EngineWorkerRequest) => void;
}> => {
  const client = await connectRaw();
  // the mirror's handshake and the 400ms analysis debounce, both real time
  await vi.waitFor(() => expect(analysisWorkers).toHaveLength(1), {
    timeout: 2000,
    interval: 20,
  });
  return client;
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
