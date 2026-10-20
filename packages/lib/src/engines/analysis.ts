/**
 * Analysis engines (goal-controller#107): an engine whose output is a value
 * per element and actor, drawn on the model, not a file. An engine declares
 * its analyses by id; each runs on the model (as `AnalysisModel`, a view of
 * its `KindModel`: its actors, elements and links with their properties) and,
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

/**
 * A value's uncertainty (goal-controller#190): the distribution a sampled
 * analysis gives it (a goal's probability of satisfaction under RE'15's
 * Monte Carlo), as its quantiles (`p` its cumulative probability,
 * ascending), its mean, and a histogram (equal-width bins from `min` to
 * `max`, each its share of the samples).
 */
export type AnalysisDistribution = {
  quantiles: readonly { p: number; value: number }[];
  mean: number;
  samples: number;
  histogram?: { min: number; max: number; shares: readonly number[] };
};

/** A value on an element or actor: a number or a word, its label, how to show it. */
export type AnalysisValue = {
  value: number | string;
  /** shown instead of the value (`Satisfied`, `75`) */
  label?: string;
  severity?: 'info' | 'warning';
  /** its distribution, when it is uncertain (a sampled analysis's) */
  distribution?: AnalysisDistribution;
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
 * What an analysis is given besides the model and its `input`
 * (goal-controller#190): each project resource kind it reads (`inputs`)
 * as the workbench reads it (its texts, by path), and the engine's options
 * the project sets (a sampled analysis's sample count and seed).
 */
export type AnalysisContext = {
  resources?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  options?: Readonly<Record<string, boolean | number | string>>;
};

/**
 * An analysis: its label, the project resource kind it reads (`input`, one
 * of the dialect's `projectResources`), or the kinds (`inputs`, several),
 * and what it computes. `resource` is `input`'s content as the workbench
 * reads it (its texts, by path); `context` has `inputs`' and the options.
 */
export type Analysis = {
  label: string;
  input?: string;
  inputs?: readonly string[];
  run: (
    model: AnalysisModel,
    resource?: Readonly<Record<string, string>>,
    context?: AnalysisContext,
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

/** An engine object's values as property texts (strings; numbers as written). */
const engineTexts = (engine: unknown): Record<string, string> => {
  if (engine === null || typeof engine !== 'object') return {};
  return Object.fromEntries(
    Object.entries(engine as Record<string, unknown>).flatMap(([key, value]) =>
      value === undefined || value === null
        ? []
        : [[key, typeof value === 'string' ? value : String(value)]],
    ),
  );
};

/** A tree node as analyses walk it for engine properties. */
type AnalysisTreeNode = {
  iStarId: string;
  properties: { engine: unknown };
  children?: readonly AnalysisTreeNode[];
  tasks?: readonly AnalysisTreeNode[];
  resources?: readonly AnalysisTreeNode[];
};

/** Collect each tree node's engine properties, by piStar id. */
const enginesOfTrees = (
  trees: readonly AnalysisTreeNode[] | undefined,
  into: Map<string, Record<string, string>>,
): void => {
  if (!trees) return;
  for (const node of trees) {
    into.set(node.iStarId, engineTexts(node.properties.engine));
    enginesOfTrees(node.children, into);
    enginesOfTrees(node.tasks, into);
    enginesOfTrees(node.resources, into);
  }
};

/**
 * A KindModel as `analysisViewOf` reads it: actors, paper
 * trees, elements (with optional `engine` for `tree: false`) and links.
 */
type AnalysisSource = {
  actors: readonly {
    id: string;
    kind: string;
    name: string;
    properties: { engine: unknown };
    elements: readonly string[];
    trees?: readonly AnalysisTreeNode[];
  }[];
  paper?: readonly AnalysisTreeNode[];
  elements: readonly {
    id: string;
    kind: string;
    name: string;
    actor?: string;
    properties: Readonly<Partial<Record<string, string>>>;
    engine?: unknown;
  }[];
  links: readonly {
    id: string;
    kind: string;
    source: string;
    target: string;
    label?: string;
    properties: { engine: unknown };
  }[];
};

/**
 * The model as analyses read it: a view of the engine's `KindModel`
 * (goal-controller#125), its actors, elements and links in the file's
 * order. An actor's and a link's properties are what the engine's mapper
 * keeps of them. An element's are as written, unless `fromEntries` is set:
 * then they are its entry's engine properties when the mapper has one (a
 * tree node's, or `tree: false`'s; goal-controller#215, #226, #244). Only
 * engines whose analyses read their entries' values set it; engines still
 * on role mappers read the texts as written.
 */
export const analysisViewOf = (
  source: AnalysisSource,
  { fromEntries = false }: { fromEntries?: boolean } = {},
): AnalysisModel => {
  const fromTrees = new Map<string, Record<string, string>>();
  if (fromEntries) {
    for (const actor of source.actors) enginesOfTrees(actor.trees, fromTrees);
    enginesOfTrees(source.paper, fromTrees);
  }

  return {
    actors: source.actors.map(
      ({ id, kind, name, properties, elements }): AnalysisActor => ({
        id,
        kind,
        name,
        properties: engineTexts(properties.engine),
        elements,
      }),
    ),
    elements: source.elements.map((element) => {
      const fromEntry = !fromEntries
        ? undefined
        : element.engine !== undefined
          ? engineTexts(element.engine)
          : fromTrees.get(element.id);
      return {
        id: element.id,
        kind: element.kind,
        name: element.name,
        ...(element.actor !== undefined && { actor: element.actor }),
        properties: fromEntry ?? texts(element.properties),
      };
    }),
    links: source.links.map(
      ({ id, kind, source: src, target, label, properties }): AnalysisLink => ({
        id,
        kind,
        source: src,
        target,
        ...(label !== undefined && { label }),
        properties: engineTexts(properties.engine),
      }),
    ),
  };
};

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
 * itself (a native file's writer), where the engine's `KindModel` isn't
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
      : [
          ...(analysis.input === undefined ? [] : [analysis.input]),
          ...(analysis.inputs ?? []),
        ].flatMap((kind) =>
          kind in (definition?.projectResources ?? {})
            ? []
            : [`analysis ${id} reads unknown project resource ${kind}`],
        ),
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
  context?: AnalysisContext,
): { result: AnalysisResult } | { error: string } => {
  try {
    return { result: analysis.run(model, resource, context) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/** A number as the report prints it: four decimals at most. */
const decimals = (n: number) => String(Math.round(n * 10000) / 10000);

/** A distribution as text: its quantiles and its mean (goal-controller#190). */
export const distributionText = (distribution: AnalysisDistribution): string =>
  `${distribution.quantiles
    .map(({ p, value }) => `q${decimals(p * 100)} ${decimals(value)}`)
    .join(
      ', ',
    )}; mean ${decimals(distribution.mean)} (${distribution.samples} samples)`;

/** A value as text: its label, or the value; its distribution after it, when it has one. */
const valueText = (value: AnalysisValue): string =>
  `${value.label ?? String(value.value)}${
    value.distribution ? ` [${distributionText(value.distribution)}]` : ''
  }`;

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
