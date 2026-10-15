/**
 * One object per engine (goal-controller#124): its dialect, the checks its
 * properties name, its mapper, what it makes (a file, or analyses drawn on
 * the model), its project resources' parsers, its pool and its kinds, as the
 * workbench registers it. `defineEngine` checks at definition time what the
 * types cannot; `registerEngines` lists them, each id once.
 */
import type {
  AnyDialect,
  CheckNameOf,
  ExtensionDefinition,
  ProjectResourceKindOf,
} from '@goal-controller/dialect';
import type { EngineMapper } from '@goal-controller/goal-tree';
import { analysesProblems, type Analyses } from './analysis';
import type { Check } from './checks';
import type { PoolRegistration } from './definitionPool';
import type { ProjectResourceParsers } from './projectResources';

/** How an engine's output is highlighted: PRISM, MutRoSe's runtime annotation, or plain. */
export type OutputLanguage = 'prism' | 'rannot' | 'text';

/** What an engine generates: `PRISM`, its file's extension (`prism`) and highlighting. */
export type EngineOutputInfo = {
  label: string;
  extension: string;
  language: OutputLanguage;
};

/** A file an engine writes, by the id its output gives it (`model`, `reliability`). */
export type EngineOutputDeclaration = { id: string; language?: string };

/** What the workbench reads of an engine's mapper. */
type MapperOf = Pick<
  EngineMapper<never, never>,
  'allowLeafGoals' | 'allowedGoalKeys' | 'allowedTaskKeys'
>;

/** An engine, as `defineEngine` takes it. */
export type EngineDefinition = {
  /** the workbench's id: `edgev2`, `goda` */
  id: string;
  /** shown to people (default: its dialect's name) */
  label?: string;
  /** what it is, in the engine menu */
  help: string;
  /** the definition its editors read (none: SLEEC) */
  dialect?: AnyDialect;
  /** the checks its dialect's properties name, by name */
  checks?: Readonly<Record<string, Check>>;
  /** how goal-tree reads a model for it (what it rejects, too) */
  mapper: MapperOf;
  output: EngineOutputInfo;
  /** an analysis engine's analyses: its values are drawn on the model, no file */
  analyses?: Analyses;
  /** the files it writes, by id */
  outputs?: readonly EngineOutputDeclaration[];
  /**
   * whether it takes generation options (the workbench's options menu);
   * goal-controller#118's declared options, once they are in
   */
  options?: true | Readonly<Record<string, unknown>>;
  /** the parsers of the project resources its dialect declares */
  projectResources?: Readonly<Record<string, unknown>>;
  /** its project's files share one definition pool (goal-controller#59) */
  pool?: PoolRegistration;
  /** the kinds it adds to iStar 2.0 */
  extension?: ExtensionDefinition;
  /** its models declare `extension`'s kinds in their file (the `"metamodel"` block) */
  fileKinds?: true;
};

/**
 * What an engine with a dialect must give: the checks its properties name,
 * none missing, and a parser per project resource it declares.
 */
type Requirements<E> = E extends { dialect: infer D extends AnyDialect }
  ? ([CheckNameOf<D>] extends [never]
      ? { checks?: Readonly<Record<string, Check>> }
      : { checks: Readonly<Record<CheckNameOf<D>, Check>> }) &
      ([ProjectResourceKindOf<D>] extends [never]
        ? { projectResources?: Readonly<Record<string, never>> }
        : { projectResources: ProjectResourceParsers<D> })
  : { checks?: undefined; projectResources?: undefined };

/** The check names a dialect's properties give, with where (`goal.maintain`). */
const namedChecks = (dialect: AnyDialect): [string, string][] => {
  const lists: [string, readonly { key: string; check?: string }[]][] = [
    ...Object.entries(dialect.properties),
    ...Object.entries(dialect.links ?? {}),
    ['actor', dialect.actors ?? []],
  ];
  return lists.flatMap(([owner, list]) =>
    list.flatMap(({ key, check }) =>
      check === undefined
        ? []
        : [[`${owner}.${key}`, check] as [string, string]],
    ),
  );
};

/** What is wrong with an engine that its types don't say. */
const engineProblems = (engine: EngineDefinition): string[] => {
  const { dialect, checks = {}, projectResources = {} } = engine;
  const declared = Object.keys(dialect?.projectResources ?? {});
  const parsed = Object.keys(projectResources);
  const ids = (engine.outputs ?? []).map((output) => output.id);
  return [
    ...(!dialect && engine.checks ? ['checks without a dialect'] : []),
    ...(!dialect && engine.projectResources
      ? ['project resource parsers without a dialect']
      : []),
    ...(dialect ? namedChecks(dialect) : []).flatMap(([where, check]) =>
      check in checks
        ? []
        : [`${where} names check ${check}, not in its checks`],
    ),
    ...declared.flatMap((kind) =>
      parsed.includes(kind) ? [] : [`project resource ${kind} has no parser`],
    ),
    ...parsed.flatMap((kind) =>
      declared.includes(kind)
        ? []
        : [`a parser for unknown project resource ${kind}`],
    ),
    ...(engine.analyses ? analysesProblems(dialect, engine.analyses) : []),
    ...ids.flatMap((id, i) =>
      ids.indexOf(id) === i ? [] : [`output ${id} is declared twice`],
    ),
    ...(engine.fileKinds && !engine.extension
      ? ['fileKinds without an extension (its kinds)']
      : []),
  ];
};

/**
 * Type-checks and freezes an engine, and checks what the types cannot: every
 * check its dialect's properties name is in its checks, it parses exactly
 * the project resources its dialect declares, its analyses read only those,
 * and it declares each output id once.
 */
export const defineEngine = <const E extends EngineDefinition>(
  engine: E & Requirements<E>,
): Readonly<E> => {
  const [problem] = engineProblems(engine);
  if (problem) throw new Error(`${engine.id}: ${problem}`);
  return Object.freeze(engine);
};

/** An engine `defineEngine` made. */
export type Engine = Readonly<EngineDefinition>;

/** An engine's name, as people see it: its own label, or its dialect's name. */
export const engineLabel = (engine: Engine): string =>
  engine.label ?? engine.dialect?.name ?? engine.id;

/** The engines a workbench offers, in its order: each id once. */
export const registerEngines = <const L extends readonly Engine[]>(
  ...engines: L
): L => {
  const ids = engines.map((engine) => engine.id);
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i)
      throw new Error(`engine ${id} is registered twice`);
  });
  return Object.freeze(engines) as L;
};
