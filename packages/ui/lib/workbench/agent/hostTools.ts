/**
 * Goal-controller's own MCP host tools for M6's agent (goal-controller#415):
 * `list-types`, `pool-lookup`, `notation-help` and `validate-notation`,
 * registered next to istar's `set-properties`/`set-link-value`/`check-edge`
 * (M5, #414). Every one of these is read-only: none dispatches an edit, so
 * none needs the review step a mutating host tool would.
 */
import * as z from 'zod';
import type { HostTool, HostToolResult } from '@istar-ts/actions';
import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  type AnyDialect,
} from '@goal-controller/dialect';
import { createPool, type PoolDocument } from '@goal-controller/lib';
import { goalView } from '@goal-controller/goal-tree';
import type { ModelMode } from '@/lib/workbench/pistar';
import type { TransformEngine } from '@/lib/types';
import { dialectOf, ENGINE_POOLS } from '@/lib/workbench/engineDialects';
import { contextOf } from '@/lib/workbench/notationDocument';
import { notationHelpText } from './engineContext';

const ok = (content: unknown): HostToolResult => ({ ok: true, content });

/** The engine's workspace documents for the pool: the model and the project's resources. */
export type PoolWorkspace = {
  tree: ReturnType<typeof goalView> | null;
  resources: readonly { kind: string; path: string; text: string }[];
};

const toolSchema = <S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  readOnly: boolean,
  handler: (args: z.infer<S>) => HostToolResult | Promise<HostToolResult>,
): HostTool => ({
  name,
  description,
  inputSchema: z.toJSONSchema(schema) as HostTool['inputSchema'],
  readOnly,
  handler: (args) => handler(schema.parse(args)),
});

/** `list-types`: the active dialect's element, link and actor kinds. */
const listTypesTool = (dialect: AnyDialect | null): HostTool =>
  toolSchema(
    'list-types',
    "The active dialect's element, link and actor kinds, with their id prefixes.",
    z.object({}),
    true,
    () =>
      ok({
        elements: Object.entries(dialect?.elements ?? {}).map(
          ([kind, element]) => ({ kind, prefix: element?.prefix ?? null }),
        ),
        links: [...ISTAR_LINK_KINDS, ...Object.keys(dialect?.links ?? {})],
        actors: ISTAR_ACTOR_KINDS,
      }),
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
 * declared `scope: 'owner'`) — reusing the same `PoolRegistration` and
 * `createPool` the project's own pool uses, never reimplemented.
 */
const poolLookupTool = (
  engine: TransformEngine,
  getWorkspace: () => PoolWorkspace,
): HostTool =>
  toolSchema(
    'pool-lookup',
    "A name in the engine's definition pool: resolves it among one of its kinds, in a scope (global, or an owner's members).",
    poolLookupSchema,
    true,
    ({ kinds, name, owner }) => {
      const registration = ENGINE_POOLS[engine as keyof typeof ENGINE_POOLS];
      if (!registration)
        return {
          ok: false,
          diagnostics: [
            {
              elementId: '',
              severity: 'error',
              message: `${engine} has no definition pool`,
              source: 'pool-lookup',
            },
          ],
        };
      const workspace = getWorkspace();
      const documents: PoolDocument[] = [
        ...(workspace.tree
          ? [{ id: 'model', kind: 'model', value: workspace.tree }]
          : []),
        ...workspace.resources.map(({ kind, path, text }) => ({
          id: path,
          kind,
          text,
        })),
      ];
      const index = createPool(registration).update(documents);
      const found = index.find(kinds, name, owner);
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

/** `notation-help`: the same text as the `notation-help` context provider, on demand. */
const notationHelpTool = (dialect: AnyDialect | null): HostTool =>
  toolSchema(
    'notation-help',
    "The goal language's notation forms for the active dialect.",
    z.object({}),
    true,
    () => ok(notationHelpText(dialect)),
  );

const validateNotationSchema = z.object({ text: z.string() });

/**
 * `validate-notation`: the SAME validation the Langium LSP runs
 * (`packages/goal-language/src/lsp/server.ts`'s `serverDiagnostics`), not a
 * second validator. `@goal-controller/goal-language/lsp` (Langium) is
 * dynamically imported, as `@istar-ts/glsp` is in `glspServer.ts`: a page
 * that never turns the agent on never pays for it. One `createGoalLspServices()`
 * is reused across calls (a host tool call is cheap to re-validate with, but
 * spinning the Langium services up each time is not).
 */
const validateNotationTool = async (
  engine: TransformEngine,
  getWorkspace: () => PoolWorkspace,
): Promise<HostTool> => {
  const { createGoalLspServices, serverDiagnostics } =
    await import('@goal-controller/goal-language/lsp');
  const { shared, store } = createGoalLspServices();
  return toolSchema(
    'validate-notation',
    'Validates a piece of goal-language notation (an element line, a property line, a bracketed notation) against the active dialect, exactly as the editor does.',
    validateNotationSchema,
    true,
    async ({ text }) => {
      const dialect = dialectOf(engine);
      if (!dialect) return ok({ diagnostics: [] });
      const workspace = getWorkspace();
      const context = workspace.tree
        ? contextOf(dialect, workspace.tree, [])
        : { elements: {}, variables: [] };
      store.set({ dialect, context });
      const diagnostics = await serverDiagnostics(
        shared,
        'file:///notation.goal',
        text,
      );
      return ok({ diagnostics });
    },
  );
};

/** Every host tool M6 registers with M5's MCP server (goal-controller#415). */
export const hostToolsFor = async (
  engine: TransformEngine,
  _mode: ModelMode,
  getWorkspace: () => PoolWorkspace,
): Promise<HostTool[]> => {
  const dialect = dialectOf(engine);
  return [
    listTypesTool(dialect),
    poolLookupTool(engine, getWorkspace),
    notationHelpTool(dialect),
    await validateNotationTool(engine, getWorkspace),
  ];
};
