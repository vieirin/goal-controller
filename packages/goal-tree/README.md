# @goal-controller/goal-tree

goal-tree reads an iStar model (parsed with `@istar-ts/core`) into a typed IR
for an engine. It reads each element's text in the engine's dialect and maps
each element's properties with the engine's mapper. It names no engine.

## The IR: `GoalModel` (goal-controller#125)

```ts
const goalModel = GoalTree.goalModel(model, mapper);
goalModel.actors;    // { id, name, kind, properties: { engine }, trees, elements }[]
goalModel.links;     // every link: { id, kind, source, target, relation, label?, properties: { engine } }
goalModel.dependums; // the dependums, each a node
goalModel.elements;  // every element as written: { id, kind, name, actor?, properties }
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

## The mapper

`createEngineMapper<Goal, Task, Resource>()({ dialect, … })` maps the
properties of each element kind (`mapGoalProps`, `mapTaskProps`,
`mapResourceProps`). The keys an element is given are the ones its kind has
in the dialect (`properties[kind]`; an iStar node's kind is `goal`, `task`,
`resource` or `quality`, a framework's its own, goal-controller#187), each in
two forms:

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

```ts
createEngineMapper<GoalProps, TaskProps, ResourceProps>()({
  dialect: edgeV2,
  mapGoalProps: ({ props, raw, executionDetail, id, text, kind }) => ({
    retries: props.maxRetries ?? 0, // number | null | undefined
    dependsOn: props.dependsOn ?? [], // string[] | undefined
    utility: raw.utility ?? '', // as written
  }),
  mapTaskProps: ({ props }) => ({ retries: props.maxRetries ?? 0 }),
  mapResourceProps: ({ raw }) => ({ type: raw.type }),
});
```

A key the dialect doesn't give the kind doesn't compile (`props.optional`
on a goal whose dialect gives it to tasks only). Two more mappers are
optional:

- `mapActorProps({ props, raw, kind, id, name })`: the dialect's `actors`
  properties, typed for the actor's kind;
- `mapLinkProps({ props, raw, kind, id })`: its `links[kind]` properties,
  typed.

An actor's and a link's `raw` holds every actor's and every link kind's
keys, as written: a check reports one on a kind that hasn't it (cgm's
`context` on a link kind without one).

An engine without them gets `{}`. `afterCreationMapper` gets `model`, the
whole `GoalModel`, and `rawProperties`, the node's `props` and `raw` with its
`nodeType` (`goal`, `task`, `resource`) and `kind`.

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
