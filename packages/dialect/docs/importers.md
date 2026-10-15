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
  } | null,
  diagnostics: { severity: 'error' | 'warning' | 'info', message }[],
}
```

- **The result.** No model and an `error` diagnostic: the text is not one this importer reads. Warnings and infos say what was read differently, or left out.
- **Ids.** An importer keeps the source's ids (piStar's ids are free text), so the source's rows (a reference tool's evaluations, say) join on them.
- **Kinds.** Kinds iStar 2.0 doesn't have go in the model's own `"metamodel"` block (istar-ts), declared by the engine's extension.
- **Direction.** One way. An export back to the source format is a separate decision, per importer.

## `.jucm` (jUCMNav, GRL): `importers/jucm`

`importJucm(text)` reads jUCMNav's EMF XMI 2.0 with lib's XML reader (`formats/xml.ts`). Each XMI element's attributes are typed by a zod schema, whose defaults are the metamodel's, since EMF writes no attribute that has its default (#105: no Ecore runtime). It writes a model in the GRL dialect ([grl.md](grl.md)):

- The `grlspec`'s elements, links, actors and strategies.
  - Only the *link* side of each element–link pair is read (`src`, `dest`): some writers (GoalCat) write only that side.
- The `urndef`'s GRL diagrams (`GRLGraph`):
  - where each element and actor is drawn;
  - which actor box draws an element (its actor);
  - the beliefs and belief links.
  - Several diagrams are placed one below the other.
  - An element no diagram draws is placed in a grid below them, with a warning.
- Skipped, with an `info`: the Use Case Maps (UCM diagrams, responsibilities, components, `ucmspec`), feature model diagrams, and elements' metadata.
- Strategies: one `strategies/<group>.json` per strategies group (ungrouped ones in `Strategies.json`). The model's 0..100 range (`_Use0to100EvaluationRange`) is the group's `range`.
- An XMI element whose attributes don't fit its schema (`importanceQuantitative="high"`) is left out, with an error naming it.

**Not in scope:**
- the round trip: there is no export to `.jucm`;
- Z.151 (`.z151`, the standard's XML), which is still open ([grl.md](grl.md)).
