// @vitest-environment node
/**
 * Backend A's live session (`openGlspSession`'s `liveRegistry`, #450,
 * istar-ts#239), as `glspMcp.test.ts` (deleted) covered over a real MCP
 * transport: the live registry's tool list, a canvas-originated edit
 * visible through it, and a guard rejection coming back as a tool error
 * with diagnostics, the live model untouched. No MCP transport left to run
 * these over (`openGlspSession` wraps `liveRegistry`/`changeSet` directly,
 * `agentTools.test.ts`'s docstring), so these call `liveRegistry` itself:
 * the same object a real MCP `tools/list`/`callTool` would be backed by.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createModelSession,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { openGlspSession } from '@/lib/workbench/agent/glspSession';
import { workspaceToolsFor } from '@/lib/workbench/agent/hostTools';

const EDGEV2 = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: one actor, G1 OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';

const NO_WORKSPACE = () => ({ tree: null, resources: [], variables: [] });

/** An edgev2 session (its mode's guards on it) and its live backend-A session. */
const opened = async () => {
  const session: ModelSession = createModelSession(
    EDGEV2,
    () => {
      /* no listener needed: the tests read the store directly */
    },
    () => {},
  );
  session.setMode('edgev2');
  const glsp = await openGlspSession(session, 'edgev2', NO_WORKSPACE);
  return { session, glsp };
};

describe('the live session (goal-controller#450, istar-ts#239)', () => {
  it("tools/list includes the generic tools, istar's create-nodes, and goal-controller's four host tools", async () => {
    const { glsp } = await opened();
    const names = glsp.liveRegistry.list().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'set-properties',
        'set-link-value',
        'check-edge',
        'create-nodes',
        'list-types',
        'pool-lookup',
        'notation-help',
        'validate-notation',
      ]),
    );
    glsp.close();
  });

  it('a canvas-originated edit (applyLabelEdit) is visible through diagram-model', async () => {
    const { session, glsp } = await opened();

    const edit = await session.dispatcherFor('canvas').dispatch({
      kind: 'applyLabelEdit',
      labelId: G1,
      text: 'Renamed by canvas',
    });
    expect(edit.ok).toBe(true);

    const diagram = await glsp.liveRegistry.call('diagram-model', {});
    expect(diagram.ok).toBe(true);
    expect(JSON.stringify(diagram)).toContain('Renamed by canvas');
    glsp.close();
  });

  it(
    "a guard rejection (oneActorOnly) over the live registry's create-nodes " +
      'comes back as an error, with diagnostics, the live model untouched',
    async () => {
      const { session, glsp } = await opened();
      const before = session.store.getModel();

      const result = await glsp.liveRegistry.call('create-nodes', {
        nodes: [
          { elementTypeId: 'node:istar.Actor', position: { x: 0, y: 0 } },
        ],
      });

      expect(result.ok).toBe(false);
      expect(!result.ok && JSON.stringify(result.diagnostics)).toMatch(
        /single actor/i,
      );
      expect(session.store.getModel()).toBe(before);
      glsp.close();
    },
  );

  it('the workspace tools run on the main thread, called back by the session in the worker', async () => {
    const { session, glsp } = await opened();
    const text = 'G1: Something [?]'; // `?` (choice) is disabled for edgeV2
    const here = workspaceToolsFor('edgev2', NO_WORKSPACE)
      .find((tool) => tool.name === 'validate-notation')
      ?.handler({ text });
    const served = await glsp.liveRegistry.call('validate-notation', { text });
    expect(served.ok).toBe(true);
    expect(here?.ok && served.ok && served.content).toEqual(
      here?.ok && here.content,
    );
    // edgev2 has no pool: the main thread's refusal comes back as the tool's
    const lookup = await glsp.liveRegistry.call('pool-lookup', {
      kinds: ['x'],
      name: 'y',
    });
    expect(lookup.ok).toBe(false);
    expect(JSON.stringify(lookup)).toMatch(/no definition pool/);
    glsp.close();
    session.dispose();
  });

  it("closing while an edit's validation is still on its way to the worker throws nothing (withDirtyState)", async () => {
    const { session, glsp } = await opened();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const renamed = await glsp.liveRegistry.call('set-properties', {
        elementId: G1,
        properties: { name: 'Renamed while closing' },
      });
      expect(renamed.ok).toBe(true);
      // its live validation is still on its way to the worker and back
      glsp.close();
      // what the worker answers after the close, and what GLSP does with it
      await session.dispatcher.dispatch({
        kind: 'requestTypeHints',
        requestId: 'settled',
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      session.dispose();
    }
  });
});
