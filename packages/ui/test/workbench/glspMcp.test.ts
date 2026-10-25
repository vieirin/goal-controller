// @vitest-environment node
/**
 * The GLSP server's MCP surface (goal-controller#414), over a workbench
 * session's own store and dispatcher: the generic tools and istar's three
 * own, a guarded edit through them reaching the same model the canvas does,
 * and a rejection coming back as a tool error with diagnostics. Node, not
 * jsdom (`test/workbench/glspHosting.test.tsx` covers `wb.glspMcp` itself):
 * the MCP SDK client's `fetch` mixes jsdom's and Node's `AbortSignal` when
 * both exist in the same realm.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parsePistar } from '@istar-ts/core';
import {
  createModelSession,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { startGlspServer, type GlspServer } from '@/lib/workbench/glspServer';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: one actor, G1 OR-refined into G2 and G3
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

const servers: GlspServer[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.dispose();
});

/** A session in edgev2 mode (oneActorOnly as a post-guard), a GLSP server over it, and an MCP client connected. */
const opened = async () => {
  const session: ModelSession = createModelSession(parsePistar(ISTAR), () => {
    /* no listener needed: the tests read the store directly */
  });
  const { guards, postGuards } = guardsForMode('edgev2');
  session.setGuards(guards);
  session.setPostGuards(postGuards);

  const server = await startGlspServer(session);
  servers.push(server);
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(server.mcp.url, {
      fetch: server.mcp.fetch,
    }),
  );
  return { session, server, client };
};

describe('the GLSP server hosted over a workbench session (#414)', () => {
  it('tools/list includes the generic tools and the three istar-specific ones', async () => {
    const { client } = await opened();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain('set-properties');
    expect(names).toContain('set-link-value');
    expect(names).toContain('check-edge');
    expect(names).toContain('create-nodes');
  });

  it('create-nodes over MCP appears in the store, undoable with one glspUndo', async () => {
    const { session, server, client } = await opened();
    const before = session.store.getModel();

    const created = await client.callTool({
      name: 'create-nodes',
      arguments: {
        sessionId: server.mcp.sessionId,
        nodes: [
          {
            elementTypeId: 'node:istar.Task',
            position: { x: 10, y: 10 },
            containerId: ACTOR,
          },
        ],
      },
    });
    expect(created.isError).not.toBe(true);

    const after = session.store.getModel();
    expect(after).not.toBe(before);
    expect(after.elements.size).toBe(before.elements.size + 1);

    const undone = await session.dispatcher.dispatch({ kind: 'glspUndo' });
    expect(undone.ok).toBe(true);
    expect(session.store.getModel()).toBe(before);
  });

  it('a canvas-originated edit appears on the GLSP side (diagram-model)', async () => {
    const { session, server, client } = await opened();

    const edit = await session.dispatcherFor('canvas').dispatch({
      kind: 'applyLabelEdit',
      labelId: G1,
      text: 'Renamed by canvas',
    });
    expect(edit.ok).toBe(true);

    const diagram = await client.callTool({
      name: 'diagram-model',
      arguments: { sessionId: server.mcp.sessionId },
    });
    expect(diagram.isError).not.toBe(true);
    expect(JSON.stringify(diagram)).toContain('Renamed by canvas');
  });

  it(
    "a guard rejection (oneActorOnly) over MCP's create-nodes comes back " +
      'as isError, with diagnostics',
    async () => {
      const { session, server, client } = await opened();
      const before = session.store.getModel();

      const result = await client.callTool({
        name: 'create-nodes',
        arguments: {
          sessionId: server.mcp.sessionId,
          nodes: [
            { elementTypeId: 'node:istar.Actor', position: { x: 0, y: 0 } },
          ],
        },
      });

      expect(result.isError).toBe(true);
      const content = JSON.stringify(result.content);
      expect(content).toContain('rejected');
      expect(content).toMatch(/single actor/i);
      expect(session.store.getModel()).toBe(before);
    },
  );
});
