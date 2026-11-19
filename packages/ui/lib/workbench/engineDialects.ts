/**
 * The engines the workbench is built from, in the order the UI offers them:
 * the one place an engine is registered. Each is its lib engine object
 * (`defineEngine`, beside its engine in @goal-controller/lib: what it reads,
 * generates and analyses) with what only the workbench knows of it (its
 * `EngineView`: palette, conversion, examples, editing rules),
 * every part of which has a default. Every map below, `TransformEngine`
 * (lib/types.ts), the diagrams and inspectors (engines/engineViews.tsx), the
 * services' dispatch, the examples' folders and the modes' rules are derived
 * from it.
 *
 * Data only: a palette is referenced by a lazy import, loaded on the client
 * (engines/engineViews.tsx), so the workers and services that read this
 * module never load React. A lazy import must not reach the workbench's
 * context (WorkbenchContext.tsx, which starts the workers that read this
 * module): Turbopack's dev compile hangs on that cycle; an engine's inspector is
 * therefore not registered here but follows from its dialect.
 */
import {
  edgeEngine,
  edgeV2Engine,
  engineLabel,
  godaEngine,
  grlEngine,
  istardtEngine,
  tropos4asEngine,
  cgmEngine,
  kaosdocEngine,
  kaosltsEngine,
  kaospropEngine,
  kaosexpertEngine,
  kaosresEngine,
  kaossimEngine,
  mutroseEngine,
  nfrpropEngine,
  registerEngines,
  runOf,
  sleecEngine,
  type Analyses,
  type AnalysisModel,
  type AnyModel,
  type Check,
  type Engine,
  type EngineContext,
  type OutputLanguage,
  type PoolRegistration,
  type ProjectResourceParsers,
} from '@goal-controller/lib';
import type {
  AnyDialect,
  CheckNameOf,
  ExtensionDefinition,
  OptionDefinition,
} from '@goal-controller/dialect';
import type { ActionGuard, ActionPostGuard } from '@istar-ts/actions';
import type { IstarExtension } from '@istar-ts/react';
import type { TransformEngine } from '@/lib/types';
import { oneActorOnly, resourceBoundsGuard } from './guards';

/**
 * What only the workbench knows of an engine, beside its lib object. Every
 * field has a default, so an engine with nothing special gives none: its
 * diagram is the whole iStar palette, a model converted to it may have what
 * its metamodel has, and its examples are `examples/<id>/`. (Its inspector
 * follows from its dialect, engines/engineViews.tsx.)
 */
export type EngineView = {
  /**
   * the extensions its canvas adds (its palette, numbering, drawing), a
   * module whose default export they are, loaded on the client; the same in
   * piStar mode's toggle (none: the whole iStar palette, nothing taken out)
   */
  palette?: () => Promise<{ default: readonly IstarExtension[] }>;
  /** piStar mode's toggle offers nothing for it (SLEEC reads the whole iStar palette) */
  noPistarPalette?: true;
  /**
   * what a model converted to it may have, which conversion lists and checks
   * (one actor); `typesResources`: a resource without a type becomes a
   * Boolean one (default: the kinds its metamodel has)
   */
  converts?: {
    elements: readonly string[];
    links: readonly string[];
    typesResources?: true;
  };
  /** how conversion's messages name it with the engines that read models as it does: 'the Edge engines' (they read) */
  group?: string;
  /** its examples' folder, `examples/<folder>/` (default: its id) */
  examples?: string;
  /** its own editing rules (lib/workbench/modeGuards.ts), with one sentence per rule for the agent */
  rules?: {
    guards?: readonly ActionGuard<string, string>[];
    postGuards?: readonly ActionPostGuard<string, string>[];
    describe: readonly string[];
  };
};

/** An engine as the workbench registers it: its lib object and its view. */
const workbench = <const E extends Engine>(
  engine: E,
  view: EngineView = {},
): Readonly<E & { view: EngineView }> => Object.freeze({ ...engine, view });

/** What the Edge engines share: one actor's goals, tasks and resources, named after their RT ids. */
const EDGE_ACTOR =
  'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.';
const edgeView = (
  rules: EngineView['rules'] = { describe: [] },
): EngineView => ({
  palette: () => import('@/components/workbench/engines/edgeFamily/palette'),
  converts: {
    elements: ['istar.Actor', 'istar.Goal', 'istar.Task', 'istar.Resource'],
    links: [
      'istar.AndRefinementLink',
      'istar.OrRefinementLink',
      'istar.NeededByLink',
    ],
    typesResources: true,
  },
  group: 'the Edge engines',
  rules: {
    postGuards: [oneActorOnly(EDGE_ACTOR), ...(rules.postGuards ?? [])],
    describe: [EDGE_ACTOR, ...rules.describe],
  },
});

const MUTROSE_ACTOR =
  'MutRoSe reads a single actor (its mission): add goals and tasks inside the existing one.';

export const ENGINE_LIST = registerEngines(
  workbench(edgeV2Engine, {
    ...edgeView({
      postGuards: [resourceBoundsGuard(edgeV2Engine.id)],
      describe: [
        "A resource's bounds must stay consistent: an int resource needs lowerBound <= initialValue <= upperBound, and a bool resource's initialValue must be true or false.",
      ],
    }),
    examples: 'edgeV2',
  }),
  workbench(edgeEngine, edgeView()),
  workbench(sleecEngine, {
    palette: () => import('@/components/workbench/engines/sleec/palette'),
    noPistarPalette: true,
  }),
  workbench(mutroseEngine, {
    palette: () => import('@/components/workbench/engines/mutrose/palette'),
    // the decomposer reads one actor's goals and tasks, refined by AND/OR links
    converts: {
      elements: ['istar.Actor', 'istar.Goal', 'istar.Task'],
      links: ['istar.AndRefinementLink', 'istar.OrRefinementLink'],
    },
    rules: {
      postGuards: [oneActorOnly(MUTROSE_ACTOR)],
      describe: [MUTROSE_ACTOR],
    },
  }),
  workbench(godaEngine, {
    palette: () => import('@/components/workbench/engines/goda/palette'),
    // goals, tasks and resources (read and left out), refined by AND/OR links
    converts: {
      elements: ['istar.Actor', 'istar.Goal', 'istar.Task', 'istar.Resource'],
      links: ['istar.AndRefinementLink', 'istar.OrRefinementLink'],
    },
  }),
  workbench(grlEngine),
  workbench(istardtEngine, {
    palette: () => import('@/components/workbench/engines/istardt/palette'),
  }),
  workbench(tropos4asEngine),
  workbench(cgmEngine),
  // the frameworks' (goal-controller#171): offered under KAOS and NFR
  workbench(kaosdocEngine),
  workbench(kaosltsEngine),
  workbench(kaospropEngine),
  workbench(kaosexpertEngine),
  workbench(kaosresEngine),
  workbench(kaossimEngine),
  workbench(nfrpropEngine),
);

type Registered = (typeof ENGINE_LIST)[number];
/**
 * An engine of a framework besides iStar 2.0 (goal-controller#171: KAOS's
 * kaosdoc, NFR's nfrprop): its dialect is its framework's, which has no
 * iStar kinds and no notation, so none of the iStar dialects' editors
 * (their Notation view, inspector and lines) read it.
 */
type OfFramework = Extract<
  Registered,
  { dialect: { framework: 'kaos' | 'nfr' } }
>;
type WithDialect = Exclude<
  Extract<Registered, { dialect: AnyDialect }>,
  OfFramework
>;
const ofFramework = (dialect?: AnyDialect): boolean =>
  (dialect?.framework ?? 'istar-2.0') !== 'istar-2.0';

/** The registered engines' ids, in their order. */
export const ENGINE_IDS: readonly TransformEngine[] = ENGINE_LIST.map(
  ({ id }) => id,
);

/** Whether a value names a registered engine. */
export const isTransformEngine = (value: unknown): value is TransformEngine =>
  typeof value === 'string' &&
  (ENGINE_IDS as readonly string[]).includes(value);

/** The engine a model is for when nothing says which: the first the UI offers. */
export const DEFAULT_ENGINE: TransformEngine = ENGINE_IDS[0]!;

/** `pick` of each registered engine that has one, by engine id. */
const byEngine = <T>(pick: (engine: Engine) => T | undefined) =>
  Object.fromEntries(
    ENGINE_LIST.flatMap((engine) => {
      const value = pick(engine);
      return value === undefined ? [] : [[engine.id, value]];
    }),
  );

/** The iStar engines' dialects, by engine. */
export const ENGINE_DIALECTS = byEngine((engine) =>
  ofFramework(engine.dialect) ? undefined : engine.dialect,
) as {
  readonly [E in WithDialect as E['id']]: E['dialect'];
};

export type DialectEngine = keyof typeof ENGINE_DIALECTS;

/** The dialects of the other frameworks' engines (goal-controller#171), by engine. */
export const FRAMEWORK_ENGINE_DIALECTS = byEngine((engine) =>
  ofFramework(engine.dialect) ? engine.dialect : undefined,
) as {
  readonly [E in OfFramework as E['id']]: E['dialect'];
};

export type FrameworkEngine = keyof typeof FRAMEWORK_ENGINE_DIALECTS;

export const isFrameworkEngine = (engine: unknown): engine is FrameworkEngine =>
  typeof engine === 'string' && engine in FRAMEWORK_ENGINE_DIALECTS;

/** An engine's checks, by the names its definition gives them (none missing). */
export type ChecksOf<E extends DialectEngine> = Readonly<
  Record<CheckNameOf<(typeof ENGINE_DIALECTS)[E]>, Check>
>;

/**
 * The engine library's checks each definition names, by name. Typed per
 * engine (defineEngine doesn't compile an engine whose checks lack one its
 * definition names), so `ENGINE_CHECKS[engine]` goes with
 * `ENGINE_DIALECTS[engine]`.
 */
export const ENGINE_CHECKS = byEngine((engine) =>
  engine.dialect && !ofFramework(engine.dialect)
    ? (engine.checks ?? {})
    : undefined,
) as { readonly [E in DialectEngine]: ChecksOf<E> };

/**
 * The engine library's parsers for the project resources each definition
 * declares (goal-controller#25), typed like ENGINE_CHECKS: none missing (an
 * engine that reads nothing beside the model has none).
 */
export const ENGINE_PROJECT_RESOURCES = byEngine((engine) =>
  engine.dialect && !ofFramework(engine.dialect)
    ? (engine.projectResources ?? {})
    : undefined,
) as {
  readonly [E in DialectEngine]: ProjectResourceParsers<
    (typeof ENGINE_DIALECTS)[E]
  >;
};

/**
 * The other frameworks' engines' parsers for their project resources
 * (goal-controller#334): `ENGINE_PROJECT_RESOURCES`'s counterpart, since a
 * framework engine's dialect is kept out of `ENGINE_DIALECTS`
 * (`FRAMEWORK_ENGINE_DIALECTS` instead), but may still declare resources of
 * its own (nfrprop's `strategies`, goal-controller#328).
 */
export const FRAMEWORK_ENGINE_PROJECT_RESOURCES = byEngine((engine) =>
  engine.dialect && ofFramework(engine.dialect)
    ? (engine.projectResources ?? {})
    : undefined,
) as {
  readonly [E in FrameworkEngine]: ProjectResourceParsers<
    (typeof FRAMEWORK_ENGINE_DIALECTS)[E]
  >;
};

/**
 * The engines whose project's files share one definition pool
 * (goal-controller#59): its providers and the checks across them.
 */
export const ENGINE_POOLS: Partial<Record<DialectEngine, PoolRegistration>> =
  byEngine((engine) => engine.pool);

/** Each engine's mapper: how goal-tree reads a model for it (what it rejects, too). */
export const ENGINE_MAPPERS = byEngine((engine) => engine.mapper) as {
  readonly [E in Registered as E['id']]: E['mapper'];
};

/**
 * Each engine's generation options, as it declares them, typed as
 * properties are (goal-controller#118): the options menu, the defaults and
 * a manifest's check are these. MutRoSe reads the model as written and GRL
 * generates nothing: they declare none.
 */
export const ENGINE_OPTIONS = Object.fromEntries(
  ENGINE_LIST.map((engine: Engine) => [engine.id, engine.options ?? []]),
) as {
  readonly [E in Registered as E['id']]: E extends {
    options: infer O extends readonly OptionDefinition[];
  }
    ? O
    : readonly [];
};

/**
 * Each engine's part of an agent's context (goal-controller#415), as it
 * declares it beside its options: one with a dialect has one (SLEEC none).
 */
export const ENGINE_AGENT_CONTEXTS: Readonly<
  Partial<Record<TransformEngine, EngineContext>>
> = byEngine((engine) => engine.agentContext);

/** Each engine's name, as the UI shows it: its own label, or its definition's name. */
export const ENGINE_LABEL: Record<TransformEngine, string> = byEngine(
  engineLabel,
) as Record<TransformEngine, string>;

/** How an output is highlighted: PRISM, MutRoSe's runtime annotation, or plain. */
export type { OutputLanguage };

type EngineInfo = {
  id: TransformEngine;
  label: string;
  /** what it generates, and the extension of that file (`output.prism`) */
  output: string;
  extension: string;
  language: OutputLanguage;
  help: string;
  /** false: it generates no file, its values are the Analyse control's (an analysis engine) */
  generates?: false;
};

/** The engines a model can be for, in the order the UI offers them, with what each generates. */
export const ENGINES: readonly EngineInfo[] = ENGINE_LIST.map(
  (engine: Engine): EngineInfo => ({
    id: engine.id as TransformEngine,
    label: engineLabel(engine),
    output: engine.output.label,
    extension: engine.output.extension,
    language: engine.output.language,
    help: engine.help,
    ...(engine.analyses && { generates: false as const }),
  }),
);

/** A registered engine's object, by id. */
export const engineOf = (engine: TransformEngine): Engine =>
  ENGINE_LIST.find(({ id }) => id === engine)!;

/**
 * Whether an engine's output leaves variables open (the Edge engines' PRISM
 * constants): the workbench lists them and asks for their values.
 */
export const isPrismEngine = (engine: TransformEngine): boolean =>
  runOf(engineOf(engine)).variables !== undefined;

const infoOf = (engine: TransformEngine): EngineInfo =>
  ENGINES.find((info) => info.id === engine)!;
/** What an engine generates: `PRISM`. */
export const outputLabelOf = (engine: TransformEngine): string =>
  infoOf(engine).output;
/** How an engine's output is highlighted. */
export const outputLanguageOf = (engine: TransformEngine): OutputLanguage =>
  infoOf(engine).language;
/** Whether an engine generates files (an analysis engine draws values instead). */
export const generatesFiles = (engine: TransformEngine): boolean =>
  infoOf(engine).generates !== false;
/** Whether an engine takes a generation option (`reduce`). */
export const takesOption = (engine: TransformEngine, key: string): boolean =>
  ENGINE_OPTIONS[engine].some((option) => option.key === key);
/** Whether an engine takes generation options. */
export const hasOptions = (engine: TransformEngine): boolean =>
  ENGINE_OPTIONS[engine].length > 0;
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
  ENGINE_DIALECTS[isDialectEngine(engine) ? engine : edgeEngine.id];

/** An engine's own dialect, when it has one (none: SLEEC), a framework engine's too. */
export const dialectOf = (engine: TransformEngine): AnyDialect | null =>
  isDialectEngine(engine)
    ? ENGINE_DIALECTS[engine]
    : isFrameworkEngine(engine)
      ? FRAMEWORK_ENGINE_DIALECTS[engine]
      : null;

/** An analysis engine's analyses, by id, and how it reads a model for them (the view of its `KindModel`, goal-controller#125). */
export type AnalysisEngine = {
  analyses: Analyses;
  model: (model: AnyModel) => AnalysisModel;
};

/**
 * An engine's analyses (goal-controller#107): its values drawn on the model,
 * not a file, by id. An engine without any has no Analyse control.
 */
export const ENGINE_ANALYSES: Readonly<
  Partial<Record<TransformEngine, AnalysisEngine>>
> = byEngine(({ analyses, analysisModel }) =>
  analyses && analysisModel ? { analyses, model: analysisModel } : undefined,
);

/**
 * The engines whose models declare kinds of their own, in their file's
 * `"metamodel"` block (written by the engine's importer: GRL's indicators
 * and beliefs, #106), by the extension that defines them. Such a model is
 * read with its block applied; the other engines read iStar 2.0 only.
 */
export const ENGINE_FILE_KINDS: Readonly<
  Partial<Record<TransformEngine, ExtensionDefinition>>
> = byEngine((engine) =>
  engine.fileKinds ? engine.dialect?.extension : undefined,
);

/** What only the workbench knows of an engine (its registration's view). */
export const viewOf = (engine: TransformEngine): EngineView =>
  ENGINE_LIST.find(({ id }) => id === engine)!.view;

/**
 * Whether piStar mode's toggle offers an engine's palette for a file recorded
 * for it: an iStar engine's (its own, or the whole iStar palette), unless it
 * says otherwise (SLEEC); a framework's engine has none (goal-controller#171).
 */
export const hasPistarPalette = (engine: TransformEngine): boolean =>
  !isFrameworkEngine(engine) && !viewOf(engine).noPistarPalette;

/** Each engine's own editing rules, by engine (lib/workbench/modeGuards.ts). */
export const ENGINE_RULES: Readonly<
  Partial<Record<TransformEngine, NonNullable<EngineView['rules']>>>
> = byEngine((engine) => (engine as Registered).view.rules);

/** examples/<folder>/: the engine its models are for, by folder. */
export const ENGINE_EXAMPLES: Readonly<Record<string, TransformEngine>> =
  Object.fromEntries(
    ENGINE_LIST.map(({ id, view }) => [view.examples ?? id, id]),
  );
