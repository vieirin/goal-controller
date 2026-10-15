# Importers

An importer reads another tool's file into goal-controller's model: a piStar
file in one of our dialects, with what the dialect reads beside it. Importers
live in `packages/lib/src/importers/<format>/`. They are lib's, not the core
packages', since they know an engine's dialect.

## Shape

```ts
import(text) → {
  model: piStar JSON | null,     // its text: JSON.stringify(model, null, 2)
  dialectRecord: {
    engine,                      // recorded as the model's diagram.customProperties.engine
    projectResources,            // each project resource kind's files, by path
    options?,                    // the engine's options the source sets (a project's manifest keeps them)
  } | null,
  diagnostics: { severity: 'error' | 'warning' | 'info', message }[],
}
```

- **The result.** No model and an `error` diagnostic: the text is not one this importer reads. Warnings and infos say what was read differently, or left out.
- **Ids.** An importer keeps the source's ids (piStar's ids are free text), so the source's rows (a reference tool's evaluations, say) join on them.
- **Kinds.** Kinds iStar 2.0 doesn't have go in the model's own `"metamodel"` block (istar-ts), declared by the engine's extension, which its dialect names (`defineDialect({ …, extension: grlExtension })`, goal-controller#132). The engine object says its models carry them, so the workbench reads such a model with its block applied: `defineEngine({ id: 'grl', dialect: grl, …, fileKinds: true })` (`engines/grl/engine.ts`; `ENGINE_FILE_KINDS` is derived from it).
- **Direction.** One way. An export back to the source format is a separate decision, per importer.
- **Positions.** The source's, where it has them. A node it doesn't place is left without `x` and `y` and placed by the layout below.

## A layout for what has no diagram: `importers/layout.ts`

`layOut(model, origin)` places each node of a piStar model that has no position (actors, their elements, orphans, dependums) from the model's structure. It reads the nodes and the links' `source`, `target` and whether they are iStar's refinements, so it knows no engine or dialect:

- **Layers by refinement.** A root on top, its children one row below, siblings in the order of their links. An element refining two parents is under the first one's. A refinement cycle starts at its first element.
- **Beside what it links to.** An element in no refinement (a contribution's source, a dependum, an extension's node such as a belief) goes to the right of the element its first link joins, in the same row. A subtree is as wide as its nodes and what is beside them, so nothing overlaps.
- **Actors.** Each actor's elements inside its boundary (a margin of `padding`), the actors side by side, in the model's order. A node outside every actor goes in a column after the actor of the element it links to, in that element's row (the next free one). The others, linked to no actor, go after the last actor, laid out the same way.
- **A fixed grid.** `LAYOUT_GRID`: 160 px between columns, 100 between rows, a 40 px margin. The same model is laid out the same way every time.

Nodes that have a position keep it. The others are laid out as a model of their own from `origin`: links to positioned nodes are not followed. It returns how far they reach (`{ right, bottom }`) to size the diagram, or `null` when there was nothing to place.

## `.jucm` (jUCMNav, GRL): `importers/jucm`

`importJucm(text)` reads jUCMNav's EMF XMI 2.0 with lib's XML reader (`formats/xml.ts`). Each XMI element's attributes are typed by a zod schema, whose defaults are the metamodel's, since EMF writes no attribute that has its default (#105: no Ecore runtime). It writes a model in the GRL dialect ([grl.md](grl.md)):

- The `grlspec`'s elements, links, actors and strategies.
  - Only the *link* side of each element–link pair is read (`src`, `dest`): some writers (GoalCat) write only that side.
- The `urndef`'s GRL diagrams (`GRLGraph`):
  - where each element and actor is drawn;
  - which actor box draws an element (its actor);
  - the beliefs and belief links.
  - Several diagrams are placed one below the other.
  - An element no diagram draws is laid out below them by the layout above, with a warning; so is a whole file without diagrams.
- Skipped, with an `info`: the Use Case Maps (UCM diagrams, responsibilities, components, `ucmspec`), feature model diagrams, and elements' metadata.
- Strategies: one `strategies/<group>.json` per strategies group (ungrouped ones in `Strategies.json`). The model's 0..100 range (`_Use0to100EvaluationRange`) is the group's `range`.
- An XMI element whose attributes don't fit its schema (`importanceQuantitative="high"`) is left out, with an error naming it.

**Not in scope:**
- the round trip: there is no export to `.jucm`;
- Z.151 (`.z151`, the standard's XML), which is still open ([grl.md](grl.md)).

## iStarDT-X (iStar-DT): `importers/istardt`

`importIstardt(text, { modelName })` reads cmg-york/istardt's iStarDT-X
(`.istardt`, `.istardtx`) with lib's XML reader into a model in the
iStar-DT dialect ([istardt.md](istardt.md), #119):

- The one actor's goals, tasks, effects, qualities, condition boxes, predicates and variables, numbered by kind in the file's order (`G1`, `T1`, `Q1`, `E1`, `C1`, `P1`, `V1`): the file has names, not ids. An element's name is its description; `identifier` keeps the file's name where it isn't the camelCase of that name (#117 D1). A second actor is left out, with a warning.
- Refinements, effect links, and `pre`/`npr` as precedence links; a `pre` that is a formula becomes a condition the importer names, with an info.
- Formulas as the goal language's texts, in the operand order the translator's xmlparser (Jackson) reads them in.
- The sets as the actor's ordered lists, a continuous export's bounds on its element.
- The header in `diagram.customProperties`, the options in `dialectRecord.options`.
- No positions: the file has none, so the whole model is laid out by the layout above.
- What a file names and doesn't declare is a warning.

**Not in scope:**
- the round trip: there is no export to iStarDT-X;
- mx2dtx's `.drawio` (positions, iStarDT-V's shapes), which is still open ([istardt.md](istardt.md)).
