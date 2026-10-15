/**
 * Analysis engines (goal-controller#107): an engine whose output is a value
 * per element and actor, drawn on the model, not a file. An engine declares
 * its analyses by id; each runs on the model (as `AnalysisModel`, a view of
 * its `GoalModel`: its actors, elements and links with their properties) and,
 * when it reads one, a
 * project resource. A result has one or more cases (one evaluation each: a
 * strategy, a scenario; a single-case analysis has one), each a value per
 * element or actor id. Nothing here names an engine.
 */
import type { AnyDialect } from '@goal-controller/dialect';
import type { GoalModel } from '@goal-controller/goal-tree';

/** A value on an element or actor: a number or a word, its label, how to show it. */
export type AnalysisValue = {
  value: number | string;
  /** shown instead of the value (`Satisfied`, `75`) */
  label?: string;
  severity?: 'info' | 'warning';
};

/** One evaluation: its values by element or actor id (the piStar ids). */
export type AnalysisCase = {
  id: string;
  label: string;
  values: Readonly<Record<string, AnalysisValue>>;
};

export type AnalysisResult = { cases: readonly AnalysisCase[] };

/** An element, link or actor as an analysis reads it: its kind and its properties. */
export type AnalysisActor = {
  id: string;
  kind: string;
  name: string;
  properties: Readonly<Record<string, string>>;
  /** its elements' ids */
  elements: readonly string[];
};
export type AnalysisElement = {
  id: string;
  kind: string;
  name: string;
  properties: Readonly<Record<string, string>>;
  /** the actor it is in (none: outside every actor, a dependum) */
  actor?: string;
};
export type AnalysisLink = {
  id: string;
  kind: string;
  source: string;
  target: string;
  /** iStar's contribution value (`make`, `help`, `hurt`, `break`), when it has one */
  label?: string;
  properties: Readonly<Record<string, string>>;
};

/** The model as analyses read it: every actor, element and link, in the file's order. */
export type AnalysisModel = {
  actors: readonly AnalysisActor[];
  elements: readonly AnalysisElement[];
  links: readonly AnalysisLink[];
};

/**
 * An analysis: its label, the project resource kind it reads (`input`, one
 * of the dialect's `projectResources`), and what it computes. `resource` is
 * that kind's content as the workbench reads it (its texts, by path).
 */
export type Analysis = {
  label: string;
  input?: string;
  run: (
    model: AnalysisModel,
    resource?: Readonly<Record<string, string>>,
  ) => AnalysisResult;
};

export type Analyses = Readonly<Record<string, Analysis>>;

/** Properties as an analysis reads them: their texts, by key. */
type PropertyTexts = Readonly<Partial<Record<string, string>>>;

const texts = (properties: PropertyTexts): Record<string, string> =>
  Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );

/**
 * The model as analyses read it: a view of the engine's `GoalModel`
 * (goal-controller#125), its actors, elements and links in the file's
 * order. An actor's and a link's properties are what the engine's mapper
 * keeps of them (`mapActorProps`, `mapLinkProps`: their texts), an
 * element's are as written.
 */
export const analysisViewOf = (
  goalModel: GoalModel<unknown, unknown, unknown, PropertyTexts, PropertyTexts>,
): AnalysisModel => ({
  actors: goalModel.actors.map(
    ({ id, kind, name, properties, elements }): AnalysisActor => ({
      id,
      kind,
      name,
      properties: texts(properties.engine),
      elements,
    }),
  ),
  elements: goalModel.elements,
  links: goalModel.links.map(
    ({ id, kind, source, target, label, properties }): AnalysisLink => ({
      id,
      kind,
      source,
      target,
      ...(label !== undefined && { label }),
      properties: texts(properties.engine),
    }),
  ),
});

/**
 * What is wrong with an engine's analyses, as `defineAnalyses` and
 * `defineEngine` reject them: one without an id or a label, or reading a
 * project resource its dialect doesn't declare.
 */
export const analysesProblems = (
  definition: Partial<Pick<AnyDialect, 'projectResources'>> | undefined,
  analyses: Analyses,
): string[] =>
  Object.entries(analyses).flatMap(([id, analysis]) =>
    !id || !analysis.label
      ? [`analysis ${id}: needs an id and a label`]
      : analysis.input !== undefined &&
          !(analysis.input in (definition?.projectResources ?? {}))
        ? [`analysis ${id} reads unknown project resource ${analysis.input}`]
        : [],
  );

/**
 * Type-checks and freezes an engine's analyses, and checks what the types
 * cannot: each has a label, and reads only a project resource its dialect
 * declares.
 */
export const defineAnalyses = <const A extends Analyses>(
  definition: Pick<AnyDialect, 'id' | 'projectResources'>,
  analyses: A,
): A => {
  const [problem] = analysesProblems(definition, analyses);
  if (problem) throw new Error(`${definition.id}: ${problem}`);
  return Object.freeze(analyses);
};

/** Runs one analysis; an analysis that throws gives its message, no result. */
export const runAnalysis = (
  analysis: Analysis,
  model: AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): { result: AnalysisResult } | { error: string } => {
  try {
    return { result: analysis.run(model, resource) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};
