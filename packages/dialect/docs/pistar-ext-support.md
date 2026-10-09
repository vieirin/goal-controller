# piStar-ext with the dialect framework

A stress test of `@goal-controller/dialect` (called `@goal-controller/definitions`
when this was written). Can piStar-ext's extension
mechanisms, and its iStar4RationalAgents example, be written as an engine
definition?

**Sources**

- Gonçalves, Rodrigues, Miranda, Pimentel, Araújo, Castro, _piStar-ext:
  Supporting the Creation of iStar Extensions with the piStar Tool_, iStar 2020
  ([CEUR Vol-2641, paper 6](https://ceur-ws.org/Vol-2641/paper_06.pdf)).
  Figs. 1, 3 and 4 were read from the rendered PDF.
- [guiRodrigues/pistar-supporting-creation-istar-extensions](https://github.com/guiRodrigues/pistar-supporting-creation-istar-extensions).
  `master` is plain piStar 2.0.0. All the extension code is one commit,
  `830a4e3` on `feature/supporting-creation-istar-extensions`.

**Branch** `vn/definitions-pistar-ext-annotations`, from `vn/engine-definitions` @ `5873719`.

> The sections up to "Open questions" are the first pass, on istar-ts 0.7.0.
> "Re-evaluation with istar-ts 0.8.0" is the second. The last section,
> **"piStar-ext as its own dialect"**, is current: piStar-ext is a dialect of
> its own with its own workbench mode, and the Edge modes don't read it.
>
> Since then the framework was renamed `@goal-controller/dialect`
> (`packages/dialect`: `defineDialect`, `DialectDefinition`, `AnyDialect`; the
> UI's `ENGINE_DIALECTS`), and the concrete definitions moved next to their
> engines in `@goal-controller/lib`: `src/engines/{edge,edgeV2,edgeLangium}/definition.ts`,
> what the Edge family shares in `src/engines/edgeFamily/`, and
> iStar4RationalAgents in `src/dialects/pistarExt/`. The names below are the
> current ones; paths in the commit tables are as they were.

## Summary

| piStar-ext mechanism                                    | Expressed?                      | How                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stereotypes `<<action>>` on nodes                       | **With a change** (done)        | New `annotations` on an element kind. Values are an `enum` property.                                                                                                             |
| Stereotypes on actors, roles and links                  | **No**                          | Actors and links aren't element kinds.                                                                                                                                           |
| Tagged values `{type = duty}` on nodes                  | **With the same change** (done) | Two properties (`tag`, `tagValue`). Listed values use the existing `ConditionalValue`.                                                                                           |
| Default tagged values Id, Reference to, Status, Logic   | **As-is**                       | Options of the `tag` enum.                                                                                                                                                       |
| Groupers (a named set of kinds)                         | **As-is, as authoring only**    | The same properties are declared on several kinds (like `REWARDS` in `edgeProperties.ts`). The grouper's name isn't data, and the paper's Actor + Role grouper can't be written. |
| New node constructs with an SVG symbol (Planning, Plan) | **No**                          | `ElementKind` is a closed union, and the schema has no shapes.                                                                                                                   |
| New link constructs with source/target and line style   | **No**                          | The schema has no links at all.                                                                                                                                                  |
| OCL constraints                                         | Not in piStar-ext either        | The paper lists them as future work. Named checks are the closest fit.                                                                                                           |

Edge, EdgeV2 and EdgeLangium declare no annotations, so they read and write
exactly as before:

- the harness against `vn/rt-langium-notation` passes;
- lib's PRISM tests are unchanged and green.

## How piStar-ext stores an extension

This is what the definition has to map onto, read from `830a4e3`.

- **Model level.** `extension: { stereotype_list, taggedvalue_list, group_list }`.
  Each entry is `{ name, constructsApplie: [types], groupName }`.
- **Per cell** (actors, nodes, links):
  `extension: { stereotype, selectedStereotype, taggedValue, selectedTaggedValue }`.
  - one stereotype and one tagged value per element;
  - `selectedTaggedValue` is the tag's name, `taggedValue` its value;
  - the element's `text` stays clean.
- **Labels are rendered, never parsed.**
  - A node's stereotype is a separate SVG text, `<<X>>`, drawn above the name.
  - The tagged value is prefixed to the name as `{k=v} name`, with no spaces.
  - A link's label is composed as `<<s>>\n{k=v}`.
- **Groupers** are copied by value into the stereotypes and tagged values that
  use them. Only built-in kinds can be grouped.
- **New constructs** are saved only in the browser's `localStorage['createdNodes']`,
  not in the model:
  - fields: name, SVG path `d`, Node or Link, and for links source/target kinds
    and a line style;
  - a model that uses one doesn't load in another browser;
  - new nodes can only be inner elements of actors;
  - the "Create a new Construct" pop-up never records a link's target (`target = sources`).
- **Validation.** None for stereotypes and tagged values. New links get an
  `isValid` copied from OR-refinement. OCL isn't implemented.

## Mechanism by mechanism

### Stereotypes: with a change (done)

> **Syntax moved to the goal language** (`packages/goal-language`, see
> `packages/goal-language/docs/goal-language.md`). Annotations are part of
> the one grammar every dialect is written in; a kind only says it carries
> them (`annotated: true`, which `withExtension` sets), and they set the
> fixed keys `stereotype`, `tag` and `tagValue` (the dialect package's
> `ANNOTATION_KEYS`). The definition-level `delimiters`/`parts` described
> below in earlier rounds no longer exist.

An element kind's line may carry annotations **before the id**, as a
resource's declaration (`{int 0..100 = 80}`) goes after the name:

```
ElementLine : Annotation* ElementId ':' Name ('[' RtExpr ']')? Declaration? ;
Annotation  : '<<' stereotype=TEXT '>>' | '{' tag=TEXT ('=' tagValue=TEXT)? '}' ;
```

The Notation view writes `<<action>> {type = duty} T1: Book a room`.

- The stereotype is a property (`stereotype`), never part of the element's
  text. That matches piStar-ext, whose `name` stays clean too.
- Editing the annotation produces property edits, as editing a declaration does.
- The inspector offers it as a select of the kind's declared stereotypes.
- Annotation groups are read in any order, each by the first annotation of the
  kind that reads it, and each annotation once.
- piStar-ext's `{Id=G1}` reads. The paper's `{Id = G1}` is what gets written.

**Gaps**

- **Actors, roles and links can't carry one.** That covers all four of the
  paper's rational-agent stereotypes (simple-reflex, model-based reflex,
  goal-based, utility-based), which sit on the Actor + Role grouper.
- **"New Value".** piStar-ext lets a modeller type a stereotype that isn't
  declared. An `enum` is closed, so this needs an open enum
  (`{ type: 'enum', options, open: true }`), or a `text` property with suggestions.
- **One stereotype per element.** That matches piStar-ext. UML allows several
  (`<<a, b>>`), which would need a list value config.

### Tagged values: the same change, plus what the schema had

`tag` is an `enum` of the default tags (Id, Reference to, Status, Logic) plus
the profile's own. `tagValue`'s config depends on `tag` through the existing
`ConditionalValue`: when `tag` is `type` it is `enum{duty, right}`, otherwise
`text`. The inspector shows a select or a text input to match.

**Gaps**

- **`ConditionalValue` has one condition.** So a kind can have only one tag
  with listed values. The fixture throws if a profile declares two. This needs
  `cases: [{ when, value }…], otherwise`.
- **No "is set" condition.** `tagValue` can't say it applies only when `tag` is
  set, because `Condition` compares against a value and unset is `undefined`.
  This needs `{ set: key }`.
- **piStar-ext's free `{value}`.** Its "New Value" tag is rendered without a
  key. Not expressed: the annotation's first part is the tag's name.
- **One tagged value per element.** Again, that matches piStar-ext. Several
  (`{Id = G1, Status = done}`) would fit the existing `pairList` value config
  on one property (`separator: ','`, `pair: '='`), but that changes the storage.

### Groupers: as authoring, not as data

The fixture's `grouper(kinds, profile)` declares the same properties and
annotations on each kind it lists. That's how `edgeProperties.ts` already shares
`REWARDS` between goals and tasks, so nothing new is needed to _apply_
something to a set of kinds.

**What's lost**

- The grouper's name isn't data: a generator or the inspector can't show
  "applies to the rational grouper". piStar-ext only keeps it for display too.
- The paper's own grouper (Actor + Role) can't be written. Actors aren't kinds.

**Change still needed** if groupers should be data: `kindSets: Record<string,
readonly ElementKind[]>`, with properties allowed to name a set instead of
being repeated per kind. That's only worth doing together with the open kinds below.

### New constructs (Planning, Plan): not at all

Fig. 4 shows both added as **node** constructs. Planning is an arrow-shaped
symbol inside an Agent's boundary ("the creation of a sequence of tasks by an
agent"). Plan's symbol isn't shown in use. The schema can't say any of this:

- `ElementKind = 'goal' | 'task' | 'resource' | 'quality'` is closed. Every
  per-kind table is a `Record<ElementKind, …>`:
  - `properties` in the schema;
  - `specsFromDefinition`'s four fixed kinds;
  - goal-tree's `ViewKind` and its `KIND` map from `istar.*`;
  - the UI's `NodeKindKey`.
- The schema has no shapes. `fill` is its only presentation.
- The schema has no containment (piStar-ext's `canBeInnerElement`) and no links.

A workaround that would fit today, _not_ done: treat Planning as a **variant
of an existing kind**. A Task would carry a preset `stereotype: planning`,
plus a palette entry and a shape keyed on that property:

- istar-ts already supports palette entries with preset properties
  (`ElementToolEntry`) and a custom element `component`;
- the definition would need `variants: [{ name, properties, shape }]` on an element kind.

This is cheap, but it is not what piStar-ext means by a new construct. An
engine would read a Planning as a Task.

### OCL: not in piStar-ext

Rules are named checks in a registry: the definition names them, an engine's
library implements them. An OCL constraint would be another named check. A
generator would need an OCL evaluator, which nobody has.

## Schema changes

### Made on this branch

- **`ElementDefinition.annotated?: boolean`** (was `annotations`, a list of
  declarations): the line carries the goal language's annotations, each
  written only when its first property is set.
- **`elementLineKeys(element)`** reads the keys an element line writes
  (`ANNOTATION_KEYS`, `DECLARATION_KEYS`).
- **`defineDialect`** now:
  - rejects an annotation or a declaration naming a property its kind doesn't have;
  - leaves the keys an element line writes out of `propertyLineOrder`'s
    "each operand kind key once" rule.
- **goal-language** (moved from the dialect package's `derive`):
  - `readLine` reads a line's annotations with their spans, and
    `annotatedProperties` what they set (the first of each kind);
  - `writeAnnotations(properties)`;
  - `lineId` skips leading annotations;
  - `elementLine` takes the annotations as an optional fourth argument;
  - `readDeclarationBody` is now shared by declarations and annotations;
  - `notationDocument` writes annotations;
  - `notationEdits` reads them back as property edits, through the one
    `setKeys` helper that declarations use too. While one group can't be
    read, no annotation key changes;
  - `documentDiagnostics` places spans after the annotations, reports
    "This annotation cannot be read", and runs the checks an annotated
    property names.
- **UI** (`lib/workbench/definitionLanguage.ts`). The Notation view's
  highlighter reads annotations before the id. The parser is exported as
  `documentParser` so the harness can tokenise lines.

### Still needed (by value for piStar-ext)

1. **Open element kinds.** A kind registry in the definition, e.g.
   `kinds: Record<string, { base: 'node' | 'actor'; shape?; containedIn? }>`,
   replacing the closed union. This ripples through `properties`,
   `specsFromDefinition`, goal-tree's view, lib's mappers (which must still
   ignore unknown kinds) and the UI's `NodeKindKey`.
2. **Links in the definition.** `links: Record<string, { source; target;
line: 'continuous' | 'dashed' | 'dotted'; marker?; annotations? }>`. The
   Notation view has no link lines (structure stays in the diagram), so link
   stereotypes could only be edited in the inspector, or in a new link-line syntax.
3. **Actors in the document.** Actor lines carrying annotations: today the
   document lists only operand and declared kinds.
4. **Profiles as data.** Promote the fixture's `withProfile` and `KindProfile`
   to a schema section (`profiles` or `extends`) with `kindSets`, so a
   generator can read the stereotypes and tags as declared.
5. **Value configs.** An open enum, a multi-case conditional value, and an
   "is set" condition.
6. **A definition without a notation.** `notation` is required and
   `defaultConstruct` must name constructs. Element lines need `{id}`, but
   piStar-ext labels have no id (`{Id = G1}` is a tag). So today a profile can
   only be laid over an engine with ids, as the fixture does over EdgeV2.
7. **Storage adapter.** piStar-ext keeps stereotypes and tags in a per-cell
   `extension` block. goal-controller reads `customProperties`. Importing or
   exporting piStar-ext files needs a mapping:
   - `selectedTaggedValue` ↔ `tag`, `taggedValue` ↔ `tagValue`, `stereotype` ↔ `stereotype`;
   - the model-level lists ↔ the profile.

   istar-ts already round-trips the `extension` block as `extra`, so nothing
   is lost meanwhile. It just isn't shown.

## What works end to end, and what doesn't

**Tested** (`test/pistarExt.test.ts`, `test/uiLib.test.ts`, 21 new tests):

- the fixture definition and its checks;
- reading and writing lines, including piStar-ext's spacing, multi-word
  stereotypes and tags, order and duplicates;
- the document, edits and the round trip doc → edits → model → doc;
- name and notation edits on annotated lines;
- inspector specs: the stereotype select, the tag select, and `tagValue`
  switching between select and text;
- diagnostic positions;
- completion inside an annotated notation;
- highlighter tokens, plus the unchanged behaviour of definitions without annotations.

**Not wired.** No workbench engine uses an annotated definition:

- `ENGINE_DIALECTS` (`packages/ui/lib/workbench/engineDialects.ts`) is keyed
  by workbench engine (`edge`, `edgev2`);
- the fixture lives in `test/fixtures/`, not in `src/`.

So the React inspector and Notation view, which are generic over their
definition, have **not been seen rendering annotations in a browser**.
Wiring them needs the decision in the first open question below. The diagram
labels (istar-ts canvas) don't show annotations either; see istar-ts below.

## What istar-ts would need

From `~/vieirin/istar-ts` @ `cb0ab99`. Nothing there was changed.

**Works today**

- Stereotypes and tags stored in `customProperties` round-trip, and so do
  unknown keys such as piStar-ext's `extension` block (`extraOf`,
  `core/src/serialization.ts:134`).

**Via an extension hook, no core change**

- **Node labels with `<<X>>` and `{k = v}`.** An `IstarExtension` element
  `component` (`react/src/registry.ts:108`) draws them from the properties.
  It could reuse `writeAnnotations` from the definition, like `problemBadges`
  wraps `DefaultElementComponent` today. Inline label editing would still
  edit the raw name.
- **Stereotype and tag fields** through `properties` (`defineProperties`) or a
  custom `inspector`.
- **Stereotyped palette variants** (`ElementToolEntry` with preset `properties`, `registry.ts:140`).

**Core changes**

- **New node kinds.**
  - `core/src/metamodel.ts:11-44` has closed `as const` arrays and
    `Record<NodeKind|ElementKind, …>` tables.
  - `core/src/serialization.ts:190` throws on an unknown element `type`. It
    needs a registry lookup, or a pass-through.
  - Also `react/src/registry.ts:170,187` (records keyed by kind),
    `react/src/context.tsx:29` (`Tool`) and `react/src/shapes.tsx:133`.
- **New link kinds and their rules.**
  - `core/src/constraints.ts:401` (`CHECKS` per kind) should become
    registrable, ideally as source/target kind sets.
  - Also `core/src/operations.ts:290`, and `serialization.ts:246`, which throws
    on an unknown link `type`.
  - Rendering: `react/src/edges.tsx:97-299` (markers, dash styles, labels per kind).
  - Link tools: `react/src/Palette.tsx:73-81`.
- **Link labels.** `link.name` is never drawn, and links have no `component`
  override. Add `component` to `LinkKindConfig` (`registry.ts:150`).
- **Display text vs stored text.** `EditableLabel`
  (`react/src/default-components.tsx:20`) shows and edits the raw name. A hook
  is needed so a stereotype line can be shown without being edited as text.
- **Groupers and validation hooks.** A kind-set concept in `metamodel.ts` used
  by the rules, plus an extension-level veto/validation hook. The workbench's
  `rejectEdit` lives outside istar-ts today.
- **Extension files.** No metamodel or extension file concept exists
  (`METAMODEL_VERSION` is a constant). Loading piStar-ext's lists needs the
  registrable metamodel first.

## In the goal language (done)

What an LSP or a grammar generator would have needed is now
`packages/goal-language/src/goal.langium` and its validator:

- **One grammar.** `ElementLine` and `AnnotatedName` (lines without ids)
  start with `Annotation*`. No generator: the grammar is fixed, and a
  dialect only says which kinds carry annotations.
- **Lexing.** GoalLexer switches token sets by position: `{` before the id
  opens a tagged value, after the name a declaration; tag names and
  stereotypes (with spaces and `-`) are TEXT tokens only inside their
  delimiters.
- **Validation** (`documentDiagnostics`):
  - a second stereotype or tagged value is reported as not read;
  - annotations on a kind that carries none are reported;
  - enum values are checked against their options unless the enum is open
    (stereotypes and tags are open);
  - `ConditionalValue`'s value per tag, and the named checks.
- **Completion.** Stereotype names, tag names and listed tag values are not
  offered yet.
- **Semantic tokens.** `highlightLine` emits `brace`, `meta` and `operator`
  for annotations, from the lexer's tokens.
- **Context.** `contextFromView` carries every custom property, so a server
  gets `stereotype`, `tag` and `tagValue` without a change.

## Open questions

1. **How does a workbench model pick a profile?** _Answered in the
   re-evaluation: the workbench always reads the known dialects._
   - Options: a model-level setting saved in the file (piStar-ext saves its
     lists in the model), a workbench toggle, or an engine variant.
   - This decides whether the fixture moves to `src/` and how
     `ENGINE_DIALECTS` is keyed.
2. **Should stereotypes and tags live in `customProperties`, or in
   piStar-ext's `extension` block?**
   - `customProperties` keeps them in the existing property machinery.
   - The `extension` block keeps piStar-ext files compatible without an adapter.
   - Whatever the choice, the engines must not report `stereotype`, `tag` and
     `tagValue` as "not read" in Problems.
3. **Is "a Planning is a Task variant" good enough for iStar4RationalAgents?**
   If not, the open kinds and istar-ts core changes are needed first.
4. **Should iStar-only definitions (no `[]` notation, no RT ids) be a goal?**
   piStar-ext is engine-free. The schema assumes an engine dialect.
5. **One stereotype and one tag per element, as in piStar-ext, or UML-style lists?**

## Effort estimate

Rough engineer-days, assuming the current code owners.

| Work                                                                                                                                                          | Estimate                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Annotations (this branch)                                                                                                                                     | done                    |
| Profiles and kind sets as schema data; open enum, multi-case conditional, "is set" condition                                                                  | 2–3 d                   |
| Wire a profile into the workbench (selection, inspector, Notation view, Problems not flagging profile keys); diagram labels via an istar-ts element component | 2–4 d, after question 1 |
| piStar-ext import/export adapter (`extension` block ↔ properties, model-level lists ↔ profile)                                                                | 1–2 d                   |
| Stereotype/tag completion and enum validation in the local language support                                                                                   | 1 d                     |
| Open element kinds in definitions, goal-tree, lib (ignore unknown kinds) and UI                                                                               | 4–6 d                   |
| istar-ts: registrable node kinds, shapes, palette, serialization                                                                                              | 5–8 d                   |
| istar-ts: registrable link kinds, rules as kind sets, link rendering and labels                                                                               | 4–6 d                   |
| Grammar/LSP for annotations (done: the goal language)                                                                                                         | 2–3 d                   |

Supporting stereotypes and tagged values on nodes in the workbench is about
**a week** on top of this branch. Full piStar-ext (actors, links, new
constructs with symbols) is **4–6 weeks**, most of it in istar-ts.

## Re-evaluation with istar-ts 0.8.0

> **Superseded** by "piStar-ext as its own dialect" below. After this round,
> the user chose a standalone dialect, so the "always read the known
> dialects" wiring of `6ec0f0d` was undone in `c5c8627`. Findings 1 and 4
> are fixed in istar-ts 0.8.1 and 0.9.0.

istar-ts 0.8.0 (`@istar-ts/core` and `@istar-ts/react`) can extend the
metamodel:

- `extendMetamodel` adds namespaced element and link kinds (`behavesLike`,
  `pistarType`, declarative link rules);
- the react registry draws them (`shape`, `line`).

That removes the blockers the first pass found in istar-ts. This round:

| Commit    | What                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `f07444d` | istar-ts `^0.8.0` in goal-tree and ui; five `.filter(isActor)` call sites wrapped (see findings)                                       |
| `d24df06` | `ExtensionDefinition`: dialects as data, iStar4RationalAgents in `src/extensions/`, goal-tree's `goalView` takes any dialect's model   |
| `6ec0f0d` | The workbench reads the known dialects: parsing, canvas, labels, piStar mode's inspector, and the editors through `EDITOR_DEFINITIONS` |

Your decision: **the workbench always reads the known dialects.** A model
without their kinds reads and writes byte for byte as before; this is tested
on every example under `examples/` and `dissertationExamples/`.

### What moved from "doesn't fit" to "fits"

| Mechanism                                   | First pass     | Now                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New node constructs** (Planning, Plan)    | No             | **Fits.** `ExtensionDefinition.elements` (category, `behavesLike`, `pistarType`, size, `shape`) → `metamodelExtensionOf` → istar-ts. Planning behaves like a Task and is saved as piStar-ext's `istar.Planning`. Plan is a plain node.                                                                                                                                    |
| **New link constructs**                     | No             | **Fits** (schema and istar-ts). `links` with `behavesLike` or `rules` (sources/targets, `sameActor`, `allowDependum`, `allowSelf`, `unique`) and a `line` (dash, marker). The paper's example has no link, so iStar4RationalAgents declares none. The tests use a test-only Generates (own rules) and Alternative (behaves like OR-refinement) with istar-ts's `canLink`. |
| **Groupers**                                | Authoring only | **Data.** `groupers: { rational: ['istar.Actor', 'istar.Agent', 'istar.Role'] }`. Stereotypes and tagged values name kinds or groupers, and `profileOf` resolves them. The paper's Actor + Role grouper can now be written (Agent added because Figs. 3-D and 4 apply goal-based to one).                                                                                 |
| **Stereotypes on actors and roles**         | No             | **Partly.** Declared through the rational grouper, drawn above the actor in every mode, and editable in piStar mode's inspector. Not in the engine modes' inspector or Notation view: see below.                                                                                                                                                                          |
| **Diagram labels** `<<…>> {k = v}`          | Not wired      | **Fits.** One `AnnotatedNode` / `AnnotatedActor` draws the annotations above the element, from its properties, through the same `writeAnnotations` the Notation view uses. The problem badges and Edge resources draw through it, so nothing is lost.                                                                                                                     |
| **Engine-mode inspector and Notation view** | Not wired      | **Fits for goals, tasks and resources.** `EDITOR_DEFINITIONS` = the engine's definition with the dialect's annotations (`withExtension`). `KNOWN_PROPERTIES` stays the engine's own, so a stereotype row says "iStar4RationalAgents: shown before the element…; Edge doesn't read it" instead of "add it to the mapper".                                                  |

Tests:

- `test/extensions.test.ts` reads a piStar-ext-style file (now `examples/pistar-ext/iStar4RationalAgents.txt`) through istar-ts: parse, rules, validate, write back with `istar.Planning`.
- The same file goes through goal-tree's view, which keeps G1 and T1 and leaves Planning and Plan out.
- `test/uiLib.test.ts` covers the workbench's `parseModel`:
  - byte-identical write-back of every example;
  - unchanged editor documents for every Edge/EdgeV2 example;
  - the dialect model's Notation document;
  - the label annotations.

**Not verified visually.** The Chrome extension was disconnected. Your
:3000 dev server compiles the page (HTTP 200, no build error), but the
canvas, labels and inspectors are only covered by the tests above. Opening
`examples/pistar-ext/iStar4RationalAgents.txt` in piStar mode is
the check to do by hand.

### Schema changes in this round

- **`ExtensionDefinition`**:
  - `name` (the namespace) and `label`;
  - `elements` and `links` (above);
  - `groupers`;
  - `stereotypes` and `taggedValues`, each with `appliesTo` (kinds or groupers) and, for tagged values, optional listed `values`;
  - `defaultTags`;
  - `annotations` (the stereotype and tagged-value syntax).

  It is engine-agnostic. `defineExtension` checks the namespace and every
  kind, grouper and link end it names.

- **`ISTAR_ACTOR_KINDS` / `ISTAR_NODE_KINDS` / `ISTAR_LINK_KINDS`.** The
  dialect package has no dependencies, so these repeat istar-ts's
  constants; a test pins them to istar-ts. `ISTAR_KIND_OF` maps engine kinds
  to iStar kinds.
- **derive**:
  - `metamodelExtensionOf` (istar-ts's `MetamodelExtension` as plain data);
  - `profileOf`, `profileProperties`, `annotationKeys`;
  - `withExtension`: the first pass's `withProfile`, moved from the fixture and generalised.
- **Deliberately not done: opening `ElementKind`.** An engine definition
  keeps the kinds an engine reads; a dialect's kinds live in the dialect.
  Opening `ElementKind` would have rippled through lib's mappers and key types
  for kinds no engine reads. Nothing needed it, because goal-tree's view
  leaves unknown kinds out.

### Findings in istar-ts 0.8.0 (reported, not changed)

1. _(Fixed in 0.8.1: `isActor`/`isNode` take one argument again;
   `isActorIn(metamodel)` / `isNodeIn(metamodel)` are the metamodel-aware
   forms.)_ **`isActor(element, metamodel?)` and `isNode` broke point-free use.**
   `.filter(isActor)` now passes the array index as the metamodel: a type
   error in goal-controller, and wrong at run time for untyped callers.
   Worth a changelog note, or a separate `isActorIn(metamodel)`.
2. **Unknown keys on an actor are written after `nodes`.** For example,
   piStar-ext's per-cell `extension` block. The content round-trips, the key
   order doesn't, so a file isn't byte-identical after a save.
3. **The kind-level `stereotype` is static.** piStar-ext's stereotypes are
   per element, so the workbench wraps `DefaultElementComponent` /
   `DefaultActorComponent`.
4. _(Fixed in 0.9.0: `LinkKindConfig.labelComponent`.)_ **Links still have
   no label component, and `link.name` is never drawn.**
   Stereotypes and tags on links can't be shown.

### What still doesn't fit, and why

- _(Engine semantics for a dialect's kinds: a non-goal, by the user's
  decision. See the next section.)_
- **Actors in the engine modes' inspector and Notation view.** goal-tree's
  view has no actors. `SelectedNode` only inspects goals, tasks and
  resources, and the document has no actor lines. In those modes an actor's
  stereotype is shown on the canvas but edited only in piStar mode.
- **Annotations on links.** The schema allows `appliesTo` with link kinds, but
  istar-ts can't draw them (finding 4), and no link inspector schema is built.
- **piStar-ext's storage.** Stereotypes and tags are read from
  `customProperties`. piStar-ext's `extension` block (per cell and model-level
  lists) round-trips but isn't read. Its construct definitions live in the
  browser's localStorage; an importer from an export of them into an
  `ExtensionDefinition` is still missing.
- **Profiles by name only.** A Planning behaves like a Task but doesn't get
  Task's `action` / `type`. That is a choice, and `behavesLike` could feed
  `profileOf`.
- **Value configs, unchanged.**
  - `ConditionalValue` has one condition, so one listed tag per kind.
  - No open enum ("New Value") and no "is set" condition.
  - piStar mode's inspector edits a tag's value as free text, because
    istar-ts's `PropertySchema` has no fields that depend on another.
- **Stacking dialects** that share annotation keys (`stereotype`, `tag`,
  `tagValue`) would repeat property keys (`defineDialect` throws). There is one
  known dialect today. Two would need namespaced keys or one merged profile.
- **OCL.** Unchanged. istar-ts's link `check` predicate is a function, so a
  definition would name it (a check registry, as for properties).

### Revised effort estimate

| Work                                                                                                                                  | First pass            | Now                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| Stereotypes and tags on nodes in the workbench                                                                                        | ≈ 1 week              | done; a manual check in the browser, ½ d                                    |
| New node kinds with shapes (definitions + istar-ts)                                                                                   | 4–6 d + 5–8 d         | done                                                                        |
| New link kinds and rules                                                                                                              | 4–6 d (istar-ts)      | done at schema and istar-ts level; ½ d to declare and draw one in a dialect |
| piStar-ext adapter: `extension` block ↔ properties, model-level lists ↔ dialect, construct definitions export → `ExtensionDefinition` | 1–2 d                 | 2–3 d (now incl. constructs)                                                |
| Actors in the engine modes' inspector and Notation view                                                                               | n/a                   | 2–3 d (goal-tree view + actor lines)                                        |
| Link stereotypes shown                                                                                                                | in istar-ts link work | 2–3 d in istar-ts (link label component) + ½ d here                         |
| Open enum, multi-case conditional value, "is set" condition                                                                           | 2–3 d                 | 2–3 d                                                                       |
| Engine semantics for dialect kinds                                                                                                    | n/a                   | 2–4 d, once decided                                                         |
| Grammar/LSP for annotations (done: goal-lang)                                                                                         | 2–3 d                 | 2–3 d                                                                       |

Full piStar-ext support goes from **4–6 weeks to about 2–3 weeks**. None of
it is blocked on istar-ts core except link labels.

## piStar-ext as its own dialect (current, istar-ts 0.9.0)

**The user's decision:** piStar-ext is its own thing. The definitions approach
has to support it as a separate dialect, chosen explicitly:

- the Edge engines are not moved to its semantics;
- the dialect's kinds are not layered onto the Edge modes.

This was relayed by the coordinating session and confirmed in this one.

| Commit    | What                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `17a384f` | istar-ts `^0.8.1`; the point-free `.filter(isActor)` calls are back; goal-tree's view uses `isActorIn(metamodelOf(model))`        |
| `c5c8627` | A standalone dialect definition (no notation, no ids) and a `pistarext` workbench mode; the implicit layering of `6ec0f0d` undone |
| `57aeb32` | An unused import                                                                                                                  |
| `15e79da` | The status bar names the mode (it showed the engine underneath piStar mode and piStar-ext)                                        |
| `8fa33fa` | istar-ts `^0.9.0`                                                                                                                 |
| `5a47fe0` | Link stereotypes and tagged values: a label component on every link kind, edited in the mode's inspector                          |
| `97e557b` | `examples/pistar-ext/`: three example models, opened in the mode from the Explorer; they replace the test fixture                 |

### How it works

**Dialect** (`@goal-controller/dialect`):

- `dialectDefinition(istar4RationalAgents)` is the dialect's own definition.
  It has every iStar kind (actors included) plus Planning and Plan, each a
  line `<<stereotype>> {tag = value} name`, with no notation and no ids.
- Its lines are their elements' in order:
  - `notationEdits` and `documentDiagnostics` map lines by position;
  - adding or removing a line changes nothing, and a diagnostic says to do it
    in the diagram;
  - such a definition writes every property on the element line.

**Workbench mode `pistarext`:**

- It's a `ModelMode`, recorded in the file like an engine (the diagram's
  `engine` property). It sets `pistar`, so nothing is generated.
- A model is read with the metamodel of the mode it records
  (`parseModel(text)`):
  - only a piStar-ext model loads Planning and Plan;
  - every other model is plain iStar 2.0, so a piStar-ext file fails to load
    in the Edge modes as before. The parse error now says "this is a
    piStar-ext model. Open it as piStar-ext (model settings)".
- **Choosing it:**
  - a piStar-ext card in the model settings (the setup dialog shows its
    conformity next to the engines);
  - the Convert dialog, both ways.

  A model with Planning or Plan is blocked from the Edge engines ("1 Planning:
  the Edge engines do not read Plannings"), from SLEEC and from plain piStar.
  Converting to piStar-ext adds no RT ids.

- **Diagram:**
  - the palette has iStar 2.0 plus Planning and Plan, from the model's
    metamodel;
  - Planning is drawn as an arrow, Plan as piStar-ext's dashed «Plan» box;
  - every element's and link's annotations are drawn: above an element, on
    a link's label.
- **Inspector** (beside the canvas, driven by the definition through
  `specsFromDefinition`): the selected element's or link's kind, its
  groupers, a preview of its annotations, its name, and its stereotype, tag
  and value. A listed tag (`type`) switches the value to a duty/right select.
- **Notation view:** the dialect's lines, an actor's elements under it,
  highlighted. Editing a stereotype, tag or name there updates the diagram.

### Examples

`examples/pistar-ext/` holds three models, as piStar-ext saves them
(`istar.Planning` on disk, no mode recorded). The Explorer lists them as
`pistar-ext` and opens them in piStar-ext mode, recording it.

- `iStar4RationalAgents.txt`: Fig. 4 as far as the paper shows it (a
  goal-based agent, Planning and Plan, an `<<action>>` task `{type = duty}`),
  with a tagged link. The tests read it; it replaces the test fixture.
- `stereotypes-and-tags.txt`: every mechanism once.
  - The rational grouper's stereotypes on a role and an agent.
  - `<<action>>` on a task.
  - The four default tagged values and the listed `type`.
  - A tagged link.

  iStar4RationalAgents declares no stereotypes for goals or links (the paper
  gives none), so those carry tagged values instead.

- `minimal.txt`: one agent, one goal, one tag.

Tests cover all three:

- each writes back byte for byte, recorded or not;
- each opens in the mode;
- those using the dialect's kinds are rejected by the Edge modes, with the
  hint.

The workbench loads examples from GitHub at `main`
(`services/examples.ts`), so these open there once they're pushed.

### What fits now

| piStar-ext mechanism                                                | Status                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dialect without `[]` notation or RT ids                           | **Fits** (schema change: optional notation and ids, lines by position)                                                                                                                                                                                                                                                 |
| Stereotypes on nodes                                                | **Fits**: diagram, inspector, Notation view                                                                                                                                                                                                                                                                            |
| Stereotypes on actors and roles (through the rational grouper)      | **Fits**: diagram, inspector, Notation view (actor lines)                                                                                                                                                                                                                                                              |
| Tagged values, the defaults, listed values (`type ∈ {duty, right}`) | **Fits**: diagram, inspector (the listed value is a select), Notation view                                                                                                                                                                                                                                             |
| Stereotypes and tagged values on links                              | **Fits** in the diagram (istar-ts 0.9.0 label component, rendered through the same `Annotations` component as an element's) and the inspector. Links carry the default tagged values; a dialect can give link kinds stereotypes. Not in the Notation view: links have no lines there (structure stays in the diagram). |
| Groupers                                                            | **Fits**, as data; the inspector names an element's groupers                                                                                                                                                                                                                                                           |
| New node constructs (Planning, Plan) with shapes                    | **Fits**: the mode's palette, shapes, inspector, Notation view                                                                                                                                                                                                                                                         |
| New link constructs                                                 | **Fits** at the schema and istar-ts level (tested with test-only Generates and Alternative links). The paper's example has none, so the mode has none to draw.                                                                                                                                                         |
| Engine semantics for the dialect's kinds                            | **Non-goal**, by the user's decision. No engine reads piStar-ext, and the Edge engines are unchanged.                                                                                                                                                                                                                  |
| OCL                                                                 | Unchanged: not in piStar-ext either                                                                                                                                                                                                                                                                                    |

**Verified:**

- **Tests:**
  - definitions 105 (including the Langium-branch harness, which now also
    checks every Edge example's Notation document, not only EdgeV2's);
  - lib 139 (PRISM output unchanged);
  - UI `tsc`, and the static export built from a /tmp copy.
  - The UI-lib tests cover parsing by recorded mode, the hint, conversions
    both ways with their blockers, the dialect's document and edits by
    position, and the highlighter.
- **In Chrome**, on the user's :3000 dev server:
  - the setup dialog for a raw piStar-ext file;
  - the mode's diagram, palette, shapes and annotations;
  - the inspector for a task (stereotype, listed `type`) and for a link (a tag
    and its value, drawn on the link);
  - the Notation view, where an edit reached the diagram;
  - an EdgeV2 example: unchanged, with no dialect kinds in its palette.

### Schema changes in this round

- **`DialectDefinition<K>`** is generic over its kinds; `AnyDialect` is
  `DialectDefinition<string>`. `ElementKind` (an engine's four kinds) stays the
  default, so Edge's types are unchanged.
- **Optional fields:**
  - `notation`, for a dialect without an engine (`grammar` and `parser`
    were removed with ANTLR);
  - an element's `prefix`, for lines without ids (`idPattern` and the
    line templates were removed: the goal language fixes the syntax).
  - `hasIds(definition)` tells which kind of lines a definition has, and
    `WithNotation` types what needs a notation.
- **`defineDialect`:**
  - either every element has an id prefix, or none has;
  - lines without ids can't have property lines.
- **A kind is listed in the document if the definition has it.** One that
  declares something on its line has no property lines or children. For
  Edge this is exactly the old rule (goals and tasks; resources with their
  declaration).
- **`DefinitionContext.order`:** the elements in line order, for a definition
  without ids.
- **`specsFromDefinition`** returns the definition's own kinds.
- **New:** `dialectDefinition(extension)` and `annotationsFor(extension, kind)`.
  `withExtension` now takes any definition and an optional id and name.

### istar-ts findings

1. Fixed in 0.8.1 (`isActorIn` / `isNodeIn`).
2. **Still:** unknown keys on an actor (piStar-ext's `extension`) are written
   after `nodes`. The content round-trips; the key order doesn't.
3. **Still:** the kind-level `stereotype` is static, so per-element
   stereotypes wrap `DefaultElementComponent` / `DefaultActorComponent`.
4. Fixed in 0.9.0 (`labelComponent`).
5. **New in 0.9.0:** a `labelComponent` is painted beneath the nodes, so a
   link inside an actor has its label hidden by the actor's boundary.
   - Verified in Chrome: the label is in the DOM at the link's midpoint, and
     shows once its layer is raised.
   - Workaround: a `z-index: 1` on the piStar-ext canvas's
     `.react-flow__edgelabel-renderer` (`packages/ui/app/globals.css`), to
     remove once istar-ts lifts its label layer.

### What still doesn't fit, and why

- **piStar-ext's own storage.**
  - Stereotypes and tags are read from `customProperties`. piStar-ext's
    per-cell `extension` block and model-level lists round-trip but aren't
    read: the iStar4RationalAgents example's Robot carries both forms.
  - Its construct definitions live in the browser's localStorage. An importer
    for an export of them into an `ExtensionDefinition` is still missing.
- **Lines by position.**
  - Adding or removing a line does nothing (by design: elements are added in
    the diagram).
  - Swapping two lines' texts swaps their elements' names and annotations,
    because there is no id to tell them apart.
  - Selection isn't synced between the dialect's Notation view and the
    diagram: their ids are piStar ids, not the workbench's RT ids.
- **Links in the Notation view.** They have no lines. Their annotations are
  edited in the inspector.
- **Profiles by kind name only.** A Planning behaves like a Task but doesn't
  get Task's `action` / `type`. That's a choice; `behavesLike` could feed
  `profileOf`.
- **Value configs.** One listed tag per kind (`ConditionalValue` has one
  condition); no open enum ("New Value") and no "is set" condition.
- **One dialect.** Two dialects sharing annotation keys would need namespaced
  keys.
- **Plain piStar mode on a piStar-ext file.** The file records `pistarext`,
  so piStar mode reads it with the dialect's kinds too, and the toggle back
  to piStar-ext is immediate. Converting it to plain piStar is blocked while
  it has Planning or Plan.

### Revised effort estimate (what's left for full piStar-ext parity)

| Work                                                                                                 | Estimate |
| ---------------------------------------------------------------------------------------------------- | -------- |
| piStar-ext storage adapter (`extension` block ↔ properties, model-level lists) and constructs import | 2–3 d    |
| Notation view ↔ diagram selection in the dialect mode                                                | ½–1 d    |
| Open enum, multi-case conditional value, "is set" condition                                          | 2–3 d    |
| Profiles through `behavesLike` (if wanted)                                                           | ½ d      |
| Several dialects (namespaced annotation keys)                                                        | 1–2 d    |
| Link lines in a dialect's Notation view (if wanted)                                                  | 2–3 d    |
| Grammar/LSP for the dialect's lines (done: goal-lang)                                                | 2–3 d    |
| Engine semantics for dialect kinds                                                                   | non-goal |

About **1½–2½ weeks** remain for full parity. None of it is blocked on
istar-ts: finding 5 has a workaround.

### piStar-ext's panel, shapes, labels and "Add new" (current)

| Commit    | What                                                          |
| --------- | ------------------------------------------------------------- |
| `cff4fd1` | The mode's inspector in piStar-ext's tabs; Planning's shape   |
| `acaebc3` | Readable labels, fitted to their shapes                       |
| `740f01a` | "Add new" constructs, and a model's own extension in its file |

**The panel**, as piStar-ext's code has it (`tool/index.html` and
`app/ui/ui.js` at `830a4e3`, matching Fig. 3):

- **Blank canvas:** Properties | Stereotype | Tagged Value | Grouper. Each
  category has a `Name | Constructs Applied | delete` table and an
  "Add New …" form.
- **Element or link:** Properties | Style. The stereotype and tagged-value
  selects are in Properties, in an "Extension" table:
  - Stereotype: Not Used, New Value, then the stereotypes declared for the
    kind;
  - TaggedValue: Not Used, New Value, Id, Reference to, Status, Logic, then
    the declared tags.

Our tabs come from the definition: `extensionCatalog` (stereotypes, tagged
values, groupers), with no piStar-ext names in the base. "New Value" takes
free text, because the dialect's enums are `open` (the open-enum gap, now
closed). Every kind carries a stereotype.

**Shapes.** piStar-ext's repository ships no Planning or Plan path data:
constructs live in the browser's localStorage, and new nodes use the user's
path data as is.

- Planning: Fig. 4's dialog shows only the start of its path
  (`M 9.1814481,1.0179789 H 65.503448 L 65.025854,14.532293 72.4491,14.819567 73.29006…`).
  That start is kept verbatim and the rest follows the drawn outline: a
  task-like pointed side, the body, and an arrow out of the right side, at
  piStar-ext's 90×55. This is a reconstruction, not the original path.
- Plan: its symbol appears nowhere, so it is the default dashed box.

**Labels.**

- Annotations are a small italic header stacked above the bold name, inside
  the shape's text box. A dialect kind's `textBox` (presentation data, like
  `shape`) places it; Planning's is its body, not its arrow.
- The label fits by measuring: its font shrinks in steps to 70%, then each
  line ends in an ellipsis with the full text on hover. A resized box refits.
- One Annotations component draws them for elements and links.

**"Add new"** (Fig. 4) is at the palette's end:

- a dialog with name, shape (SVG path, live preview), node or link, and for a
  link its source and target kinds and its kind of line;
- the construct joins the palette at once.

**Where constructs are kept** (this answers open question 1's sequel,
per-model extension editing; superseded by istar-ts 0.11.0, below):

- piStar-ext keeps constructs in localStorage. Here they are the model's, in
  its file, under a top-level `modelExtension` key (piStar and istar-ts keep
  unknown keys). They're saved as `istar.<Name>`, as piStar-ext saves them.
- The dialect framework reads the block generically (`ModelExtension`,
  `withModelExtension`):
  - kinds in the `model.` namespace, groupers, stereotypes, tagged values;
  - each checked against the dialect, which rejects a name it already has
    (a kind, a piStar type, a grouper, a stereotype, a tagged value) or a
    kind nobody declares.
- A model in the mode is read with iStar 2.0, the dialect and its own
  extension (`modelDialect`). Its own kinds open there and nowhere else: the
  Edge modes reject them, with the hint.
- The category tabs add and delete the model's own entries; the dialect's
  stay read-only.

Tests:

- `test/modelExtension.test.ts`: merging, istar-ts reading the model's kinds
  and link rules, and every collision.
- `test/uiLib.test.ts`: byte-for-byte write-back of a model with its own
  construct, Edge rejection with the hint, the collision message, and the
  catalog.

Verified in Chrome on :3000:

- the tabs, with the dialect's entries read-only;
- the labels on stereotypes-and-tags.txt and iStar4RationalAgents;
- creating a Mission (preview, then palette, then placed inside the agent);
- adding the stereotype `urgent` for Mission and giving it to the element;
- the Planning collision refused in the dialog.

**istar-ts 0.10.0** ships the label API that was proposed: `textBox`,
`labelHeader` for elements and links, `labelFit`, `useFitText`, and link
labels drawn above the nodes. The mode now keeps only:

- the dialect's `shape` and `textBox` data;
- one extension supplying `labelHeader`, with istar-ts's `TEXT_BOXES`
  presets for iStar's kinds (0.10.0's default box is the whole element).

The client copies are deleted (`5b115a8`).

**Finding 6 (istar-ts 0.10.0, reported, not changed):** a header line too
wide for its box is ellipsized at full size instead of shrinking first.

- Cause: `overflows()` compares the label block's `scrollWidth` with its box,
  but each `.istar-label-header-line` clips itself (`overflow: hidden`), so
  the block never overflows in width.
- Fix: also test each header line's `scrollWidth > clientWidth`.
- Seen in Chrome: Robot's `<<goal-b…`, Nurse's `<<utility-…`, Sample kit's
  `{Reference to …` and Planning's `{Status = …`. The client fitting showed
  these whole at a smaller size.

### A model's own constructs in istar-ts's block (istar-ts 0.11.0, current)

istar-ts 0.11.0 reads a file's own `"metamodel"` block: its kinds extend the
host metamodel (here iStar 2.0 + iStar4RationalAgents) before parsing, with
collisions checked, and `toPistar` writes the block back as read, keys it
doesn't know included. So a model's own constructs now live there:

```json
"metamodel": {
  "name": "model",
  "elements": [
    { "kind": "model.Mission", "label": "Mission", "pistarType": "istar.Mission",
      "category": "node", "shape": { "path": "M 0 0 L 80 0 L 100 20 L 80 40 L 0 40 Z" } }
  ],
  "links": [
    { "kind": "model.Assigns", "label": "Assigns", "pistarType": "istar.Assigns",
      "rules": { "sources": ["model.Mission"], "targets": ["istar.Goal"] },
      "line": { "dash": "1,3" } }
  ],
  "groupers": { "missions": ["model.Mission", "istar.Task"] },
  "stereotypes": [{ "name": "urgent", "appliesTo": ["missions"] }],
  "taggedValues": [{ "name": "deadline", "appliesTo": ["model.Mission"] }]
}
```

- `name`, `elements` and `links` are istar-ts's (`FileMetamodel`): it reads,
  checks (a kind or piStar type taken, an unknown kind) and draws them
  (`registryForMetamodel` takes `shape`, `textBox` and `line` from them).
- `groupers`, `stereotypes` and `taggedValues` are ours, extra keys istar-ts
  keeps. `withModelEntries` (`@goal-controller/dialect`) merges them, and
  the kinds, with the dialect for the profiles, the catalog and the Notation
  lines, and rejects a name the dialect already has.
- A piStar-ext model is read with `parsePistar(text, { metamodel: host,
  fileMetamodel: true })`; "Add new" and the category tabs write with
  `withFileMetamodel` (`writeModelExtension` in the UI's `pistar.ts`). An
  emptied block is removed, and a kind still used can't be dropped.
- The Edge modes don't apply the block: a model using its kinds is rejected
  there, with the hint.

**Migration.** The top-level `modelExtension` key is gone; its content moves
into `metamodel` unchanged but for two fields: a kind's `shape` is
`{ "path": "<d>" }` instead of the path string, and a link's `line.dash` is
an SVG dash array (`"10,5"`, `"1,3"`) instead of `"dashed"`/`"dotted"`. The
examples had no such block, so none was rewritten. Deleted: the
`modelExtension` key and its reader/writer, `withModelExtension` (now
`withModelEntries`, without the kind and piStar-type collision checks,
which istar-ts makes), `newNodeKind`/`newLinkKind`, `modelExtensionKinds`,
and `modelDialect`'s cache of metamodels by block.

Verified in Chrome on :3000: a new piStar-ext model, "Add new" Mission with
a shape (palette, then placed in an actor, drawn with its shape), the source
showing the block, reopened from Recent and drawn again; a stereotype added
for Mission written into the same block; "Planning" refused in the dialog.

## Pre-existing failure, unrelated

goal-tree's suite fails to compile on this base, and on main:
`test/tree/execCondition.test.ts`, e.g. `TS2339: Property 'edge' does not
exist on type '{ engine: unknown; }'`. It isn't in the root `pnpm test`, and
this branch doesn't touch goal-tree.
