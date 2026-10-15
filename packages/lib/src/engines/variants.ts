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

export type VariantOptions = {
  /** the condition at a point (an assertion tree), or none */
  guard: (at: VariationPoint) => AssertionTree | null | undefined;
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

/** The variants of `root`, lazily, in a deterministic order. */
export function* eachVariant(
  model: AnalysisModel,
  root: string,
  options: Omit<VariantOptions, 'limit'>,
): Generator<Variant> {
  throw new Error('eachVariant: not implemented yet');
}

/** The first `limit` variants of `root`, whether there are more, and how many there are. */
export const variantsOf = (
  model: AnalysisModel,
  root: string,
  options: VariantOptions,
): Variants => {
  throw new Error('variantsOf: not implemented yet');
};

/**
 * A variant's context: the conjunction of its literals (a false one
 * negated), as an assertion tree; none when it passed no guard.
 */
export const variantContext = (variant: Variant): AssertionTree | null => {
  throw new Error('variantContext: not implemented yet');
};
