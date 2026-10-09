/**
 * The goal model as an editor shows it: parents and children through the links the
 * engines read (as `convertToTree` follows them, without rejecting anything), the
 * Qualities qualifying each element, and what each element's text says, read with the engine's own RT grammar (`getGoalDetail`):
 * its RT id, name, notation and the construct the notation expresses. Never throws: a text
 * the grammar cannot read keeps its plain `ID: name [notation]` split and reports why.
 */
import {
  isActorIn,
  isNode,
  metamodelOf,
  type IstarModel,
} from '@istar-ts/core';
import { getGoalDetail, type GoalNameParser } from './parsers/goalNameParser';
import { actorRootCandidates, linkEnds, linkRelation } from './internal/roots';
import type { GoalExecutionDetail } from './types/';

/** The construct a notation expresses (`sequence` for `[G1;G2]`, …). */
export type ViewConstruct = GoalExecutionDetail['type'];

export type ViewKind = 'goal' | 'task' | 'resource' | 'quality';

export type GoalViewNode = {
  /** piStar element id */
  iStarId: string;
  /** RT id ("G3"); the piStar id when the text has none */
  id: string;
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
  /** RT ids: in notation order, then the others */
  children: string[];
  parent: string | null;
  /** RT ids of the Qualities qualifying it (Qualification links: not refinements) */
  qualities: string[];
  /** a Quality's: RT ids of the elements it qualifies */
  qualifies: string[];
  properties: Record<string, string>;
  /** fill colour saved in the diagram, if any */
  color: string | null;
};

export type GoalView = {
  /** by RT id; the first element wins when ids repeat */
  nodes: Map<string, GoalViewNode>;
  /** by piStar id: every element, repeated RT ids included */
  byIStarId: Map<string, GoalViewNode>;
  /** each actor's root candidates, then anything not reachable from them */
  roots: string[];
};

/** `ID: name [notation]` as written (the fallback when the grammar cannot read it). */
const TEXT = /^\s*([A-Za-z]+\d+[A-Za-z0-9.]*)\s*:\s*(.*?)\s*(?:\[(.*)\])?\s*$/s;

const KIND: Record<string, ViewKind> = {
  'istar.Goal': 'goal',
  'istar.Task': 'task',
  'istar.Resource': 'resource',
  'istar.Quality': 'quality',
};

const listed = (detail: GoalExecutionDetail | null): string[] => {
  if (!detail) return [];
  switch (detail.type) {
    case 'interleaved':
      return detail.interleaved;
    case 'alternative':
      return detail.alternative;
    case 'sequence':
      return detail.sequence;
    case 'anyOrder':
      return detail.anyOrder;
    case 'degradation':
      return detail.degradationList;
    case 'decisionMaking':
      return detail.dm;
    case 'choice':
      return detail.choice ?? [];
  }
};

/** Reads a model of any dialect: kinds it doesn't know (an extension's) are left out. */
export function goalView(
  model: IstarModel<string, string>,
  grammar: GoalNameParser,
): GoalView {
  const byIStarId = new Map<string, GoalViewNode>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, string>();

  for (const element of model.elements.values()) {
    const kind = KIND[element.kind];
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
          grammar,
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
      id: (errors.length === 0 && detail?.id) || written?.[1] || element.id,
      kind,
      name: (
        (errors.length === 0 && detail?.goalName) ||
        written?.[2] ||
        text
      ).trim(),
      text,
      notation,
      construct: executionDetail?.type ?? null,
      order: listed(executionDetail),
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

  for (const node of byIStarId.values()) {
    const ids = (children.get(node.iStarId) ?? [])
      .map((id) => byIStarId.get(id)?.id)
      .filter((id): id is string => !!id && id !== node.id);
    // the notation's order first (the priority), then any unlisted child
    node.children = [...new Set(ids)].sort((a, b) => {
      const ia = node.order.indexOf(a);
      const ib = node.order.indexOf(b);
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
    const parent = parents.get(node.iStarId);
    node.parent = parent ? (byIStarId.get(parent)?.id ?? null) : null;
  }

  for (const [qualityId, qualifiedId] of qualifications) {
    const quality = byIStarId.get(qualityId);
    const qualified = byIStarId.get(qualifiedId);
    if (!quality || !qualified) continue;
    if (!quality.qualifies.includes(qualified.id))
      quality.qualifies.push(qualified.id);
    if (!qualified.qualities.includes(quality.id))
      qualified.qualities.push(quality.id);
  }

  const byId = new Map<string, GoalViewNode>();
  for (const node of byIStarId.values())
    if (!byId.has(node.id)) byId.set(node.id, node);
  const roots = [...model.elements.values()]
    .filter(isActorIn(metamodelOf(model)))
    .flatMap((actor) => actorRootCandidates(model, actor.id))
    .map((element) => byIStarId.get(element.id)?.id)
    .filter((id): id is string => !!id);
  const reachable = new Set<string>();
  const visit = (id: string): void => {
    if (reachable.has(id)) return;
    reachable.add(id);
    byId.get(id)?.children.forEach(visit);
  };
  roots.forEach(visit);
  for (const node of byId.values()) {
    // a Quality outside the refinements only qualifies: it is not a tree of its own
    const onlyQualifies = node.kind === 'quality' && node.children.length === 0;
    if (!reachable.has(node.id) && !node.parent && !onlyQualifies) {
      roots.push(node.id);
      visit(node.id);
    }
  }

  return { nodes: byId, byIStarId, roots: [...new Set(roots)] };
}
