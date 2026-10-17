/**
 * Analysis engines (goal-controller#107): an engine whose output is a value
 * per element and actor, drawn on the model, not a file. An engine declares
 * its analyses by id; each runs on the model (as `AnalysisModel`, a view of
 * its `GoalModel`: its actors, elements and links with their properties) and,
 * when it reads one, a
 * project resource. A result has one or more cases (one evaluation each: a
 * strategy, a scenario; a single-case analysis has one), each a value per
 * element or actor id; a case may be a selection (goal-controller#152: a
 * variant, the elements and links it consists of, with a one-line summary),
 * which the workbench draws by dimming the rest. An analysis that derives
 * variants or reasons over conditions has `variantsOf` (./variants) and
 * `satisfiable`, `implies`, `equivalent` (./propositional). Nothing here
 * names an engine.
 */
import { ISTAR_KIND_OF, type AnyDialect } from '@goal-controller/dialect';
import {
  readProperties,
  type PropertyList,
  type PropertyValues,
} from '@goal-controller/goal-language';
import type { GoalModel } from '@goal-controller/goal-tree';

/** A value on an element or actor: a number or a word, its label, how to show it. */
export type AnalysisValue = {
  value: number | string;
  /** shown instead of the value (`Satisfied`, `75`) */
  label?: string;
  severity?: 'info' | 'warning';
};

/** Values by element or actor id (the piStar ids). */
export type AnalysisValues = Readonly<Record<string, AnalysisValue>>;

/**
 * One step of a case run as a sequence (goal-controller#135): a scenario's
 * step, its label (`3: WetCleaning fails`) and every value then.
 */
export type AnalysisStep = { label: string; values: AnalysisValues };

/**
 * One evaluation: its values by element or actor id (the piStar ids). A
 * case run step by step has `steps` too, in order (the workbench steps
 * through them); its `values` are then its outcome (its last step's). A
 * case that is a selection (goal-controller#152: a variant) has the piStar
 * ids of the elements and links it consists of (the workbench dims the
 * rest), and a one-line `summary` (its context, score, cost).
 */
export type AnalysisCase = {
  id: string;
  label: string;
  values: AnalysisValues;
  steps?: readonly AnalysisStep[];
  selection?: readonly string[];
  summary?: string;
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

/** A dialect as `readProperties` reads it: its element kinds', link kinds' and actors' properties. */
type PropertyDialect = {
  properties?: Readonly<Record<string, PropertyList>>;
  links?: Readonly<Record<string, PropertyList>>;
  actors?: readonly (PropertyList[number] & { kinds?: readonly string[] })[];
};

/** Every property a dialect declares: its element kinds', its link kinds', its actors'. */
type DeclaredPropertiesOf<D> =
  | (D extends { properties: infer P } ? P[keyof P] : never)
  | (D extends { links?: infer L }
      ? NonNullable<L>[keyof NonNullable<L>]
      : never)
  | (D extends { actors?: infer A } ? NonNullable<A> : never);

/**
 * A view's actor's, element's or link's properties as its dialect reads
 * them (`viewValues`): every key the dialect declares, typed (a key two
 * kinds declare, either's type); those its kind has are set.
 */
export type ViewValues<D> = PropertyValues<
  Extract<DeclaredPropertiesOf<D>, PropertyList>
>;

/** The dialect kind an element's properties are declared on: iStar's (`goal`) for its iStar kind, else its own (an extension's). */
const DIALECT_KIND_OF: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ISTAR_KIND_OF).map(([kind, iStar]) => [iStar, kind]),
);

/** A view's item as `viewValues` reads it: its kind (piStar's, or the dialect's) and its properties as written. */
type ViewItem = {
  kind: string;
  properties: Readonly<Partial<Record<string, string>>>;
};

const valuesRead = new WeakMap<object, WeakMap<object, unknown>>();

/**
 * An actor's, an element's or a link's properties in a view (its texts) as
 * its dialect reads them (goal-controller#187): what an engine's mapper is
 * given as `props`, by the same `readProperties`, for the view's items the
 * mapper doesn't see (an extension's kinds, every link): only the keys the
 * dialect gives its kind, each its value type's data (with its members),
 * a value written with an error unset (the dialect's checks report it).
 * Read once per item and dialect.
 */
export const viewValues = <const D extends PropertyDialect>(
  dialect: D,
  owner: 'actor' | 'element' | 'link',
  item: ViewItem,
): ViewValues<D> => {
  let read = valuesRead.get(dialect);
  if (!read) valuesRead.set(dialect, (read = new WeakMap()));
  if (!read.has(item))
    read.set(
      item,
      readProperties(
        dialect,
        owner === 'element'
          ? { element: DIALECT_KIND_OF[item.kind] ?? item.kind }
          : owner === 'actor'
            ? { actor: item.kind }
            : { link: item.kind },
        item.properties,
      ).values,
    );
  return read.get(item) as ViewValues<D>;
};

type PistarNode = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  customProperties?: Record<string, unknown>;
};
const textsOf = (properties: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(properties ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

/**
 * A piStar model's JSON as analyses read it, without the engine's mapper:
 * every actor, element (an actor's, an orphan, a dependum) and link as the
 * file has them, their properties' texts. For what reads a model's file
 * itself (a native file's writer), where the workbench's `GoalModel` isn't
 * at hand.
 */
export const pistarAnalysisModel = (
  json: Readonly<Record<string, unknown>>,
): AnalysisModel => {
  const list = (value: unknown) =>
    (Array.isArray(value) ? value : []) as (PistarNode & {
      nodes?: unknown;
      source?: unknown;
      target?: unknown;
      label?: unknown;
    })[];
  const element = (node: PistarNode, actor?: string): AnalysisElement => ({
    id: String(node.id),
    kind: String(node.type),
    name: String(node.text ?? ''),
    properties: textsOf(node.customProperties),
    ...(actor !== undefined && { actor }),
  });
  const actors = list(json.actors);
  return {
    actors: actors.map((actor) => ({
      id: String(actor.id),
      kind: String(actor.type),
      name: String(actor.text ?? ''),
      properties: textsOf(actor.customProperties),
      elements: list(actor.nodes).map((node) => String(node.id)),
    })),
    elements: [
      ...actors.flatMap((actor) =>
        list(actor.nodes).map((node) => element(node, String(actor.id))),
      ),
      ...list(json.orphans).map((node) => element(node)),
      ...list(json.dependencies).map((node) => element(node)),
    ],
    links: list(json.links).map((link) => ({
      id: String(link.id),
      kind: String(link.type),
      source: String(link.source),
      target: String(link.target),
      ...(typeof link.label === 'string' && { label: link.label }),
      properties: textsOf(link.customProperties),
    })),
  };
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

/** A value as text: its label, or the value. */
const valueText = (value: AnalysisValue): string =>
  value.label ?? String(value.value);

/**
 * A result as text (goal-controller#135): each case, its summary and
 * selection when it has them (goal-controller#152), its values (or, for a
 * case run step by step, each step and its values), one `id: value` line
 * per element or actor, named by `nameOf` (default: its id).
 */
export const analysisText = (
  result: AnalysisResult,
  nameOf: (id: string) => string = (id) => id,
): string => {
  const valueLines = (values: AnalysisValues, indent: string) =>
    Object.entries(values).map(
      ([id, value]) => `${indent}${nameOf(id)}: ${valueText(value)}`,
    );
  return result.cases
    .flatMap((analysisCase) => [
      analysisCase.label,
      ...(analysisCase.summary !== undefined
        ? [`  summary: ${analysisCase.summary}`]
        : []),
      ...(analysisCase.selection
        ? [`  selection: ${analysisCase.selection.map(nameOf).join(', ')}`]
        : []),
      ...(analysisCase.steps?.length
        ? analysisCase.steps.flatMap((step, i) => [
            `  step ${i + 1}: ${step.label}`,
            ...valueLines(step.values, '    '),
          ])
        : valueLines(analysisCase.values, '  ')),
    ])
    .join('\n');
};
