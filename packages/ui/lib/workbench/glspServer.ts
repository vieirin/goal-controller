/**
 * A headless `@istar-ts/glsp` server hosted over the workbench's own session
 * (goal-controller#414): the canvas's store and dispatcher, `shared`, so an
 * edit through GLSP goes through the same guards (#412) as the canvas, and
 * one appears in both at once. No stock GLSP client: MCP is the point, for
 * M6's agent. `@istar-ts/glsp` (Inversify, `reflect-metadata`, the GLSP
 * server and `@eclipse-glsp/server-mcp`) is dynamically imported, so it never
 * lands in the initial bundle: a page that never turns this on pays nothing.
 */
import { metamodelOf } from '@istar-ts/core';
import type { ModelMode } from './pistar';
import type { TransformEngine } from '../types';
import type { ModelSession } from './modelSession';
import type { PoolWorkspace } from './agent/hostTools';

/** The in-page MCP handle (`startGlspServer`'s result): what M6's agent needs to reach it. */
export type GlspMcpHandle = {
  /** The endpoint to give an MCP SDK client's `StreamableHTTPClientTransport`. */
  readonly url: URL;
  /** A Fetch API `fetch` for that transport: never leaves the page. */
  readonly fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  /** The headless session MCP tools act on: pass it as every tool call's `sessionId`. */
  readonly sessionId: string;
};

export type GlspServer = {
  readonly mcp: GlspMcpHandle;
  /** Closes the GLSP connection and its MCP server. */
  dispose(): void;
};

/**
 * Starts a GLSP server over `session`'s store and dispatcher, with a
 * contribution built (`contributionFor`) from the model's current metamodel,
 * the session's palette and registry sizes (`PaletteBridge`'s, not
 * re-derived): matches the active mode's dialect, since the model, palette
 * and sizes are all the showing canvas's. `engine`/`mode` and `getWorkspace`
 * (goal-controller#415) build goal-controller's own context providers and
 * host tools for M6's agent, registered next to istar's own MCP tools.
 * `@istar-ts/glsp` and the agent's own modules are dynamically imported, so
 * they never land in the initial bundle: a page that never turns this on
 * pays nothing.
 */
export async function startGlspServer(
  session: ModelSession,
  engine: TransformEngine,
  mode: ModelMode,
  getWorkspace: () => PoolWorkspace,
): Promise<GlspServer> {
  const [
    { contributionFor },
    { serveIstarGlsp },
    { contextProvidersFor },
    { hostToolsFor },
  ] = await Promise.all([
    import('@istar-ts/glsp'),
    import('@istar-ts/glsp/browser'),
    import('./agent/engineContext'),
    import('./agent/hostTools'),
  ]);
  const contribution = contributionFor(metamodelOf(session.store.getModel()), {
    palette: session.getPalette(),
    sizes: session.getSizes(),
  });
  const server = serveIstarGlsp({
    shared: { store: session.store, dispatcher: session.dispatcher },
    mcp: {
      hostTools: await hostToolsFor(engine, mode, getWorkspace),
      context: contextProvidersFor(engine, mode),
    },
    contributions: [contribution],
  });
  await server.mcp.ready;
  // optional in IstarGlspMcpServer only because the type is shared with
  // serveOnPort's: the no-port overload used here always goes through
  // serveHeadless, which always sets it (@istar-ts/glsp dist/browser.js).
  const { sessionId } = server;
  if (sessionId === undefined) {
    throw new Error('serveIstarGlsp (headless) returned no sessionId');
  }
  return {
    mcp: {
      url: server.mcp.url,
      fetch: server.mcp.fetch,
      sessionId,
    },
    dispose: () => server.close(),
  };
}
