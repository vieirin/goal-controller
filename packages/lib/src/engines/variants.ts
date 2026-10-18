/**
 * Variants (goal-controller#152, #151 D8): the ways a root can be achieved,
 * over the model as analyses read it. A parent keeps every `and` child and
 * takes one `or` child; a link with a guard (the engine's: a condition, an
 * assertion tree) is taken with it true, and an `and` child with a guard is
 * also dropped with it false; a dependency is followed into the dependee's
 * tree when the engine says so. Each variant gives the elements and links it
 * uses, its leaves and the guards it passed, in tree order. Nothing here
 * names a dialect: an engine says where its conditions are (`guard`), which
 * links refine (`relation`) and which dependencies go on (`follow`).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import type {
  AnalysisActor,
  AnalysisElement,
  AnalysisLink,
  AnalysisModel,
} from './analysis';

/** How a link joins its parent's variants: kept (`and`) or one of its alternatives (`or`). */
export type VariantRelation = 'and' | 'or';

/**
 * A dependency the walk reaches: the depender's link to the dependum, the
 * dependum, and what the dependum's own link points to (an element or an
 * actor; none when it has no such link).
 */
export type VariantDependency = {
  link: AnalysisLink;
  dependum: AnalysisElement;
  dependee?: AnalysisElement | AnalysisActor;
};

/**
 * Where the walk asks for a guard: at the root, or at a link it takes (its
 * relation), from the parent (`from`, the depender for a dependency) to the
 * child (`to`, the dependum); `dependency` when the link is one.
 */
export type VariationPoint =
  | { point: 'root'; element: AnalysisElement }
  | {
      point: VariantRelation;
      link: AnalysisLink;
      from: string;
      to: string;
      dependency?: VariantDependency;
    };

/**
 * A guard at a variation point: its assertion, none (always taken), or
 * `'unreadable'` when the dialect couldn't read what was written
 * (goal-controller#238: that branch yields no variant; the dialect's
 * diagnostic is what the user sees).
 */
export type VariantGuard = AssertionTree | null | undefined | 'unreadable';

export type VariantOptions = {
  /** the condition at a point (an assertion tree), none, or unreadable */
  guard: (at: VariationPoint) => VariantGuard;
  /**
   * how a link joins its parent (its target for a refinement, its source
   * for a dependency): default iStar's, AND refinement and NeededBy `and`,
   * OR refinement `or`, a dependency `and`; none: not followed
   */
  relation?: (link: AnalysisLink) => VariantRelation | null | undefined;
  /**
   * whether the walk goes on past a dependum: `true`, at the dependee
   * element; a string, at that element; none, it stops (the dependum is a
   * leaf)
   */
  follow?: (dependency: VariantDependency) => boolean | string | undefined;
  /** at most this many variants (default 10,000); `truncated` says when there are more */
  limit?: number;
};

/** A guard the variant passed: where (a link's or the root's id), what, and whether it holds there. */
export type GuardLiteral = {
  at: string;
  condition: AssertionTree;
  holds: boolean;
};

/**
 * A variant: its elements (the root first) and links, in the walk's order;
 * its leaves (the elements it uses that nothing below them in it does); the
 * guards it passed, in tree order.
 */
export type Variant = {
  elements: readonly string[];
  links: readonly string[];
  leaves: readonly string[];
  literals: readonly GuardLiteral[];
};

export type Variants = {
  variants: readonly Variant[];
  /** there are more than `limit` */
  truncated: boolean;
  /** how many there are, counted without enumerating them */
  total: number;
};

/** iStar's relations: AND refinement and NeededBy keep, OR refinement chooses, a dependency keeps. */
const ISTAR_RELATION: Readonly<Record<string, VariantRelation>> = {
  'istar.AndRefinementLink': 'and',
  'istar.NeededByLink': 'and',
  'istar.OrRefinementLink': 'or',
  'istar.DependencyLink': 'and',
};

/** What a subtree adds to a variant. */
type Piece = {
  elements: readonly string[];
  links: readonly string[];
  leaves: readonly string[];
  literals: readonly GuardLiteral[];
};

const EMPTY: Piece = { elements: [], links: [], leaves: [], literals: [] };

const join = (a: Piece, b: Piece): Piece => ({
  elements: [...a.elements, ...b.elements],
  links: [...a.links, ...b.links],
  leaves: [...a.leaves, ...b.leaves],
  literals: [...a.literals, ...b.literals],
});

/**
 * A subtree as the walk reads it: its element, the parts it keeps and those
 * it takes one of. A part is the link it passes (none: a dependum's walk
 * into an element it has no link to), its guard, and the child's subtree.
 */
type Subtree = { element: string; and: Part[]; or: Part[] };
type Part = {
  link?: string;
  guard: AssertionTree | null | 'unreadable';
  child: Subtree;
};

/** The subtree of `root`, its guards asked as the walk reaches them. */
const subtreeOf = (
  model: AnalysisModel,
  root: string,
  options: Omit<VariantOptions, 'limit'>,
): Subtree => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const actors = new Map(model.actors.map((a) => [a.id, a]));
  const relationOf = (link: AnalysisLink) =>
    (options.relation ?? ((l) => ISTAR_RELATION[l.kind]))(link) ?? null;
  const isDependum = (id: string) =>
    elements.has(id) && elements.get(id)!.actor === undefined;
  // a link joins its target to its source, a link to a dependum its source
  // (the depender) to it; a dependum's own link is its dependency's other half
  const below = new Map<string, AnalysisLink[]>();
  for (const link of model.links) {
    if (isDependum(link.source)) continue;
    const parent = isDependum(link.target) ? link.source : link.target;
    below.set(parent, [...(below.get(parent) ?? []), link]);
  }
  const ownLink = (dependum: string) =>
    model.links.find((link) => link.source === dependum);

  const walk = (id: string, path: ReadonlySet<string>): Subtree => {
    const subtree: Subtree = { element: id, and: [], or: [] };
    // an element already on the path (a cycle of dependencies) is a leaf here
    if (path.has(id)) return subtree;
    const on = new Set(path).add(id);
    for (const link of below.get(id) ?? []) {
      const relation = relationOf(link);
      if (!relation) continue;
      const to = link.source === id ? link.target : link.source;
      if (!isDependum(to)) {
        const guard = options.guard({ point: relation, link, from: id, to });
        subtree[relation].push({
          link: link.id,
          guard: guard === 'unreadable' ? 'unreadable' : (guard ?? null),
          child: walk(to, on),
        });
        continue;
      }
      const dependumLink = ownLink(to);
      const dependee = dependumLink
        ? (elements.get(dependumLink.target) ?? actors.get(dependumLink.target))
        : undefined;
      const dependency: VariantDependency = {
        link,
        dependum: elements.get(to)!,
        ...(dependee && { dependee }),
      };
      const guard = options.guard({
        point: relation,
        link,
        from: id,
        to,
        dependency,
      });
      const followed = options.follow?.(dependency);
      const next =
        typeof followed === 'string'
          ? followed
          : followed && dependee && elements.has(dependee.id)
            ? dependee.id
            : undefined;
      if (next !== undefined && !elements.has(next))
        throw new Error(`dependency ${link.id}: ${next} is no element`);
      const dependum: Subtree = {
        element: to,
        and:
          next === undefined
            ? []
            : [
                {
                  ...(dependumLink && { link: dependumLink.id }),
                  guard: null,
                  child: walk(next, on),
                },
              ],
        or: [],
      };
      subtree[relation].push({
        link: link.id,
        guard: guard === 'unreadable' ? 'unreadable' : (guard ?? null),
        child: dependum,
      });
    }
    return subtree;
  };

  if (!elements.has(root)) throw new Error(`variants: no element ${root}`);
  return walk(root, new Set());
};

/** How many variants a subtree has (an unreadable guard yields none, #238). */
const countOf = (subtree: Subtree): number => {
  if (subtree.and.some((part) => part.guard === 'unreadable')) return 0;
  const and = subtree.and.reduce(
    (product, part) =>
      product *
      (part.guard === 'unreadable'
        ? 0
        : countOf(part.child) + (part.guard ? 1 : 0)),
    1,
  );
  if (!subtree.or.length) return and;
  const or = subtree.or.reduce(
    (sum, part) =>
      sum + (part.guard === 'unreadable' ? 0 : countOf(part.child)),
    0,
  );
  return and * or;
};

/** A part's variants: taken (its guard true), then, for a guarded `and` part, dropped. */
function* partVariants(part: Part, droppable: boolean): Generator<Piece> {
  // unreadable: no variant through this branch (goal-controller#238)
  if (part.guard === 'unreadable') return;
  const condition = part.guard;
  const literal = (holds: boolean): GuardLiteral[] =>
    condition ? [{ at: part.link!, condition, holds }] : [];
  const taken: Piece = {
    ...EMPTY,
    links: part.link ? [part.link] : [],
    literals: literal(true),
  };
  for (const below of subtreeVariants(part.child)) yield join(taken, below);
  if (droppable && condition) yield { ...EMPTY, literals: literal(false) };
}

/** The product of the parts' variants, the first part's slowest. */
function* product(
  parts: readonly (() => Iterable<Piece>)[],
  from = 0,
): Generator<Piece> {
  if (from === parts.length) {
    yield EMPTY;
    return;
  }
  for (const first of parts[from]!())
    for (const rest of product(parts, from + 1)) yield join(first, rest);
}

/** A subtree's variants: its element, every `and` part, one `or` part. */
function* subtreeVariants(subtree: Subtree): Generator<Piece> {
  // an unreadable AND child: no variant of this parent (#238)
  if (subtree.and.some((part) => part.guard === 'unreadable')) return;
  const parts: (() => Iterable<Piece>)[] = subtree.and.map(
    (part) => () => partVariants(part, true),
  );
  if (subtree.or.length)
    parts.push(function* () {
      for (const part of subtree.or) yield* partVariants(part, false);
    });
  for (const below of product(parts))
    yield join(
      {
        ...EMPTY,
        elements: [subtree.element],
        leaves: below.elements.length ? [] : [subtree.element],
      },
      below,
    );
}

/**
 * The root's guard: its literals, or `null` when the activation is
 * unreadable (no variant of this root, goal-controller#238).
 */
const rootLiterals = (
  model: AnalysisModel,
  root: string,
  options: Omit<VariantOptions, 'limit'>,
): GuardLiteral[] | null => {
  const element = model.elements.find((e) => e.id === root)!;
  const guard = options.guard({ point: 'root', element });
  if (guard === 'unreadable') return null;
  return guard ? [{ at: root, condition: guard, holds: true }] : [];
};

/** The variants of `root`, lazily, in a deterministic order. */
export function* eachVariant(
  model: AnalysisModel,
  root: string,
  options: Omit<VariantOptions, 'limit'>,
): Generator<Variant> {
  // subtree first: a missing root throws `variants: no element …`
  const subtree = subtreeOf(model, root, options);
  const literals = rootLiterals(model, root, options);
  if (!literals) return;
  for (const variant of subtreeVariants(subtree))
    yield { ...variant, literals: [...literals, ...variant.literals] };
}

/** The first `limit` variants of `root`, whether there are more, and how many there are. */
export const variantsOf = (
  model: AnalysisModel,
  root: string,
  { limit = 10_000, ...options }: VariantOptions,
): Variants => {
  const subtree = subtreeOf(model, root, options);
  const literals = rootLiterals(model, root, options);
  if (!literals) return { variants: [], truncated: false, total: 0 };
  const total = countOf(subtree);
  const variants: Variant[] = [];
  for (const variant of subtreeVariants(subtree)) {
    if (variants.length === limit) break;
    variants.push({ ...variant, literals: [...literals, ...variant.literals] });
  }
  return { variants, truncated: total > variants.length, total };
};

/** A condition grouped, where its text would read otherwise: `!` binds tightest, then `&`. */
const grouped = (
  tree: AssertionTree,
  kinds: readonly AssertionTree['kind'][],
): AssertionTree =>
  kinds.includes(tree.kind) ? { kind: 'paren', expr: tree } : tree;

/**
 * A variant's context: the conjunction of its literals in order (a false
 * one negated), as an assertion tree; none when it passed no guard. Its
 * text (`assertionText`) reads back as the same formula, as REJ 2010's
 * Fig. 3 writes one: `C0 & !C2 & !C3 & C1`.
 */
export const variantContext = (variant: Variant): AssertionTree | null =>
  variant.literals
    .map(({ condition, holds }): AssertionTree =>
      holds
        ? grouped(condition, ['or'])
        : { kind: 'not', expr: grouped(condition, ['and', 'or']) },
    )
    .reduce<AssertionTree | null>(
      (context, literal) =>
        context ? { kind: 'and', left: context, right: literal } : literal,
      null,
    );
