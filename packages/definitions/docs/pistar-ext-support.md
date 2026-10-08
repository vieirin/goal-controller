# piStar-ext with the engine definitions

A stress test of `@goal-controller/definitions`. Can piStar-ext's extension
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

An element kind can now declare `annotations`: declarations written **before
the id** on its line. They are read and written like a resource's
`{int 0..100 = 80}`, which goes after the name:

```ts
annotations: [
  {
    delimiters: ['<<', '>>'],
    parts: [{ key: 'stereotype', pattern: '[^<>]*[^<>\\s]' }],
  },
  {
    delimiters: ['{', '}'],
    parts: [
      { key: 'tag', pattern: '[^{}=]*[^{}=\\s]' },
      {
        optional: [
          { literal: ' = ' },
          { key: 'tagValue', pattern: '[^{}]*[^{}\\s]' },
        ],
      },
    ],
  },
];
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

- **`ElementDefinition.annotations?: readonly DeclarationDefinition[]`.**
  Declarations before the id, each written only when its first property is set.
- **`declarationKeys` moved from `derive/lines.ts` to `schema.ts`.** It is
  re-exported as before. A new `elementLineKeys(element)` reads the keys an
  element line writes.
- **`defineEngine`** now:
  - rejects an annotation or a declaration naming a property its kind doesn't have;
  - leaves the keys an element line writes out of `propertyLineOrder`'s
    "each operand kind key once" rule.
- **derive**:
  - `splitAnnotations`, `readAnnotations`, `writeAnnotations` and `annotationsOf`;
  - `lineId` and `readElementLine` skip leading annotations;
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

- `ENGINE_DEFINITIONS` (`packages/ui/lib/workbench/definitions.ts`) is keyed
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

## What a future LSP / grammar generator would need

The element line grows a prefix:

```
ElementLine : Annotation* Id ':' Name ('[' Notation ']')? Declaration? ;
Annotation  : Stereotype | TaggedValue ;          // one rule per DeclarationDefinition
Stereotype  : '<<' STEREOTYPE '>>' ;               // from parts[0].pattern
TaggedValue : '{' TAG ('=' TAG_VALUE)? '}' ;       // literal ' = ' → '=' with any whitespace
```

- **One rule per `DeclarationDefinition`.** Generate a parser rule from each
  annotation's parts: `key` → a terminal from `pattern`, `literal` → a keyword
  with whitespace around it, `optional` → `?`. The declaration after the name
  is the same generator, at the end of the line.
- **Lexing conflicts the generator must solve.**
  - `{` opens both the tagged value (before the id) and a resource
    declaration (after the name). Only position tells them apart, so it needs
    lexer modes, or one token with the split done in the parser.
  - Tag names and stereotypes contain spaces and `-` ("Reference to",
    "model-based reflex"). That collides with `Name` and `Id` terminals
    outside the delimiters, so these terminals are only valid inside them
    (modes again, or a hand-written token builder in Langium).
  - The annotations' kind isn't known until the id, so the grammar accepts
    every kind's annotations and validation rejects the wrong ones. That's
    what `readAnnotations` and the "cannot be read" diagnostic do now.
- **Validation.**
  - Each annotation at most once.
  - Enum values from `properties` (the local support doesn't check enum
    values yet, for property lines either).
  - `ConditionalValue`'s value per tag.
  - The named checks.
- **Completion.** Stereotype names after `<<`, tag names after `{`, and a
  tag's listed values after `=`, all from the enum options. The local support
  doesn't offer these yet.
- **Semantic tokens.** Annotation delimiters, names and values, as the local
  highlighter now emits (`brace`, `meta`, `operator`).
- **Context.** `contextFromView` already carries every custom property, so a
  server gets `stereotype`, `tag` and `tagValue` without a change.

## Open questions

1. **How does a workbench model pick a profile?**
   - Options: a model-level setting saved in the file (piStar-ext saves its
     lists in the model), a workbench toggle, or an engine variant.
   - This decides whether the fixture moves to `src/` and how
     `ENGINE_DEFINITIONS` is keyed.
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
| Grammar/LSP generation for annotations, once a generator exists                                                                                               | 2–3 d                   |

Supporting stereotypes and tagged values on nodes in the workbench is about
**a week** on top of this branch. Full piStar-ext (actors, links, new
constructs with symbols) is **4–6 weeks**, most of it in istar-ts.

## Pre-existing failure, unrelated

goal-tree's suite fails to compile on this base, and on main:
`test/tree/execCondition.test.ts`, e.g. `TS2339: Property 'edge' does not
exist on type '{ engine: unknown; }'`. It isn't in the root `pnpm test`, and
this branch doesn't touch goal-tree.
