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
  DefinitionContext,
  OptionDefinition,
  ProjectResourceKindOf,
} from '@goal-controller/dialect';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  notationDocument,
  type Diagnostic,
} from '@goal-controller/goal-language';
import {
  goalView,
  type AnyModel,
  type KindEngineMapper,
} from '@goal-controller/goal-tree';
import {
  analysesProblems,
  type Analyses,
  type AnalysisModel,
} from './analysis';
import { engineContextOf, type EngineContext } from './agentContext';
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
type MapperOf = Partial<Pick<KindEngineMapper, 'allowLeafGoals'>>;

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
  /** how it reads a model for its analyses (the view of its `KindModel`, goal-controller#125) */
  analysisModel?: (model: AnyModel) => AnalysisModel;
  /** the files it writes, by id */
  outputs?: readonly EngineOutputDeclaration[];
  /** its generation options (`defineOptions`, goal-controller#118): none, no options menu */
  options?: readonly OptionDefinition[];
  /**
   * its part of an agent's context (goal-controller#415): by default
   * `engineContextOf(dialect)`, which `defineEngine` gives every engine with
   * a dialect; one that needs lines of its own passes
   * `engineContextOf(dialect, { constraints })`
   */
  agentContext?: EngineContext;
  /** the parsers of the project resources its dialect declares */
  projectResources?: Readonly<Record<string, unknown>>;
  /** its project's files share one definition pool (goal-controller#59) */
  pool?: PoolRegistration;
  /** its models declare its dialect's extension's kinds in their file (the `"metamodel"` block) */
  fileKinds?: true;
  /**
   * the properties (`goal.maxRetries`, `istar.ContributionLink.context`,
   * `actor.key`) whose value it reads as unset when the dialect reports an
   * error on it, on purpose: generation goes on for these (goal-controller#274)
   */
  intendedDefaults?: readonly string[];
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
    ...(engine.analyses && !engine.analysisModel
      ? ['analyses without an analysisModel']
      : []),
    ...(engine.analysisModel && !engine.analyses
      ? ['an analysisModel without analyses']
      : []),
    ...ids.flatMap((id, i) =>
      ids.indexOf(id) === i ? [] : [`output ${id} is declared twice`],
    ),
    ...(engine.fileKinds && !dialect?.extension
      ? ['fileKinds without an extension (its dialect declares none)']
      : []),
    ...(engine.intendedDefaults ?? []).flatMap((where) =>
      dialect && declaredProperties(dialect).has(where)
        ? []
        : [`intendedDefaults names ${where}, not a property of its dialect`],
    ),
  ];
};

/** Every property a dialect declares, with its owner (`goal.maxRetries`). */
const declaredProperties = (dialect: AnyDialect): Set<string> => {
  const lists: [string, readonly { key: string }[]][] = [
    ...Object.entries(dialect.properties),
    ...Object.entries(dialect.links ?? {}),
    ['actor', dialect.actors ?? []],
  ];
  return new Set(
    lists.flatMap(([owner, list]) => list.map(({ key }) => `${owner}.${key}`)),
  );
};

/**
 * Type-checks and freezes an engine, and checks what the types cannot: every
 * check its dialect's properties name is in its checks, it parses exactly
 * the project resources its dialect declares, its analyses read only those,
 * and it declares each output id once. An engine with a dialect gets its
 * agent context (`engineContextOf`), unless it gives its own.
 */
export const defineEngine = <const E extends EngineDefinition>(
  engine: E & Requirements<E>,
): Readonly<E & { agentContext?: EngineContext }> => {
  const [problem] = engineProblems(engine);
  if (problem) throw new Error(`${engine.id}: ${problem}`);
  const agentContext =
    engine.agentContext ??
    (engine.dialect ? engineContextOf(engine.dialect) : undefined);
  return Object.freeze({
    ...engine,
    ...(agentContext && { agentContext }),
  });
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

/** What the gate refuses on: a dialect error on a property, where it is. */
export type PropertyError = Diagnostic & { key: string };

/**
 * The errors the dialect reports on the properties an engine reads
 * (goal-controller#274), as the Problems panel shows them: the model's
 * Notation document read in the engine's dialect, its named checks run with
 * the model in scope. A value the dialect can't read is unset in `props`, so
 * an engine would generate as if it weren't written. Warnings, and the
 * properties it lists in `intendedDefaults`, are not errors here; an engine
 * without a dialect, or of another framework (whose models the panel reads
 * through the framework's own checks), has none.
 */
export const propertyErrors = (
  engine: Engine,
  model: AnyModel,
  /** the project's resources, parsed: checks that read them (a MutRoSe world) run */
  projectResources?: DefinitionContext['projectResources'],
): PropertyError[] => {
  const { dialect, checks = {} } = engine;
  if (!dialect || (dialect.framework ?? 'istar-2.0') !== 'istar-2.0') return [];
  const tree = goalView(model, dialect);
  const context: DefinitionContext = {
    ...contextFromView(dialect, tree, []),
    ...(projectResources &&
      Object.keys(projectResources).length > 0 && { projectResources }),
  };
  const intended = new Set(engine.intendedDefaults ?? []);
  // a link's or an actor's diagnostic: its owner is any link kind, or `actor`
  const ownersOf = (elementId: string | undefined): string[] => {
    const kind = elementId ? context.elements[elementId]?.kind : undefined;
    return kind !== undefined
      ? [kind]
      : [...Object.keys(dialect.links ?? {}), 'actor'];
  };
  return documentDiagnostics(
    dialect,
    notationDocument(dialect, tree).text,
    context,
    {
      runCheck: (name, input, self) =>
        checks[name]?.(input, checkContextOf(context, self)) ?? null,
    },
  ).filter(
    (diagnostic): diagnostic is PropertyError =>
      diagnostic.severity === 'error' &&
      diagnostic.key !== undefined &&
      !ownersOf(diagnostic.elementId).some((owner) =>
        intended.has(`${owner}.${diagnostic.key}`),
      ),
  );
};

/** An error as one line: `G3 maxRetries: …`. */
const errorLine = ({ elementId, key, message }: PropertyError): string =>
  `${elementId ? `${elementId} ` : ''}${key}: ${message}`;

/**
 * Refuses to generate from a model with an error on a property the engine
 * reads (goal-controller#274, `propertyErrors`): throws, naming the first
 * (its element as `(node G3)`, as Problems marks it) and listing every one.
 */
export const refuseOnPropertyErrors = (
  engine: Engine,
  model: AnyModel,
  projectResources?: DefinitionContext['projectResources'],
): void => {
  const errors = propertyErrors(engine, model, projectResources);
  const [first] = errors;
  if (!first) return;
  const more =
    errors.length > 1 ? ` (and ${errors.length - 1} more, in Problems)` : '';
  throw new Error(
    [
      `${engineLabel(engine)} does not generate from a model with an error on a property it reads: ${errorLine(first)}${first.elementId ? ` (node ${first.elementId})` : ''}${more}`,
      ...errors.map((error) => `- ${errorLine(error)}`),
    ].join('\n'),
  );
};
