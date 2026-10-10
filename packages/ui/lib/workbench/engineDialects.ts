/**
 * The engines' definitions the workbench is built from (written with
 * @goal-controller/dialect, kept with their engines in @goal-controller/lib),
 * by workbench engine id: the one place an engine's definition is picked.
 */
import {
  edge,
  edgeCheckRegistry,
  edgeEngineMapper,
  edgeProjectResources,
  edgeV2,
  edgeV2EngineMapper,
  goda,
  godaCheckRegistry,
  godaEngineMapper,
  mutrose,
  mutroseCheckRegistry,
  mutroseEngineMapper,
  mutroseProjectResources,
  sleecEngineMapper,
  type Check,
  type ProjectResourceParsers,
} from '@goal-controller/lib';
import type { CheckNameOf } from '@goal-controller/dialect';
import type { TransformEngine } from '@/lib/types';

export const ENGINE_DIALECTS = {
  edge,
  edgev2: edgeV2,
  mutrose,
  goda,
} as const;

export type DialectEngine = keyof typeof ENGINE_DIALECTS;

/** An engine's checks, by the names its definition gives them (none missing). */
export type ChecksOf<E extends DialectEngine> = Readonly<
  Record<CheckNameOf<(typeof ENGINE_DIALECTS)[E]>, Check>
>;

/**
 * The engine library's checks each definition names, by name. Typed per
 * engine, so a registry that lacks a check its definition names doesn't
 * compile, and `ENGINE_CHECKS[engine]` goes with `ENGINE_DIALECTS[engine]`.
 */
export const ENGINE_CHECKS: { readonly [E in DialectEngine]: ChecksOf<E> } = {
  edge: edgeCheckRegistry,
  edgev2: edgeCheckRegistry,
  mutrose: mutroseCheckRegistry,
  goda: godaCheckRegistry,
};

/**
 * The engine library's parsers for the project resources each definition
 * declares (goal-controller#25), typed like ENGINE_CHECKS: none missing.
 */
export const ENGINE_PROJECT_RESOURCES: {
  readonly [E in DialectEngine]: ProjectResourceParsers<
    (typeof ENGINE_DIALECTS)[E]
  >;
} = {
  edge: edgeProjectResources,
  edgev2: edgeProjectResources,
  mutrose: mutroseProjectResources,
  // it reads nothing beside the model
  goda: {},
};

/** Each engine's mapper: how goal-tree reads a model for it (what it rejects, too). */
export const ENGINE_MAPPERS = {
  edge: edgeEngineMapper,
  edgev2: edgeV2EngineMapper,
  sleec: sleecEngineMapper,
  mutrose: mutroseEngineMapper,
  goda: godaEngineMapper,
} as const satisfies Record<TransformEngine, { allowLeafGoals?: boolean }>;

/** Each engine's name, as the UI shows it: a definition's own, or SLEEC's. */
export const ENGINE_LABEL: Record<TransformEngine, string> = {
  edge: edge.name,
  edgev2: edgeV2.name,
  sleec: 'SLEEC',
  mutrose: mutrose.name,
  goda: goda.name,
};

/** How an output is highlighted: PRISM, MutRoSe's runtime annotation, or plain. */
export type OutputLanguage = 'prism' | 'rannot' | 'text';

type EngineInfo = {
  id: TransformEngine;
  label: string;
  /** what it generates, and the extension of that file (`output.prism`) */
  output: string;
  extension: string;
  language: OutputLanguage;
  help: string;
  /** whether it takes generation options (MutRoSe reads the model as written) */
  hasOptions: boolean;
};

/** The engines a model can be for, in the order the UI offers them, with what each generates. */
export const ENGINES: readonly EngineInfo[] = [
  {
    id: 'edgev2',
    label: ENGINE_LABEL.edgev2,
    output: 'PRISM',
    extension: 'prism',
    language: 'prism',
    help: 'EDGE reference encoding, with cost and utility rewards',
    hasOptions: true,
  },
  {
    id: 'edge',
    label: ENGINE_LABEL.edge,
    output: 'PRISM',
    extension: 'prism',
    language: 'prism',
    help: 'Legacy Edge encoding',
    hasOptions: true,
  },
  {
    id: 'sleec',
    label: ENGINE_LABEL.sleec,
    output: 'SLEEC',
    extension: 'sleec',
    language: 'text',
    help: 'SLEEC rules from the goal conditions',
    hasOptions: true,
  },
  {
    id: 'mutrose',
    label: ENGINE_LABEL.mutrose,
    // the runtime annotation its decomposer prints with -v
    output: 'Runtime annotation',
    extension: 'rannot',
    language: 'rannot',
    help: "The runtime annotation MutRoSe's decomposer reads, after checking the model as it does",
    hasOptions: false,
  },
  {
    id: 'goda',
    label: ENGINE_LABEL.goda,
    // the actor's MDP; its PCTL properties and parametric formulas are its other files
    output: 'PRISM MDP',
    extension: 'nm',
    language: 'prism',
    help: 'GODA-MDP: the PRISM MDP, its properties and its parametric reliability and cost formulas',
    hasOptions: false,
  },
];

const infoOf = (engine: TransformEngine): EngineInfo =>
  ENGINES.find((info) => info.id === engine)!;
/** What an engine generates: `PRISM`. */
export const outputLabelOf = (engine: TransformEngine): string =>
  infoOf(engine).output;
/** How an engine's output is highlighted. */
export const outputLanguageOf = (engine: TransformEngine): OutputLanguage =>
  infoOf(engine).language;
/** Whether an engine takes generation options. */
export const hasOptions = (engine: TransformEngine): boolean =>
  infoOf(engine).hasOptions;
/** The extension of what an engine generates: `prism`. */
export const outputExtensionOf = (engine: TransformEngine): string =>
  infoOf(engine).extension;

export const isDialectEngine = (
  engine: TransformEngine,
): engine is DialectEngine => engine in ENGINE_DIALECTS;

/**
 * The definition whose notation an engine's view shows: SLEEC has none of its own
 * and its view reads goal texts in Edge's dialect (services/tree.ts).
 */
export const notationDefinitionOf = (engine: TransformEngine) =>
  ENGINE_DIALECTS[isDialectEngine(engine) ? engine : 'edge'];
