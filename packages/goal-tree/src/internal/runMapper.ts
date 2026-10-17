/**
 * A mapper as goal-tree builds a model with it (goal-controller#215): its
 * entry for each kind, the tree shape its naming reads, its links' and
 * actors' mappers. A mapper written with entries is one already; one written
 * per role (`mapGoalProps`, `mapTaskProps`, `mapResourceProps`) is expanded
 * into the entries it stands for, the iStar reading's, so it builds the
 * model it always has.
 */
import type { Framework } from '@goal-controller/dialect';
import type { AnyEngineMapper, NodePropertiesUnion } from './engineMapper';
import { isKindMapper, type KindEngineMapper } from './entries';
import { otherFrameworkOf } from './roots';
import type { MapperDialect } from './engineMapper';
import type { KindNode, KindProps, Naming, Shape } from '../types/kindTree';

/** What an entry is given after every node is built. */
export type AfterCreationArgs = {
  node: { iStarId: string; id: string; kind?: string; type: string };
  input: Record<string, unknown> & {
    kind: string;
    props: Record<string, unknown>;
    raw: Record<string, string>;
  };
  allNodes: Map<string, KindNode<KindProps, Naming, Shape>>;
  model: unknown;
};

/** A kind's entry, as the builder runs it. */
export type RunEntry = {
  as: string;
  /** a node of a tree; otherwise in the model's elements only */
  tree: boolean;
  mapProps: (input: Record<string, unknown>) => unknown;
  afterCreation?: (args: AfterCreationArgs) => unknown;
  /** checked as a node, then left out (a mapper's `skipResource`) */
  skip?: true;
};

/** A mapper, as the builder runs it. */
export type RunMapper = {
  dialect: MapperDialect;
  shape: 'istar' | 'kinds';
  allowLeafGoals: boolean;
  entries: ReadonlyMap<string, RunEntry>;
  linkMapper: (kind: string) => ((input: never) => unknown) | undefined;
  mapActorProps?: (input: never) => unknown;
  /**
   * a mapper written per role builds what it always has: goal nodes with
   * `isQuality`, `kind` only in a framework's, and elements as written
   */
  legacy: boolean;
};

/**
 * How the IR held a framework's kinds before entries (goal-controller#171):
 * the kinds a mapper written per role maps with `mapGoalProps`, as goal
 * nodes. kaosdoc's, kaosprop's and nfrprop's entries say it themselves.
 */
const FRAMEWORK_GOAL_KINDS: Readonly<
  Record<Exclude<Framework, 'istar-2.0'>, readonly string[]>
> = {
  kaos: [
    'kaos.BehavioralGoal',
    'kaos.Softgoal',
    'kaos.DomainProperty',
    'kaosObstacles.Obstacle',
  ],
  nfr: ['nfr.NFR', 'nfr.Operationalization'],
};

/** A mapper written per role, as the entries it stands for. */
const fromRoles = (
  mapper: AnyEngineMapper<unknown, unknown, unknown, unknown, unknown>,
): RunMapper => {
  const after = mapper.afterCreationMapper;
  // its afterCreationMapper, on goal nodes, given the node's properties by role
  const afterCreation =
    after &&
    ((args: AfterCreationArgs) => {
      const engine = after({
        node: args.node as never,
        allNodes: args.allNodes as never,
        rawProperties: {
          nodeType: 'goal',
          kind: args.input.kind,
          props: args.input.props,
          raw: args.input.raw,
        } as NodePropertiesUnion,
        model: args.model as never,
      });
      if (typeof engine !== 'object' || engine === null)
        throw new Error(
          `[INVALID_MAPPER]: afterCreationMapper for goal ${args.node.id} must return an object`,
        );
      return engine;
    });
  const goal: RunEntry = {
    as: 'goal',
    tree: true,
    mapProps: mapper.mapGoalProps as RunEntry['mapProps'],
    ...(afterCreation && { afterCreation }),
  };
  const entries = new Map<string, RunEntry>();
  const framework = otherFrameworkOf(mapper.dialect);
  if (framework)
    for (const kind of FRAMEWORK_GOAL_KINDS[framework]) entries.set(kind, goal);
  else {
    entries.set('istar.Goal', goal);
    entries.set('istar.Quality', goal);
    entries.set('istar.Task', {
      as: 'task',
      tree: true,
      mapProps: mapper.mapTaskProps as RunEntry['mapProps'],
    });
    entries.set('istar.Resource', {
      as: 'resource',
      tree: true,
      mapProps: (mapper.mapResourceProps ??
        (() => undefined)) as RunEntry['mapProps'],
      ...(mapper.skipResource === true && { skip: true as const }),
    });
  }
  return {
    dialect: mapper.dialect,
    shape: 'istar',
    allowLeafGoals: mapper.allowLeafGoals === true,
    entries,
    linkMapper: () => mapper.mapLinkProps as never,
    ...(mapper.mapActorProps && {
      mapActorProps: mapper.mapActorProps as never,
    }),
    legacy: true,
  };
};

/** A mapper written with entries, by kind. */
const fromEntries = (mapper: KindEngineMapper): RunMapper => {
  const entries = new Map<string, RunEntry>();
  for (const entry of mapper.elements) {
    // the iStar reading's trees hold its goals, tasks and resources only
    const tree =
      entry.tree !== false &&
      (mapper.shape === 'kinds' ||
        ['goal', 'task', 'resource'].includes(entry.as));
    for (const kind of entry.kinds)
      entries.set(kind, {
        as: entry.as,
        tree,
        mapProps: entry.mapProps as RunEntry['mapProps'],
        ...(entry.afterCreation && {
          afterCreation: entry.afterCreation as RunEntry['afterCreation'],
        }),
      });
  }
  const links = new Map(
    mapper.links.flatMap((entry) =>
      entry.kinds.map((kind) => [kind, entry.mapProps] as const),
    ),
  );
  return {
    dialect: mapper.dialect,
    shape: mapper.shape,
    allowLeafGoals: mapper.allowLeafGoals,
    entries,
    linkMapper: (kind) => links.get(kind),
    ...(mapper.mapActorProps && { mapActorProps: mapper.mapActorProps }),
    legacy: false,
  };
};

/** A mapper, either form, as the builder runs it. */
export const runMapperOf = (mapper: object): RunMapper =>
  isKindMapper(mapper)
    ? fromEntries(mapper)
    : fromRoles(
        mapper as AnyEngineMapper<unknown, unknown, unknown, unknown, unknown>,
      );
