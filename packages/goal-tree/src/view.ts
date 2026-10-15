/**
 * The goal model as an editor shows it: parents and children through the links the
 * engines read (as `convertToTree` follows them, without rejecting anything), the
 * Qualities qualifying each element, and what each element's text says, read in the engine's dialect (`getGoalDetail`, the goal language):
 * its RT id, name, notation and the construct the notation expresses. Never throws: a text
 * the grammar cannot read keeps its plain `ID: name [notation]` split and reports why.
 */
import {
  isActorIn,
  isNode,
  metamodelOf,
  type IstarModel,
} from '@istar-ts/core';
import { extensionKindsRead } from '@goal-controller/dialect';
import {
  notationRefs,
  parseElementLineIn,
  scopedKey,
} from '@goal-controller/goal-language';
import { getGoalDetail, type ReadingDialect } from './parsers/goalNameParser';
import { actorRootCandidates, linkEnds, linkRelation } from './internal/roots';
import type { GoalExecutionDetail } from './types/';

/** The construct a notation expresses (`sequence` for `[G1;G2]`, …). */
export type ViewConstruct = GoalExecutionDetail['type'];

/**
 * iStar's kinds, as an engine reads them, or one of its extension's it reads
 * (`toy.Sensor`, goal-controller#132), by its id.
 */
export type ViewKind =
  | 'goal'
  | 'task'
  | 'resource'
  | 'quality'
  | `${string}.${string}`;

export type GoalViewNode = {
  /** piStar element id */
  iStarId: string;
  /** its horizontal position in the diagram (piStar's absolute x) */
  x?: number;
  /** RT id ("G3"); the piStar id when the text has none */
  id: string;
  /**
   * what the view knows it by: its id, or, in a dialect whose ids are scoped
   * by their goal (`idScope: 'ancestorGoal'`), `G3/T1.1` for an id another
   * element repeats under another goal (`scopedKey`)
   */
  key: string;
  kind: ViewKind;
  name: string;
  /** the element's whole text */
  text: string;
  /** what is inside `[...]`, as written */
  notation: string | null;
  construct: ViewConstruct | null;
  /** the RT ids the notation lists, in order (the priority of the children) */
  order: string[];
  /** why the grammar could not read the text, if it could not */
  notationError: string | null;
  /** how the element refines its children: AND/OR refinement (Needed-By is not one) */
  relation: 'and' | 'or' | null;
  /** keys: in notation order, then the others */
  children: string[];
  /** its parent's key */
  parent: string | null;
  /** keys of the Qualities qualifying it (Qualification links: not refinements) */
  qualities: string[];
  /** a Quality's: keys of the elements it qualifies */
  qualifies: string[];
  properties: Record<string, string>;
  /** fill colour saved in the diagram, if any */
  color: string | null;
};

/** A link, with its ends as the view knows them (goal-controller#107). */
export type ViewLink = {
  /** piStar link id */
  iStarId: string;
  kind: string;
  /** its ends' keys; null: an end the view doesn't list (an actor, a dependum, an extension's kind) */
  source: string | null;
  target: string | null;
  /** its ends as the model has them: piStar id and kind, whatever the kind (an extension's too) */
  ends: { source: LinkEnd; target: LinkEnd };
  /** iStar's contribution value (`make`, `help`, …), when it has one */
  label?: string;
  properties: Record<string, string>;
};

/** A link's end: its piStar id, and its kind (null: the model lacks it). */
export type LinkEnd = { iStarId: string; kind: string | null };

/** An actor (or agent, role, an extension's actor kind), with its properties (goal-controller#107). */
export type ViewActor = {
  /** piStar id */
  iStarId: string;
  kind: string;
  name: string;
  properties: Record<string, string>;
  /** its elements' keys */
  elements: string[];
};

export type GoalView = {
  /** by key (its RT id, unless scoped); the first element wins when keys repeat */
  nodes: Map<string, GoalViewNode>;
  /** by piStar id: every element, repeated RT ids included */
  byIStarId: Map<string, GoalViewNode>;
  /** each actor's root candidates, then anything not reachable from them */
  roots: string[];
  /** every link, in the model's order */
  links: ViewLink[];
  /** every actor, in the model's order */
  actors: ViewActor[];
};

/** `ID: name [notation]` as written (the fallback when the grammar cannot read it); `TX` is an id too. */
const TEXT =
  /^\s*([A-Za-z]+(?:\d+[A-Za-z0-9.]*|X))\s*:\s*(.*?)\s*(?:\[(.*)\])?\s*$/s;

const KIND: Record<string, ViewKind | undefined> = {
  'istar.Goal': 'goal',
  'istar.Task': 'task',
  'istar.Resource': 'resource',
  'istar.Quality': 'quality',
};

/** Every id a goal text's notation names, once each, in the order written (read in the dialect). */
const listed = (dialect: ReadingDialect, text: string): string[] => [
  ...new Set(
    notationRefs(parseElementLineIn(dialect, text).value?.notation ?? null),
  ),
];

/**
 * Reads a model of any dialect: iStar's kinds, and its extension's it reads
 * (lists, gives properties or names in a reference: `extensionKindsRead`),
 * each keyed by the id its text starts with (`E1: …`) or its piStar id; any
 * other kind is left out.
 */
export function goalView(
  model: IstarModel<string, string>,
  dialect: ReadingDialect,
): GoalView {
  const byIStarId = new Map<string, GoalViewNode>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, string>();
  const extensionKinds = new Set(extensionKindsRead(dialect));

  for (const element of model.elements.values()) {
    const kind =
      KIND[element.kind] ??
      (extensionKinds.has(element.kind)
        ? (element.kind as ViewKind)
        : undefined);
    if (!kind || !isNode(element) || element.isDependum) continue;
    const text = element.name;
    const written = TEXT.exec(text);
    const notation = written?.[3] !== undefined ? written[3].trim() : null;
    const errors: string[] = [];
    let detail: ReturnType<typeof getGoalDetail> | null = null;
    if (written) {
      try {
        detail = getGoalDetail({
          goalText: text,
          dialect,
          onSyntaxError: (m) => errors.push(m),
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const executionDetail =
      errors.length === 0 ? (detail?.executionDetail ?? null) : null;
    byIStarId.set(element.id, {
      iStarId: element.id,
      x: element.x,
      id: (errors.length === 0 && detail?.id) || written?.[1] || element.id,
      // set once the parents are known
      key: '',
      kind,
      name: (
        (errors.length === 0 && detail?.goalName) ||
        written?.[2] ||
        text
      ).trim(),
      text,
      notation,
      construct: executionDetail?.type ?? null,
      order: errors.length === 0 ? listed(dialect, text) : [],
      notationError:
        notation !== null && errors.length > 0 ? errors.join('; ') : null,
      relation: null,
      children: [],
      parent: null,
      qualities: [],
      qualifies: [],
      properties: { ...element.customProperties },
      color:
        typeof element.display?.backgroundColor === 'string'
          ? element.display.backgroundColor
          : null,
    });
  }

  // in model order: the first link decides the relation and, for a child with several
  // parents (a resource needed by several tasks), the parent
  const qualifications: Array<[quality: string, qualified: string]> = [];
  for (const link of model.links.values()) {
    if (link.kind === 'istar.QualificationLink') {
      qualifications.push([link.source, link.target]);
      continue;
    }
    const relation = linkRelation(link);
    const [parentId, childId] = linkEnds(link);
    const parent = byIStarId.get(parentId);
    if (!relation || !parent || !byIStarId.has(childId)) continue;
    if (!parent.relation && relation !== 'neededBy') parent.relation = relation;
    children.set(parentId, [...(children.get(parentId) ?? []), childId]);
    if (!parents.has(childId)) parents.set(childId, parentId);
  }

  // an id another element repeats, in a dialect that scopes ids by their
  // goal: keyed by its nearest goal (GODA's G3_T1_1, G4_T1_1)
  const uses = new Map<string, number>();
  for (const node of byIStarId.values())
    uses.set(node.id, (uses.get(node.id) ?? 0) + 1);
  const goalAbove = (iStarId: string): string | null => {
    for (let at = parents.get(iStarId); at; at = parents.get(at)) {
      const node = byIStarId.get(at);
      if (node?.kind === 'goal') return node.id;
    }
    return null;
  };
  for (const node of byIStarId.values()) {
    const goal =
      dialect.idScope === 'ancestorGoal' &&
      node.kind !== 'goal' &&
      (uses.get(node.id) ?? 0) > 1
        ? goalAbove(node.iStarId)
        : null;
    node.key = goal ? scopedKey(goal, node.id) : node.id;
  }

  const idByKey = new Map(
    [...byIStarId.values()].map((node) => [node.key, node.id]),
  );
  const keyOf = (iStarId: string | undefined) =>
    iStarId ? byIStarId.get(iStarId)?.key : undefined;
  for (const node of byIStarId.values()) {
    const keys = (children.get(node.iStarId) ?? [])
      .map(keyOf)
      .filter((key): key is string => !!key && key !== node.key);
    // the notation's order first (the priority, by id), then any unlisted child
    const idOf = (key: string) => idByKey.get(key) ?? key;
    node.children = [...new Set(keys)].sort((a, b) => {
      const ia = node.order.indexOf(idOf(a));
      const ib = node.order.indexOf(idOf(b));
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
    node.parent = keyOf(parents.get(node.iStarId)) ?? null;
  }

  for (const [qualityId, qualifiedId] of qualifications) {
    const quality = byIStarId.get(qualityId);
    const qualified = byIStarId.get(qualifiedId);
    if (!quality || !qualified) continue;
    if (!quality.qualifies.includes(qualified.key))
      quality.qualifies.push(qualified.key);
    if (!qualified.qualities.includes(quality.key))
      qualified.qualities.push(quality.key);
  }

  const byId = new Map<string, GoalViewNode>();
  for (const node of byIStarId.values())
    if (!byId.has(node.key)) byId.set(node.key, node);
  const roots = [...model.elements.values()]
    .filter(isActorIn(metamodelOf(model)))
    .flatMap((actor) => actorRootCandidates(model, actor.id, dialect))
    // an extension's element is no tree's root (goal-controller#132)
    .filter((element) => !extensionKinds.has(element.kind))
    .map((element) => keyOf(element.id))
    .filter((id): id is string => !!id);
  const reachable = new Set<string>();
  const visit = (id: string): void => {
    if (reachable.has(id)) return;
    reachable.add(id);
    byId.get(id)?.children.forEach(visit);
  };
  roots.forEach(visit);
  for (const node of byId.values()) {
    // a Quality outside the refinements only qualifies: it is not a tree of
    // its own; nor is an extension's element no refinement reaches
    const onlyQualifies = node.kind === 'quality' && node.children.length === 0;
    if (
      !reachable.has(node.key) &&
      !node.parent &&
      !onlyQualifies &&
      !extensionKinds.has(node.kind)
    ) {
      roots.push(node.key);
      visit(node.key);
    }
  }

  const strings = (properties: Readonly<Record<string, unknown>> | undefined) =>
    Object.fromEntries(
      Object.entries(properties ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  const links = [...model.links.values()].map((link): ViewLink => ({
    iStarId: link.id,
    kind: link.kind,
    source: keyOf(link.source) ?? null,
    target: keyOf(link.target) ?? null,
    ends: {
      source: {
        iStarId: link.source,
        kind: model.elements.get(link.source)?.kind ?? null,
      },
      target: {
        iStarId: link.target,
        kind: model.elements.get(link.target)?.kind ?? null,
      },
    },
    ...(link.label !== undefined && { label: link.label }),
    properties: strings(link.customProperties),
  }));
  const actors = [...model.elements.values()]
    .filter(isActorIn(metamodelOf(model)))
    .map((actor): ViewActor => ({
      iStarId: actor.id,
      kind: actor.kind,
      name: actor.name,
      properties: strings(actor.customProperties),
      elements: [...model.elements.values()]
        .filter((inner) => inner.parent === actor.id)
        .map((inner) => keyOf(inner.id))
        .filter((key): key is string => !!key),
    }));

  return {
    nodes: byId,
    byIStarId,
    roots: [...new Set(roots)],
    links,
    actors,
  };
}
