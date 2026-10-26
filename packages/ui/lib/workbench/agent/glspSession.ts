/**
 * Backend A's session over the workbench's own session (goal-controller#414,
 * #450): `openGlspMcpSession` (istar-ts#239) gives both Auto mode's live
 * tool registry and Propose mode's scratch-session change set, over the same
 * store and dispatcher the canvas edits through, so an edit through either
 * mode goes through the same guards and one appears in the canvas at once.
 *
 * It runs in the model worker, next to that store and dispatcher
 * (`serveGlspMcpSession`, agent/agentHost.ts); the drawer holds
 * `connectGlspMcpSession`'s end of it. A scratch step's result carries its
 * `stepId` and an `undo`/`redo`'s its `undoDescription`, so `changeSet.step`
 * and the drawer's preview work on the copies that crossed the port. The
 * worker reads its options fresh on every Propose run: the mode's guards
 * and post-guards (`modeGuards.ts`, so a Propose batch breaking one is
 * refused on the scratch session, at preview, not only at `apply`), its host
 * tools (hostTools.ts) and context providers (context.ts), and the built-in
 * metamodel context provider (istar-ts#240), on by default. The host tools
 * that read the workspace (`pool-lookup`, `validate-notation`: the model's
 * view, the project's resources and the analysis' variables, all the main
 * thread's) run here, the worker forwarding each call (`serveAgent`).
 *
 * `@istar-ts/agent/glsp` is dynamically imported, so it never lands in the
 * initial bundle: a page that never turns this on pays nothing.
 */
import type { GlspMcpSession } from '@istar-ts/agent/glsp';
import type { ModelMode } from '@/lib/workbench/pistar';
import type { ModelSession } from '@/lib/workbench/modelSession';
import { workspaceToolsFor, type AgentWorkspace } from './hostTools';

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
  const { connectGlspMcpSession } = await import('@istar-ts/agent/glsp');
  const { port1, port2 } = new MessageChannel();
  const stop = session.serveAgent(port2, workspaceToolsFor(mode, getWorkspace));
  const close = (): void => {
    stop();
    port1.close();
  };
  // a call on this port is its own round trip into the worker, next to the
  // session's own; a model-worker crash (goal-controller#469) leaves it
  // hanging exactly like a dead dispatch would, so it rejects with the same
  // error `session.onCrash` gives everyone else
  const rejectOnCrash = <T>(pending: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const stop = session.onCrash(reject);
      pending.then(
        (value) => {
          stop();
          resolve(value);
        },
        (error) => {
          stop();
          reject(error);
        },
      );
    });
  // an edit resolves once the session's mirror shows it, as a dispatch
  // through `session.dispatcher` does: its change reaches the mirror on the
  // session's port, its answer comes on this one
  const shown = async <T>(pending: Promise<T>): Promise<T> => {
    const result = await rejectOnCrash(pending);
    await session.synced();
    return result;
  };
  try {
    const connected = await rejectOnCrash(
      connectGlspMcpSession<MessageEvent>(port1),
    );
    const { liveRegistry, changeSet } = connected;
    return {
      liveRegistry: {
        ...liveRegistry,
        call: (name, args, options) =>
          shown(liveRegistry.call(name, args, options)),
      },
      changeSet: {
        ...changeSet,
        apply: (entries) => shown(changeSet.apply(entries)),
      },
      close: () => {
        connected.close();
        close();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
