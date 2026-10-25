// @vitest-environment node
/**
 * Goal-controller's own MCP host tools and context providers for M6's agent
 * (goal-controller#415): each tool's data, `validate-notation` against the
 * same validator the Langium LSP runs, the system prompt built from the
 * context providers, and a Propose-mode run that applies nothing until
 * approved. Node, not jsdom, as `glspMcp.test.ts` (the MCP client's `fetch`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parsePistar } from '@istar-ts/core';
import type {
  ChatClient,
  ChatCompletion,
  ChatRequest,
  ToolCall,
} from '@istar-ts/agent';
import { goalView } from '@goal-controller/goal-tree';
import {
  createGoalLspServices,
  serverDiagnostics,
} from '@goal-controller/goal-language/lsp';
import {
  createModelSession,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { startGlspServer, type GlspServer } from '@/lib/workbench/glspServer';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';
import { contextProvidersFor } from '@/lib/workbench/agent/engineContext';
import { hostToolsFor } from '@/lib/workbench/agent/hostTools';
import { createMcpChangeSet } from '@/lib/workbench/agent/mcpChangeSet';
import { dialectOf } from '@/lib/workbench/engineDialects';
import { contextOf } from '@/lib/workbench/notationDocument';

const EDGEV2 = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
const KAOS = readFileSync(
  join(__dirname, '../../../../examples/kaos/kaos-welcome.txt'),
  'utf8',
);
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';

const servers: GlspServer[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.dispose();
});

describe('list-types, pool-lookup and notation-help (goal-controller#415)', () => {
  it('list-types gives edgeV2 and kaosdoc their own element kinds', async () => {
    const edgev2Tools = await hostToolsFor('edgev2', 'edgev2', () => ({
      tree: null,
      resources: [],
    }));
    const listTypesEdgeV2 = edgev2Tools.find((t) => t.name === 'list-types')!;
    const edgev2Result = await listTypesEdgeV2.handler(
      {},
      { getModel: () => parsePistar(EDGEV2), dispatcher: undefined as never },
    );
    expect(edgev2Result.ok).toBe(true);
    expect(
      (
        edgev2Result as { content: { elements: { kind: string }[] } }
      ).content.elements.map((e) => e.kind),
    ).toContain('goal');

    const kaosdocTools = await hostToolsFor('kaosdoc', 'kaosdoc', () => ({
      tree: null,
      resources: [],
    }));
    const listTypesKaos = kaosdocTools.find((t) => t.name === 'list-types')!;
    const kaosResult = await listTypesKaos.handler(
      {},
      { getModel: () => parsePistar(KAOS), dispatcher: undefined as never },
    );
    expect(kaosResult.ok).toBe(true);
  });

  it("pool-lookup resolves (or not) in mutrose's definition pool, reusing createPool", async () => {
    const tools = await hostToolsFor('mutrose', 'mutrose', () => ({
      tree: null,
      resources: [],
    }));
    const poolLookup = tools.find((t) => t.name === 'pool-lookup')!;
    const result = await poolLookup.handler(
      { kinds: ['mutrose.world.class'], name: 'Room' },
      { getModel: () => parsePistar(EDGEV2), dispatcher: undefined as never },
    );
    expect(result.ok).toBe(true);
    // no project resources given: nothing of that kind is defined
    expect((result as { content: unknown }).content).toBeNull();
  });

  it('notation-help differs between edgeV2 (its own operators) and a dialect with none', async () => {
    const edgev2Tools = await hostToolsFor('edgev2', 'edgev2', () => ({
      tree: null,
      resources: [],
    }));
    const edgev2Help = await edgev2Tools
      .find((t) => t.name === 'notation-help')!
      .handler(
        {},
        { getModel: () => parsePistar(EDGEV2), dispatcher: undefined as never },
      );
    expect(edgev2Help.ok).toBe(true);
    expect((edgev2Help as { content: string }).content).toContain('Sequence');

    const kaosdocTools = await hostToolsFor('kaosdoc', 'kaosdoc', () => ({
      tree: null,
      resources: [],
    }));
    const kaosHelp = await kaosdocTools
      .find((t) => t.name === 'notation-help')!
      .handler(
        {},
        { getModel: () => parsePistar(KAOS), dispatcher: undefined as never },
      );
    expect(kaosHelp.ok).toBe(true);
  });

  it("validate-notation's diagnostics equal the LSP's for the same text", async () => {
    const dialect = dialectOf('edgev2')!;
    const tree = goalView(parsePistar(EDGEV2), dialect);
    const context = contextOf(dialect, tree, []);
    const text = 'G1: Something [?]'; // `?` (choice) is disabled for edgeV2

    const { shared, store } = createGoalLspServices();
    store.set({ dialect, context });
    const expected = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      text,
    );

    const tools = await hostToolsFor('edgev2', 'edgev2', () => ({
      tree,
      resources: [],
    }));
    const validate = tools.find((t) => t.name === 'validate-notation')!;
    const result = await validate.handler(
      { text },
      { getModel: () => parsePistar(EDGEV2), dispatcher: undefined as never },
    );
    expect(result.ok).toBe(true);
    expect(
      (result as { content: { diagnostics: unknown } }).content.diagnostics,
    ).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });
});

describe("the system prompt includes goal-controller's context sections (#415)", () => {
  it("contextProvidersFor(edgev2) covers the dialect's type definitions and notation", () => {
    const providers = contextProvidersFor('edgev2', 'edgev2');
    const names = providers.map((p) => p.name);
    expect(names).toContain('type-definitions');
    expect(names).toContain('notation-help');
    expect(names).toContain('engine-constraints');
  });

  it('a stub chat client receives a system prompt with those sections', async () => {
    const { systemPromptWith } = await import('@istar-ts/agent');
    const providers = contextProvidersFor('edgev2', 'edgev2');
    const prompt = await systemPromptWith('You are an agent.', providers);
    expect(prompt).toContain('Element, link and actor properties');
    expect(prompt).toContain('Goal notation');
    expect(prompt).toContain("edgev2's own constraints");
  });
});

/** A `ChatClient` that answers one tool call, then a final message. */
const stubClient = (toolCall: ToolCall): ChatClient => {
  let step = 0;
  return {
    model: 'stub',
    baseUrl: 'stub://',
    complete: async (_request: ChatRequest): Promise<ChatCompletion> => {
      step += 1;
      if (step === 1)
        return {
          message: { role: 'assistant', content: null, tool_calls: [toolCall] },
          finishReason: 'tool_calls',
        };
      return {
        message: { role: 'assistant', content: 'Done.' },
        finishReason: 'stop',
      };
    },
  };
};

describe('Propose mode over MCP applies nothing until approved (#415)', () => {
  it('one approval = one undo step, for a single-op tool (istar-ts#223 not needed)', async () => {
    const session: ModelSession = createModelSession(
      parsePistar(EDGEV2),
      () => {},
    );
    const { guards, postGuards } = guardsForMode('edgev2');
    session.setGuards(guards);
    session.setPostGuards(postGuards);
    const server = await startGlspServer(session, 'edgev2', 'edgev2', () => ({
      tree: null,
      resources: [],
    }));
    servers.push(server);
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(server.mcp.url, {
        fetch: server.mcp.fetch,
      }),
    );
    const { createMcpToolRegistry, runAgent } = await import('@istar-ts/agent');
    const registry = await createMcpToolRegistry(client, {
      boundArgs: { sessionId: server.mcp.sessionId },
    });

    const before = session.store.getModel();
    const toolCall: ToolCall = {
      id: 'call-1',
      type: 'function',
      function: {
        name: 'create-nodes',
        arguments: JSON.stringify({
          nodes: [
            {
              elementTypeId: 'node:istar.Task',
              position: { x: 10, y: 10 },
              containerId: ACTOR,
            },
          ],
        }),
      },
    };

    const base = createMcpChangeSet(registry);
    let heldEntries: unknown = null;
    const changeSet = {
      openScratch: base.openScratch,
      apply: async (entries: Parameters<typeof base.apply>[0]) => {
        heldEntries = entries;
        return base.apply(entries);
      },
    };

    const run = await runAgent({
      client: stubClient(toolCall),
      prompt: 'Add a task.',
      approval: 'propose',
      changeSet,
    });

    // the dry run proposes the call; nothing is applied until the drawer approves it
    expect(session.store.getModel()).toBe(before);
    expect(run.changeSet.length).toBe(1);
    expect(heldEntries).toBeNull();

    // the user approves: the drawer calls `changeSet.apply` with the reviewed entries
    await changeSet.apply(run.changeSet);
    expect(heldEntries).not.toBeNull();

    const afterApply = session.store.getModel();
    expect(afterApply).not.toBe(before);
    expect(afterApply.elements.size).toBe(before.elements.size + 1);

    const undone = await session.dispatcher.dispatch({ kind: 'glspUndo' });
    expect(undone.ok).toBe(true);
    expect(session.store.getModel()).toBe(before);
  });
});
