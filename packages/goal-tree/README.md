# @goal-controller/goal-tree

goal-tree reads an iStar model (parsed with `@istar-ts/core`) into a typed IR
for an engine. It reads each element's text in the engine's dialect and maps
each element's properties with the engine's mapper. It names no engine.

## The IR: `GoalModel` (goal-controller#125)

```ts
const goalModel = GoalTree.goalModel(model, mapper);
goalModel.actors;      // { id, name, kind, properties: { engine }, roots, trees, elements }[]
goalModel.paper;       // a framework's trees, outside every actor (KAOS, NFR)
goalModel.dependums;   // the dependums, each a node
goalModel.roots;       // every root's piStar id: the actors', then the paper's
goalModel.links;       // every link: { id, kind, source, target, relation, label?, properties: { engine } }
goalModel.refinements; // the refinement graph: { link, relation, parent, child }[], n-ary ones resolved
goalModel.elements;    // every element as written: { id, kind, name, actor?, properties },
                       // with a mapper by kind its `as`, and `engine` for a kind no tree holds
```

- **Actors hold trees, one per root goal.** A root is an element of a tree
  kind (Goal, Task, Resource; a Quality is never one) that refines nothing,
  that is, it has no outgoing refinement link (`actorRoots`). Today's
  exclusions stay:
  - an element only a Quality qualifies;
  - a Resource linked to nothing, under `unlinkedResources: 'ignore'`.
- **Tree children are the refinements into a node** (And, Or, NeededBy).
  Every other link (a contribution, a qualification, a dependency, an
  extension's) is only in `links`, with `relation: null`. Kinds no tree holds
  (an extension's) are only in `elements`. Every node has its actor's piStar
  id as `actor`.
- **A dialect without ids** (no element kind has a `prefix`): a node's id is
  its piStar id, and its name is its text, unparsed.

## The mapper: entries by kind (goal-controller#215)

An engine declares one entry per kind of its dialect, or per group of
kinds that map alike. Each entry says what its kinds are to the engine
(`as`, the node's `type`) and maps their properties (`mapProps`):

```ts
createEngineMapper({
  dialect: edgeV2,
  naming: useIstarDefaultNaming(),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'], // `as: 'goal'`, the naming's
      mapProps: ({ kind, props, raw, executionDetail, id, name, text }) =>
        kind === 'istar.Goal'
          ? { retries: props.maxRetries ?? 0 } // number | null | undefined
          : { retries: 0 },
      afterCreation: ({ node, input, allNodes, model }) => node.properties.engine,
    }),
    entry({ kind: 'istar.Task', mapProps: ({ props }) => ({ retries: props.maxRetries ?? 0 }) }),
  ],
  ignore: ['istar.Resource'], // no node; in `elements` as written
  links: (entry) => [entry({ kind: 'istar.ContributionLink', mapProps: ({ props }) => props })],
});
```

- **The kinds** (`ElementKindsOf<D>`) are, for an iStar dialect, iStar's
  four, its extension's node kinds and any namespaced kind it gives
  properties. For a KAOS or NFR dialect, they are the kinds it lists and
  the kinds it gives properties (KAOS's refinement hub).
- **Every kind has an entry or is in `ignore`.** A kind without one doesn't
  compile (`'kinds without an entry': "istar.Resource"`), and neither does
  a kind the dialect doesn't have, a kind in two entries, or an entry for
  an ignored kind.
- **Every link kind the dialect gives properties needs an entry in
  `links`.** A mapper without `links` doesn't compile for such a dialect,
  and a link kind without an entry gets `{}`.
- **`ignore` never visits a kind.** An ignored kind has no node, and its
  elements are in `elements` as written: an ignored Resource with children
  doesn't throw (`Resource node … can't have children`).
- **`mapProps` is given its element's kind**, one member per kind. Narrowing
  on `kind` narrows `props`: in a Goal-and-Quality entry, a goal-only key
  doesn't compile until `kind === 'istar.Goal'`. Its output is the node's
  `properties.engine`, typed by kind:
  - `EngineProps<typeof mapper>['istar.Task']` is the task entry's output;
  - `NodeOf<typeof mapper>` is a node, narrowed by `type` or `kind`;
  - `ModelOf<typeof mapper>` is the IR.

  An engine whose properties refer to its own nodes (Edge's `dependsOn`)
  writes the node type with `KindNode<IstarProps<Goal, Task, Resource>, IstarNaming, 'istar'>`.
- **`afterCreation`** runs once every node is built, children first. It is
  given the node, its `input`, every node by id and the IR, and returns the
  node's final engine properties, of the entry's type.
- **`tree: false`** keeps a kind out of the trees, in `elements` only, with
  its engine properties (an own naming's agents or hubs).

### The naming

`useIstarDefaultNaming(options?)` is the iStar reading:
- **Names:** `istar.Goal` and `istar.Quality` are a `goal`, `istar.Task` a
  `task`, `istar.Resource` a `resource`. An entry for one of those kinds may
  leave `as` out, and can't give another.
- **Trees:** a goal holds its goals (`children`) and its tasks; a task holds
  its tasks and its resources (a NeededBy link's).
- **Checks:** a resource has no children, only a task has resources, and a
  task has no goals.
- **Roots:** a Quality is never a root, nor is an element only a Quality
  qualifies.
- **Leaves:** a goal in an actor that nothing refines is an error, unless
  `useIstarDefaultNaming({ leafGoals: 'allow' })` (MutRoSe's Query goals).

An extension kind's entry (`{ kind: 'grl.Belief', as: 'belief' }`) puts its
elements in `elements`, each with its `as` and `engine`, not in a tree. An
entry naming one `goal`, `task` or `resource` puts it in the trees.

Without a `naming`, the engine names every kind itself (kaosdoc's
`goal`, `domainProperty`, `obstacle`). Each node holds every refinement child
in `children`, roots are the tree kinds' elements that refine nothing, and
there is no leaf rule.

### `props` and `raw`

The keys an element is given are the ones its kind has in the dialect
(`properties[kind]`; an iStar node's kind is `goal`, `task`, `resource` or
`quality`, a framework's its own, goal-controller#187), each in two forms:

- `props`: the value as the goal language reads its type
  (`readProperties` in `@goal-controller/goal-language`): an `int` or a
  `number` is a number, a `bool` a boolean, a `refList` its ids, a
  `pairList` its pairs, an `assertion` or an `expression` its tree, an
  `enum` one of its options' values (any word when it is `open`). A
  conditional value is either of its two types: narrow on the property it
  depends on. Empty is `null` (`[]` for a list). A value written with an
  error is unset: the dialect's checks report it, and the mapper never parses
  it.
- `raw`: the strings as written, for an engine that forwards a value
  verbatim.

`mapActorProps({ props, raw, kind, id, name })` maps the dialect's `actors`
properties. An actor's and a link's `raw` holds every actor's and every
link kind's keys, as written: a check reports one on a kind that hasn't it
(cgm's `context` on a link kind without one).

`TreeNode<G, T, R>`, `GoalNode`, `Task`, `Resource`, `GoalTreeType` and
`GoalModel<…>` remain as aliases over the iStar reading's nodes, for code
that types nodes by hand. The per-role form (`createEngineMapper<G, T, R>()`
with `mapGoalProps`, `mapTaskProps`, `mapResourceProps`, `skipResource`,
`afterCreationMapper`) is gone (#215): write entries.

## The shape an engine reads

An engine's definition declares the model it accepts with `model: { actors:
'one' | 'many', treesPerActor: 'one' | 'many' }`. The default is one actor
with one root goal. `modelShapeProblem(model, dialect)` says what doesn't
fit, for example `Edge reads one actor with one root goal; the model has 2
actors`. `Model.validate(model, dialect)` and `GoalTree.fromModel(model,
mapper)` throw it, as `[INVALID_MODEL]: …`.

- `GoalTree.fromModel` gives the IR's trees, flat. That is all a
  one-actor, one-tree engine reads (`tree.query.allByType`, `leafGoals`,
  `allGoalsMap`, `root`, `toJSON`).
- `GoalTree.goalModel` gives the whole IR for any shape. It doesn't check the
  shape.

See `packages/dialect/docs/adding-an-engine.md` (3.8) for an engine's side.
