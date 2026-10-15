/**
 * What TAOM4E's base metamodel can carry of a Tropos4AS model: its actors,
 * its iStar elements (where each is: an actor's, or a dependum) with the
 * conditions Formal Tropos has a slot for (`creation`, `achievement`,
 * `maintain`) and a maintain-goal's type, and its iStar links. What it
 * can't (Tropos4AS's kinds and links, `perform`, `failure`, `drop`,
 * `target`, `onFailure`, `precondition`, positions) is left out, so a seed
 * and its `.tropos` twin compare equal (the stress test's importer column,
 * the importer's tests).
 */
type Json = Record<string, any>;

const ISTAR_NODES = new Set([
  'istar.Goal',
  'istar.Quality',
  'istar.Task',
  'istar.Resource',
]);
const ISTAR_LINKS = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
  'istar.ContributionLink',
  'istar.DependencyLink',
]);
const CARRIED = ['creation', 'achievement', 'maintain'] as const;

export type CarriedModel = {
  actors: string[];
  /** `id kind "text" in actor` (or `dependum`), its carried properties after */
  elements: string[];
  /** `type source → target (label)` */
  links: string[];
};

/** A piStar model (as JSON) as TAOM4E's base metamodel carries it. */
export const taom4eCarried = (model: Json): CarriedModel => {
  const element = (node: Json, where: string) => {
    const p: Json = node.customProperties ?? {};
    const properties = [
      ...(p.type === 'maintain' ? ['type maintain'] : []),
      ...CARRIED.flatMap((key) => (p[key] ? [`${key} ${p[key]}`] : [])),
    ];
    return [
      `${node.id} ${node.type} "${node.text}" in ${where}`,
      ...properties,
    ].join('; ');
  };
  const elements: string[] = [
    ...(model.actors ?? []).flatMap((actor: Json) =>
      (actor.nodes ?? [])
        .filter((n: Json) => ISTAR_NODES.has(n.type))
        .map((n: Json) => element(n, actor.id)),
    ),
    ...(model.dependencies ?? [])
      .filter((n: Json) => ISTAR_NODES.has(n.type))
      .map((n: Json) => element(n, 'dependum')),
  ];
  const ids = new Set([
    ...(model.actors ?? []).map((a: Json) => a.id),
    ...elements.map((e) => e.split(' ')[0]),
  ]);
  return {
    actors: (model.actors ?? []).map((a: Json) => `${a.id} "${a.text}"`),
    elements: elements.sort(),
    links: (model.links ?? [])
      .filter(
        (l: Json) =>
          ISTAR_LINKS.has(l.type) && ids.has(l.source) && ids.has(l.target),
      )
      .map(
        (l: Json) =>
          `${l.type} ${l.source} → ${l.target}${l.label ? ` (${l.label})` : ''}`,
      )
      .sort(),
  };
};

/** Where two carried models differ first (`elements: … ≠ …`), or null. */
export const carriedDifference = (
  expected: CarriedModel,
  actual: CarriedModel,
): string | null => {
  for (const key of ['actors', 'elements', 'links'] as const) {
    const a = expected[key];
    const b = actual[key];
    const at = a.findIndex((line, i) => b[i] !== line);
    if (at >= 0 || a.length !== b.length) {
      const i = at >= 0 ? at : a.length;
      return `${key}: expected ${a[i] ?? '(end)'}, got ${b[i] ?? '(end)'}`;
    }
  }
  return null;
};
