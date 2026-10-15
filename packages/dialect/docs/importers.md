# Native files and importers

A dialect's **native file** is a model in its own format, another tool's or
its own: jUCMNav's `.jucm`, an XSD-described XML, a text with its own
grammar (goal-controller#143). It is kept **1:1 with the piStar model**:
open it and the piStar model is read from it; edit the model and the file is
written from it again. An **importer** is a native file with a reader only.

Readers and writers are the dialect's, on helpers the core provides (below):
the formats are the goal language's (`@goal-controller/goal-language/formats`,
`packages/goal-language/src/formats/`); what works on piStar models (the
round trip, the layout) is lib's (`packages/lib/src/importers/`).
Nothing in the core names a format or a dialect; the toy dialect in
`packages/lib/test/dialect/support/native/` (an invented XMI format and a
five-rule Langium grammar) shows the whole path.

## Declaring one: `nativeFiles`

```ts
defineDialect({
  …,
  nativeFiles: {
    board: {
      label: 'Board XMI',
      extensions: ['.board'],          // lower case, with the dot; never .json or .txt (a piStar model's)
      format: 'xmi',                   // 'xmi' | 'xml' | 'json' | 'text': the tab's highlighting
      schema: { kind: 'ecore', path: 'schema/board.ecore' }, // optional, from the engine's folder
      read: (text, context) => …,      // the importer's result (Shape, below)
      write: (model, context) => …,    // optional: { text, diagnostics }; text null: this model can't be written, the diagnostics say why
      canonical: (text) => …,          // optional: the form two texts are compared in
      lossy: ['actors.*.nodes.*.x', 'actors.*.nodes.*.y', 'display'],
      language: …,                     // a text format's: highlighting and completion (defineLanguage)
    },
  },
});
```

- **The context** both get: `{ modelName, projectResources?, options? }`, the model's name and what the project holds beside it.
- **`schema`**: its kind says what it describes: `ecore` an XMI format, `xsd` an XML or XMI one, `json-schema` a JSON one, `langium` a text one (the grammar it is read with).
- **`lossy`**: what the format can't carry, as piStar paths (`*`: any key or index). A model written and read back is the model but for these, and a file is in sync with a model it reads to but for these. What the file holds that the model never keeps (a `.jucm`'s Use Case Maps) is not a model path: the engine's doc says it, and its fixtures with it aren't lossless (the round trip, below).
- **`defineDialect` checks** the id, the label, the format, each extension (lower case, dotted, one native file's), the schema's kind against the format and its path (a file inside the engine's folder), that `read` (and `write`, `canonical`) are functions, that a language is a text format's, and the lossy paths.
- **Extensions across dialects**: the Open dialog finds a file's dialect by its longest extension (`nativeFileFor`); no two registered dialects may take the same one (`sharedNativeExtensions`, which the workbench's tests check).

## The helpers

- **EMF XMI**, `formats/xmi.ts`: `readXmi` (below) and its inverse, `writeXmi(root, { idAttribute, namespaces, order, xmiVersion, encoding, indent })`. A node to write is `{ feature, type?, id?, attributes?, references?, hrefs?, children?, text? }`; references into the document are written as the target's id, or its path fragment when it has none (`//@actors.0/@goals.2`), space-separated; references into another file as `<feature href="other.ecore#//X"/>`. The root gets `xmi:version` and its namespaces (`xmi`, `xsi` when a node has an `xsi:type`, then the given ones); attributes are written `xsi:type` first, then in `order`, then as given; values escaped as EMF does (`&#xA;` for a line break), what the encoding can't carry as character references. A reference to a node not in the document is an error, and left out. `canonicalXml(text, { order })` is a canonical form for any XML: attributes in `order`, then by name, EMF's indents, comments out.
- **XML**, `formats/xml.ts`: `readXml(text) → { root, problems }`, elements with the ranges of their names, attributes and text.
- **JSON**, `formats/json.ts`: `readJson(text) → { value, diagnostics }` (where it stops being JSON), `writeJson(value)` (two spaces, a final line break), `canonicalJson(text)` (keys sorted).
- **Langium**, `formats/language.ts`: `defineLanguage(generated, { language?, module?, terminals? })`, on the goal language's Langium, turns a grammar's generated module into `{ id, services, parse, highlight, complete }`. `parse(text) → { ast, diagnostics }` gives Langium's AST (references unlinked: `$refText` names them), its syntax errors as diagnostics; `highlight` reads the grammar's keywords, terminals (a rule returning a number is `number`, one named like `STRING` is `string`) and assignments (a `name=` is a definition, a cross-reference a reference); `complete` offers the grammar's keywords and the names the text defines. Each language has its own services, apart from the goal language's. The dialect's `read` maps the AST to the model, its `write` prints it. Where it goes: [adding-an-engine.md](adding-an-engine.md).
- **The model compared**, `packages/dialect/src/native.ts`: `modelDifference(a, b, lossy)` (the first path where two piStar models differ, but for the lossy paths, keys sorted; the links and the dependencies compared as sets, every other list in order: a file that writes the actors or their elements in another order differs), `canonicalModel`, `withoutLossy`.

## The round-trip contract

`modelRoundTrip(file, model, context)` and `textRoundTrip(file, text, context)` (lib, `importers/native.ts`) check it, and give `{ ok, problem, diagnostics }`; every dialect with native files runs them on its fixtures with `describeNativeRoundTrips(dialect, fixtures)` (`packages/lib/test/support/nativeRoundTrip.ts`):

1. each fixture reads without an error;
2. with a writer, `read(write(m))` is `m` but for the format's `lossy` paths, `m` the fixture's model;
3. for a fixture marked `lossless` (one that holds only what the model keeps), `write(read(f))` is `f`, both in the format's `canonical` form (as written, without one).

The stress scripts' `native` column is the same check.

## In a project

A model's native file sits beside its piStar file (`<model>.<ext>`), listed in project.json under the model (`"native": { "<id>": "<path>" }`); the archive carries it. Opening a native file makes that project. A project that ships without the native file its dialect writes gets it when it opens, written from the model (a file its dialect only reads is never made). The sync rule is in the project module's README (`packages/ui/lib/project/README.md`).

# Importers

An importer reads another tool's file into goal-controller's model: a piStar
file in one of our dialects, with what the dialect reads beside it. As a
dialect's native file, it is its `read`; the importers below are lib's
functions, which goal-controller#144 moves into their engines' `nativeFiles`
(with writers). They live in `packages/lib/src/importers/<format>/`, and know
an engine's dialect.

## Shape

An importer's result is a native file's `read`'s (`NativeReadResult`, `@goal-controller/dialect`; lib's `ImportResult` is the same type).

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
- **Direction.** One way, for an importer. A native file with a writer goes both ways (above).
- **Positions.** The source's, where it has them. A node it doesn't place is left without `x` and `y` and placed by the layout below.

## A layout for what has no diagram: `importers/layout.ts`

`layOut(model, origin)` places each node of a piStar model that has no position (actors, their elements, orphans, dependums) from the model's structure. It reads the nodes and the links' `source`, `target` and whether they are iStar's refinements, so it knows no engine or dialect:

- **Layers by refinement.** A root on top, its children one row below, siblings in the order of their links. An element refining two parents is under the first one's. A refinement cycle starts at its first element.
- **Beside what it links to.** An element in no refinement (a contribution's source, a dependum, an extension's node such as a belief) goes to the right of the element its first link joins, in the same row. A subtree is as wide as its nodes and what is beside them, so nothing overlaps.
- **Actors.** Each actor's elements inside its boundary (a margin of `padding`), the actors side by side, in the model's order. A node outside every actor goes in a column after the actor of the element it links to, in that element's row (the next free one). The others, linked to no actor, go after the last actor, laid out the same way.
- **A fixed grid.** `LAYOUT_GRID`: 160 px between columns, 100 between rows, a 40 px margin. The same model is laid out the same way every time.

Nodes that have a position keep it. The others are laid out as a model of their own from `origin`: links to positioned nodes are not followed. It returns how far they reach (`{ right, bottom }`) to size the diagram, or `null` when there was nothing to place.

## EMF XMI: `formats/xmi.ts` (`@goal-controller/goal-language/formats`), the reader every XMI importer starts from

`readXmi(text, { idAttribute?, fileName? })` reads an EMF XMI document for
any metamodel (goal-controller#135). It knows none: the importer maps its
node types to piStar.

- **Nodes.** Each XML element is an `XmiNode`: its containment `feature`
  (the element's name), its `type` (`xsi:type`, or null), its `id` (from
  `xmi:id`, or `idAttribute`: jUCMNav keys by `id`), its `path` fragment
  (`//@actors.0/@goals.2`; the root's is `/`), its `attributes`, its
  `children` and its `parent`. `reader.document` has them all (`nodes`, in
  the file's order), `byId` and `byPath`. `reader.children(node, feature)`
  gives a node's children in one feature.
- **References**, in the forms EMF writes: an id list (`subgoals="g2 g3"`),
  path fragments (`//@actors.0/@goals.2`; a single-valued feature's `.0`
  may be left out), and an `href` to the same document (`#g2`,
  `model.xmi#//@goals.0`, where `fileName` is `model.xmi`), as an attribute
  or as children of the feature's name. `reader.references(node, feature)`
  gives the nodes they name; `reader.resolve(reference)` one.
- **Diagnostics.** A reference that names nothing in the document, or names
  another file, is a warning, and left out; a repeated id a warning (the
  first one keeps it). `reader.typed(schema, node)` types a node's
  attributes with a zod schema, whose defaults are the metamodel's (EMF
  writes no attribute that has its default); when they don't fit, it gives
  null and an error, and the importer leaves the node out. Text that isn't
  XML gives no reader and an error.

## `.jucm` (jUCMNav, GRL): `importers/jucm`

`importJucm(text)` reads jUCMNav's EMF XMI 2.0 with the XMI reader above (its ids in `id`). Each XMI element's attributes are typed by a zod schema, whose defaults are the metamodel's, since EMF writes no attribute that has its default (#105: no Ecore runtime). It writes a model in the GRL dialect ([grl.md](grl.md)):

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

The way back is `writeJucm`, GRL's native file writer ([grl.md § Native file](grl.md#native-file-144)).

**Not in scope:** Z.151 (`.z151`, the standard's XML), which is still open ([grl.md](grl.md)).

## iStarDT-X (iStar-DT): `importers/istardt`

`importIstardt(text, { modelName })` reads cmg-york/istardt's iStarDT-X
(`.istardt`, `.istardtx`) with lib's XML reader into a model in the
iStar-DT dialect ([istardt.md](istardt.md), #119):

- The one actor's goals, tasks, effects, qualities, condition boxes, predicates and variables, numbered by kind in the file's order (`G1`, `T1`, `Q1`, `E1`, `C1`, `P1`, `V1`): the file has names, not ids. An element's name is its description; `identifier` keeps the file's name where it isn't the camelCase of that name (#117 D1). A second actor is left out, with a warning.
- The file's names as the piStar ids (G1 and the like are the texts' ids).
- Refinements; each task's effect group, its effects linked from it with their probabilities; turns-true and turns-false links to the predicates; `pre`/`npr` as precedence links (a `pre` that is a formula becomes a condition the importer names, with an info); a quality that is a weighted sum as its utility links, as mx2dtx's diagrams draw them.
- Formulas as the goal language's texts, in the operand order the translator's xmlparser (Jackson) reads them in.
- The sets as the actor's ordered lists, a continuous export's bounds on its element.
- The header in `diagram.customProperties`, the options in `dialectRecord.options`.
- No positions: the file has none, so the whole model is laid out by the layout above.
- What a file names and doesn't declare is a warning.
- **In the workbench:** iStarDT-X is iStar-DT's native file (`nativeFiles.istardtx`, with a writer): opening a `.istardt`/`.istardtx` makes its project. The writer, its canonical form and its oracle (dtx2dtg's validator) are in [istardt.md](istardt.md), Native file. `FILE_IMPORTERS` lists none now: every importer is a native file.

**Not in scope:**
- mx2dtx's `.drawio` (positions, iStarDT-V's shapes), which is still open ([istardt.md](istardt.md)).

## `.tropos` (TAOM4E, Tropos4AS or GODA): `engines/tropos4as/taom4e`

`readTaom4e(text, { modelName, fileName })` reads TAOM4E's EMF XMI with the XMI reader above, in #143's `read` shape (`{ model, dialectRecord, diagnostics }`). It is written against TAOM4E's base Tropos metamodel, `TAOM4E-MM.ecore`, committed beside it (`taom4e/reference/`, its origin in the README there). The mapping is logged on #134 (item 4's D):

- **Elements.** Actors, hard goals, softgoals, plans and resources → iStar's actor, goal, quality, task and resource, with the file's ids (`xmi:id`, else the path fragment) and names. An element is its actor's by `wanter`, `capableOf` or `use` (or the actor's `wanted`, `plans`, `resources`). A dependency's dependum is in no actor. An element in no actor and no dependency is an orphan, with an info.
- **Links.**
  - An AND/OR `BooleanDecomposition` → AND/OR refinements, child to root. It reads the links the decomposition lists and the links that name it.
  - A means-end → an OR-refinement of its end: iStar 2.0 has no means-end link, as the Tropos4AS seeds write it. A resource as the means is left out, with a warning.
  - A contribution → iStar's; `FContribution.metric` `++`, `+`, `-`, `--` → make, help, hurt, break. Any other metric → `unknown`, with a warning. A contribution to anything but a softgoal is left out, with a warning (iStar 2.0 contributes to qualities).
  - A dependency → its dependum, linked from the depender and to the dependee. Its `why` and its formal attributes are not read (an info).
  - A link's id is its relation's `xmi:id`, else `<source>-<Kind>-<target>`, as the seeds name them. A dependency's two links take theirs from goal-controller's extension, when the file has one.
- **Positions.** From the `diagram` package: the first diagram node whose `core` names an element or an actor gives its `x`, `y` (read as written, not relative to the node's container), `width` and `height`. What no diagram places is laid out by the layout above, with an info.
- **Formal Tropos's attributes** on a hard goal → Tropos4AS's:
  - `creationProperty` → `creation`, `fulfillmentProperty` → `achievement`, `invariantProperty` → `maintain`;
  - `mode`: `ACHIEVE` → the default type, `MAINTAIN` → `type: maintain`, `ACHIEVEMAINTAIN` → maintain (a warning: its achieve phase is lost), `AVOID` → kept as `mode` (a warning);
  - `attribute`, and the formal attributes of plans, resources, softgoals and actors: kept as written, unread;
  - Formal Tropos writes LTL: a text the goal language can't read is kept as written, and the checks report it.
- **GODA-shaped.** When every hard goal's name follows CRGMToPRISM's `G1: …` and every plan's `T1.1: …`, and no Tropos4AS attribute is set (a fulfillment or invariant property, a mode other than ACHIEVE), the model is GODA's:
  - `dialectRecord.engine` and the diagram's engine are `goda`;
  - `creationProperty` stays `creationProperty` on goals and plans (CRGMToPRISM reads GODA's context there);
  - the one root goal is `selected`, as CRGMToPRISM generates from the root goals. With several roots, none is, with a warning.
  - Otherwise the model is Tropos4AS's, its `"metamodel"` block with it.
- **What isn't read**, with an info: classes outside the mapping (`Capability`, …).
- **In the workbench:** `.tropos` is Tropos4AS's native file (`nativeFiles.tropos`, with a writer): opening one makes its project. The writer, the extension it keeps Tropos4AS's own constructs in, and the round trips are in [tropos4as.md](tropos4as.md), Native file.

**Unverified against TAOM4E.** No `.tropos` file TAOM4E wrote survives (#134), so the fixtures (`packages/lib/test/engines/tropos4as/taom4e/`) are written by hand against the ecore. They hold two roots in an `xmi:XMI` (the project and its business model), as EMF writes a resource of two, with the packages' `nsPrefix`es, and reference by `xmi:id`. In a file that references by EMF's multi-root path fragments (`/1/@TroposClasses.0`), those references don't resolve (warnings): the XMI reader resolves single-root fragments only.
- The seeds' twins (`cleaner-agent.tropos`, `patient-monitoring.tropos`) import to what the base metamodel carries of the seeds (`taom4eCarried`).
- The GODA-shaped twin of `examples/goda/dm` (`dm-goda.tropos`) generates, through the GODA engine, what `dm2.txt` does, file for file (#134 D1.3).
- `pnpm stress:tropos4as`'s importer column runs both.

**Not in scope:**
- the Tropos4AS extension's metamodel (artifacts, failures, errors), which TAOM4E's plug-ins wrote: it is in REJ 2017's figures only ([tropos4as.md](tropos4as.md)).
