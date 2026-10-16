/**
 * Lookups over an STS-ml model that every analysis shares: names, goal
 * trees (DKE §3.1.1: an actor's AND/OR decompositions; a goal's scope is
 * its subtree, §3.1.3), where a received document comes from, and
 * the part-of structure of information and documents (DKE §3.1.2).
 */
import type {
  StsAuthorisation,
  StsDecomposition,
  StsDelegation,
  StsModel,
  StsTransmission,
  StsUse,
} from './model';

const groupBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
};

/** The ids reachable from `start` by `next`, `start` first, each once. */
export const reachable = (
  start: readonly string[],
  next: (id: string) => readonly string[],
): string[] => {
  const seen = new Set<string>();
  const order: string[] = [];
  const stack = [...start].reverse();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    stack.push(...[...next(id)].reverse());
  }
  return order;
};

/**
 * The cycles of a directed graph: its strongly connected components with
 * more than one node, or with a node's edge to itself, in the order their
 * first node is given.
 */
export const cyclesOf = (
  nodes: readonly string[],
  edges: readonly (readonly [string, string])[],
): string[][] => {
  const next = new Map<string, string[]>();
  for (const [a, b] of edges) next.set(a, [...(next.get(a) ?? []), b]);
  const indexOf = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let counter = 0;
  const visit = (v: string) => {
    indexOf.set(v, counter);
    low.set(v, counter++);
    stack.push(v);
    onStack.add(v);
    for (const w of next.get(v) ?? []) {
      if (!indexOf.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w))
        low.set(v, Math.min(low.get(v)!, indexOf.get(w)!));
    }
    if (low.get(v) === indexOf.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      components.push(component);
    }
  };
  for (const v of nodes) if (!indexOf.has(v)) visit(v);
  const order = new Map(nodes.map((n, i) => [n, i]));
  return components
    .filter((c) => c.length > 1 || (next.get(c[0]!) ?? []).includes(c[0]!))
    .map((c) => [...c].sort((a, b) => order.get(a)! - order.get(b)!))
    .sort((a, b) => order.get(a[0]!)! - order.get(b[0]!)!);
};

export type StsIndex = ReturnType<typeof indexStsModel>;

export const indexStsModel = (model: StsModel) => {
  const names = new Map<string, string>(
    [
      ...model.actors,
      ...model.goals,
      ...model.documents,
      ...model.information,
      ...model.events,
    ].map((x) => [x.id, x.name]),
  );
  const actorOf = new Map<string, string>(
    [...model.goals, ...model.documents].map((x) => [x.id, x.actor]),
  );
  const decompositionOf = new Map<string, StsDecomposition>(
    model.decompositions.map((d) => [d.goal, d]),
  );
  const parentsOf = new Map<
    string,
    { goal: string; type: 'and' | 'or'; link?: string }[]
  >();
  for (const d of model.decompositions)
    d.subgoals.forEach((sub, i) =>
      parentsOf.set(sub, [
        ...(parentsOf.get(sub) ?? []),
        { goal: d.goal, type: d.type, ...(d.links[i] && { link: d.links[i] }) },
      ]),
    );
  const delegationsOf = groupBy(model.delegations, (d) => d.goal);
  const delegationsTo = groupBy(
    model.delegations.filter((d) => d.received !== undefined),
    (d) => d.received!,
  );
  const transmissionsOf = groupBy(model.transmissions, (t) => t.document);
  const transmissionsTo = groupBy(
    model.transmissions.filter((t) => t.received !== undefined),
    (t) => t.received!,
  );
  const usesOfGoal = groupBy(model.uses, (u) => u.goal);
  const usesOfDocument = groupBy(model.uses, (u) => u.document);
  const authorisationsTo = groupBy(model.authorisations, (a) => a.to);
  const partsOf = groupBy(model.partOf, (p) => p.whole);
  const wholesOf = groupBy(model.partOf, (p) => p.part);

  const name = (id: string) => names.get(id) ?? id;
  const subgoals = (goal: string): readonly string[] =>
    decompositionOf.get(goal)?.subgoals ?? [];
  /** A goal and its descendants in its actor's tree (its scope, DKE §3.1.3). */
  const subtree = (goal: string) => reachable([goal], subgoals);
  /** The document a received document is (DKE Def. 3(5)), back to the first sender's. */
  const originalDocument = (document: string): string => {
    const seen = new Set<string>();
    let at = document;
    while (!seen.has(at)) {
      seen.add(at);
      const from = transmissionsTo.get(at)?.[0];
      if (!from) return at;
      at = from.document;
    }
    return at;
  };
  /** The parts of an information or document, transitively, not itself. */
  const partsOfDeep = (id: string) =>
    reachable([id], (x) => (partsOf.get(x) ?? []).map((p) => p.part)).slice(1);
  /** The wholes an information or document is part of, transitively, not itself. */
  const wholesOfDeep = (id: string) =>
    reachable([id], (x) => (wholesOf.get(x) ?? []).map((p) => p.whole)).slice(
      1,
    );
  /** The information a document makes tangible, on the original document (DKE Table 3). */
  const tangibleIn = (document: string): string[] => {
    const original = originalDocument(document);
    return model.tangible
      .filter((t) => t.document === original || t.document === document)
      .map((t) => t.information);
  };

  return {
    model,
    name,
    actorOf: (id: string) => actorOf.get(id),
    decompositionOf: (goal: string) => decompositionOf.get(goal),
    parentsOf: (goal: string) => parentsOf.get(goal) ?? [],
    subgoals,
    subtree,
    originalDocument,
    delegationsOf: (goal: string): readonly StsDelegation[] =>
      delegationsOf.get(goal) ?? [],
    delegationsTo: (goal: string): readonly StsDelegation[] =>
      delegationsTo.get(goal) ?? [],
    transmissionsOf: (document: string): readonly StsTransmission[] =>
      transmissionsOf.get(document) ?? [],
    transmissionsTo: (document: string): readonly StsTransmission[] =>
      transmissionsTo.get(document) ?? [],
    usesOfGoal: (goal: string): readonly StsUse[] => usesOfGoal.get(goal) ?? [],
    usesOfDocument: (document: string): readonly StsUse[] =>
      usesOfDocument.get(document) ?? [],
    authorisationsTo: (actor: string): readonly StsAuthorisation[] =>
      authorisationsTo.get(actor) ?? [],
    partsOfDeep,
    wholesOfDeep,
    tangibleIn,
  };
};
