/**
 * The model worker in the tests (goal-controller#434): jsdom has no
 * `Worker`, so the worker's host runs in-process (modelWorkerLocal.ts), but
 * still over a `MessagePort` per session: an edit reaches the store, and its
 * change the mirror, a message later, as in the browser.
 */
import { act } from '@testing-library/react';
import type { ModelSession } from '@/lib/workbench/modelSession';

/**
 * Waits until the worker has handled every message sent to `session` so far
 * and the mirror shows what they did: a request is answered after everything
 * sent before it (a ⌘Z, a raw write, a mode), and its changes arrive before
 * its answer.
 */
export const settled = (session: ModelSession): Promise<void> =>
  act(async () => {
    await session.dispatcher.dispatch({
      kind: 'requestTypeHints',
      requestId: 'settled',
    });
  });
