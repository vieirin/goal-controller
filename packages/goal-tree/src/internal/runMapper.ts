/**
 * A mapper as goal-tree builds a model with it (goal-controller#215): its
 * entry for each kind, the tree shape its naming reads, its links' and
 * actors' mappers.
 */
import type { MapperDialect } from './engineMapper';
import type { KindEngineMapper } from './entries';
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
};

/** A mapper, as the builder runs it. */
export type RunMapper = {
  dialect: MapperDialect;
  shape: 'istar' | 'kinds';
  allowLeafGoals: boolean;
  entries: ReadonlyMap<string, RunEntry>;
  linkMapper: (kind: string) => ((input: never) => unknown) | undefined;
  mapActorProps?: (input: never) => unknown;
};

/** A mapper, as the builder runs it. */
export const runMapperOf = (mapper: KindEngineMapper): RunMapper => {
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
  };
};
