/**
 * The engines the workbench is built from (each one object, defined with
 * `defineEngine` beside its engine in @goal-controller/lib), in the order
 * the UI offers them: the one place an engine is registered. Every map
 * below is derived from it.
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
  kaospropEngine,
  kaosexpertEngine,
  kaosresEngine,
  mutroseEngine,
  nfrpropEngine,
  registerEngines,
  sleecEngine,
  type Analyses,
  type AnalysisModel,
  type AnyModel,
  type Check,
  type Engine,
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
import type { TransformEngine } from '@/lib/types';

export const ENGINE_LIST = registerEngines(
  edgeV2Engine,
  edgeEngine,
  sleecEngine,
  mutroseEngine,
  godaEngine,
  grlEngine,
  istardtEngine,
  tropos4asEngine,
  cgmEngine,
  // the frameworks' (goal-controller#171): offered under KAOS and NFR
  kaosdocEngine,
  kaospropEngine,
  kaosexpertEngine,
  kaosresEngine,
  nfrpropEngine,
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

/** Every registered id is a TransformEngine, and every TransformEngine is registered. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const registersEveryEngine: Same<Registered['id'], TransformEngine> = true;
void registersEveryEngine;

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
  ENGINE_DIALECTS[isDialectEngine(engine) ? engine : 'edge'];

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
