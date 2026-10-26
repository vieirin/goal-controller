/**
 * M6's agent context (goal-controller#415), composed: the notation's part
 * (goal-language's `notationHelpOf`, for the mode's dialect), the engine's
 * part (its registry entry's `agentContext`, or its dialect binding's in
 * lib) and the mode's guards' descriptions (`modeGuards.ts`, ui's own
 * guards). The root's part (the model's istar-ts metamodel) is no longer
 * composed here: `@istar-ts/actions`' own metamodel context provider is
 * prepended automatically, by every MCP session and `runAgent`/
 * `systemPromptWith` call that gets a model (istar-ts#240,
 * goal-controller#450). Nothing about a dialect or the notation is worked
 * out here: the system prompt's sections and the host tools read these
 * same objects.
 */
import type { HostContextProvider } from '@istar-ts/actions';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  notationHelpOf,
  notationHelpText,
  type NamedChecks,
  type NotationHelp,
} from '@goal-controller/goal-language';
import {
  engineContextText,
  type EngineContext,
  type PoolRegistration,
} from '@goal-controller/lib';
import { isEngineMode, type ModelMode } from '@/lib/workbench/pistar';
import {
  dialectOf,
  ENGINE_AGENT_CONTEXTS,
  ENGINE_CHECKS,
  ENGINE_POOLS,
  isDialectEngine,
} from '@/lib/workbench/engineDialects';
import {
  FRAMEWORK_AGENT_CONTEXTS,
  FRAMEWORK_DIALECTS,
  isFrameworkMode,
} from '@/lib/workbench/frameworkModes';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';

/** The three parts of a mode's context, each its owner's (the root's is the model's metamodel's). */
export type AgentContextParts = {
  /** goal-language's: what the mode's dialect's lines may say (none: no dialect) */
  notation: NotationHelp | null;
  /** the engine's (or its dialect binding's): its kinds, properties and constraints */
  engine: EngineContext | null;
  /** the mode's own guards, described */
  guards: readonly string[];
};

/** What a mode's agent works with: its parts, and its dialect, checks and pool for the host tools. */
export type AgentMode = AgentContextParts & {
  mode: ModelMode;
  dialect: AnyDialect | null;
  checks: NamedChecks;
  pool: PoolRegistration | null;
};

const dialectOfMode = (mode: ModelMode): AnyDialect | null =>
  isEngineMode(mode)
    ? dialectOf(mode)
    : isFrameworkMode(mode)
      ? FRAMEWORK_DIALECTS[mode]
      : null;

/** A mode's agent: an engine's, a framework's dialect's, or (piStar, piStar-ext) its guards only. */
export const agentModeOf = (mode: ModelMode): AgentMode => {
  const dialect = dialectOfMode(mode);
  return {
    mode,
    dialect,
    notation: dialect && notationHelpOf(dialect),
    engine: isEngineMode(mode)
      ? (ENGINE_AGENT_CONTEXTS[mode] ?? null)
      : isFrameworkMode(mode)
        ? FRAMEWORK_AGENT_CONTEXTS[mode]
        : null,
    guards: guardsForMode(mode).describe,
    checks:
      isEngineMode(mode) && isDialectEngine(mode) ? ENGINE_CHECKS[mode] : {},
    pool:
      isEngineMode(mode) && isDialectEngine(mode)
        ? (ENGINE_POOLS[mode] ?? null)
        : null,
  };
};

/**
 * The parts as `HostContextProvider`s, one system-prompt section each. The
 * root's part isn't one of these: the built-in metamodel context provider
 * (istar-ts#240) is prepended automatically, ahead of them, by every MCP
 * session and `runAgent`/`systemPromptWith` call. Every one of these sets
 * `resource: false`: `notation-help` is a host tool of the same name
 * (hostTools.ts), and server-mcp's default `dataMode: 'tools'` would
 * otherwise register a second tool of that name.
 */
export const contextProviders = (
  mode: ModelMode,
  { notation, engine, guards }: AgentContextParts,
): HostContextProvider[] => [
  ...(engine
    ? [
        {
          name: 'type-definitions',
          title: `${engine.dialect}: kinds, properties and constraints`,
          text: engineContextText(engine),
          resource: false,
        },
      ]
    : []),
  ...(notation
    ? [
        {
          name: 'notation-help',
          title: `${notation.dialect}: goal notation`,
          text: notationHelpText(notation),
          resource: false,
        },
      ]
    : []),
  ...(guards.length > 0
    ? [
        {
          name: 'engine-constraints',
          title: `${mode}'s own constraints`,
          text: guards.map((line) => `- ${line}`).join('\n'),
          resource: false,
        },
      ]
    : []),
];

/** A mode's context providers: its mode's parts, composed. */
export const contextProvidersFor = (mode: ModelMode): HostContextProvider[] =>
  contextProviders(mode, agentModeOf(mode));
