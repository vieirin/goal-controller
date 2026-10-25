// @vitest-environment node
/**
 * Goal-controller's own MCP host tools and context providers for M6's agent
 * (goal-controller#415): the composed context (the root's, the notation's,
 * the engine's and the guards' parts) for an edgeV2 and a KAOS mode, each
 * tool reading those same objects, `validate-notation` against the
 * language server's diagnostics, and Propose mode over istar-ts's scratch
 * GLSP session: nothing applied until approved, one approval one undo step,
 * refused as a whole. Node, not jsdom, as `glspMcp.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePistar } from '@istar-ts/core';
import type { HostTool, HostToolResult } from '@istar-ts/actions';
import { runAgent } from '@istar-ts/agent';
import type {
  ChatClient,
  ChatCompletion,
  ChatRequest,
  ToolCall,
} from '@istar-ts/agent';
import { goalView } from '@goal-controller/goal-tree';
import {
  notationContextOf,
  notationHelpOf,
  savedLinesOf,
} from '@goal-controller/goal-language';
import {
  createGoalLspServices,
  serverDiagnostics,
} from '@goal-controller/goal-language/lsp';
import { kaosAgentContext } from '@goal-controller/lib';
import {
  createModelSession,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';
import {
  agentModeOf,
  contextProvidersFor,
} from '@/lib/workbench/agent/context';
import {
  hostToolsFor,
  type AgentWorkspace,
} from '@/lib/workbench/agent/hostTools';
import { proposeChangeSet } from '@/lib/workbench/agent/proposeChangeSet';
import {
  dialectOf,
  ENGINE_AGENT_CONTEXTS,
} from '@/lib/workbench/engineDialects';
import { parseModel } from '@/lib/workbench/dialects';

const EDGEV2 = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
const KAOS = readFileSync(
  join(__dirname, '../../../../examples/kaos/kaos-welcome.txt'),
  'utf8',
);
const ACTOR = '08f209f3-3f64-4f1e-9638-d36d0f1de8a8';

const NO_WORKSPACE = (): AgentWorkspace => ({
  tree: null,
  resources: [],
  variables: [],
});

/** A host tool's result, called as the MCP server calls it. */
const call = async (
  tools: readonly HostTool[],
  name: string,
  args: Record<string, unknown>,
  text: string,
): Promise<HostToolResult> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`no ${name}`);
  const session = createModelSession(parseModel(text), () => {});
  return tool.handler(args, {
    getModel: () => session.store.getModel(),
    dispatcher: session.dispatcher,
  });
};

const contentOf = (result: HostToolResult): unknown => {
  if (!result.ok) throw new Error(result.diagnostics[0]?.message);
  return result.content;
};

describe("a mode's composed context (goal-controller#415)", () => {
  it('edgev2: the root, notation, engine and guard parts', async () => {
    const providers = contextProvidersFor('edgev2');
    expect(providers.map((p) => p.name)).toEqual([
      'metamodel',
      'type-definitions',
      'notation-help',
      'engine-constraints',
    ]);
    const { systemPromptWith } = await import('@istar-ts/agent');
    const prompt = await systemPromptWith('You are an agent.', providers, () =>
      parsePistar(EDGEV2),
    );
    expect(prompt).toContain('istar.AndRefinementLink');
    expect(prompt).toContain('Sequence');
    expect(prompt).toContain('maxRetries');
    expect(prompt).toContain("edgev2's own constraints");
  });

  it("kaos: KAOS's root, its dialect's notation and engine parts, no guards", async () => {
    const parts = agentModeOf('kaos');
    expect(parts.engine).toBe(kaosAgentContext);
    expect(parts.notation?.refinement).toBeNull();
    expect(parts.guards).toEqual([]);
    const providers = contextProvidersFor('kaos');
    expect(providers.map((p) => p.name)).toEqual([
      'metamodel',
      'type-definitions',
      'notation-help',
    ]);
    const { systemPromptWith } = await import('@istar-ts/agent');
    const prompt = await systemPromptWith('You are an agent.', providers, () =>
      parseModel(KAOS),
    );
    expect(prompt).toContain('kaos.BehavioralGoal');
    expect(prompt).not.toContain('istar.AndRefinementLink');
  });

  it("an engine mode's engine part is its registry entry's", () => {
    expect(agentModeOf('edgev2').engine).toBe(ENGINE_AGENT_CONTEXTS.edgev2);
    expect(agentModeOf('edgev2').notation).toEqual(
      notationHelpOf(dialectOf('edgev2')!),
    );
  });
});

describe('the host tools read the same parts (goal-controller#415)', () => {
  it("list-types: the model's root and the engine's part", async () => {
    const tools = hostToolsFor('edgev2', NO_WORKSPACE);
    const content = contentOf(await call(tools, 'list-types', {}, EDGEV2));
    expect(content).toMatchObject({
      engine: ENGINE_AGENT_CONTEXTS.edgev2,
      root: { framework: 'istar-2.0' },
    });
  });

  it("notation-help: goal-language's part, for edgeV2 and KAOS", async () => {
    const edgev2 = contentOf(
      await call(
        hostToolsFor('edgev2', NO_WORKSPACE),
        'notation-help',
        {},
        EDGEV2,
      ),
    );
    expect(edgev2).toEqual(agentModeOf('edgev2').notation);
    const kaos = contentOf(
      await call(hostToolsFor('kaos', NO_WORKSPACE), 'notation-help', {}, KAOS),
    );
    expect(kaos).toEqual(agentModeOf('kaos').notation);
  });

  it("pool-lookup resolves (or not) in mutrose's definition pool, reusing createPool", async () => {
    const tools = hostToolsFor('mutrose', NO_WORKSPACE);
    const result = await call(
      tools,
      'pool-lookup',
      { kinds: ['mutrose.world.class'], name: 'Room' },
      EDGEV2,
    );
    // no project resources given: nothing of that kind is defined
    expect(contentOf(result)).toBeNull();
    const none = await call(
      hostToolsFor('edgev2', NO_WORKSPACE),
      'pool-lookup',
      { kinds: ['x'], name: 'y' },
      EDGEV2,
    );
    expect(none.ok).toBe(false);
  });

  it("validate-notation's diagnostics equal the language server's for the same context", async () => {
    const dialect = dialectOf('edgev2')!;
    const tree = goalView(parsePistar(EDGEV2), dialect);
    const text = 'G1: Something [?]'; // `?` (choice) is disabled for edgeV2
    const workspace = { tree, resources: [], variables: [] };

    const { shared, store } = createGoalLspServices();
    store.set({
      dialect,
      context: notationContextOf(dialect, workspace),
      saved: savedLinesOf(dialect, tree),
    });
    const expected = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      text,
    );
    const result = await call(
      hostToolsFor('edgev2', () => workspace),
      'validate-notation',
      { text },
      EDGEV2,
    );
    expect(contentOf(result)).toEqual({ diagnostics: expected });
    expect(expected.length).toBeGreaterThan(0);
  });
});

/** A `ChatClient` that makes `toolCalls`, one per turn, then answers. */
const stubClient = (toolCalls: readonly ToolCall[]): ChatClient => {
  let step = 0;
  return {
    model: 'stub',
    baseUrl: 'stub://',
    complete: async (_request: ChatRequest): Promise<ChatCompletion> => {
      const toolCall = toolCalls[step];
      step += 1;
      if (toolCall)
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

const createNode = (id: string, node: Record<string, unknown>): ToolCall => ({
  id,
  type: 'function',
  function: {
    name: 'create-nodes',
    arguments: JSON.stringify({ nodes: [node] }),
  },
});

const task = (id: string, text: string) =>
  createNode(id, {
    elementTypeId: 'node:istar.Task',
    position: { x: 10, y: 10 },
    containerId: ACTOR,
    text,
  });

/** An edgev2 session (its mode's guards on it), its Propose-mode target, and a run of `toolCalls` on it. */
const proposed = async (toolCalls: readonly ToolCall[]) => {
  const session: ModelSession = createModelSession(
    parsePistar(EDGEV2),
    () => {},
  );
  const { guards, postGuards } = guardsForMode('edgev2');
  session.setGuards(guards);
  session.setPostGuards(postGuards);
  const changeSet = await proposeChangeSet(session, 'edgev2', NO_WORKSPACE);
  const before = session.store.getModel();
  const run = await runAgent({
    client: stubClient(toolCalls),
    prompt: 'Edit the model.',
    approval: 'propose',
    changeSet,
  });
  return { session, changeSet, before, run };
};

describe('Propose mode: one approval, one undo step (#415, istar-ts#232)', () => {
  it('applies nothing until approved; one glspUndo undoes a 3-entry batch', async () => {
    const { session, changeSet, before, run } = await proposed([
      task('call-1', 'First'),
      task('call-2', 'Second'),
      task('call-3', 'Third'),
    ]);
    // the dry run proposes the calls, each a step described in words
    expect(session.store.getModel()).toBe(before);
    expect(run.changeSet).toHaveLength(3);
    for (const entry of run.changeSet)
      expect(changeSet.step(entry)?.description.length).toBeGreaterThan(0);

    const applied = await changeSet.apply(run.changeSet);
    expect(applied.ok).toBe(true);
    const after = session.store.getModel();
    expect(after.elements.size).toBe(before.elements.size + 3);
    expect([...after.elements.values()].map((element) => element.name)).toEqual(
      expect.arrayContaining(['First', 'Second', 'Third']),
    );

    const undone = await session.dispatcher.dispatch({ kind: 'glspUndo' });
    expect(undone.ok).toBe(true);
    expect(session.store.getModel()).toBe(before);
  });

  it("a batch whose 2nd entry breaks the mode's post-guard is refused at apply, the model untouched", async () => {
    const { session, changeSet, before, run } = await proposed([
      task('call-1', 'First'),
      // edgeV2 reads a single actor (edgeOneActor, a post-guard): the
      // scratch session has no post-guards (TODO(istar-ts#239)), so the
      // live dispatcher refuses it, and the compound with it
      createNode('call-2', {
        elementTypeId: 'node:istar.Actor',
        position: { x: 0, y: 0 },
      }),
      task('call-3', 'Third'),
    ]);
    expect(run.changeSet).toHaveLength(3);

    const applied = await changeSet.apply(run.changeSet);
    expect(applied.ok).toBe(false);
    expect(JSON.stringify(!applied.ok && applied.diagnostics)).toMatch(
      /single actor/i,
    );
    expect(session.store.getModel()).toBe(before);
    expect(session.store.canUndo()).toBe(false);
  });

  it("the scratch session's registry has goal-controller's host tools", async () => {
    const session = createModelSession(parsePistar(EDGEV2), () => {});
    const changeSet = await proposeChangeSet(session, 'edgev2', NO_WORKSPACE);
    const scratch = await changeSet.openScratch();
    const names = scratch.registry.list().map((spec) => spec.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'create-nodes',
        'list-types',
        'validate-notation',
      ]),
    );
    const listed = await scratch.registry.call('list-types', {});
    expect(listed.ok).toBe(true);
    scratch.close?.();
  });
});
