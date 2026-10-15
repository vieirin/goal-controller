/**
 * Analysis engines (goal-controller#107): an engine whose output is a value
 * per element and actor, drawn on the model, not a file. An engine declares
 * its analyses by id; each runs on the model (as `AnalysisModel`: its actors,
 * elements and links with their properties) and, when it reads one, a
 * project resource. A result has one or more cases (one evaluation each: a
 * strategy, a scenario; a single-case analysis has one), each a value per
 * element or actor id. Nothing here names an engine.
 */
import type { AnyDialect } from '@goal-controller/dialect';

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

/** What analysisModel reads of an istar-ts model (any kinds: an extension's too). */
export type AnalysedModel = {
  readonly elements: ReadonlyMap<
    string,
    {
      readonly id: string;
      readonly kind: string;
      readonly name: string;
      readonly parent?: string;
      readonly customProperties?: Readonly<Record<string, unknown>>;
    }
  >;
  readonly links: ReadonlyMap<
    string,
    {
      readonly id: string;
      readonly kind: string;
      readonly source: string;
      readonly target: string;
      readonly label?: string;
      readonly customProperties?: Readonly<Record<string, unknown>>;
    }
  >;
};

const ACTOR_KINDS = new Set(['istar.Actor', 'istar.Agent', 'istar.Role']);

/**
 * The model as analyses read it. An actor is an element of an actor kind
 * (iStar's, or `actorKinds` an extension adds); the rest are elements.
 */
export const analysisModel = (
  model: AnalysedModel,
  { actorKinds = [] }: { actorKinds?: readonly string[] } = {},
): AnalysisModel => {
  const isActor = (kind: string) =>
    ACTOR_KINDS.has(kind) || actorKinds.includes(kind);
  const props = (p: Readonly<Record<string, unknown>> | undefined) =>
    Object.fromEntries(
      Object.entries(p ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  const actors: AnalysisActor[] = [];
  const elements: AnalysisElement[] = [];
  for (const element of model.elements.values()) {
    const { kind } = element;
    if (isActor(kind))
      actors.push({
        id: element.id,
        kind,
        name: element.name,
        properties: props(element.customProperties),
        elements: [...model.elements.values()]
          .filter((inner) => inner.parent === element.id)
          .map((inner) => inner.id),
      });
    else
      elements.push({
        id: element.id,
        kind,
        name: element.name,
        properties: props(element.customProperties),
        ...(element.parent !== undefined && { actor: element.parent }),
      });
  }
  const links = [...model.links.values()].map((link): AnalysisLink => ({
    id: link.id,
    kind: link.kind,
    source: link.source,
    target: link.target,
    ...(link.label !== undefined && { label: link.label }),
    properties: props(link.customProperties),
  }));
  return { actors, elements, links };
};

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
