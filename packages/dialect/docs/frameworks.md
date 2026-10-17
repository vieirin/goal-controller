# Frameworks (goal-controller#171)

A **framework** is the goal-modelling language a project's models are
written in: iStar 2.0, KAOS or the NFR Framework. It sits one level above the
dialect. A dialect is a profile of one framework's metamodel, and an engine
reads one dialect. A project's models are all in one framework, and nothing
converts a model from one framework to another.

Each framework is one of istar-ts's root metamodels (istar-ts 0.13.3,
[`docs/dsm3-goals.md`](https://github.com/vieirin/istar-ts/blob/main/docs/dsm3-goals.md)):

| Framework | Root | Package | Kinds | File |
| --- | --- | --- | --- | --- |
| `istar-2.0` | `ISTAR_2_0` | `@istar-ts/core` | `istar.*` | piStar's (`tool: "pistar.2.0.0"`) |
| `kaos` | `KAOS` | `@istar-ts/dsm3-kaos/metamodel` | `kaos.*` | DSM3-goals' (`tool: "dsm3-goals"`) |
| `nfr` | `NFR` | `@istar-ts/dsm3-nfr/metamodel` | `nfr.*` | DSM3-goals' (`tool: "dsm3-goals"`) |

iStar 2.0 is the default everywhere: a dialect, a manifest or a model file
that names no framework is in iStar 2.0, so nothing changes for iStar
projects or their files.

## Where it lives

| Where | What |
| --- | --- |
| `dialect/src/schema.ts` | `Framework`, `FRAMEWORKS`, `DEFAULT_FRAMEWORK`; `DialectDefinition.framework?`; `FRAMEWORK_KINDS`, the KAOS and NFR kinds a dialect may name, read from istar-ts's roots; `defineDialect`'s checks per framework |
| `ui/lib/project/manifest.ts` | `Manifest.framework?`, `ModelEntry.framework?`, `ManifestSettings.framework` |
| `ui/lib/project/embedded.ts` | the framework record of a one-model project: `diagram.customProperties.framework`; `recordedFramework` |
| `ui/lib/workbench/frameworks.ts` | `FRAMEWORK_ROOTS`, `hostFor`, `frameworkOfModel`, `emptyModelText` |
| `ui/lib/workbench/dialects.ts` | `parseModel`, `metamodelOfMode` and `emptyModel` read and write with the framework's root |
| `ui/lib/workbench/pistar.ts` | `frameworkOfMode`, `frameworkMismatch`; `planConversion` refuses targets in another framework |
| `ui/components/workbench/engineConformity.tsx` | conformity's framework axis, checked before the engine axis |

## The manifest

`project.json` may name the project's framework, and a model entry may
override it:

```json
{
  "version": 1,
  "dialect": "kaos",
  "framework": "kaos",
  "models": [{ "path": "backup.txt" }]
}
```

A model's framework is `entry.framework ?? manifest.framework ?? 'istar-2.0'`
(`settingsInManifest`). `setSettingsInManifest` leaves the framework a model
would get anyway implicit: iStar 2.0 at project level, and the project's own
framework on an entry. A framework the workbench doesn't know is a
`ManifestError` that names where it is (`models[1].framework: unknown
framework "tropos"`).

A one-model project keeps its manifest in the model file. The framework is
stored in `diagram.customProperties.framework`, beside the mode's
`diagram.customProperties.engine`. The record is written only when the
framework isn't iStar 2.0, so every existing file stays byte-identical. When
a `project.json` names no framework, the model file's own record applies, as
it does for the mode.

## Dialects

`DialectDefinition.framework` defaults to `istar-2.0`. `defineDialect`
applies iStar's rules only when the framework is iStar 2.0:

| Rule | iStar 2.0 | KAOS, NFR |
| --- | --- | --- |
| kinds named in `elements`, `properties` and references | `goal`, `task`, `resource`, `quality` and the extension's node kinds | the root's element kinds (`FRAMEWORK_KINDS[f].elements`), with the hub that an n-ary link generates (`kaos.RefinementLinkHub`), and the extension's node kinds and hubs |
| id prefixes | `G`, `T`, `R`, `AT` for iStar's kinds; one or two capitals, unique, for an extension's | one or two capitals other than `X` and `W`; kinds may share a prefix (KAOS's two goal kinds both use `G`) |
| `links` keys | iStar's link kinds or namespaced kinds | the root's link kinds (`FRAMEWORK_KINDS[f].links`), legs and ends included, and the extension's |
| `extension` | allowed | allowed, extending the root (#181) |
| `actors`, `notation` | allowed | none |
| every element has an id prefix, or none does | yes | yes |

`PropertyKindOf` accepts the framework's kinds at the type level. A kind that
has properties but no line in the text view (KAOS's refinement hub) therefore
still compiles.

`FRAMEWORK_KINDS` is read from the istar-ts roots the workbench reads models
with (`KAOS_OBSTACLES`, `NFR`; #181), from their React-free `/metamodel`
subpaths. A UI test (`test/workbench/frameworks.test.ts`) checks it against
the workbench's `FRAMEWORK_ROOTS`.

## Hosts

The metamodel a model is read with is a function of its framework:
`hostFor(framework, extension?)` returns the framework's root, extended with
a dialect's extension when the dialect has one. `parseModel(text, mode,
framework)` reads with the mode's dialect host, or with the root of
`framework`. By default that is the text's own framework
(`frameworkOfModel`: its content, else its record), so DSM3's files, which
record none, read as KAOS or NFR. `metamodelOfMode` and
`GoalModel.parseModel` (`ParseOptions.framework`) default the same way. A new
model is `emptyModelText(framework)`: the root's empty model
(`createEmptyModel(undefined, { metamodel: root })`), which records the
framework when it isn't iStar 2.0.

## Conformity

Conformity checks a model against an engine on two axes, framework first
("model typing against a profile"):

1. **Framework.** The model's framework is what its content says
   (`frameworkOfModel`: istar-ts's `detectFramework` over the three roots),
   falling back to its record. It must match the project's framework, and so
   must the framework of the target's dialect (`frameworkOfMode`). A mismatch
   (`frameworkMismatch`) becomes the target's plan error, and the target is
   blocked before any engine reads the model.
2. **Engine.** The conversion the target needs and the engine's own checks,
   as before.

`planConversion` refuses a target whose framework differs from the model's:
"the Edge engines read iStar 2.0 models, and the model is in KAOS: nothing
converts a model between frameworks".

## Decisions

Each PR of #171 appends its decisions here.

### PR A: the framework axis

- **The framework is recorded beside the mode, not inside it.** Modes such
  as `kaos` and `nfr` can name a framework's dialect, but a model's framework
  is its own record (`diagram.customProperties.framework`). A model with no
  mode (plain piStar, or DSM3's own file) still has a framework.
- **Content wins over the record.** `frameworkOfModel` trusts
  `detectFramework` first. A file whose types are `kaos.*` is a KAOS model
  whatever its record says. The record decides only when the content can't:
  DSM3's empty files share a tool, so only the record tells an empty KAOS
  model from an empty NFR one.
- **Manifests stay byte-identical.** iStar 2.0 is never written: not in the
  embedded record, not at project level, and not on an entry that would
  inherit it anyway.
- **The dialect package stays free of dependencies.** It keeps the KAOS and
  NFR kind names as data (`FRAMEWORK_KINDS`) instead of importing them from
  istar-ts. A UI test pins the copy to the packages.
- **ui and lib use the React-free `/metamodel` subpaths.**
  `@istar-ts/dsm3-kaos/metamodel` and `@istar-ts/dsm3-nfr/metamodel`
  (istar-ts 0.13.2, istar-ts#14) have both ESM and CommonJS builds. The
  package roots are ESM-only and pull in React. Since 0.13.3 the subpaths
  also declare `typesVersions`, so lib's CommonJS (node10) resolution finds
  their types without any `paths` mapping.
- **Kinds may share prefixes outside iStar.** The issue asks for KAOS `G`
  (both goal kinds), `A` (both agent kinds) and `DP`. Which kind a new `G`
  line creates is the goal language's decision (PR C).
- **Opening a file is detected by content in the workbench, not in the
  project module.** `lib/project` (`open.ts`'s settings) knows no istar-ts,
  so a project's model settings take the framework from the manifest or the
  model's record only. PR B's Open dialog runs `frameworkOfModel` before
  `openFile` and passes the framework in, so a DSM3 file without a record
  opens as KAOS or NFR. The workbench's readers (`parseModel`,
  `metamodelOfMode`, `GoalModel.parseModel`) already default to the content.
- **The project's framework in the workbench.** The Convert and model
  settings dialogs read it from the open project's manifest
  (`projectFrameworkOf`). Switching a project's framework belongs to PR B's
  Open dialog.

### PR C: the kaos and nfr dialects, Problems and seeds

- **Two modelling dialects, in lib.** `lib/src/dialects/kaos` and
  `lib/src/dialects/nfr` are `DialectDefinition`s with `framework` set and no
  engine. Their kinds, property schemas and labels are imported from the
  React-free `@istar-ts/dsm3-{kaos,nfr}/metamodel` subpaths, not copied. The
  KAOS property lists take their keys and order from istar-ts's schemas, so
  a key DSM3 adds and the dialect doesn't explain doesn't compile.
- **KAOS properties are free text.** Neither DSM3 nor the KAOS literature
  (van Lamsweerde's goal attributes) fixes a vocabulary for `Priority`,
  `Stability`, `Type` or `Category`, so none is an enum. `FormalSpec` is text
  until PR D types it. Every element also declares piStar's `Description`,
  which DSM3 writes on every element.
- **The hub carries the refinement's properties.** `SysRef`, `Status` and
  `Tactic` are declared on `kaos.RefinementLinkHub`, where DSM3 saves them.
  The hub has no Notation line: the inspector edits them.
- **NFR labels are the link's label, not a property.** A contribution's or
  correlation's value stays `link.label`, as DSM3 writes it and as istar-ts
  edits it (`changeableLabel`). The dialect declares the vocabulary in a new
  `linkLabels` field (`NFR_CONTRIBUTION_LABELS`), which Problems checks.
- **Refinements are declared, not guessed.** A new `refinements` field names
  a framework's refining link kinds and their relation: NFR's And/Or links;
  KAOS's n-ary `kaos.RefinementLink` is an AND. goalView reads an n-ary
  kind's legs (core's `<Kind>Start`) as children of the hub's end target, and
  leaves the hub out. Nothing in the goal language knows hubs.
- **Every unparented element is a root.** KAOS and NFR have no actors, so
  goalView doesn't read a framework's kinds as an iStar extension's (which
  are in no tree): any element no refinement reaches starts a tree.
- **Prefixes.** KAOS: `G` (both goal kinds), `A` (both agent kinds), `DP`.
  NFR: `S`, `O`, `C`. The Notation view creates no element, so a shared
  prefix needs no tie-break: a line's kind is its element's in the model.
  `kindOfId` and the lexer already read a dialect's own prefixes. The
  catalog's `G/T/R/AT` stay lexed in every dialect (forking the Langium
  grammar per framework wasn't worth it). Instead a framework's document
  reports a line whose prefix none of its kinds take ("T is no prefix of
  KAOS's: its elements are G…, A…, DP…"). iStar dialects keep their messages.
  `prefixIn` needed no change: only engine targets get ids, and conversion
  between frameworks is refused (PR A).
- **No bracket notation: a name is the rest of the line.** A framework's
  dialect has no notation (PR A's rule), so `nameReading` reads the text
  after the id as the name, brackets, digits and commas included. KAOS's
  `G1: Achieve [Manual Backup]` and NFR's `O1: Encrypt with RSA 128 bits`
  read back as written. The rule keys on the framework, not on a missing
  notation, since internal callers pass partial definitions.
- **The seeds have no ids.** DSM3's welcome models are committed byte for
  byte, so their Notation lines are `<piStar id>: name`, which the goal
  language asks to give an id, as for any id-less model in a dialect with
  ids. The Notation view tests run on a copy with ids added.
- **Problems.** `ui/lib/workbench/frameworkProblems.ts` publishes, through
  the diagnostics protocol, every issue istar-ts's `validateModel` finds, by
  its constraint code: `incomplete-hub` on the hub, `hub-target`, and DSM3's
  `invalid-source`/`invalid-target`/`duplicate-link`/`self-link`, with
  DSM3's messages where istar-ts keeps them. It also reports a label outside
  `linkLabels` (`unknown-label`). The source is the dialect's name.
- **Modes, the minimum Home needs.** `FrameworkMode` (`kaos`, `nfr`) joins
  `ModelMode`, kept as piStar mode with its dialect, as piStar-ext is.
  `ModellingMode` and `isModellingMode` name "no engine" where the code
  meant it; extension-only paths keep `isDialectMode`. Recording a framework
  mode records the framework beside it. The diagram passes istar-ts's
  `kaosExtension`/`nfrExtension` to the canvas with its inspector. Settings
  and Convert offer the modes (PR A's conformity refuses another
  framework's model). Per-framework filtering of the lists, the Open
  dialog's detection, New per framework and a Notation tab for the
  framework modes are PR B's.
- **Seeds on Home.** `examples/kaos` and `examples/nfr` are sections after
  the engines', citing KAOS's and NFR's literature and DSM3-goals (Pimentel,
  no licence stated). An example opens in its folder's mode and framework,
  written in memory, the file untouched. Previews keep an n-ary link's hub,
  legs and end, so the cards draw.

### PR B: mode sets per framework, Open detection, workbench UI

- **Opening a file goes by its content.** A `.txt`/`.json` model opened or
  dropped goes through `openModelFile`. Its framework is
  `frameworkOfModel`'s (content first). A KAOS or NFR file that records no
  mode of its framework (DSM3's own) opens in the framework's mode, recorded
  in the opened text as an example's folder mode is. Native files and
  importers keep their extension routing.
- **A switch of framework is confirmed, never implied.** The open project's
  framework is its open model's, by content. A model of another framework
  waits in `frameworkSwitch` with conformity's message (`frameworkMismatch`).
  `FrameworkSwitchDialog` offers "Switch to …" (open it, closing the open
  model, which stays in Recent) or "Keep the project" (nothing opens). With
  no model open there is nothing to switch.
- **New per framework, in the setup dialog.** The settings dialog shows one
  group per framework: a framework selector above the cards. A new, empty
  model's framework may be chosen there, which replaces its empty model with
  that framework's (`emptyModelText`) in the framework's mode. Any other
  model's framework is shown, not chosen. Cards of another framework show no
  conformity (it would judge the empty model about to be replaced). iStar's
  cards are as they were. A KAOS or NFR model gets its framework's mode
  only: no engine, no piStar card.
- **Convert and piStar are iStar's.** The Convert dialog lists the model's
  framework's targets only. A KAOS or NFR model has no piStar toggle and no
  "Convert to…" (desktop and mobile): its framework's canvas is its editor,
  and nothing converts between frameworks.
- **The canvas: istar-ts's parts, then the dialect's ids.** `FrameworkDiagram`
  applies `kaosExtension`/`nfrExtension`, then `dialectParts(definition)`:
  a new element named with its prefix's next id from 1 (`G3: Behavioral
  Goal`). KAOS's two goal kinds share `G`'s numbering. This answers PR A's
  question of which kind a new `G` line creates: the palette entry chosen,
  numbered in the shared sequence. Fills are istar-ts's since 0.13.7: each
  KAOS and NFR shape carries its `fill` (`KAOS_FILL`, DSM3's grey; `NFR_FILL`,
  white), which the canvas draws for an element without a saved colour and
  the palette's icons draw too. The kaos and nfr dialects import the same
  constants as their `fill` from the `/metamodel` subpaths, so lib and the
  canvas agree. This replaces PR B's own fill override, which coloured the
  canvas but not the palette.
- **Why the extensions are widened, in one place.** The workbench types
  every model, and so its store and `IstarProvider`, as an iStar 2.0 model.
  That is deliberate: a dialect's model keeps its own metamodel, which
  istar-ts reads at run time. An `IstarExtension<KaosElementKind, …>` is
  therefore not assignable to the provider's `IstarExtension<ElementKind,
  …>`. There is one `@istar-ts/react` copy; it isn't a duplicate-types
  problem. `forCanvas` widens it, as piStar-ext's extension is widened.
  Typing the store per framework would mean making the workbench generic
  in its kinds, which is out of scope here.
- **The framework Notation tab.** `FrameworkNotationView` writes goalView's
  view of the model with the framework's dialect, checked by the shared
  goal language. The worker reads the dialect from the context, so there
  are no worker changes and no named checks. DSM3's id-less files show a
  banner: "Give every element an id (G…, A…, DP…)". `withFrameworkIds` is
  one undoable edit that renames each listed element with its kind's next
  id, in model order, changing nothing else. This supersedes PR C's "the
  seeds' lines ask for ids": the files stay byte-identical, and the user
  chooses.
- **goalView doesn't ask core which elements are hubs.** Core keeps
  model→metamodel in a module-level `WeakMap`. goal-tree's CommonJS build
  loads core's `index.cjs`, while the workbench parses with core's ESM
  `index.js`, so in ui vitest, and likely in the bundle, `metamodelOf` sees
  iStar 2.0 and `hubOfLink` finds no hubs. goalView reads an n-ary kind's
  hub, legs and end by the names core generates (`<Kind>Hub`, `<Kind>Start`,
  `<Kind>End`) from the dialect's `refinements`. PR D moves this into a
  shared `refinementsOf` in roots.ts. The remaining `metamodelOf` uses in
  goal-tree are reported for a separate fix.
- **Home.** iStar-DT joins `GROUP_ORDER`, before the frameworks' sections.

### PR D: a framework-neutral IR, kaosdoc and nfrprop

- **The IR keeps iStar's three node types.** A framework's kinds map onto
  them (`FRAMEWORK_NODE_TYPES`): KAOS's goals and domain properties, and
  NFR's softgoals and operationalizations, are goal nodes, and each node
  keeps its `kind`. There is no new node type, so every engine's switch over
  `type` stays as it is. `kind` is set only in another framework's IR, so
  iStar's IR is the same as before. Agents, claims and hubs are in no tree:
  their links say what they do.
- **Trees on the paper.** A framework without actors has its trees in a new
  `GoalModel.paper`, one tree per element of a tree kind that no refinement
  makes a child. `fromModel` returns the actors' trees and then the paper's.
- **Refinements by kind name, in one place.** `refinementsOf(model,
  dialect)` (goal-tree's `roots.ts`) reads iStar's refinement links, or a
  framework dialect's `refinements`, and an n-ary link's legs as children of
  the hub's end's target. Hubs, legs and ends are found by the kinds core
  generates (`<Kind>Hub/Start/End`), not by core's `metamodelOf`, whose
  registry belongs to one module instance (agent-red's finding in PR B). The
  IR and `goalView` both use this function. A goal with several hubs has
  those alternatives merged into one AND in the tree. kaosdoc reads the hubs
  themselves to tell the alternatives apart.
- **Ids.** A framework text without an id (DSM3's files) keeps its piStar id
  in the IR, its whole text as its name, and reports no syntax error. The
  Notation view still offers it an id.
- **Keys by kind.** `createEngineMapper`'s `kindKeys` gives a kind its own
  keys, overriding its type's (`allowedGoalKeys`, …), and the mappers get
  the element's `kind`. The G/T/R triple stays as it is for iStar's engines.
- **kaosdoc is properties-only, over the IR.** It reads lib's `kaos` dialect
  as it is and writes Markdown tables:
  - goals with their fit criteria, then the other details of the goals that
    have any;
  - refinements by hub, numbered as alternatives where a goal has several;
  - domain properties;
  - leaf behavioural goals as requirements (a system agent's), expectations
    (an environment agent's), shared, or unassigned, as van Lamsweerde
    classifies them;
  - agents;
  - conflicts with their boundary conditions.

  `FormalSpec` is text: typing it as LTL is later work, following #58's
  pattern. The document for DSM3's example is committed next to the seed and
  checked byte for byte.
- **nfrprop's rules.** These are Chung et al.'s (2000, ch. 3):
  - the individual impact of each contribution type on its offspring's label;
  - AND takes its least offspring and OR its greatest, in the order
    ✗ < W− < ⚡ < U < W+ < ✓;
  - the impacts on a softgoal combine: positive and negative together are a
    conflict, and undecided ones decide nothing.

  Two choices go beyond the book, where Chung et al. leave the step to the
  developer:
  - weak labels propagate weakly, as in Horkoff and Yu's automated forward
    propagation;
  - a claim gates the contribution it argues: a held claim lets it stand, a
    denied one sets it aside, an undecided one decides nothing.
- **nfrprop's initial labels.** They are an element property,
  `initialLabel`, in nfrprop's dialect. When it is unset, an
  operationalization or claim that nothing contributes to is satisficed
  (chosen, held), and every other element's label is propagated, so DSM3's
  seed, which has no labels, evaluates as it is. The one case runs as steps,
  one per element labelled, each giving its reason: that is the propagation
  report, shown in the workbench's step control and in `analysisText`. The
  oracle is DSM3's example labelled by hand with these rules, committed as
  `examples/nfr/nfr-welcome.labels.csv`, each row with its derivation.
- **Framework engines in the workbench.** `FRAMEWORK_ENGINE_DIALECTS` keeps
  their dialects out of `ENGINE_DIALECTS`, so the iStar notation editors never
  read them. `frameworkEditorOf(mode)` gives them their framework's editor:
  its canvas, its Notation tab in the engine's dialect, `frameworkProblems`,
  and no piStar mode. Settings offer each framework's engines under it, and
  recording an engine's mode records its framework beside it.
- **Deferred.** Typed inspector fields for a framework engine's own
  properties: the diagram's inspector is istar-ts's, so nfrprop's
  `initialLabel` is a property line in its Notation view, typed there by its
  dialect. More than one strategy per NFR model. KAOS's FormalSpec as LTL.

## KAOS stress test (goal-controller#181)

Cailliau's London Ambulance (KAOSTools) and the Brussels ambulance
dispatching corpus (ADS) bring obstacle analysis, a textual KAOS and
RE'12's quantities. The work is split into three layers: istar-ts owns the
structure (istar-ts#20), the `kaos` dialect owns the vocabularies, and an
engine's dialect (`kaosprop`) owns its quantities. Results and the attempts
log are in #182.

### PR E: framework dialects extend their root; the typed `kaos` dialect

- **A framework dialect may declare `extension`.** PR A's rule forbade it.
  Its kinds extend the root through `hostFor(framework, extension)`, which
  already took an extension. `defineExtension(extension, base, framework)`
  checks a framework's extension against that root's kinds: link ends and
  `behavesLike` name the root's kinds or the extension's, never iStar's.
  The root's namespace (`kaos.`) is the root's, as istar-ts's
  `extendMetamodel` reserves it, so an extension's kinds are namespaced on
  their own (`vote.Ballot`). `actors` and `notation` stay iStar's.
- **An extension link may be n-ary** (`arity: 'n'`, passed to istar-ts
  through `metamodelExtensionOf`). istar-ts generates its hub, legs and end
  (`<kind>Hub`, `<kind>Start`, `<kind>End`). The dialect may give the hub
  `properties`, and the legs and the end `links`, as it already could for
  the root's `kaos.RefinementLinkStart`. `extensionHubKinds` and
  `extensionLinkKinds` list them, and the type level knows the hub
  (`ExtensionHubKindOf`).
- **Every KAOS model is read with KAOS plus its obstacle analysis.**
  `FRAMEWORK_ROOTS.kaos` is istar-ts 0.14.0's `KAOS_OBSTACLES`
  (`extendMetamodel(KAOS, kaosObstacleAnalysis)`). Obstacles are
  KAOS-the-language (istar-ts's layer), not one dialect's, so they are not
  the `kaos` dialect's `extension`: every KAOS dialect, engine and importer
  reads them. DSM3's files read as before, and an empty KAOS model is
  written as before, byte for byte.
- **`FRAMEWORK_KINDS` is derived, not copied.** It reads the kinds of
  istar-ts's `KAOS_OBSTACLES` and `NFR` (their element and link maps, the
  generated hubs, legs and ends included), and its types are istar-ts's
  (`KaosElementKind | KaosObstacleElementKind`, …). This supersedes PR A's
  "the dialect package stays free of dependencies": it now depends on
  `@istar-ts/dsm3-kaos` and `@istar-ts/dsm3-nfr`, whose `/metamodel`
  subpaths need no React. Their core is the one lib and the workbench
  already load (the workbench aliases it to one copy, #177). A kind istar-ts
  adds reaches every dialect check without an edit here. The ui test checks
  the table against the workbench's own roots. The obstacle kinds are
  `kaosObstacles.*` because core reserves the root's `kaos.` prefix. Files
  write them as `kaos.*` (`pistarType`), so `detectFramework` still sees
  KAOS.
- **Three generic value types:**
  - `reference`: one element id, of the given `kinds`;
  - `formula`: text with a language tag, which nothing checks yet;
  - `probability`: `0.8`, `.8` or `80%`, in [0, 1]; `probabilityOf` reads
    it as a number.

  None has a grammar rule. They lex as `text` (`highlight.ts`'s `START`
  map, which the language server uses too), and `valueProblem` checks
  them. The inspector edits `formula` as long text and the other two as
  text. The `kaos` dialect uses `formula` (`FormalSpec`, tagged `ltl`).
  `reference` is for `Anchor` and `probability` is for kaosprop. A
  reference reads its id with the grammar, as a `refList` reads its ids. A
  piStar id, which no grammar reads, is accepted only where the model has
  it (`context.iStarIds`).
- **Vocabularies, one source each** (`KAOS_VOCABULARIES` in lib's `kaos`
  dialect):

  | Key | On | Values | Source |
  | --- | --- | --- | --- |
  | `Type` | goals | Achieve, Cease, Maintain, Avoid, Optimize, softgoal | van Lamsweerde, *Requirements Engineering* (2009), ch. 7, the behavioural goal patterns and Optimize; `softgoal` is DSM3's preset on softgoals |
  | `Category` | goals | Satisfaction, Information, Accuracy, Safety, Security | van Lamsweerde and Letier, TSE 26(10) 2000: the goal categories its obstacle categories (Non-satisfaction, Non-information, Inaccuracy, Hazard, Threat) come from |
  | `Priority` | goals | high, medium, low | none: no KAOS source fixes the levels (the book's and DSM3's are free). An ordinal of three is our choice, and a source can replace it |
  | `Tactic` | refinement hubs | milestone-driven, case-driven, guard-introduction, divide-and-conquer, uncontrollability, unmonitorability | Darimont and van Lamsweerde, FSE'96 (refinement patterns), as Cailliau and van Lamsweerde, RE'12, Table I propagate through them; no tactic reads as milestone-driven |
  | `FormalSpec` | goals | a `formula`, `ltl` | KAOS's real-time linear temporal logic (the book, ch. 17); no checker (the deferred "FormalSpec → LTL") |

  `Source`, `Issue`, `FitCriterion`, `Stability`, `SysRef`, `Status` and
  `BoundaryCondition` stay free text. `SysRef`'s help now says what it is:
  RE'11's system reference, the design option a refinement belongs to.
- **A value outside a vocabulary is a Problem, not a parse error.** It is
  the existing enum diagnostic (`One of …, not Achive`, an error on the
  property line), and the Notation view writes the value back as read.
  DSM3's welcome model has only empty values and `softgoal`, so it lints
  clean and saves byte-identically. This supersedes PR C's "KAOS properties
  are free text".
- **Nothing quantitative on the plain `kaos` dialect.** `RSR`, `ESR` and
  `Probability` are kaosprop's (PR G), and the plain mode keeps them as
  unknown keys, untouched.
- **A leg's properties in the text view are a `link` line under its
  sub-goal, naming the goal its refinement refines** (`link G1 {Probability
  = .6}`). goalView gives a leg's `target` as the hub's refined goal (the
  `refinementsOf` parent), since a hub has no line (PR C). A hub's own keys
  (`Tactic`) stay in the inspector. If a sub-goal is a leg of two hubs of
  the same goal (two alternatives), the line is ambiguous, and the link
  line's diagnostics say so as they do for two kinds.
- **Obstacles in the `kaos` dialect.**
  - `kaosObstacles.Obstacle` has prefix `O` (NFR's operationalizations take
    `O` too, in another framework).
  - Its keys are istar-ts's: `Description`, `FormalSpec` (an `ltl`
    formula) and `Category`.
  - An obstacle refinement is an AND, as a goal refinement is, so
    sub-obstacles are listed under the obstacle they refine, and several
    hubs on one obstacle (an OR) merge into one AND in the text (PR D's
    rule). Its sources may be domain properties, as in LAS.
  - An obstruction is not a refinement: an obstacle tree is a tree of its
    own, a root in the text view.
  - A resolution's `ResolutionType` and `Anchor` are a `link` line under
    the resolving goal, naming the obstacle:
    `link O5 {ResolutionType = mitigation} {Anchor = …}`.
- **More vocabularies, one source each:**

  | Key | On | Values | Source |
  | --- | --- | --- | --- |
  | `Category` | obstacles | Non-satisfaction, Non-information, Inaccuracy, Hazard, Threat | TSE'00: one per goal category it obstructs |
  | `ResolutionType` | resolutions | goal substitution, agent substitution, obstacle prevention, goal deidealization, domain transformation, obstacle reduction, goal restoration, obstacle mitigation, do-nothing | TSE'00 §5's nine resolution strategies |
  | `Kind` | domain properties | invariant, hypothesis | van Lamsweerde 2009: domain invariants and hypotheses (KAOSTools: `domainproperty`, `domainhypothesis`) |

- **KAOSTools' names are values too, labelled with what they stand for.**
  `Tactic`: `milestone` and `case`; `ResolutionType`: `prevention` and
  `mitigation`. istar-ts's LAS fixture writes them as KAOSTools does
  (`Tactic = case`, `ResolutionType = mitigation`). Accepting them keeps
  such files clean as written, with nothing rewritten. An engine reads
  each alias as its value (kaosprop: `case` is case-driven).
- **`Anchor` is a `reference` to a goal** (behavioural or soft), as
  istar-ts suggests. An imported model's anchor is a piStar id (LAS:
  `achieve_ambulance_on_scene_when_ambulance_mobilized`), so a reference
  resolves by its key, by the id its text gives it (`G1`), or by its piStar
  id. The context carries `iStarIds` where a dialect has references.
- **Obstruction Problems** (`frameworkProblems`):
  - Istar-ts's link rules already make an obstruction run from an obstacle
    to a goal or a domain property, and a resolution from a goal to an
    obstacle.
  - An obstruction of a *refined* goal is a warning (`not-a-leaf`):
    obstacles obstruct leaf goals. This is declared, not coded for KAOS: a
    dialect's `leafTargets` names the link kinds whose target must be a
    leaf (`kaosObstacles.ObstructionLink`).
  - It is a warning, not an error, since KAOSTools lets any goal be
    obstructed.
  - A `reference` value naming no element, or one of another kind, is an
    error (`dangling-reference`) on the link or element that holds it.
  - LAS has none.
- **istar-ts 0.14.0.** `@istar-ts/core`, `react`, `dsm3-kaos` and
  `dsm3-nfr` are bumped to `^0.14.0` (dependencies, not our versions), all
  four at once. `dsm3-nfr` 0.13.7 pins core `<0.14`, so a partial bump
  installs a second core (#177). dsm3-nfr 0.14.0 reached the registry
  after the other three, and the bump waited for it rather than using an
  override (#182).

### PR G: kaosprop, probabilistic obstacle analysis

- **An analysis engine with its own dialect.** kaosprop's dialect is `kaos`
  plus the quantities of Cailliau and van Lamsweerde's RE'12 and REJ'13,
  each a `probability` written as read:
  - a goal's `RSR` and `ESR`;
  - a leaf obstacle's `Probability`;
  - an obstacle refinement's hub's `Probability`, `P(O|SO1..n)`;
  - an obstruction's `Probability`, `P(¬G|O)`;
  - a case leg's `Probability`, `P(CS)`.

  This mirrors nfrprop's `initialLabel`. The plain `kaos` dialect keeps
  these as unknown keys. Defaults: a hub's and an obstruction's
  probability is 1, a domain property holds (1), and a leaf obstacle with
  no estimate is 0, which its step says.
- **The rules** (RE'12 §IV, Table I):
  - An obstacle refinement is the AND of its children times its
    `P(O|SO…)`. Several refinements of one obstacle are an OR,
    `1 − Π(1 − P(hub))`. One rule gives both of the paper's formulas.
  - A leaf goal is `Π(1 − P(O)·P(¬G|O))` over its obstructions.
  - A goal refinement's `Tactic` decides its rule: case-driven (or
    KAOSTools' `case`) is `Σ P(CS)·P(SG)`. With two legs and one case
    given, the other is its complement. Every other tactic, an unknown
    one and none is the product, which is Table I's for all five other
    patterns.
- **Two choices beyond Table I, both from the paper's own example:**
  - A leaf goal that nothing obstructs takes its `ESR` as its estimate
    (default 1). RE'12 gives such leaves' values (0.98, 0.90, 0.95)
    without the obstacles behind them, and REJ'13 gives three sibling
    subtrees as results only. On a refined or obstructed goal, `ESR` is
    not read: its EPS is computed.
  - Several refinements of one goal are alternatives, either of which
    suffices: `1 − Π(1 − P(hub))`. This is RE'12's general and-propag with
    `P(G|SGi,¬SGj) = 1`, which the paper uses for
    `MobilizedWhenAtStation` (fax or phone).
- **The report and the values.** There is one case, run as steps, one per
  goal and obstacle computed, each saying how (`AND of …`, `OR of …`,
  `case-driven: 0.4 × … + 0.6 × …`). A goal shows `EPS 92.77%`, and with
  an `RSR` also `· SV 2.23%`, a warning when `SV > 0`. An obstacle shows
  `P 1.90%`. Resolutions are not propagated: the analysis is of the model
  as it is, which is RE'12's use, before countermeasures.
- **Critical combinations** (RE'12 §V, REJ'13 §6.4). A combination is a
  singleton or a pair of leaf obstacles at their estimates, with every
  other leaf at 0. It is critical when a goal with an `RSR` gets
  `SV > 0`. Each critical combination is a case: a selection of its
  obstacles and the goal, ranked by SV. The issue's "whose removal makes
  SV ≤ 0" is read as the papers define it.
- **Oracles.**
  - RE'12's LAS is a hand-drawn model
    (`lib/test/engines/kaosprop/fixtures/re12-las.txt`) with the paper's
    estimates, each value derived in `examples/kaos/las/las.expected.csv`.
    The top EPS is 92.77 % against an RSR of 95 %.
  - Table II's eight rows are within 0.04 points: the paper rounds, and
    its 110 row is 0.035 points under the arithmetic. They are critical
    exactly where the paper's are.
  - RE'12 prints `0.6 × 0.995 + 0.4 × 0.98 = 0.984`, but the arithmetic
    is 0.989, and only 0.989 gives the paper's next steps (0.9466,
    0.9277) and Table II's 96.92 %. The oracle keeps the arithmetic and
    logs the typo.
  - KAOSTools' `las.kaos` is not RE'12's figure: it has `[.8]`/`[.2]`
    legs and one tactic-less fax/phone hub. A seed imported from it
    (PR F) gives its own numbers.
  - REJ'13's carpooling chain (`rej13-carpooling.txt`: Fig. 6's obstacle
    tree, Table 3's estimates, Fig. 4's goals) reproduces 0.015 → 0.08 →
    0.12 → 0.19 → 0.81 → 0.526 → 0.425 → 0.28. The paper's critical pairs
    (RE'12: 904 of 1722; REJ'13: 470 of 1953) need the full 63-leaf model,
    which neither paper contains, so they are not checked.
- **The IR holds obstacles.** `FRAMEWORK_NODE_TYPES` makes
  `kaosObstacles.Obstacle` a goal node, so obstacle trees lie on the paper
  beside the goal trees. `refinementsOf` reads obstacle hubs through the
  dialect's `refinements`.
- **kaosdoc reads `KAOS_OBSTACLES`** and gains an "Obstacles" section:
  each obstacle in its tree's order, with its category, what it
  obstructs, the goals resolving it, and how (`mitigation, anchored on
  …`). Only a model with obstacles has the section, so DSM3's document
  stays byte-identical.
- **In the workbench** kaosprop is offered under KAOS beside kaosdoc, in
  KAOS's editor (§4.1 of the engine guide). kaosprop has no file output,
  as nfrprop has none, so `output.test.ts` has no entry for it. Its report
  is checked through `analysisText`'s steps. The ui test of Analyse on the
  LAS seed waits for PR F's seeds. A ui test runs both analyses on the
  RE'12 model, read by the workbench's own parser.

