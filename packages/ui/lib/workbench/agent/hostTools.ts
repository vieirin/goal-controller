/**
 * Goal-controller's own MCP host tools for M6's agent (goal-controller#415):
 * `list-types`, `pool-lookup`, `notation-help` and `validate-notation`,
 * registered next to istar's `set-properties`/`set-link-value`/`check-edge`
 * (M5, #414) through `GlspMcpBackendOptions.hostTools` (istar-ts#239,
 * goal-controller#450). Each reads the mode's parts (`agentModeOf`,
 * context.ts), the same objects the system prompt's sections are written
 * from. Every one is read-only: none dispatches an edit, so none needs the
 * review step a mutating host tool would.
 */
import * as z from 'zod';
import {
  metamodelContext,
  type HostTool,
  type HostToolContext,
  type HostToolResult,
} from '@istar-ts/actions';
import { metamodelOf } from '@istar-ts/core';
import {
  validateNotation,
  type NotationInputs,
  type NotationTree,
} from '@goal-controller/goal-language';
import { createPool, type PoolRegistration } from '@goal-controller/lib';
import type { ModelMode } from '@/lib/workbench/pistar';
import {
  poolDocuments,
  type PoolWorkspace,
} from '@/lib/workbench/poolDocuments';
import { agentModeOf, type AgentMode } from './context';

const ok = (content: unknown): HostToolResult => ({ ok: true, content });

/**
 * What the host tools read of the open project, fresh on each call: the
 * model's view and the project's resources (the pool's documents), and what
 * the Notation editor checks the model against (its context variables and
 * the resources, parsed).
 */
export type AgentWorkspace = Omit<PoolWorkspace, 'tree'> & {
  tree: NotationTree | null;
  variables: NotationInputs['variables'];
  projectResources?: NotationInputs['projectResources'];
};

const toolSchema = <S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  handler: (
    args: z.infer<S>,
    context: HostToolContext,
  ) => HostToolResult | Promise<HostToolResult>,
): HostTool => ({
  name,
  description,
  inputSchema: z.toJSONSchema(schema) as HostTool['inputSchema'],
  readOnly: true,
  handler: (args, context) => handler(schema.parse(args), context),
});

const refusal = (source: string, message: string): HostToolResult => ({
  ok: false,
  diagnostics: [{ elementId: '', severity: 'error', message, source }],
});

/** `list-types`: the root's part (istar-ts's `metamodelContext`, istar-ts#240) and the engine's (its kinds, property schemas, constraints). */
const listTypesTool = ({ engine }: AgentMode): HostTool =>
  toolSchema(
    'list-types',
    "The model's element, link and actor kinds, and the active dialect's id prefixes, property schemas and constraints.",
    z.object({}),
    (_args, { getModel }) =>
      ok({ root: metamodelContext(metamodelOf(getModel())), engine }),
  );

const poolLookupSchema = z.object({
  kinds: z.array(z.string()).min(1),
  name: z.string(),
  owner: z.string().optional(),
});

/**
 * `pool-lookup`: a name in the engine's definition pool (goal-controller#59),
 * in one of its scopes — global (no `owner`), owner (`owner` given) or
 * through a link (the owner chain `TypedPool.find` already walks for a kind
 * declared `scope: 'owner'`) — over the same `PoolRegistration`,
 * `createPool` and `poolDocuments` the project's own pool uses.
 */
const poolLookupTool = (
  mode: ModelMode,
  pool: PoolRegistration | null,
  getWorkspace: () => AgentWorkspace,
): HostTool =>
  toolSchema(
    'pool-lookup',
    "A name in the engine's definition pool: resolves it among one of its kinds, in a scope (global, or an owner's members).",
    poolLookupSchema,
    ({ kinds, name, owner }) => {
      if (!pool)
        return refusal('pool-lookup', `${mode} has no definition pool`);
      const found = createPool(pool)
        .update(poolDocuments(getWorkspace()))
        .find(kinds, name, owner);
      return ok(
        found
          ? {
              id: found.id,
              kind: found.kind,
              name: found.name,
              owner: found.owner ?? null,
              type: found.type ?? null,
              detail: found.detail ?? null,
            }
          : null,
      );
    },
  );

/** `notation-help`: goal-language's part, the notation the dialect reads. */
const notationHelpTool = ({ notation }: AgentMode): HostTool =>
  toolSchema(
    'notation-help',
    "The goal language's notation forms for the active dialect: its element line, bracket operators, property, link and actor lines, assertions and expressions.",
    z.object({}),
    () => ok(notation),
  );

const validateNotationSchema = z.object({ text: z.string() });

const EMPTY_TREE: NotationTree = { nodes: new Map(), roots: [] };

/**
 * `validate-notation`: goal-language's `validateNotation`, with what the
 * Notation editor checks the model against (its tree, context variables
 * and project resources, and the engine's named checks), so it reports
 * exactly what the editor shows for the same text.
 */
const validateNotationTool = (
  { dialect, checks }: AgentMode,
  getWorkspace: () => AgentWorkspace,
): HostTool =>
  toolSchema(
    'validate-notation',
    'Validates a piece of goal-language notation (an element line, a property line, a bracketed notation) against the active dialect, exactly as the editor does.',
    validateNotationSchema,
    ({ text }) => {
      if (!dialect) return ok({ diagnostics: [] });
      const { tree, variables, projectResources } = getWorkspace();
      return ok({
        diagnostics: validateNotation(
          dialect,
          text,
          { tree: tree ?? EMPTY_TREE, variables, projectResources },
          checks,
        ),
      });
    },
  );

/** Every host tool M6 registers with M5's MCP server (goal-controller#415). */
export const hostToolsFor = (
  mode: ModelMode,
  getWorkspace: () => AgentWorkspace,
): HostTool[] => {
  const agent = agentModeOf(mode);
  return [
    listTypesTool(agent),
    poolLookupTool(mode, agent.pool, getWorkspace),
    notationHelpTool(agent),
    validateNotationTool(agent, getWorkspace),
  ];
};
