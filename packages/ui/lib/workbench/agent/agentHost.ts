/**
 * The agent's GLSP/MCP session (goal-controller#414, #450), served in the
 * model worker next to the store and dispatcher it edits
 * (`serveGlspMcpSession`); the drawer's side is `connectGlspMcpSession`
 * (glspSession.ts). Auto mode's live registry edits through the worker's
 * dispatcher, its guards and its one undo stack; Propose mode's change set
 * dry-runs on a scratch session, with the mode's post-guards, so a batch
 * breaking one is refused at preview, and applies as one undo step.
 *
 * `getOptions` is read in the worker, fresh on every Propose run: the
 * session's mode (its guards, post-guards, host tools and context), its
 * palette, and the model's metamodel. The host tools the worker can't run
 * (`forwarded`: they read the main thread's workspace, hostTools.ts) are
 * served with a handler that calls the main thread.
 *
 * The worker imports this module (and with it `@istar-ts/agent/glsp`)
 * dynamically, only once a page turns the agent on.
 */
import type {
  ActionDispatcher,
  HostTool,
  HostToolResult,
} from '@istar-ts/actions';
import { serveGlspMcpSession } from '@istar-ts/agent/glsp';
import {
  metamodelOf,
  type AnyPaletteDescription,
  type ModelStore,
} from '@istar-ts/core';
import type { ModelMode } from '@/lib/workbench/pistar';
import { pistarExtMetamodelGuard } from '@/lib/workbench/dialects';
import { guardsForMode } from '@/lib/workbench/modeGuards';
import type { ForwardedToolSpec } from '@/lib/workbench/modelWorkerProtocol';
import { contextProvidersFor } from './context';
import { hostToolsFor } from './hostTools';

export type AgentHost = {
  readonly store: ModelStore<string, string>;
  readonly dispatcher: ActionDispatcher<string, string>;
  /** the session's mode, now */
  getMode(): ModelMode;
  /** what `requestContextActions` answers, now */
  getPalette(): AnyPaletteDescription;
  /** the main thread's own host tools, served here by `forward`ing each call */
  readonly forwarded: readonly ForwardedToolSpec[];
  forward(
    name: string,
    args: Parameters<HostTool['handler']>[0],
  ): Promise<HostToolResult>;
};

/** Serves the agent's session on `port` until the returned function is called. */
export const serveAgent = (
  port: MessagePort,
  host: AgentHost,
): (() => void) => {
  const forwarded: HostTool[] = host.forwarded.map((spec) => ({
    ...spec,
    handler: (args) => host.forward(spec.name, args),
  }));
  const stop = serveGlspMcpSession<MessageEvent>(port, () => {
    const mode = host.getMode();
    const { guards, postGuards } = guardsForMode(mode);
    return {
      store: host.store,
      dispatcher: host.dispatcher,
      guards: [pistarExtMetamodelGuard, ...guards],
      postGuards,
      metamodel: metamodelOf(host.store.getModel()),
      palette: host.getPalette(),
      hostTools: [...hostToolsFor(mode), ...forwarded],
      context: contextProvidersFor(mode),
    };
  });
  return () => {
    stop();
    port.close();
  };
};
