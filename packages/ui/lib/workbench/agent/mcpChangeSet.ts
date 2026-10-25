/**
 * Propose mode over backend A (MCP), for M6's agent drawer (goal-controller#415).
 * `@istar-ts/agent`'s own `createActionChangeSet` is backend B (a dispatcher)
 * only; its README says backend A "needs a `ChangeSetTarget` with a scratch
 * GLSP session", which the package does not ship yet (istar-ts, as of
 * 0.15.0-beta.5). This is a narrower stand-in: it does not dry-run a call
 * against a scratch model (no diagnostics preview before approval), only
 * gates it — a mutating call is held, unapplied, until the drawer approves
 * it, then it is the one real MCP call, live. A read-only call always runs
 * right away, as Propose mode does on backend B. Flagged to the orchestrator
 * as a gap worth istar-ts shipping its own backend-A `ChangeSetTarget` for.
 */
import type {
  ChangeSetEntry,
  ChangeSetTarget,
  JsonValue,
  ScratchSession,
  ToolRegistry,
  ToolResult,
} from '@istar-ts/agent';

/**
 * A `ChangeSetTarget` over `registry` (an MCP `ToolRegistry`, M5's server):
 * a read-only call runs immediately; a mutating one is recorded, unapplied,
 * for the drawer to show and the user to approve or reject. `apply` makes
 * the real calls, in order, as the user approved them.
 */
export const createMcpChangeSet = (registry: ToolRegistry): ChangeSetTarget => {
  const readOnly = new Set(
    registry.list().flatMap((tool) => (tool.readOnly ? [tool.name] : [])),
  );
  return {
    openScratch: (): ScratchSession => ({
      registry: {
        list: () => registry.list(),
        call: async (name: string, args: JsonValue): Promise<ToolResult> =>
          readOnly.has(name)
            ? registry.call(name, args)
            : {
                ok: true,
                content: { proposed: true },
              },
      },
    }),
    apply: async (entries: readonly ChangeSetEntry[]): Promise<ToolResult> => {
      let last: ToolResult = { ok: true, content: null };
      for (const entry of entries) {
        last = await registry.call(entry.name, entry.args);
        if (!last.ok) return last;
      }
      return last;
    },
  };
};
