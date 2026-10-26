/**
 * Backend A's session over the workbench's own session (goal-controller#414,
 * #450): `openGlspMcpSession` (istar-ts#239) gives both Auto mode's live
 * tool registry and Propose mode's scratch-session change set, over the same
 * store and dispatcher the canvas edits through, so an edit through either
 * mode goes through the same guards and one appears in the canvas at once.
 *
 * It runs on the main thread, over the session's mirror and the model
 * worker's dispatcher (goal-controller#434), not in the worker: the change
 * set's `step(entry)` and `describeUndo(result)` are synchronous and keyed by
 * the very `ToolResult` object a scratch call returned, and `list()` is
 * synchronous too, so neither survives a `postMessage` without a transport of
 * its own, which @istar-ts/agent doesn't have. An edit the agent applies is
 * still a dispatch to the worker, through its guards, one undo step.
 * `getOptions` is read fresh on every Propose run, so a mode change the
 * drawer doesn't itself restart (it does: `mode` is one of this module's own
 * dependencies, WorkbenchContext.tsx) still reaches the next one.
 *
 * Goal-controller's own read-only host tools (hostTools.ts) and context
 * providers (context.ts) are served next to istar's, through
 * `GlspMcpBackendOptions.hostTools`/`context` (istar-ts#239): no more
 * client-side merge. `GlspMcpBackendOptions.postGuards` (istar-ts#239) is the
 * mode's own post-guards (`modeGuards.ts`), so a Propose batch breaking one
 * is refused on the scratch session, at preview, not only at `apply`. The
 * built-in metamodel context provider (istar-ts#240) is on by default: no
 * `metamodelContext: false` here.
 *
 * `@istar-ts/agent/glsp` is dynamically imported, so it never lands in the
 * initial bundle: a page that never turns this on pays nothing.
 */
import type {
  DispatchOptions,
  IstarAction,
  StoreActionDispatcher,
} from '@istar-ts/actions';
import { metamodelOf } from '@istar-ts/core';
import type { GlspMcpSession } from '@istar-ts/agent/glsp';
import type { ModelMode } from '@/lib/workbench/pistar';
import type { ModelSession } from '@/lib/workbench/modelSession';
import { pistarExtMetamodelGuard } from '@/lib/workbench/dialects';
import { guardsForMode } from '@/lib/workbench/modeGuards';
import { hostToolsFor, type AgentWorkspace } from './hostTools';
import { contextProvidersFor } from './context';

export type GlspSession = GlspMcpSession;

/**
 * Opens `session`'s backend-A session, in `mode`: `liveRegistry` is Auto
 * mode's tools (over the live model); `changeSet` is Propose mode's target
 * (a fresh scratch session per run); `close` tears both down.
 */
export async function openGlspSession(
  session: ModelSession,
  mode: ModelMode,
  getWorkspace: () => AgentWorkspace,
): Promise<GlspSession> {
  const { openGlspMcpSession } = await import('@istar-ts/agent/glsp');
  // the worker's own model first (#434): the GLSP server reads the session's
  // mirror, which until then shows the model as the main thread read it
  await session.ready;
  // the server's dispatches still on their way to the worker (#434): `close`
  // waits for them, or an answer arriving after it (a live validation's
  // markers) is pushed to a stopped GLSP action queue, which
  // @eclipse-glsp/server rejects unhandled
  const inFlight = new Set<Promise<unknown>>();
  const dispatcher: StoreActionDispatcher<string, string> = {
    ...session.dispatcher,
    dispatch<A extends IstarAction<string, string>>(
      action: A,
      options?: DispatchOptions,
    ) {
      const pending = session.dispatcher.dispatch(action, options);
      const settled = () => {
        inFlight.delete(pending);
      };
      inFlight.add(pending);
      void pending.then(settled, settled);
      return pending;
    },
  };
  const drained = async (): Promise<void> => {
    while (inFlight.size > 0) {
      await Promise.allSettled(inFlight);
      // what the server does with the answers, before it stops
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const opened = await openGlspMcpSession(() => ({
    store: session.store,
    dispatcher,
    guards: [pistarExtMetamodelGuard, ...guardsForMode(mode).guards],
    postGuards: guardsForMode(mode).postGuards,
    metamodel: metamodelOf(session.store.getModel()),
    palette: session.getPalette(),
    hostTools: hostToolsFor(mode, getWorkspace),
    context: contextProvidersFor(mode),
  }));
  return {
    ...opened,
    close: () => {
      void drained().then(() => opened.close());
    },
  };
}
