/**
 * The engine worker (goal-controller#413): a dispatched edit updates
 * `wb.analysis`/`wb.problems` only after the worker's own message comes
 * back, not synchronously within the dispatch's tick. jsdom has no real
 * `Worker`, so this fakes one and drives its `onmessage` by hand, the way
 * the real worker's response would arrive over `postMessage`.
 */
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useEffect } from 'react';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_SLOW_MS,
  ANALYSIS_UNRESPONSIVE_MS,
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import {
  useEngineWorker,
  type EngineTransformResult,
} from '@/lib/workbench/engineWorkerClient';
import type {
  EngineWorkerRequest,
  EngineWorkerResponse,
} from '@/lib/workbench/engineWorkerProtocol';
import { emptyModel, rootMetamodelOf } from '@/lib/workbench/dialects';
import { createModelSession } from '@/lib/workbench/modelSession';
import { createLocalModelWorker } from '@/lib/workbench/modelWorkerLocal';
import { publishDiagnostics } from '@/lib/workbench/diagnosticsStore';
import type { AnalyzeResponse } from '@/lib/workbench/types';
import { writeModelMode } from '@/lib/workbench/pistar';
import { analysisKey } from '@/lib/workbench/signature';

// recorded as edgev2 (not piStar mode): analysis only runs for an engine
const ISTAR = writeModelMode(
  readFileSync(
    join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
    'utf8',
  ),
  'edgev2',
);
// in simpleChoice.txt: G1, OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const ISTAR_METAMODEL_NAME = rootMetamodelOf(emptyModel()).name;

class FakeWorker {
  onmessage: ((event: MessageEvent<EngineWorkerResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  terminate = vi.fn();
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  respond(message: EngineWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<EngineWorkerResponse>);
  }
  crash(message: string): void {
    this.onerror?.({ message, preventDefault: () => {} } as ErrorEvent);
  }
  sendUnreadable(): void {
    this.onmessageerror?.({} as MessageEvent);
  }
}

let workers: FakeWorker[] = [];

beforeEach(() => {
  workers = [];
  vi.stubGlobal(
    'Worker',
    class {
      constructor(url: URL) {
        // the model worker (#434) runs for real, in-process: only the engine
        // worker is faked here
        if (url.pathname.endsWith('/modelWorker.ts'))
          return createLocalModelWorker();
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  return { wb: () => wb! };
};

const response: AnalyzeResponse = {
  success: true,
  variables: [],
  problems: [
    { severity: 'error', source: 'Edge', message: 'bad', elementId: G1 },
  ],
  knownProperties: { goal: [], task: [], resource: [], quality: [] },
};

describe('the engine worker (#413)', () => {
  it('updates analysis/problems only once the worker answers, not within the dispatch', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    expect(workers).toHaveLength(1);
    const worker = workers[0]!;
    // the mirror's port, and the current engine, went out already
    expect(
      worker.posted.some(
        (message) => (message as { type: string }).type === 'connect',
      ),
    ).toBe(true);
    const configured = worker.posted.filter(
      (message) => (message as { type: string }).type === 'configure',
    );
    expect(configured.at(-1)).toEqual({
      type: 'configure',
      engine: 'edgev2',
      pistar: false,
    });

    expect(wb().analysis).toBeNull();
    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      expect(result.ok).toBe(true);
    });
    // the edit applied, but the worker hasn't answered yet
    expect(wb().analysis).toBeNull();
    expect(
      wb().problems.some((p) => p.elementId === G1 && p.message === 'bad'),
    ).toBe(false);

    await act(async () => {
      worker.respond({ type: 'analyzed', key: 'k', data: response });
    });
    await waitFor(() => expect(wb().analysis).toEqual(response));
    await waitFor(() =>
      expect(
        wb().problems.some((p) => p.elementId === G1 && p.message === 'bad'),
      ).toBe(true),
    );
  });

  it('a serviceDiagnostics update recomputes the problems list (goal-controller#433)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));

    expect(
      wb().problems.some((p) => p.elementId === G1 && p.message === 'flagged'),
    ).toBe(false);

    // another producer (the goal language service, say) publishing directly
    // to the store, with no engine worker or dispatch involved at all
    act(() => {
      publishDiagnostics('goal language', 'probe-document', [
        {
          severity: 'warning',
          source: 'goal language',
          message: 'flagged',
          elementId: G1,
        },
      ]);
    });

    await waitFor(() =>
      expect(
        wb().problems.some(
          (p) => p.elementId === G1 && p.message === 'flagged',
        ),
      ).toBe(true),
    );

    act(() => {
      publishDiagnostics('goal language', 'probe-document', []);
    });
    await waitFor(() =>
      expect(
        wb().problems.some(
          (p) => p.elementId === G1 && p.message === 'flagged',
        ),
      ).toBe(false),
    );
  });

  const lastTransformRequestId = (worker: FakeWorker): number => {
    const sent = worker.posted
      .filter(
        (
          message,
        ): message is { type: 'transform'; options: { requestId: number } } =>
          (message as { type: string }).type === 'transform',
      )
      .at(-1);
    if (!sent) throw new Error('no transform message was posted');
    return sent.options.requestId;
  };

  it('an engine throw comes back as a failed run, not a hang (goal-controller#432 review)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    const worker = workers[0]!;
    // variables ready: the key the worker would have answered with
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(ISTAR, 'edgev2'),
        data: response,
      });
    });
    await waitFor(() => expect(wb().analyzing).toBe(false));

    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));
    const requestId = lastTransformRequestId(worker);
    await act(async () => {
      worker.respond({
        type: 'transformed',
        outcome: {
          requestId,
          modelSignature: analysisKey(ISTAR, 'edgev2'),
          ok: false,
          error: 'the engine threw',
        },
      });
    });
    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs[0]?.error).toBe('the engine threw');
    expect(wb().runs[0]?.files).toBeNull();
  });

  it('a worker crash fails every pending transform, clears analyzing/generating, and respawns (goal-controller#432 review)', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    const worker = workers[0]!;
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(ISTAR, 'edgev2'),
        data: response,
      });
    });
    await waitFor(() => expect(wb().analyzing).toBe(false));

    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));

    await act(async () => {
      worker.crash('the engine worker died');
    });

    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs[0]?.error).toBe('the engine worker died');
    await waitFor(() =>
      expect(
        wb().problems.some((p) => p.message === 'the engine worker died'),
      ).toBe(true),
    );
    expect(wb().analyzing).toBe(false);

    // a fresh worker, reconnected and reconfigured, for the next request
    await waitFor(() => expect(workers).toHaveLength(2));
    const respawned = workers[1]!;
    expect(
      respawned.posted.some(
        (message) => (message as { type: string }).type === 'connect',
      ),
    ).toBe(true);
    expect(
      respawned.posted.some(
        (message) => (message as { type: string }).type === 'configure',
      ),
    ).toBe(true);
  });

  const postedOf = <T extends EngineWorkerRequest['type']>(
    worker: FakeWorker,
    type: T,
  ): Extract<EngineWorkerRequest, { type: T }>[] =>
    worker.posted.filter(
      (message): message is Extract<EngineWorkerRequest, { type: T }> =>
        (message as { type: string }).type === type,
    );

  const transformed = (requestId: number): EngineWorkerResponse => ({
    type: 'transformed',
    outcome: {
      requestId,
      modelSignature: null,
      ok: true,
      files: [],
      report: null,
    },
  });

  // variables ready for ISTAR: the key the worker would have answered with
  const openAnalysed = async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    const worker = workers[0]!;
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(ISTAR, 'edgev2'),
        data: response,
      });
    });
    await waitFor(() => expect(wb().analyzing).toBe(false));
    return { wb, worker };
  };

  it('a session switch mid-transform clears generating and adds no run, even when the old answer lands (goal-controller#432 review)', async () => {
    const { wb, worker } = await openAnalysed();
    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));
    const requestId = lastTransformRequestId(worker);

    // another model opened: a new session, before the worker answered
    await act(() => wb().openModelFile('other.txt', ISTAR));
    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs).toEqual([]);

    // the old session's answer, late: nothing is waiting for it
    await act(async () => worker.respond(transformed(requestId)));
    expect(wb().runs).toEqual([]);
    expect(wb().generating).toBe(false);
  });

  it('a superseded transform adds no run, and generating clears once the one that replaced it answers (goal-controller#432 review)', async () => {
    const { wb, worker } = await openAnalysed();
    act(() => wb().generate());
    await waitFor(() => expect(wb().generating).toBe(true));
    const first = lastTransformRequestId(worker);
    act(() => wb().generate());
    const second = lastTransformRequestId(worker);
    expect(second).not.toBe(first);

    // the worker answers in order: the superseded one first
    await act(async () => worker.respond(transformed(first)));
    expect(wb().runs).toEqual([]);
    expect(wb().generating).toBe(true);
    await act(async () => worker.respond(transformed(second)));
    await waitFor(() => expect(wb().generating).toBe(false));
    expect(wb().runs).toHaveLength(1);
    expect(wb().runs[0]?.error).toBeNull();
  });

  describe('every transform settles once and is forgotten (goal-controller#432 review)', () => {
    const client = () => {
      const first = createModelSession(
        '',
        () => {},
        () => {},
      );
      const second = createModelSession(
        '',
        () => {},
        () => {},
      );
      const hook = renderHook(
        ({ connect }) =>
          useEngineWorker(
            connect,
            'edgev2',
            false,
            () => {},
            ISTAR_METAMODEL_NAME,
          ),
        { initialProps: { connect: first.serve } },
      );
      return {
        hook,
        worker: workers[0]!,
        switchSession: () => hook.rerender({ connect: second.serve }),
      };
    };
    const options = { engine: 'edgev2', fileName: 'model' } as const;

    it('superseded: cancelled at once, the newer one still pending', async () => {
      const { hook, worker } = client();
      const older = hook.result.current.transform(options);
      const newer = hook.result.current.transform(options);
      await expect(older).resolves.toEqual({
        status: 'cancelled',
        reason: 'superseded',
      } satisfies EngineTransformResult);
      expect(hook.result.current.pendingTransforms()).toBe(1);
      worker.respond(transformed(lastTransformRequestId(worker)));
      await expect(newer).resolves.toMatchObject({ status: 'done' });
      expect(hook.result.current.pendingTransforms()).toBe(0);
    });

    it('a session switch: cancelled, nothing pending, a late answer ignored', async () => {
      const { hook, worker, switchSession } = client();
      const sent = hook.result.current.transform(options);
      const requestId = lastTransformRequestId(worker);
      switchSession();
      await expect(sent).resolves.toEqual({
        status: 'cancelled',
        reason: 'session',
      } satisfies EngineTransformResult);
      expect(hook.result.current.pendingTransforms()).toBe(0);
      worker.respond(transformed(requestId));
      expect(hook.result.current.pendingTransforms()).toBe(0);
    });

    it('an unmount: cancelled, nothing pending', async () => {
      const { hook } = client();
      const sent = hook.result.current.transform(options);
      const { pendingTransforms } = hook.result.current;
      hook.unmount();
      await expect(sent).resolves.toEqual({
        status: 'cancelled',
        reason: 'unmounted',
      } satisfies EngineTransformResult);
      expect(pendingTransforms()).toBe(0);
    });

    it('a crash: failed, nothing pending', async () => {
      const { hook, worker } = client();
      const sent = hook.result.current.transform(options);
      act(() => worker.crash('gone'));
      await expect(sent).resolves.toMatchObject({
        status: 'done',
        outcome: { ok: false, error: 'gone' },
      });
      expect(hook.result.current.pendingTransforms()).toBe(0);
    });
  });

  // an edit after a first analysis: the key this thread now waits for is the edited model's
  const editAfterAnalysis = async () => {
    const { wb, worker } = await openAnalysed();
    // from the edit on: its slow-analysis timer is a fake one
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      expect(result.ok).toBe(true);
    });
    expect(wb().analyzing).toBe(true);
    return { wb, worker };
  };

  it('an analysis slower than the backstop: shown as slow, no false error, variables not ready until the real result (goal-controller#432 review)', async () => {
    const { wb, worker } = await editAfterAnalysis();
    act(() => vi.advanceTimersByTime(ANALYSIS_SLOW_MS + 1));
    expect(wb().analysisSlow).toBe(true);
    expect(wb().analyzing).toBe(true);
    expect(
      wb().problems.some((p) => /did not finish|responding/.test(p.message)),
    ).toBe(false);
    expect(postedOf(worker, 'ping')).toHaveLength(1);

    // a Run asked for now waits for the variables (shown as generating): nothing is sent yet
    act(() => wb().generate());
    expect(wb().generating).toBe(true);
    expect(postedOf(worker, 'transform')).toHaveLength(0);

    // the worker was busy, not dead: its result, then the pong
    const renamed = {
      ...response,
      variables: [{ name: 'renamed_var', kind: 'achievability', usedBy: [G1] }],
    } satisfies AnalyzeResponse;
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(wb().text, 'edgev2'),
        data: renamed,
      });
      worker.respond({ type: 'pong', id: postedOf(worker, 'ping')[0]!.id });
    });
    expect(wb().analyzing).toBe(false);
    expect(wb().analysisSlow).toBe(false);
    expect(wb().variables).toEqual(renamed.variables);
    // the pending Run goes out now, with the new model's variables
    const [sent] = postedOf(worker, 'transform');
    expect(sent?.options.variables).toEqual({
      renamed_var: expect.any(Number),
    });

    // the pong arrived: no restart, however long it is quiet
    act(() => vi.advanceTimersByTime(ANALYSIS_UNRESPONSIVE_MS * 2));
    expect(workers).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('a healthy analysis that takes 90s of fake time completes with its result, no false error, no respawn (goal-controller#437)', async () => {
    const { wb, worker } = await editAfterAnalysis();
    act(() => vi.advanceTimersByTime(ANALYSIS_SLOW_MS + 1));
    expect(wb().analysisSlow).toBe(true);
    // the worker's `ping` handler never blocks on the analysis underneath
    // (goal-controller#437): its `pong` arrives well before the
    // unresponsive deadline even though the result itself is still miles
    // away
    await act(async () => {
      worker.respond({ type: 'pong', id: postedOf(worker, 'ping')[0]!.id });
    });
    expect(wb().analyzing).toBe(true);

    act(() => vi.advanceTimersByTime(90_000 - ANALYSIS_SLOW_MS - 1));
    expect(workers).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(wb().analyzing).toBe(true);

    const renamed = {
      ...response,
      variables: [{ name: 'renamed_var', kind: 'achievability', usedBy: [G1] }],
    } satisfies AnalyzeResponse;
    await act(async () => {
      worker.respond({
        type: 'analyzed',
        key: analysisKey(wb().text, 'edgev2'),
        data: renamed,
      });
    });
    expect(wb().analyzing).toBe(false);
    expect(wb().analysisSlow).toBe(false);
    expect(wb().variables).toEqual(renamed.variables);
    expect(
      wb().problems.some((p) => /did not finish|responding/.test(p.message)),
    ).toBe(false);
    expect(workers).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('a hung worker (no pong) ends the analysis in an error and is respawned (goal-controller#432 review)', async () => {
    const { wb, worker } = await editAfterAnalysis();
    act(() => vi.advanceTimersByTime(ANALYSIS_SLOW_MS + 1));
    expect(wb().analysisSlow).toBe(true);
    act(() => vi.advanceTimersByTime(ANALYSIS_UNRESPONSIVE_MS - 2));
    expect(wb().analyzing).toBe(true);
    expect(workers).toHaveLength(1);

    act(() => vi.advanceTimersByTime(2));
    expect(worker.terminate).toHaveBeenCalled();
    expect(wb().analyzing).toBe(false);
    expect(wb().analysisSlow).toBe(false);
    expect(
      wb().problems.some((p) => /stopped responding/.test(p.message)),
    ).toBe(true);
    expect(workers).toHaveLength(2);
    expect(postedOf(workers[1]!, 'connect')).toHaveLength(1);
  });
});
