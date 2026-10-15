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

`createEngineMapper<Goal, Task, Resource>()({ … })` maps the properties of
each element kind (`mapGoalProps`, `mapTaskProps`, `mapResourceProps`). Each
gets the raw values of its allowed keys, typed. Two more mappers are
optional:

- `mapActorProps({ raw, kind, id, name })` over `allowedActorKeys`;
- `mapLinkProps({ raw, kind, id })` over `allowedLinkKeys`.

An engine without them gets `{}`. The keys come from the definition
(`actorPropertyKeys`, `linkPropertyKeys` in `@goal-controller/dialect`).
`afterCreationMapper` gets `model`, the whole `GoalModel`.

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
