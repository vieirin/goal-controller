// @vitest-environment node
/**
 * The model worker's crash recovery (goal-controller#469), for the one
 * scenario that needs a real `connectGlspMcpSession` (jsdom's and Node's
 * `AbortSignal` don't mix, `glspHosting.test.tsx`'s docstring, so that one
 * stays jsdom with `openGlspSession` mocked): the agent's own session, over
 * its own port into the worker, reconnects once the workbench opens a fresh
 * session on a fresh worker, the way `WorkbenchContext`'s crash-recovery
 * effect does (a new `createModelSession` call on the same text and mode).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createModelSession,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { modelWorker } from '@/lib/workbench/modelWorkerClient';
import { openGlspSession } from '@/lib/workbench/agent/glspSession';

const EDGEV2 = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);

const NO_WORKSPACE = () => ({ tree: null, resources: [], variables: [] });

let sessions: ModelSession[] = [];

afterEach(() => {
  for (const session of sessions) session.dispose();
  sessions = [];
});

const opened = (text = EDGEV2): ModelSession => {
  const session = createModelSession(
    text,
    () => {
      /* no listener needed: the tests read the store directly */
    },
    () => {},
  );
  session.setMode('edgev2');
  sessions.push(session);
  return session;
};

describe('the agent session reconnects after a model-worker crash (goal-controller#469)', () => {
  it('tools/list works again once the workbench opens a fresh session on the respawned worker', async () => {
    const before = opened();
    const glspBefore = await openGlspSession(before, 'edgev2', NO_WORKSPACE);
    expect(glspBefore.liveRegistry.list().map((tool) => tool.name)).toContain(
      'create-nodes',
    );

    const crashed = new Error('the model worker died');
    const pending = before
      .dispatcherFor('canvas')
      .dispatch({ kind: 'applyLabelEdit', labelId: 'nope', text: 'x' });
    // the crash, as `modelWorker().onerror` would call it (no real `Worker`
    // here either: the in-process host wires `onerror` the same way)
    modelWorker().onerror?.({
      message: crashed.message,
      preventDefault: () => {},
    } as ErrorEvent);
    await expect(pending).rejects.toThrow(/model worker died/);
    glspBefore.close();

    // the workbench's own recovery: a fresh session, same text and mode
    const after = opened();
    const glspAfter = await openGlspSession(after, 'edgev2', NO_WORKSPACE);
    expect(glspAfter.liveRegistry.list().map((tool) => tool.name)).toContain(
      'create-nodes',
    );
    const result = await glspAfter.liveRegistry.call('set-properties', {
      elementId: '117b97d7-775b-41a9-8fec-9e923edde772',
      properties: { name: 'Renamed after recovery' },
    });
    expect(result.ok).toBe(true);
    glspAfter.close();
  });
});
