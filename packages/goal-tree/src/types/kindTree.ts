/**
 * The tree and the IR typed by kind (goal-controller#215): a node's engine
 * properties are its kind's entry's output (`P[kind]`), and its `type` is
 * what the engine names its kind (`N[kind]`, the entry's `as`).
 */
import type { GoalExecutionDetail, Relation } from './goalTree';
import type { id } from './istar';

/** What each kind is to the engine: its `as`, by kind. */
export type Naming = { readonly [kind: string]: string };

/** The engine's properties, by kind. */
export type KindProps = { readonly [kind: string]: unknown };

/**
 * `useIstarDefaultNaming`'s reading: iStar's four kinds as the node types
 * the iStar engines have always read.
 */
export type IstarNaming = {
  readonly 'istar.Goal': 'goal';
  readonly 'istar.Quality': 'goal';
  readonly 'istar.Task': 'task';
  readonly 'istar.Resource': 'resource';
};

/** An iStar engine's properties by kind, from a goal's, a task's and a resource's. */
export type IstarProps<G, T, R> = {
  'istar.Goal': G;
  'istar.Quality': G;
  'istar.Task': T;
  'istar.Resource': R;
};

/** What every node has: where it is, its kind and what the engine names it. */
type KindBase<K, A> = {
  iStarId: id;
  /** the element's horizontal position in the diagram (piStar's absolute x) */
  x?: number;
  id: string;
  name: string | null;
  /** the piStar id of the actor it is in (none: a dependum, or on the paper) */
  actor?: id;
  relationToChildren: Relation | null;
  kind: K;
  type: A;
};

/** The tree shape a naming reads: the iStar reading's, or an own naming's. */
export type Shape = 'istar' | 'kinds';

/** A node the engine names `A`. */
type NodeNamed<P, N, A> = Extract<KindNode<P, N, 'istar'>, { type: A }>;

/**
 * A node under `useIstarDefaultNaming`: the shapes the iStar engines read,
 * a goal holding its goals (`children`) and tasks, a task its tasks and
 * resources (goal-controller#215 keeps them).
 */
type IstarNode<P, N, K extends keyof N & keyof P> = KindBase<K, N[K]> & {
  properties: { root?: boolean; engine: P[K] };
} & (N[K] extends 'goal'
    ? {
        children?: Array<NodeNamed<P, N, 'goal'>>;
        tasks?: Array<NodeNamed<P, N, 'task'>>;
      }
    : N[K] extends 'task'
      ? {
          tasks: Array<NodeNamed<P, N, 'task'>>;
          resources: Array<NodeNamed<P, N, 'resource'>>;
        }
      : {});

/** A node under an engine's own naming: every refinement child in `children`. */
type GenericNode<P, N, K extends keyof N & keyof P> = KindBase<K, N[K]> & {
  properties: { root?: boolean; engine: P[K] };
  children: Array<KindNode<P, N, 'kinds'>>;
};

/**
 * A tree node of an engine whose kinds map to `P`, are named by `N` and
 * read in the shape `S`, one member per kind: narrowing on `kind` (or
 * `type`) narrows `properties.engine`.
 */
export type KindNode<P, N, S extends Shape = 'kinds'> = {
  [K in keyof N & keyof P]: S extends 'istar'
    ? IstarNode<P, N, K>
    : GenericNode<P, N, K>;
}[keyof N & keyof P];

/** A refinement of the model: its link, how it refines, its parent and its child (piStar ids). */
export type ModelRefinement = {
  /** the link that makes it (an n-ary one's leg) */
  link: id;
  relation: 'and' | 'or' | 'neededBy';
  parent: id;
  child: id;
};

/** What every element has, whatever its kind. */
type ModelElementBase = {
  id: id;
  name: string;
  /** the actor it is in; none: a dependum, or on the paper */
  actor?: id;
  /** its custom properties, as written */
  properties: Record<string, string>;
};

/**
 * An element of the model as it is written, whatever its kind; one of a kind
 * with an entry has its `kind` narrowed and its `as`/`engine` (narrowing on
 * either narrows the others), and one of an ignored kind, or of a kind with
 * no entry, keeps `kind: string` and no `as`/`engine`.
 */
export type ModelElement<P = KindProps, N = Naming> =
  | (ModelElementBase &
      {
        [K in keyof N & keyof P]: { kind: K; as: N[K]; engine: P[K] };
      }[keyof N & keyof P])
  | (ModelElementBase & { kind: string; as?: undefined; engine?: undefined });

/** An actor of the IR: its properties, its roots, its trees (one per root) and its elements. */
export type KindModelActor<P, N, A, S extends Shape = 'kinds'> = {
  id: id;
  name: string;
  kind: string;
  properties: { engine: A };
  /** its roots' piStar ids, in the model's order */
  roots: id[];
  trees: Array<KindNode<P, N, S>>;
  elements: id[];
};

/** A link of the IR: every link of every kind, its relation as a refinement, its properties. */
export type KindModelLink<L> = {
  id: id;
  kind: string;
  source: id;
  target: id;
  relation: 'and' | 'or' | 'neededBy' | null;
  label?: string;
  properties: { engine: L };
};

/**
 * The typed IR (goal-controller#215): the actors with their roots and trees,
 * the trees on the paper and the dependums, every root, every link and the
 * refinement graph (n-ary refinements resolved), and every element.
 */
export type KindModel<P, N, A = {}, L = {}, S extends Shape = 'kinds'> = {
  actors: Array<KindModelActor<P, N, A, S>>;
  paper: Array<KindNode<P, N, S>>;
  dependums: Array<KindNode<P, N, S>>;
  /** every root's piStar id: the actors', then the paper's */
  roots: id[];
  links: Array<KindModelLink<L>>;
  refinements: ModelRefinement[];
  elements: Array<ModelElement<P, N>>;
};

export type { GoalExecutionDetail };
