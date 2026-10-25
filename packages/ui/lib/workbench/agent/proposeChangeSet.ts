/**
 * Propose mode over backend A, for M6's agent drawer (goal-controller#415):
 * istar-ts's own `createGlspChangeSet` (istar-ts#232). Each run dry-runs on
 * a scratch headless GLSP session over a copy of the live model, with the
 * mode's guards; each mutating call becomes a step described in plain
 * words; `apply` dispatches the reviewed steps to the session's own
 * dispatcher as one `compound`: one undo step, refused as a whole (the model
 * untouched) when any guard there rejects it.
 *
 * The scratch session serves istar's tools only, so goal-controller's
 * read-only host tools (hostTools.ts) are added to its registry here; they
 * read the live project, which a Propose run never changes.
 * TODO(istar-ts#239): pass `hostTools`/`context` in GlspMcpBackendOptions.
 * The scratch dispatcher takes no post-guards, and every mode guard is one
 * (modeGuards.ts): such a refusal comes at `apply`, not in the preview.
 * TODO(istar-ts#239): pass `postGuards` in GlspMcpBackendOptions.
 */
import { metamodelOf } from '@istar-ts/core';
import type { HostTool } from '@istar-ts/actions';
import type { ToolRegistry } from '@istar-ts/agent';
import type { GlspChangeSet } from '@istar-ts/agent/glsp';
import type { ModelMode } from '@/lib/workbench/pistar';
import type { ModelSession } from '@/lib/workbench/modelSession';
import { pistarExtMetamodelGuard } from '@/lib/workbench/dialects';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';
import { hostToolsFor, type AgentWorkspace } from './hostTools';

/** `registry` with `hostTools` listed after its own, each call going to the one that has it. */
const withHostTools = async (
  registry: ToolRegistry,
  hostTools: readonly HostTool[],
  session: ModelSession,
): Promise<ToolRegistry> => {
  const { createActionToolRegistry } = await import('@istar-ts/agent');
  const host = createActionToolRegistry(session.dispatcher, {
    metamodel: metamodelOf(session.store.getModel()),
    hostTools,
    getModel: () => session.store.getModel(),
  });
  const names = new Set(hostTools.map((tool) => tool.name));
  return {
    list: () => [
      ...registry.list(),
      ...host.list().filter((spec) => names.has(spec.name)),
    ],
    call: (name, args, options) =>
      names.has(name)
        ? host.call(name, args, options)
        : registry.call(name, args, options),
    ...(registry.prepare && { prepare: registry.prepare.bind(registry) }),
  };
};

/**
 * The drawer's Propose-mode target over `session`, in `mode`: the scratch
 * session's guards are the session's own pre-guards (`modelSession.ts`),
 * read fresh on each run.
 */
export const proposeChangeSet = async (
  session: ModelSession,
  mode: ModelMode,
  getWorkspace: () => AgentWorkspace,
): Promise<GlspChangeSet> => {
  const [{ createGlspChangeSet }, { contributionFor }] = await Promise.all([
    import('@istar-ts/agent/glsp'),
    import('@istar-ts/glsp'),
  ]);
  const metamodel = metamodelOf(session.store.getModel());
  const base = createGlspChangeSet(
    () => ({
      store: session.store,
      dispatcher: session.dispatcher,
      guards: [pistarExtMetamodelGuard, ...guardsForMode(mode).guards],
      metamodel: metamodelOf(session.store.getModel()),
      palette: session.getPalette(),
    }),
    contributionFor(metamodel, {
      palette: session.getPalette(),
      sizes: session.getSizes(),
    }),
  );
  const hostTools = hostToolsFor(mode, getWorkspace);
  return {
    ...base,
    openScratch: async () => {
      const scratch = await base.openScratch();
      return {
        ...scratch,
        registry: await withHostTools(scratch.registry, hostTools, session),
      };
    },
  };
};
