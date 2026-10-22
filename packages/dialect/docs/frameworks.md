# Frameworks (goal-controller#171)

A **framework** is the goal-modelling language a project's models are
written in: iStar 2.0, KAOS or the NFR Framework. It sits one level above the
dialect. A dialect is a profile of one framework's metamodel, and an engine
reads one dialect. A project may hold models of several frameworks (#329):
the framework is each model entry's, the project's is the default for
entries that name none. Nothing converts a model from one framework to
another.

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
   falling back to its record. It must match its own entry's framework (the
   project's when the entry names none; #329), and so must the framework of
   the target's dialect (`frameworkOfMode`). A mismatch
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
  `KindModel.paper`, one tree per element of a tree kind that no refinement
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
- **Keys by kind.** A mapper is given the properties its element's kind has
  in the dialect (`properties[kind]`, goal-controller#187), and the
  element's `kind`. iStar's engines read their kinds' (`goal`, `task`,
  `resource`, `quality`).
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
- **Deferred.** KAOS's FormalSpec as LTL.

### goal-controller#328: several strategies per NFR model

- **A project resource, GRL's pattern.** nfrprop's dialect declares
  `projectResources.strategies` (`format: 'json', many: true, path:
  'strategies/'`); one file is one strategy, `{ name, labels: { [id]:
  NfrLabel } }`, parsed by `parseNfrStrategies`
  (`packages/lib/src/engines/nfrprop/strategies.ts`). Unlike GRL's groups
  (several strategies, with includes, per file), the NFR Framework has no
  such structure to carry over, so one file is one strategy and there is
  no `includes`.
- **A key is an element's name, tried first, or its piStar id.** Resolving
  it needs the model (a project resource's parser never has one in scope),
  so it happens in `runPropagation`, at analysis time, as GRL's unknown
  evaluations are: a key resolving to nothing is said in the strategy's
  case label, not a Problems diagnostic.
- **`propagateLabels` takes its initial labels as an argument**
  (`ReadonlyMap<string, NfrLabel>`, default: `modelLabels(model)`, the
  model's own `initialLabel` properties), rather than reading them itself.
  `runPropagation` gives "Model labels" first (the seed's own case, so it
  still runs without a project), then one case per strategy, in file
  order, each with its own steps: a step series per case, as the step
  control already supports, and no series over the strategies'
  differences (the issue's open question, resolved this way).
  `examples/nfr/nfr-welcome.labels.csv` gained a `strategy` column (one
  CSV, not one per strategy) for the "RSA 260 only" strategy's expected
  labels, next to the "Model labels" rows (its column blank).
- **Out of scope: wiring project resources into the UI for framework
  engines.** `nfrprop`'s dialect (like `kaosdoc`'s and `kaosprop`'s) is
  kept out of `ENGINE_DIALECTS` (`FRAMEWORK_ENGINE_DIALECTS` instead, see
  above), and the workbench's project-resource pipeline
  (`declarationsOf`/`parseResources`,
  `packages/ui/lib/workbench/projectResources.ts`) gates on
  `isDialectEngine`, so it never reaches `ENGINE_PROJECT_RESOURCES` for a
  framework engine: a `strategies/` folder in a project would not yet show
  up in the file tree or reach the analysis's `resource` argument from the
  live workbench. The lib-level pipeline (the dialect, the parser, the
  cases) is complete and tested directly, resource maps built by hand; the
  UI wiring is goal-controller#334.

### goal-controller#334: project resources for a framework engine

- **`declarationsOf` reads a framework engine's dialect too.**
  `dialectOf(mode)` (`engineDialects.ts`, already there for the inspector,
  goal-controller#327) gives either map's dialect, `ENGINE_DIALECTS`'s or
  `FRAMEWORK_ENGINE_DIALECTS`'s; `declarationsOf` reads its
  `projectResources` through it, instead of `ENGINE_DIALECTS[mode]` alone.
  Every call site (`WorkbenchContext`'s `resourceSlotsNow`,
  `resourceProblemsNow`, `addResource`; `Home.tsx`; `services/examples.ts`)
  goes through this one function, so nothing else changes.
- **`FRAMEWORK_ENGINE_PROJECT_RESOURCES`, `ENGINE_PROJECT_RESOURCES`'s
  counterpart.** Built the same way (`byEngine`, `ofFramework` the other
  way), so `parseResources` picks a framework engine's parser from it
  instead of returning `{}` outright (nfrprop's `strategies`, kaosdoc's and
  kaosprop's for when they declare one). `ENGINE_CHECKS` and the notation
  gates (`isDialectEngine`'s other callers: `notationDefinitionOf`,
  `pistar.ts`, `goalWorker.ts`, `languageServices.ts`) are untouched: those
  assume iStar notation, which a framework engine genuinely has none of.
- **`analysisResource`/`runAnalysisNow` needed no change.** They read
  `resourceSlotsNow` and `resourceTexts` directly, not
  `ENGINE_PROJECT_RESOURCES`, so fixing `declarationsOf` alone already let
  a framework engine's analysis read its resource's files; the parser
  widening is for the Problems panel and the language's symbols/data, not
  the analysis's own input.
- **Tested through the real pipeline**
  (`test/workbench/frameworkEngineResources.test.tsx`): a `WorkbenchProvider`
  opens an NFR project with `strategies/*.json` present (one with a bad
  label), `declarationsOf`/`parseResources` as units, then
  `workbench.runAnalysis` end to end — the case picker's cases, and the
  Problems panel's diagnostic for the bad label.

## KAOS stress test (goal-controller#181)

Cailliau's London Ambulance (KAOSTools) and the Brussels ambulance
dispatching corpus (ADS) bring obstacle analysis, a textual KAOS and
RE'12's quantities. The work is split into three layers: istar-ts owns the
structure (istar-ts#20), the `kaos` dialect owns the vocabularies, and an
engine's dialect (`kaosprop`) owns its quantities. Results and the attempts
log are in #182. Defects found along the way in the reference tools
(CAIRIS, RADAR, KAOSTools) and in the published papers/models themselves
are gathered in [`reference-defects.md`](reference-defects.md), rather
than fixed or reported upstream.

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
  | `ResolutionType` | resolutions | goal substitution, agent substitution, obstacle prevention, goal deidealization, domain transformation, obstacle reduction, goal restoration, obstacle mitigation, weak mitigation, strong mitigation, do-nothing | TSE'00 §6's nine resolution strategies (§5 here before #191, a slip), with §6.3.2's two forms of mitigation since #191 ("Step 4 part A" below) |
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


### PR F: the `.kaos` importer and writer

- **The goal language serves the parser.** The grammar is `packages/goal-language/src/formats/kaos/kaos.langium`, generated into its own `generated/` (its own `langium-config.json`, beside the goal grammar's `src/generated`, which is untouched; goal-language's `generate` runs both). `defineLanguage` turns it into `kaosLanguage`, a `NativeLanguage`: the parse with ranged diagnostics, and the `.kaos` tab's highlighting and completions. `@goal-controller/goal-language/formats` exports it with `parseKaos(text)`, which returns the AST and its diagnostics. The CommonJS `formats.cjs` bundles it on the package's one Langium copy. lib's `importers/kaos` holds only the reader (AST → model) and the writer. This is the owner's decision, after a hand parser in lib and then a grammar in lib: a parser for another tool's format lives with the formats. #189's core-package gate (no engine names in goal-language) therefore gains `.kaos`'s format here, a file format of the KAOS framework rather than an engine.
  - The grammar follows KAOSTools' PEG (`Parsing/Parsers/GoalModelParser.peg`, MIT). It adds the older forms ADS's files use:
    - `declare goal` with an `id` attribute;
    - anonymous `declare obstacle … end` inside `refinedby`;
    - `resolvedby(mitigation[g])`;
    - a reference by its quoted name;
    - a tuple value (`probability[e4] (20%, 20%, 40%)`).
  - A declaration of any kind parses as one rule, so nothing fails to parse for being unknown. The reader decides what it places.
  - Formulas are datatype rules, used to find where a formula ends. The reader keeps a formula's text from the CST (`kaosFormulaText`), its tokens joined by one space wherever the file had a space, a line break or a comment.
  - A top-level declaration may lack its `end`; the reader warns. No corpus file needs this. It was asked for on a wrong report of mine that `simple.kaos` had such a declaration, and is kept as leniency, with a synthetic test.
  - The grammar's tests and the corpus (ADS's six models and KAOSTools' LAS, each with its MIT licence) are goal-language's (`test/kaos.test.ts`, `test/fixtures/kaos`). lib's importer tests read the same files from there.
- **Where each attribute goes** (#181's table, as implemented):

  | `.kaos` | Model | Layer |
  | --- | --- | --- |
  | `declare goal` / `softgoal` / `obstacle` / `agent` | `kaos.BehavioralGoal` / `kaos.Softgoal` / `kaos.Obstacle` / `kaos.Agent` | structure |
  | `declare domainproperty` / `domainhypothesis` | `kaos.DomainProperty`, `Kind` `invariant` / `hypothesis` | structure, vocabulary |
  | agent `type software` / `environment` / `malicious` / none | `kaos.Agent` / `kaos.EnvironmentAgent` / `kaos.Agent` with an info diagnostic / `kaos.Agent` | structure |
  | `name` | the element's text (its identifier when it has none) | structure |
  | `definition` | `Description` | structure |
  | `formalspec` | `FormalSpec` (also on a domain property, see below) | structure |
  | `refinedby [p] a, b` | one refinement hub per `refinedby`: a goal's, or an obstacle's (several on one obstacle are an OR) | structure |
  | its pattern | the hub's `Tactic`: `milestone` → `milestone-driven`, `case` → `case-driven`, `introduce_guard` → `guard-introduction`, `divide_and_conquer` → `divide-and-conquer`, `uncontrollability`, `unmonitorability`; another one as written | vocabulary |
  | a refinee's `[p]` | its leg's `Probability`, as written | quantity |
  | `obstructedby o` (`o [p]`) | an obstruction (its `Probability`) | structure (quantity) |
  | `resolvedby [pattern:anchor] g`, `resolvedby(pattern[anchor]) g` | a resolution, `ResolutionType`: `prevention` → `obstacle prevention`, `mitigation` → `obstacle mitigation`, `substitution` → `goal substitution`, `restoration` → `goal restoration`, `weakening` → `goal deidealization`, `obstacle_reduction` → `obstacle reduction`, `weak_mitigation` → `weak mitigation`, `strong_mitigation` → `strong mitigation` (since #191); another one as written. `Anchor` is the anchor's identifier | structure, vocabulary |
  | `assignedto a, b` | one responsibility assignment each | structure |
  | `rsr` (older `rds`) on a goal | `RSR`, as written | quantity |
  | `esr` / `eps` / `probability`, a single number | a goal's `ESR`, an obstacle's `Probability`, as written | quantity |
  | `$Type`, `$Priority`, … (a `kaos` key `.kaos` has no attribute for) | that key | vocabulary |
  | `@title` | the diagram's name | — |

- **Kept as written, never dropped.** The following are kept in the diagram's `kaosUnsupported`, in file order and separated by blank lines, and the writer writes them back:
  - `expert`, `calibration`, `entity`, `association`, `predicate` and `type` declarations, and any other unknown declaration;
  - per-expert and distribution forms of `probability`/`esr`/`rsr`;
  - `provided`, `except`, `relaxedTo` and `replaces` (read since #191 when KAOSTools writes them, `except [o] g`: "Step 4 part A" below);
  - a refinement's `context`;
  - custom `$attributes` with no `kaos` key;
  - `@author`, `@version` and other model attributes;
  - an import the reader isn't given;
  - a domain property's `probability`.

  Since #190 part A, experts, calibrations, `@experts.quantiles`, an obstacle's per-expert and distribution `probability`, and a domain property's `probability` are read (kaosexpert's keys and resources, "Step 3 part A" below); since #199, a goal's distribution `esr`/`eps` and an obstacle's `beta` are too ("Step 3 part C" below). A goal's per-expert `esr`/`rsr` is still kept (no per-expert form for either, so nothing in the corpus would ever write one).

  An attribute of a placed element is kept as `override <kind> [ <id> ] … end`, so reading it back keeps it in the same place. Each item gets a diagnostic: a warning, or an info for a model attribute. The key is on the diagram, a model-level record; it adds nothing to either dialect's element keys.
- **Domain properties carry `FormalSpec`** (the book, ch. 17), from KAOSTools' `formalspec`, same as a goal's and an obstacle's: istar-ts's domain-property schema gained the optional key (istar-ts#24), and the `kaos` dialect types it as the same `ltl` formula (goal-controller#338).
- **References.** A reference resolves by identifier, and by name when the reference is a quoted name (ADS). An element that nothing declares is created with the kind its reference implies (a refinee of a goal is a goal, of an obstacle an obstacle; `obstructedby` an obstacle; `resolvedby` a goal; `assignedto` an agent), with a warning. An anonymous element's identifier is made from its name (`Paper Jam` → `paper_jam`). An `override` of an element not yet seen creates it. A second `declare` of one adds its attributes, with an info diagnostic.
- **Imports** resolve against the files the reader is given: the native file's project resources, matched by path and then by file name. Otherwise the import is kept as written, with a warning.
- **The model** is written as istar-ts writes a KAOS model (`toPistarObject(parsePistar(…, KAOS_OBSTACLES))`), with DSM3's keys present and empty, as DSM3 creates them. It records no mode or framework: the project's manifest gives the mode (the native file's dialect, kaosprop), and its kinds make it KAOS, as DSM3's files do. A seed records its mode when it opens, as every example does. (Part 1 recorded both; part 2 dropped them, because every example records neither.) Ids:
  - an element's id is its KAOSTools identifier, as in istar-ts's LAS fixture, so `Anchor` names it;
  - a link's id is made from its structure (`<goal>-refinement-<n>`, `<obstacle>-obstructs-<goal>`).
- **Layout.** `layOut` gains a third argument, the link types to layer by. Its default is iStar's refinements, so other importers are unchanged. `.kaos` lays out:
  - a refinement's children below it;
  - an obstacle below the goal it obstructs;
  - a resolving goal below its obstacle;
  - an agent beside its goal.

  A hub sits between its goal and its children.
- **The writer** writes in KAOSTools' current syntax:
  - patterns by KAOSTools' names;
  - quantities as written;
  - an environment agent as `type environment`;
  - a `kaos` key without a `.kaos` attribute as a custom attribute;
  - the kept text at the end.

  An identifier that isn't a KAOSTools one (a workbench UUID) is written as its name's identifier, with an info diagnostic. The writer says what it can't write:
  - a refinement's `SysRef` and `Status`;
  - an obstacle refinement's `Probability`;
  - a conflict;
  - an unknown key;
  - a non-numeric quantity.

  A `FormalSpec` that isn't a KAOSTools formula is written as a string, with a warning. An obstruction's `[p]` is written, but KAOSTools doesn't read it (only goal-controller does).
  - `type software` and an untyped agent both read as `kaos.Agent`, and the writer writes no `type` for one: an untyped agent is KAOSTools' default.
  - A domain property whose `Kind` is unset is written as a `domainproperty`.
- **Round trip.** `.kaos → model → .kaos` is structural, not textual: the writer chooses the order and the keywords (`rds` is written `rsr`, `eps` is written `esr` or `probability`, the older resolution syntax the PEG's). `modelRoundTrip` holds for all seven corpus files, and writing a written file again gives the same text. `KAOS_LOSSY` lists positions and sizes, link ids, `display`, `saveDate`, and the diagram's `Description`, `engine` and `framework`.
- **Counts.** #181's figures: `las.kaos` 41 goals and 8 agents, `obstacles.kaos` 76 obstacles. For `simple.kaos`, 183 obstacles are read. #181's 185 also counts the two `declare obstacle` blocks that are commented out (o2, o4). Every corpus model validates in istar-ts (`validateModel`: none).
- **In the workbench.** `.kaos` is kaosprop's native file, so the Open dialog takes it, and opening one makes its project in kaosprop's mode (the KAOS framework). The plain `kaos` mode is one switch away. Two workbench changes were needed:
  - `nativeDeclarationsOf` read the iStar engines' dialects only, so a framework engine's native files never had a slot. It now asks `dialectOf`, as #337 did for project resources.
  - A native file whose model is in another framework than the open model's waits in `frameworkSwitch`, as a model file does (#171, PR B). `FrameworkSwitch` gains an optional `open`, which opens the native file's project once the switch is confirmed.
- **Seeds** (`examples/kaos/`, projects in kaosprop's mode, each with its `.kaos` as the native file and its model as that file read, byte for byte):
  - `las`: KAOSTools' `las.kaos`, verbatim. `las.expected.csv` stays beside it, and its header now says it is the oracle of RE'12's hand-drawn model, not of this file (#182). kaosprop's test skips `#` lines in it.
  - `ambulance`: ADS's `las.kaos` followed by its `obstacles.kaos`, verbatim, with las.kaos's two imports commented out. `resolutions.kaos` is not part of the seed, which is one file, not three. Its obstacles' estimates are per expert and kept as written, so kaosprop finds every goal satisfied: `Achieve [Incident Resolved]` shows `EPS 100.00% · SV -5.00%`. Combining the experts is #190's job.
  - `carpooling`: REJ'13 re-keyed in `.kaos` from Fig. 4, Fig. 6 and Table 3 (PR G's leftover), citing REJ 18(2):129–146, 2013. kaosprop gives the same numbers as PR G's hand-drawn fixture, to the last digit: 0.015 → … → 0.28.
  - Provenance is in `home/references.ts` under KAOS: RE'12, REJ'13, RE'15, SEAMS'17, KAOSTools and ADS (MIT).
- **PR G's ui test** ("Analyse on the LAS seed shows the badge on `Achieve[IncidentResolved]`") runs on the `ambulance` seed. `Achieve [Incident Resolved]` is ADS's London Ambulance System's root, and KAOSTools' LAS doesn't have it.

### Step 3 part A: expert combination and uncertainty (goal-controller#190)

Cailliau and van Lamsweerde's RE'15 (DOI 10.1109/RE.2015.7320413, the
authors' copy `RE2015.pdf`): several experts estimate each leaf obstacle,
calibration variables weigh them (Cooke's classical model), and each goal's
probability of satisfaction becomes a distribution, sampled by Monte Carlo
over a BDD of its obstruction superset, with its violation uncertainty (VU)
and uncertainty spread (US). Results and the attempts log are in #343.

- **The engine is `kaosexpert`** (D1's working name, kept). Its dialect is
  kaosprop's with three changes:
  - a leaf obstacle's `Probability` is a `distribution` that also takes a
    single value, so kaosprop's point estimates are its degenerate case;
  - that `Probability` is keyed by expert (D2): `Probability[e1]`;
  - a domain property has a `Probability` (how likely it holds, RE'15's
    domain hypotheses; default 1, as kaosprop reads one).

  Its project resources are the experts (`experts.json`) and the
  calibration variables (`calibrations.json`). Every other key is
  kaosprop's, so the same file runs under both.
- **`.kaos` is the native file of both, one definition.** A registry
  refused two dialects sharing an extension. Now two dialects may share one
  only through the same `NativeFileDefinition` (`sharedNativeExtensions`),
  and the reader says which mode a file opens in (`dialectRecord.engine`).
  A file with experts, calibrations, `@experts.quantiles`, per-expert or
  distribution estimates, or a domain property's probability opens in
  kaosexpert's mode; any other in kaosprop's, as before.
- **A generic `distribution` value type** (the dialect package's
  `distribution.ts`, shared with the quantitative round, #193). Its forms
  are KAOSTools' (`ESRAttributeParser`): `beta[α, β]`, `uniform[min, max]`,
  `triangular[min, mode, max]`, `pert[min, mode, max]`, `quantile[…]`
  (`quantiles`), and ADS's tuple `(q1, …, qn)`. With `point`, a single value
  too. It ranges over probabilities by default, or the reals (`range:
  'real'`). It is written back as read; a value it rejects is a Problem and
  stays as written. ADS's calibration estimate `(30%, 10%, 50%)` (falling
  quantiles) is the corpus's one such value.
- **Keyed properties (D2).** `keyed: 'expert'` on a property, the kind one
  of the dialect's `projectResources` (`defineDialect` checks it). On disk
  `Probability[e1]` (`keyedKey`/`keyedKeyOf`). `propertyOf` resolves the key
  to the property, so the checks read it, and `readProperties` reads each
  name's value. The framework inspector has a row per expert
  (`frameworkProperties.ts`'s `schemaOf` takes the resources' names,
  `resourceNames`), and a `distribution` is a text field there. The Notation
  view writes no line for a keyed key, because its keys are words: #345.
- **The `.kaos` grammar is unchanged.** It already parses every form
  generically: `probability[e1] (…)` is an attribute with a parameter and a
  tuple, `beta[2, 3]` a name with a bracket. Typing the forms in the grammar
  would make `beta`, `pert`, … keywords, which KAOSTools doesn't (it matches
  the distribution's name on an identifier). The reader types them:
  - an obstacle's or a domain property's `probability X` is `Probability`;
  - `probability[e] X` is `Probability[e]`, as written (one line, whitespace
    runs as one space);
  - `declare expert [ e ]` and `declare calibration` (its known value
    `probability v`, its experts' `probability[e] X`) are entries of the
    resources, an attribute they have no key for kept in the entry
    (`kept`);
  - `@experts.quantiles "…"` is `experts.json`'s `quantiles`, as written.

  Nothing of these is kept raw any more (ADS's `obstacles.kaos` reads with
  no diagnostic at all); a goal's per-expert `esr` still is (no engine has
  a per-expert goal estimate; #199 adds the plain distribution form,
  "Step 3 part C" below). The writer writes them back after the
  elements, from the project's resources (`NativeFileContext`), and a read
  of what it wrote gives the same model and resources, byte for byte.
- **Cooke's model as RE'15 applies it (D3).** RE'15 gives its numbers, not
  its formulas, so the rules are those of the tool that made them:
  KAOSTools' `UncertaintySimulation` (2498386, March 2015) over
  ExpertOpinionSharp's `CookFramework` (both MIT). It differs from the
  textbook model:
  - the bins' masses are hard-coded (.05, .45, .45, .05), though the model
    declares the levels (.1, .5, .9);
  - every estimated variable counts, the leaf obstacles too (N):
    information is averaged over all of them, and the calibration's
    empirical masses are realisations per bin over N, so they sum to less
    than 1;
  - each bin's term of I(s, p) is clamped at 0; calibration is
    1 − χ²₃(2·N·I);
  - the cut-off α maximises the decision maker's information, by Brent's
    search on [0, the largest weight] (ported line for line with the C#'s
    one departure from Brent's text).

  The evidence: with N = 16 (13 leaf obstacles and 3 calibration
  variables), Table I's bins give Expert1 1 − χ²₃(2·ln 1.25) = **0.9305**
  and Expert2 **1**, RE'15's scores exactly. The clamp is needed (without
  it the statistic is negative and both get 1), and the tail mass .05 too
  (with .1 the clamp zeroes Expert1's term). ExpertOpinionSharp itself, run
  under Mono in Docker on the same inputs, gives 0.93052310130834992, which
  `cooke.test.ts` pins to 1e-12 with its information scores, weights and
  cut-off. The textbook model is the `classical` option, and `equal` weighs
  experts the same.
- **No fitting.** RE'15 fits nothing to the fire alarm: the decision maker
  is the experts' quantile distributions mixed by weight, each CDF linear
  between its quantiles and reaching 0 and 1 at the variable's intrinsic
  range (all experts' quantiles and the known value, 10 % beyond each end),
  as the tool samples it. A named distribution is sampled by its own
  inverse CDF: Beta by the inverse regularised incomplete beta function,
  PERT as a Beta with λ = 4. For Cooke's scores it gives its quantiles at
  the levels. The brief's "Beta/PERT/Triangular as RE'15 does" is the
  named distributions ADS's experts may give, not a fit.
- **Numerics in pure TypeScript (D5)**, generic, in `lib/src/numeric/`:
  - ln Γ, the incomplete beta and gamma functions and their inverses
    (Numerical Recipes);
  - distributions, a mixture, a seeded generator (sfc32 seeded through
    splitmix32);
  - ROBDDs with apply, ite and the probability walk of §VI.B;
  - Brent's minimiser.

  No numeric library.
- **Obstruction supersets as BDDs (§VI.A–B)**, with kaosprop's quantities as
  kaosprop reads them:
  - an obstacle refinement is an AND (times its `P(O|SO)` as an event),
    several refinements an OR;
  - a domain property in one holds with its probability;
  - an obstruction is the obstacle and its `P(¬G|O)`;
  - a refined goal is obstructed when any sub-goal is, its alternatives
    when all are;
  - a case-driven refinement is a chain of case events;
  - a leaf goal nothing obstructs fails with 1 − its `ESR`.

  With point estimates only, every sample is kaosprop's EPS: RE'12's LAS to
  1e-12. REJ'13's carpooling differs by 0.0008 at one goal, because the BDD
  counts Wrong Instructions Sent, shared by two sub-obstacles, once. §VI.B's
  worked example is 98.22 % (0.982199524); the paper prints 98.21 %, its
  digits truncated.
- **Monte Carlo (D4).** Each sample draws every event in a fixed order
  (a mixture draws the expert by weight, then from that expert's
  distribution, as KAOSTools does). Each goal's sample is 1 − Pr[OS(G)].
  The options are `samples` (default 10000), `seed` (default 1) and
  `weighting`, engine options (§3.8 of the guide), and the analyses get
  them. VU and US are §III.B's:
  - VU = SU(RDS), the share of samples below the RSR;
  - US = √(Σ (xᵢ − RSR)² / k) over the k samples below it.

  SU(p) is the formula's ∫ₓ<ₚ; the paper's prose ("at least p") says the
  opposite, a slip, logged.
- **The result shape gains a distribution** (the guide's §3.7): a value's
  `distribution` carries its quantiles, mean, sample count and a
  histogram. An analysis may read several resource kinds (`inputs`) and is
  given them and the options (`context`). `analysisText` prints a
  distribution after its value; other engines' reports are unchanged.
- **The report.** One case, run as steps:
  - the run (samples, seed, events);
  - each expert's information, calibration and weight;
  - each goal (`P 82.27% · VU 1 · US 0.1582`, a warning when VU > 0) and
    obstacle, with how its estimate was made.

  "Critical obstacles" (§VII) is one case per leaf obstacle and goal it
  violates (VU > 0): the obstacle alone, every other leaf at 0, ranked by
  VU then US, as Table III.
- **The fire alarm (#197), from the paper and the author's model.** RE'15
  prints too little to re-key the model whole:
  - Fig. 2 has the obstacle trees of three leaf goals;
  - Table I has two of the three calibration variables;
  - Table II has 3 of the 13 leaf obstacles' estimates.

  The owner's first call was the paper only; it was then reversed, by the
  owner's call, to use Cailliau's own `firesystem.kaos`
  (ancailliau/phd-thesis at 6a9f5fd), "used with the owner's approval; the
  repository states no licence". That departs from the precedent of
  re-keying from papers only an unlicensed source (#189). The seed
  (`examples/kaos/fire-alarm`) has Fig. 1's goals and Fig. 2's trees. Its
  estimates are the thesis model's, but for two rows where the paper prints
  other values, which keep the paper's: Table I's FireSprinklerBroken, and
  Table II's BatteryOutofService for Expert2 (Fig. 5(b) plots it over
  0–0.2 %). Elsewhere the tables print the thesis's values truncated.
  `fire-alarm.expected.csv` has two kinds of rows:
  - "RE'15" rows, reproduced exactly from the paper's inputs:
    - calibration 0.9305 / 1;
    - the weights from the printed scores;
    - §VI.B's chain.
  - "thesis" rows, the seed's own numbers, each beside the printed one with
    the reason for any difference:
    - information 0.4348 / 0.5552 (printed 0.4216 / 0.4740, unexplained);
    - VU 1;
    - US 0.1586 (printed 0.1645 and 0.1529);
    - SU(0.84) 0.85 (printed 0.78);
    - Table III's seven obstacles, BatteryOutofService's VU 0.41 (printed
      1).
- **`stress:kaos`** (`scripts/kaos-stress`) checks every KAOS seed:
  - import, validation and round trip with its resources;
  - kaosprop's and kaosexpert's analyses;
  - its expected CSV: kaosprop's `las` and `carpooling`
    (`carpooling.expected.csv` is new), kaosexpert's `fire-alarm`,
    `ambulance` (#198, "Step 3 part B" above) and `mooring` (#199, "Step 3
    part C" below), a `triangular a`/`triangular b` quantity kind for the
    latter's oracle (`lib.extendTriangular`), and a row whose `expected`
    is `-` reported, never a failure (the first seed to need it: Table
    II's Spearman correlations, whose inputs HASE'11 withholds).

  It is in the stress workflow's matrix, strict. The repository ruleset's
  required checks are the owner's to change.
- **Paper findings** (#343):
  - US is 0.1645 in §III and 0.1529 in §VII, for the same goal;
  - Expert2's weight is truncated, not rounded (0.547155 is printed
    0.5471);
  - so is §VI.B's 98.2199 % (98.21 %);
  - SU's prose contradicts its formula;
  - §V mentions three calibration variables, Table I gives two.

### Step 3 part B: ADS's five experts, the field oracle (goal-controller#198)

RE'15's §VIII validates the approach on the Brussels ambulance dispatching
model with five paramedics as experts. ADS (ancailliau/ADS, MIT) has that
model: `las.kaos` (41 goals) and `obstacles.kaos` (76 obstacles, 47 of them
leaves, as §VIII counts). The `ambulance` seed is PR F's, now with all five
experts. Results and attempts are on #343.

- **The commented estimates are the run's selection, so the seed
  uncomments them.** `obstacles.kaos` writes every expert's estimate on
  every leaf and calibration variable, and comments out all but one
  expert's:
  - e4's in ADS, from its first commit (746a247, 2016) to its last;
  - e1's in Cailliau's thesis's copy of the model (ancailliau/phd-thesis,
    `obstacles-uncertainty.kaos`), for its "Expert 1" run.

  RE'15 combines all five, and its Table IV prints the commented values
  (PatientCannotReachAmbulance's five rows exactly). So the seed removes
  the `#` before e1, e2, e3 and e5's estimates. That is its one edit
  beyond PR F's commented imports, and the header says so. e4's `(30%,
  10%, 50%)` for Allocated Ambulance Not At Station is kept as written: on
  the leaf and on the calibration variable, a Problem the workbench
  reports (Table IV prints 30/40/50 %). kaosexpert leaves both out, so e4
  scores on 48 variables, the others on 50.
- **A variable every expert estimates at one value has no information.**
  Six ADS leaves are `(0%, 0%, 0%)` from all five experts, for example
  AVLS Out of Service. Their range is a point, so the masses per bin are
  0/0. RE'15's tool averages that NaN into every expert's information
  score, which makes every weight NaN. Part A's port did the same, and
  then gave every obstacle probability 0: the root was 100 % satisfied.
  `cooke()` now leaves such a variable out of the information scores (the
  experts' and the decision maker's). It still counts in N, and its
  decision maker is the point. Calibration is unchanged.
- **The diagnostics.** `obstacles.kaos` reads with none. The seed has two
  infos: `@author` and `@version` are kept as written, because the KAOS
  model has no model-level key for them. Read alone, `las.kaos` also warns
  about its two imports when it isn't given the files. Nothing
  per-expert or distributional is kept raw.
- **The oracle** (`ambulance.expected.csv`, in `stress:kaos`) is what
  kaosexpert gives on the seed (100 000 samples, seed 1), with a tolerance
  of at least 4 × the spread over seeds 1–6:
  - each expert's information, calibration and weight;
  - the root `Achieve [Incident Resolved]` (RSR 95 %): VU 1 (RE'15
    100 %) and US 0.9462 (RE'15 0.9189);
  - Expert 1 alone (`given` `experts=e1`, the stress script's run on some
    experts' estimates only): US 0.9496 (RE'15 0.9471);
  - each of the 47 leaves alone against the root (§VII's violation
    diagram):
    - two are over 90 %: Ambulance Stopped In Traffic and Ambulance In
      Traffic Deviation (RE'15's four are Mobilization Cancelled,
      MDTTurnedOff, Blackspot and AvailableBedNotAssigned: 0.74, 0.22,
      0.75 and 0.31 here);
    - 26 have US > 0.10 (RE'15 counts 18 and names none);
    - 8 have VU 0 (RE'15 counts 14).

  RE'15's numbers can't be reproduced from ADS's file. RE'15 calls its
  data "fictitious but realistic", and Table IV differs from the file
  (Allocated Ambulance Not At Station, Service End Before Intervention).
  Putting Table IV's values in moves US by 0.0005 only. The thesis prints
  yet other numbers for its later 54-leaf version (US 0.9258, 0.9487 with
  Expert 1).
- **KAOSTools as the second oracle (#190 oracle 4).** KAOSTools of July
  2017 can't read ADS's files: they have anonymous nested `declare
  obstacle`, and its PEG wants `[id]`. ADS's 2016 files are the same model
  in the older syntax, which KAOSTools of 2015 reads. So the second oracle
  is:
  - KAOSTools 0f17b6e (2015-11-20, the last commit before ADS's first),
    whose `UncertaintySimulation` made RE'15's numbers;
  - BDDSharp and ExpertOpinionSharp as committed in April 2017 (the 2015
    tool needs APIs that only those commits have);
  - built with `mcs` under Mono 6.12 in Docker (`msbuild` and `csc` abort
    under amd64 emulation on the host);
  - run on ADS 746a247's `las.kaos` and `obstacles.kaos`, all five experts,
    without `resolutions.kaos`.

  Two findings about the tool:
  - With `resolutions.kaos` imported, its weakening and restoration of
    Achieve [Mobilized Ambulance Intervention] take that goal's eight
    leaves out of the root's obstruction set. RE'15 models "the ideal
    case", without countermeasures, and the seed doesn't have the file.
  - As is, every weight is NaN (the six point-range variables).

  With the two rules above (the point range left out, r clamped at machine
  epsilon) and e4's estimate corrected to Table IV's, its information,
  calibration and weights are kaosexpert's to 1e-8. At 100 000 samples
  its root is VU 100 %, US 0.9461, mean 0.395 %; kaosexpert's is US 0.9462,
  mean 0.380 %. The rest is one rule: KAOSTools uses a draw below 0 (an
  overshoot below 0 %) as a negative probability, and kaosexpert clamps it
  to 0. Without the clamp, kaosexpert gives 0.9461 and 0.40 % too.

  Its §VII run (each leaf alone, 100 000 samples) agrees with kaosexpert's
  on 38 of the 47 leaves, within 0.006 in VU and in US. It names the same
  two obstacles over 90 % and the same 8 with VU 0. The 9 others each have
  an expert quantile of exactly 5 %, so the leaf alone puts the root at
  exactly 95 %. KAOSTools reads quantiles in single precision
  (`float.Parse(…) / 100f`): 5 % is 0.0500000007, the root 94.99999993 %,
  a violation. kaosexpert reads 0.05, and 95 % meets the RSR. So
  KAOSTools' VU is higher there by the expert's weight times the mass at
  5 %: 0.17 for e4's `(5%, 5%, 5%)`, 0.08 for `(5%, 5%, 10%)`. Patient
  Not Transportable's US falls to 0.086, and KAOSTools counts 25 with
  US > 0.10.

### Step 3 part C: fibre-rope mooring (goal-controller#199)

Sabetzadeh, Falessi, Briand, Di Alesio, McGeorge, Åhjem, Borg, HASE'11
(DOI 10.1109/HASE.2011.25): the simplest sibling of expert combination
kaosexpert handles — one distribution kind (triangular, with 5 % tails),
no experts, evidence on the leaves instead. Results in #343.

- **The seed (`examples/kaos/mooring`)** re-keys Figure 2, "Simplified
  goal model for fiber rope mooring", in full: the top goal GL1, its
  obstruction tree OB1–OB7, the mitigating goal GL2 and its subtree
  GL3–GL11, the eleven evidence items and the assumption AP1.
  Decomposition completeness (filled or empty circles in the figure) does
  not survive PDF text extraction reliably past the three the paper
  states explicitly in prose (GL2 OR, full; GL3, GL5, GL8 AND, partial);
  every other refinement is left at the default, noted in the seed.
- **What the paper withholds.** Section V states twice that every
  elicited quantity is unpublished ("For privacy, we do not report the
  elicited quantities"; Figure 6(b) "report[s] the curve shape but not
  the actual numbers"): the five leaf goals' ESR, α for GL3/GL5/GL8, and
  any propagated satisfaction result. The seed leaves all of it unset
  (the fire-alarm precedent: re-key what is printed, nothing invented),
  each marked in `mooring.kaos` with a comment saying so. Unset reads as
  kaosexpert's documented default (a leaf with no `ESR` holds, 1; a hub
  with no `Probability`, α = 0), so the `uncertainty` analysis still runs
  end to end, at EPS 1 throughout: the engine's behaviour for a model
  with nothing elicited, not a claim about the real technology.
- **The one printed number, Figure 3 and §III-B2.** The paper's only
  fully worked numeric example, standalone (not tied to any one element):
  an elicited triangular (a₀, m, b₀) = (0.85, 0.90, 0.96), extended by
  distributing 5 % of the mass before a₀ and after b₀, giving (a, m, b) =
  (0.82548, 0.90, 0.9863). `lib.extendTriangular` (`numeric/
  distributions.ts`) solves the two equations exactly by 2D Newton
  (`CDF(a₀) = tail` on the left branch, `CDF(b₀) = 1 − tail` on the
  right); its exact solve, (0.825529, 0.90, 0.986351), is close to the
  paper's printed digits but not identical (~5e-5, ~1e-4) — both of the
  paper's own values solve the same two equations to within 5e-4 of
  0.05/0.95, not exactly, so this reads as the paper's rounding or a
  lower-precision solver, not a different formula. Both equations factor
  through `(a0 − a)` and `(b0 − b)`, so `a = a0`/`b = b0` is always a
  spurious root, degenerate (a double root) exactly when the mode sits at
  an elicited bound (`m = a0` or `m = b0`); the initial guess is offset by
  the elicited range (`b0 − a0`), which stays nonzero there (rv199's
  finding — a guess scaled by `m − a0`/`b0 − m` collapses onto the
  spurious root in that case), and the result is checked against the two
  equations and `a < m < b` before being returned, else an error.
  `examples/kaos/mooring/mooring.expected.csv` checks the exact solve;
  Table II's Spearman correlations depend on the withheld leaf estimates
  and α, so they are listed as not reproducible (`expected = -`), not fit
  with placeholder numbers — `scripts/kaos-stress/run.cjs` reports such a
  row, never fails on it (the README already documented this; mooring is
  the first seed to need it).
- **Evidence, a new project resource kind (gap 5).** `evidence.json`:
  items with an `id`, an optional `name` and `kind`, no numeric content
  of their own — what a leaf goal's `ESR` or a leaf obstacle's
  `Probability` is based on. A leaf's new `Evidence` key (`nameList`)
  names them by id, written and read the same generic way `Category` and
  `Priority` already are (`vocabulary.ts`'s `CUSTOM_KEYS`). `declare
  evidence [ id ] name "…" kind "…" end` round-trips it through `.kaos`,
  the same shape as `declare expert`/`declare calibration`. Using
  `Evidence` is itself what opens a file in kaosexpert's mode (the same
  rule as a distribution or a per-expert estimate): it is a kaosexpert-only
  key, so a file that uses it needs that dialect even when nothing
  numeric is elicited.
- **A leaf goal's `ESR` is a `distribution` too.** The same `distribution`
  value type RE'15's `Probability` already uses, with `point: true` (a
  plain value, kaosprop's degenerate case), no `keyed` (HASE'11 elicits no
  per-expert estimate of a goal). kaosexpert's `obstructed()` reads a
  distribution `ESR` by its complement, `1 − ESR`: `numeric/
  distributions.ts`'s new `complementOf` mirrors any `Continuous` (`min:
  1 − max, max: 1 − min, quantile: u => 1 − quantile(1 − u)`), so the
  Monte Carlo draws it exactly like any other distribution event — no
  closed-form transform of the distribution's own parameters is needed.
  `.kaos`'s `esr`/`eps` reads a goal's distribution the same way an
  obstacle's `probability` already does (`read.ts`'s `estimateOf`,
  generalised to take the target key, `ESR` or `Probability`).
- **α and β: do they fold into kaosprop's existing hub `Probability`
  slot?** (#189's question, #199's acceptance criterion.) Figure 4's
  rules, against kaosprop's propagation (`kaosprop/propagation.ts`,
  `hubProbability` and `obstacle`):
  - **Goals, complete AND:** `P(G) = Π P(Gᵢ)`, kaosprop's "any other
    tactic" rule, unchanged.
  - **Goals, partial AND (b):** `P(G) = (1 − α) · Π P(Gᵢ)`. kaosprop's
    goal refinement hub gains the same `Probability` slot the obstacle
    refinement hub already has (`P(O | SO1..n)`, RE'12's own conditional):
    set to `1 − α`, it multiplies the exact product the rule needs — the
    same mathematical form, just not previously declared on a goal hub.
    **α folds in exactly, no new key, on both of the hub's tactics**: the
    "any other tactic" product and the case-driven sum (`Σ caseᵢ · P(Gᵢ)`)
    are each multiplied by it (rv199 caught the case-driven branch
    computing the sum and never reading the slot — fixed in both engines,
    with a counter-model pinned as a test in each: a case-driven hub,
    legs at cases 0.6/0.4 and P 1 each, hub Probability 0.5, expects 0.5,
    not the undamped 1). (β = 0 for goals always, per the paper; the goal
    hub's rule has no OR term for it to replace, so this is consistent,
    not a gap.)
  - **Obstacles, complete OR:** `P(O) = 1 − Π(1 − P(Oᵢ))`, kaosprop's
    `any` across an obstacle's several refinement hubs, unchanged.
  - **Obstacles, partial OR (d):** `P(O) = 1 − (1 − β) · Π(1 − P(Oᵢ))`.
    This multiplies `Π(1 − P(Oᵢ))`, the product of *complements* across
    an obstacle's several refinement hubs — a different mathematical
    object than any one hub's own product (`Π P(SOᵢ)`, what the existing
    `Probability` slot multiplies), and a property of the *obstacle*
    (one β however many refinement hubs it has), not of any one hub.
    kaosprop's existing hub slot has no such product in its scope: **β
    does not fold in.** It is `Beta`, its own key on the obstacle
    (`kaosprop/definition.ts`), read only when the obstacle has more than
    one refinement (the only case a partial OR's risk is meaningful in);
    default 0, the complete-decomposition case, unchanged.

  Both rules are point-value propagation's (kaosprop), and the BDD's
  (kaosexpert, an extra independent event OR'd in for each): α as
  `event(1 − Probability)` inside the hub's own alternative, β as
  `event(Beta)` alongside the obstacle's refinement branches, both only
  when the corresponding slot is set — unset leaves every existing model
  byte-for-byte the same result (the defaults are the rules' complete
  cases). `kaosprop.test.ts` and `kaosexpert.test.ts` have both rules on
  small synthetic models, hand-derived, including the "one refinement
  only: β not read" and "α unset: the complete default" edge cases; this
  model sets neither (§III-A's explicit examples, GL3/GL5/GL8's α, are
  withheld).

### Step 4 part A: countermeasures as model transformations (goal-controller#191, #202)

Cailliau and van Lamsweerde, SEAMS'17 (*Runtime monitoring and resolution
of probabilistic obstacles to system goals*, DOI 10.1109/SEAMS.2017.5, the
authors' copy `SEAMS17.pdf`): a countermeasure is a resolution with a cost
and an effect on the model. Selection then picks the countermeasures that
keep the goals over their RDS at the least cost. Part A is the dialect,
the `.kaos` reader and writer, and what applying a countermeasure does to
the model. Part B (#200, #201) is the selection. Results and the attempts
log are on #353.

- **What the sources have** (verified 2026-10-20; logged on #353 and #189):
  - **ADS's `resolutions.kaos` has no `cost` and none of the four forms.**
    Neither does any other ADS file, at any commit. It has `resolvedby` only:
    13 preventions, 17 mitigations, 2 restorations and 1 weakening. ADS's
    optimiser (`Optimizer.cs`) and KAOSTools' optimisers
    (`NaiveCountermeasureSelectionOptimizer`, `cost = selection.Count()`)
    take a selection's cost to be the number of its countermeasures.
  - **KAOSTools read `cost [cost_variable] n` on a goal until be2aa0e**
    (2017-03-22), with `declare cost_variable`; no corpus file uses it.
  - **The four forms are goal attributes, about an obstacle,** added to
    KAOSTools in September 2017 (195b8d1, 554f728), after SEAMS'17:
    - `except [o] cg`, on the anchor;
    - `provided [o] f`, `providednot [o] f` and `relaxedTo [o] f`, on the
      goal itself;
    - `replaces [o] g`, on the replacing goal.

    No KAOSTools propagator reads `provided` or `relaxedTo`. Their
    definitions are Cailliau's thesis's (2017, ch. 5, "Obstacle resolution
    as exception handling"), quoted below. So `provided` is an extra
    conjunct on the goal's antecedent, a deidealisation, not "a new domain
    hypothesis" as #191's brief has it.
  - **KAOSTools' `las.kaos` has one resolution, with no pattern**
    (`resolvedby avoid_ambulance_not_in_familiar_area`).
    `resolvedby(prevention)` and `resolvedby(mitigation[…])` are ADS's.
- **The definitions, as the sources give them.** van Lamsweerde and Letier,
  TSE'00, §6 (the strategies):
  - goal substitution (§6.1.1): "identify an alternative goal refinement
    for some higher-level goal, in which the obstructed goal and
    obstructing obstacle are no longer present";
  - agent substitution (§6.1.2): "consider alternative agent assignments
    so that the obstacle scenario may no longer occur";
  - obstacle prevention (§6.1.3): "resolves the obstruction by adding a new
    goal requiring that the obstacle be avoided" (G*: ❑ ¬OC);
  - goal deidealization (§6.1.4): "transform the goal being obstructed in
    order to make the obstruction disappear";
  - domain transformation (§6.1.5): "transforming the domain … so as to
    make the obstruction disappear. The set of domain properties is
    modified so as to make the obstacle either inconsistent with the domain
    … or no longer obstructing the goal";
  - obstacle reduction (§6.2): "one tries to reduce the occurrences of the
    obstacle instead of eliminating them completely";
  - goal restoration (§6.3.1): "adding a new goal stating that if the
    obstacle condition OC becomes true then the obstructed goal assertion G
    should be satisfied again in some reasonably near future" (G*: OC ⇒
    ◊G);
  - obstacle mitigation (§6.3.2): "add a new goal to attenuate the effects
    of obstacle occurrences". Weak mitigation is "ensuring some weakened
    version G' of the obstructed goal G whenever the obstacle condition OC
    becomes true". Strong mitigation is "ensuring some parent goal G' of G
    whenever the obstacle condition OC becomes true, in spite of G being
    obstructed";
  - do-nothing (§6.3.3): "tolerate its occurrences without any resolution
    action".

  SEAMS'17, §II: "The integration either adds a new goal in the model or
  replaces the obstructed goal or an ancestor of it by another goal", and
  "The anchor for a countermeasure goal is the lowest ancestor goal meeting
  the ancestor-entailment condition". §VI.A: "the obstructed goal is removed
  from the goal model or kept. In the former case, the obstructed goal is
  replaced by the countermeasure goal; in the latter case, a new
  refinement is introduced involving both the obstructed goal and the
  countermeasure goal". When it is kept, "the anchor goal is refined into
  two subgoals; one subgoal is the obstructed goal conjoined with the
  negation of the obstacle condition; the other subgoal is the
  countermeasure goal. (To preserve the correctness of goal/obstacle
  refinements, the new conjunct is propagated down to leaf obstacles.)"
  §VI.B: "Countermeasures come with a cost. … only single costs are
  considered here. … The resolution cost of a selection is the sum of the
  costs associated with the selected countermeasures."

  The thesis, ch. 5, gives the two schemas and the tactics that use them.
  The schema that removes the obstructed goal "should be applied when the
  *Substitute goal* or *Weaken goal* tactic is used". The schema that keeps
  it applies to "*Avoid obstacle*, *Reduce obstacle likelihood*, or
  *Mitigate obstacle*". Its example of *agent substitution* uses the first
  schema. The four forms:
  - Except "links a countermeasure goal to its anchor goal" and is "fully
    equivalent to" the second schema's refinement;
  - Provided "specifies an extra conjunct on the antecedent of an original
    goal G" (C ∧ EC ⇒ ΘT), and ProvidedNot EC is Provided ¬EC;
  - RelaxedTo specifies "an extra disjunct on the consequent" (C ⇒ ΘT ∨
    ED);
  - Replaces is "useful for tracing previous versions of a goal".
- **D1 as built: the `kaosres` dialect** (the working name, kept). It is
  kaosprop's dialect with four keys on the resolution link from the
  countermeasure goal to the obstacle:
  - `Cost`, a number ≥ 0 (SEAMS'17's single cost);
  - `Form`: `provided`, `providedNot`, `except`, `relaxedTo` or `replaces`.
    `providedNot` is a fifth value, KAOSTools' `providednot`, kept for the
    round trip;
  - `Condition`, an `ltl` formula: provided's and providedNot's extra
    conjunct, relaxedTo's extra disjunct;
  - `Replaces`, a reference to a goal: what `replaces` names.

  `except`'s payload is the anchor, the `kaos` dialect's `Anchor`, so the
  form needs no key of its own. The plain `kaos` dialect and kaosprop's keep
  all four as unknown keys. kaosres has no engine yet: registering it in the
  workbench is part B's, with the selection. Until then a `.kaos` file opens
  in kaosprop's or kaosexpert's mode, as before.
- **`.kaos`: where each goes.** The grammar is unchanged: it already parses
  each form generically, the precedent of "Step 3 part A". The reader puts
  each annotation on the resolution link it is about:

  | `.kaos` (KAOSTools' syntax) | On the resolution | Of |
  | --- | --- | --- |
  | `except [o] cg` on goal `ag` | `Form` `except`, `Anchor` `ag` | cg → o |
  | `provided [o] f`, `providednot [o] f`, `relaxedTo [o] f` on goal `g` | `Form`, `Condition` `f` | g → o |
  | `replaces [o] h` on goal `g` | `Form` `replaces`, `Replaces` `h` | g → o |
  | `cost [o] n` on goal `g`; `cost n` | `Cost` `n`; on each of g's resolutions | g → o |

  - An annotation for which no `resolvedby` declares the resolution creates
    it, with an info.
  - A second form on the same resolution is kept as written, with a
    warning.
  - `cost [x] n` with x not an obstacle is KAOSTools' cost variable, one of
    the several costs SEAMS'17 leaves out. It is kept as written.
  - The writer writes `cost [o] n` and each form on the goal it belongs to,
    in KAOSTools' syntax. It says what it can't write: a form without its
    payload, a cost that is not a number.
  - The round trip is structural, as for the rest of `.kaos`.
- **D2 as built: one transformation per strategy, of the model in memory**
  (`engines/kaosres/transform.ts`). The input and output are the
  KAOS-kind-typed istar-ts model (`IstarModel<KaosElementKind,
  KaosLinkKind>`, the kinds of `KAOS_OBSTACLES`), which `GoalTree.goalModel`
  reads into the `KindModel`. The `KindModel`'s trees are derived from the
  model, so transforming the model and reading it again is the sound
  order:
  - the `kaos` dialect's Problems read the variant;
  - kaosdoc reads `kaosdocGoalModel(variant)`;
  - kaosprop reads `kaosresView(variant)`.

  The file is untouched. A countermeasure's `Form` says what it does when
  set, its `ResolutionType` otherwise:

  | Strategy or form | KAOSTools | Integration | What the model becomes |
  | --- | --- | --- | --- |
  | goal substitution | `substitution` | substitute | the anchor's one refinement loses the sub-goals the obstacle obstructs (directly or below them) and gains CG |
  | agent substitution | — | substitute | the same (the thesis's example); no agent is reassigned: the model has the resolving goal, not the agent |
  | goal deidealization | `weakening` | substitute | the same; with the anchor the obstructed leaf itself, CG (its weakened version) takes its place in its parents ("AG' replaces AG"; KAOSTools refuses this case, ANCHOR_NO_REFINEMENT) |
  | obstacle prevention | `prevention` | anchor | the anchor refined into K ("… unless O": its own refinements and obstructions, O false below it) and CG |
  | obstacle reduction | `obstacle_reduction` | anchor | the same: KAOSTools resolves the obstacle; the reduced likelihood TSE'00 speaks of has no number to model |
  | goal restoration | `restoration` | anchor | the same |
  | obstacle mitigation, weak, strong | `mitigation`, `weak_mitigation`, `strong_mitigation` | anchor | the same; weak and strong differ only in where the anchor is (the goal, or a parent of it) |
  | domain transformation | — | eliminate | the obstacle cannot occur, anywhere: a leaf's estimate 0, a refined one's every refinement's P(O\|SO) 0, its expert estimates and `Beta` gone (kaosprop's own slots) |
  | do-nothing | — | record | nothing: the decision is the resolution |
  | `except` | `except` | anchor | as prevention, at its anchor |
  | `replaces` | `replaces` | replace | CG takes the replaced goal's place in every refinement it is in |
  | `provided`, `providedNot`, `relaxedTo` | the same | deidealize | the goal itself, O false below it, in place: O no longer obstructs it |

  Only do-nothing changes nothing. Domain transformation changes no
  structure, only the obstacle's probability. A resolution with neither a
  strategy nor a form isn't applied, and says why (KAOSTools: NO_PATTERN).
- **"O false below a goal" is a copy.** The sub-goals and obstacle trees O
  reaches are copied with O's branches cut:
  - an obstacle refinement with O, or with a sub-obstacle that can no
    longer occur, is an AND with a false member, so it goes;
  - an obstruction by O goes.

  An original that nothing uses any more is removed, and its copy takes its
  id and name back. So what only the anchor used changes in place. What
  something else also uses stays as it was, with its copy beside it, named
  "… unless O". O itself stays, a root of its own, with its resolutions.
- **Scope, the owner's call:** the default is SEAMS'17 §VI.A as written
  (`scope: 'anchor'`). There O is false below the anchor only, the conjunct
  "propagated down" from the obstructed goal. The thesis says the same:
  "Only siblings of the anchor goal and its ancestor may need to be
  de-idealized. The other goals were obstructed by the resolved obstacle
  and are therefore not concerned". §VI.A's next sentence can be read
  globally: it "reduces the formal specification of the obstacle … to
  false; The satisfaction rate of the latter is therefore 0". KAOSTools
  implements that reading: `ResolutionIntegrator` sets `obstacle.Resolved =
  true`, and its BDD then samples the obstacle at 0 everywhere. That reading
  is `scope: 'model'`, where K keeps the anchor's content as it was and O
  is eliminated. Part B picks the scope that reproduces Table I and says
  which.
- **Anchors.**
  - An `Anchor` resolves by id, then by a goal's name.
  - Without one, the keep schema anchors on the goal the obstacle's tree
    obstructs, and substitution anchors on that goal's parent. Since part
    B, a strong mitigation anchors on that goal's parent too (TSE'00
    §6.3.2's "some parent goal G' of G"), and is refused when the goal is a
    root or has several parents. The goal is
    found in the model as given, so a second countermeasure for the same
    obstacle finds the anchor the first one found. When it is not one goal,
    the countermeasure is refused: "set its Anchor".
  - A keep schema whose obstacle obstructs nothing below the anchor is
    applied with a warning: CG is added, and nothing is resolved.
- **Countermeasures apply one after another**, in the model's order, each
  to the model the previous ones gave. Two on one anchor nest:
  - the anchor is refined into K₂ and CG₂;
  - K₂ is refined into K₁ and CG₁.

  This is KAOSTools' `AddExceptions` loop.
- **FormalSpec is not rewritten.** K's is empty and its Description says
  what it is. Deriving "C ∧ ¬OC ⇒ ΘT" needs the antecedent of a formula,
  which nothing checks yet (the deferred "FormalSpec → LTL").
- **Oracles (#202: no numbers).**
  - **Unit:** one test per strategy and form, on a hand-written model
    (`lib/test/engines/kaosres/transform.test.ts`). The obstacle is at 1,
    so the root fails for sure until the countermeasure is applied; each
    test then checks the propagated values against a hand derivation.
  - **ADS's three files read together** (`lib/test/dialect/kaosres.test.ts`):
    - all 33 resolutions apply, each alone. Where each is integrated, the
      obstacle obstructed before, no longer does (`obstructs`), and that
      goal's EPS is the same with the obstacle alone at 1 and at 0;
    - all at once, they add no Problem the model didn't have.
  - **KAOSTools' LAS:** its one resolution has no strategy, so it is not
    applied, and the test says so. Typed as a prevention (its goal is
    `Avoid [Ambulance Not In Familiar Area]`), it passes the same checks
    with no Problem.
  - **The Respect-IT tutorial's Elevator:** no seed exists (#195's), so it
    is a test fixture (`lib/test/engines/kaosres/fixtures/elevator.kaos`),
    re-keyed by hand from Figures 33–35 (© Respect-IT, no licence stated).
    Only the figures' labels are taken, no text. The five resolutions take
    their strategies from §3.6's words: two preventions (Fig. 34), and a
    mitigation, a restoration and a prevention (Fig. 35). All five apply,
    with no Problem; only the unresolved "Insufficient display contrast"
    still obstructs; kaosdoc's Obstacles section prints each resolution.
- **What part B can rely on** (`@goal-controller/lib`, `engines/kaosres`):
  - `countermeasuresOf(model)`: every resolution link, typed: `strategy`,
    `form`, `anchor`, `replaces`, `condition`, and `cost` (a number or null).
  - `applyCountermeasures(model, ids, { scope })`: the variant, which
    countermeasures were applied and how (`integration`, `at`, `added`,
    `summary`), problems (an error means not applied), and `cost`, the sum
    of the applied `Cost`s with unset as 0.
  - `kaosresView(variant.model)`: what `propagateProbabilities` reads.
  - `applyCountermeasuresToView(view, ids, options)`: the same on an
    analysis's `AnalysisModel`, whose kinds are narrowed to KAOS's (an
    error for any other kind), with the variant's view.
  - `obstructs(model, goal, obstacle)`.
  - `integrationOf`, `STRATEGY_INTEGRATIONS` and `FORM_INTEGRATIONS`.

  Each call is pure and costs a copy of the model per variant, so
  enumerating 2ⁿ selections is B's to bound.
- **D3 unchanged.** Runtime monitoring and activation, SEAMS'17 §IV–V and
  §VII, are out of scope. That is the KAOS version of the SA-BSN loop
  (Vein 6's runtime with GODA formulas, #93, #97).

### Step 4 part B: countermeasure selection (goal-controller#191, #200, #201)

SEAMS'17 §VI.B–C's selection, over part A's transformations: the `kaosres`
engine, the flood seed, ADS's files. Results and the attempts log are on
#353; changes to D1–D4 on #189.

- **The definitions, as SEAMS'17 gives them** (§VI.B–C, p. 6–7; D4):
  - "A *safe* selection of countermeasures is a set of countermeasures
    that, once integrated, guarantees that the monitored satisfaction rate
    of the high-level goals is greater than their respective RDS."
  - "A selection of countermeasures must be *consistent*; conflicting
    countermeasures shall not be selected together: {CMi, CMj, Dom} ⊭
    false for i≠j."
  - "The resolution cost of a selection is the sum of the costs associated
    with the selected countermeasures."
  - "A selection is *cost-optimal* if no other selection increases the
    probability of satisfaction of the high-level goal without increasing
    the resolution cost."
  - "The selection of most appropriate countermeasures is defined as the
    one having the lowest resolution cost such that the satisfaction rate
    for the high-level goals is maximized while being safe, consistent, and
    cost-optimal."
  - §VI.C: the selection "amounts to solving two optimization problems,
    namely, finding the minimal cost for guaranteeing the RDS of the
    high-level goals; finding the selection that maximizes the
    satisfaction rate of the high-level goals given this cost". Both by
    the "naive approach … O(2ⁿ) where n is the number of countermeasures".
  - §V: "Multiple ones are handled by use of a weighted sum combining goal
    satisfaction rates, where the weights capture goal priorities."
  - The thesis, ch. 7: "If no selection guarantees the goal's required
    satisfaction rate, the selection that maximizes the satisfaction rate
    of the high-level goals is picked."
- **Decisions, implementing those as written** (`engines/kaosres/selection.ts`):
  - **A countermeasure is a countermeasure goal**, with every resolution
    link it is the source of. Table I selects goals, and its costs count
    Achieve [LocalsWarnedBy…Email…], which resolves two obstacles, once.
    KAOSTools' optimiser does the same (`ResolvingGoalIdentifier`).
  - **Cost:** a countermeasure's `Cost` when the model sets any (the
    largest of its links': one goal is deployed once), unset 0; when the
    model sets none, 1 each, so a selection costs the number of its
    countermeasures, as ADS's and KAOSTools' optimisers take it and as
    Table I's costs are (below).
  - **The high-level goals are the goals with an RSR.** Safe: each one's
    ESR is greater than its RSR (strictly, "greater than"). With none, the
    roots (no countermeasure goal) are maximised and nothing is required.
    With several, their ESRs' mean is maximised: §V's weighted sum with
    equal weights, since the `kaos` dialect's `Priority` is free text.
  - **Consistent, on our IR: a Conflict link is KAOS's conflict,
    `{G1, G2, Dom} ⊨ false`.** A selection is inconsistent when a Conflict
    joins two of its goals (the paper's pairs), or one of its goals and a
    goal its variant still has in use (reachable from the model's roots or
    from the selection). The second half reads `Dom` as what the
    integrated model keeps. It is what the flood files need: their
    conflicts pair a countermeasure with an original goal (Camera with
    UltrasoundSpeedAccurate). Table I's fifth column agrees: it selects
    Camera together with CameraSpeedAccurate. A conflict among more than
    two goals is no link (below).
  - **Cost-optimal is among the consistent selections**, those the
    definition can compare.
  - **The chosen selection** is §VI.C's two problems in order: the minimal
    cost of a safe and consistent selection, then the largest satisfaction
    at that cost. Ties are all chosen; the first, in the model's order,
    is drawn. When none is safe, the most satisfying consistent one at
    the lowest cost, labelled "Best, none safe".
  - **The search is §VI.C's naive one, bounded.** Selections are evaluated
    in the order of their cost (a heap over the countermeasures sorted by
    cost: every subset once, in non-decreasing cost), the empty one first,
    at most `limit` of them (an engine option, default 4096 = 2¹²).
    - With 2ⁿ within the limit, every selection is evaluated: the safe,
      consistent and cost-optimal ones are complete.
    - Past it, the search stops once the cost level of the first safe
      selection is complete. The chosen one is then exact (§VI.C's two
      problems need nothing costlier), and the result says so.
    - At the limit before that, the result says the chosen one is the best
      of those evaluated, not §VI.C's.
  - **KAOSTools' rules, as an option** (`semantics: 'kaostools'`, the
    owner's call): its `NaiveCountermeasureSelectionOptimizer` at 05a5125
    differs from the paper three ways, all reproduced:
    - no consistency check: conflicts are not read;
    - only non-empty selections are candidates, the empty one counting
      only for the minimal cost (`GetMinimalCost` returns 0 when the model
      as it is meets the RDS);
    - with the minimal cost 0 or none safe, the most satisfying over every
      non-empty selection, every tie kept (`GetOptimalSelections` filters
      by cost only when the minimal cost is positive).

    With a positive minimal cost, `GetOptimalSelections` pools every
    selection costing no more than it, safe or not, and keeps the most
    satisfying. For KAOSTools' one root goal (`--root`) a cheaper selection
    is unsafe, its rate at most the RSR, so it never wins. With several
    high-level goals (their mean, which KAOSTools has no notion of) an
    unsafe one could: kaosres pools only the safe ones (#367's review,
    rv367; its counter-model is a test under both rules). The chosen case
    is labelled "Best, none safe" only when no selection is safe.
  - **Scope stays `anchor`**: Table I can't decide it (below). On the flood
    files every countermeasure is a substitution, which the scope doesn't
    touch; `model` is an engine option.
- **Part A, amended.**
  - **Strong mitigation's default anchor** (#355's review): with no Anchor,
    a strong mitigation anchors on the obstructed goal's parent, TSE'00
    §6.3.2's "some parent goal G' of G". It is refused, "set its Anchor",
    when the goal is a root or has several parents. Before, it anchored on
    the goal itself, as a weak mitigation does.
  - **A goal that substitutes for two obstacles** (the flood's Email, for
    Voice Network Overloaded and GSM Network Down): its second resolution
    finds itself already in the anchor's refinement, and is applied as
    such, with nothing left to do. It used to be refused ("obstructs no
    sub-goal").
- **`.kaos`.**
  - **`declare constraint [ c ] conflict a, b end`** (KAOSTools' older
    syntax, the flood model's) is read as a Conflict link between the two
    goals, and written back so. A constraint's name has no place on a
    link (an info says so). A conflict among three or more goals means
    `{a, b, c, Dom} ⊨ false`, which no pair of links says: it is kept as
    written, with a warning. Any other constraint is kept as before.
  - **A file with resolutions opens in kaosres's mode** (kaosres has
    kaosprop's two analyses and the selection); one with experts still in
    kaosexpert's. KAOSTools' `las.kaos` (one resolution) now opens in
    kaosres's mode: its seed's project says so.
- **The engine.** `kaosres` is registered under KAOS beside kaosprop and
  kaosexpert. Its analyses: *Countermeasure selection*, then kaosprop's
  *Obstacle and goal probabilities* and *Critical obstacle combinations*
  on the same view (the model's properties as written: the resolution
  keys reach the selection). The selection's cases:
  - one per selection evaluated, at most 256: the chosen first, then the
    safe and cost-optimal ones, the other safe ones, the other
    cost-optimal ones, the rest;
  - each case's values are its variant's EPS and probabilities on the
    model's elements. Its selection is what the variant keeps in use: the
    goals the roots and the countermeasures reach, the obstacle trees
    below them, their agents, the resolutions selected. The canvas dims
    the rest (the goals substituted, the countermeasures not selected);
  - its summary: the cost, each high-level goal's ESR against its RSR,
    safe, consistent (or the conflicts it breaks), cost-optimal, and any
    resolution not applied. The first case's says how far the search went.

  Options: `scope` (anchor, model), `semantics` (seams17, kaostools),
  `limit`.
- **The flood model, found (#200).** SEAMS'17's Table I is not ADS's: its
  goals are the paper's running example, a flood detection system. Two
  versions of that model are published:
  - **`ancailliau/FloodingSimulator`** (MIT, © 2016 Antoine Cailliau),
    `FloodingSimulator/Model.kaos` at ef6db9f (2016-08-24), deleted in
    3744438: the goals, obstacles and `resolvedby (substitution[…])`, and
    three `declare constraint … conflict`. No probability.
  - **`ancailliau/phd-thesis`** (no licence; used with the owner's
    approval), `running-example-fds/model2.kaos` at 6a9f5fd (2017-09-22),
    the thesis's ch. 7 running example: the same model in the bracket
    syntax, with leaf `probability`s (Dusty Environment .1, False Echo .08,
    Radar Sensor Broken .2, Ultrasound Sensor Broken .4, Noisy Image .05,
    Voice Network Overloaded .15; Distortion and GSM Network Down none),
    the root's `rsr .65`, and the conflicts commented out.

  The seed `examples/kaos/flood` is model2.kaos as written, with
  FloodingSimulator's three constraints (the owner's call, option (a)).
  Nothing is added: the Email goal's blank name stays blank,
  SpeedAcquiredEvery10SecondsByUltrasound stays a goal that resolves
  nothing, and the emergency countermeasure stays commented out.
- **Table I is not reproducible** (#200's oracle):

  | Table I column | 1 | 2 | 3 | 4 | 5 |
  | --- | --- | --- | --- | --- | --- |
  | selection | — | SMS, Ultrasound 10 s | Email, Ultrasound 10 s | Email, Emergency | Email, Camera, Emergency, CameraSpeedAccurate |
  | ESR printed | .52 | .68 | .72 | .81 | .77 |
  | cost printed | 0 | 2 | 2 | 2 | 4 |

  - Its leaf rates were monitored at runtime at an unstated moment, and
    are printed nowhere. With the thesis's estimates the root is .8 × .6 ×
    .85 = .408, not .523; the paper's RDS is 80 %, the files' .65.
  - Two of its six countermeasures resolve nothing in either file:
    LocalsWarnedWhenRiskImminentAndEmergencySituation's obstacle
    (`LowAcquisitionRateInEmergency`, `eps .1`) is commented out, and
    SpeedAcquiredEvery10SecondsByUltrasound has no `resolvedby`.
  - Its figures fit no one set of leaf rates under the files' structure
    (the root an AND of four leaf goals):
    - column 4 (Email + Emergency) = .81 gives (1−a)(1−b) = .81, a and b
      the radar's and the ultrasound's obstacles;
    - §VI.A's "SMS at 1 → 61.6 %" then gives (1−e) = .616 / .81 = .76;
    - §VI.A's "Emergency: 52.3 → 65.4 %" gives (1−e) = .523 / .654 = .80,
      and predicts .81 × .523 / .616 = .688, not .654.
  - Two things Table I does fix: **cost is the number of countermeasure
    goals** (columns 2–4 cost 2 with two goals each, Email's two
    resolutions counting once), and **the sixth row (CameraSpeedAccurate),
    lost in the OCR, is 0 0 0 0 1**, the only way column 5 costs 4.

  What the seed gives instead, its oracle (`flood.expected.csv`, every
  number derived by hand, "no published oracle"):

  | Selection | Cost | ESR | Flags |
  | --- | --- | --- | --- |
  | none | 0 | .408 | consistent, cost-optimal |
  | Camera | 1 | .646 | inconsistent (cst11: UltrasoundSpeedAccurate still in use) |
  | SMS, or Email | 1 | .48 | consistent, cost-optimal |
  | Camera + CameraSpeedAccurate | 2 | .646 | consistent, cost-optimal |
  | Camera + SMS, or + Email | 2 | .76 | safe, inconsistent (cst11) |
  | **Camera + CameraSpeedAccurate + SMS**, or + Email | 3 | .76 | **safe, consistent, cost-optimal: chosen** |

  The minimal cost is 3, all 16 selections evaluated. GSM Network Down has
  no estimate, so SMS and Email tie.
- **KAOSTools as second oracle.** CMSelector at 05a5125 built with `mcs`
  under Mono 6.12 in Docker (amd64), in /tmp, nothing committed.
  - **Flood** (the thesis's model2.kaos): "Satisfaction Rate without
    countermeasures: 0.408", "Minimal cost to guarantee RSR: 2", optimal
    {Camera, SMS} and {Camera, Email} at 0.76, 6 safe of 15. kaosres
    under `semantics: 'kaostools'` gives exactly these (the CSV's rows);
    under SEAMS'17's rules the minimal cost is 3, because Camera alone
    breaks cst11.
  - **ADS:** 05a5125 can't parse ADS's files (anonymous nested obstacles;
    #343's finding). ADS's three files written by our writer, with each
    leaf at its experts' combined mean and 10 of the countermeasure goals
    (the leaf weakening left out: KAOSTools refuses it,
    ANCHOR_NO_REFINEMENT), and the anchors our default gives
    (05a5125 requires one on every `resolvedby`, #366). Both find no
    selection safe. KAOSTools' root is 0.403 % unresolved and 1.388 % at
    best; ours 0.117 % and 1.386 %. The difference is the propagation, not
    the selection: kaosexpert's BDD with the same point estimates gives
    KAOSTools' 0.0040271564838259 exactly. kaosprop's RE'12 rules treat
    a leaf obstacle shared by several trees as independent on each path;
    the BDD counts it once (#365).
- **#201: neither `simple.kaos` nor `validation-model.kaos` is Table I's
  file**: Table I is the flood example's. Both propagate under kaosprop
  and select under kaosres (`scripts/kaos-stress/ads.expected.csv`):

  | File | Goals, obstacles | Countermeasures | Selections | Chosen |
  | --- | --- | --- | --- | --- |
  | `simple.kaos` | 19, 183 | 3 (3 more commented out) | 8, all evaluated | none: no leaf has an estimate, every goal is at 100 %, over every RSR (0, .8) |
  | `validation-model.kaos` | 44, 15 | 0 | 1 | none: no RSR |

  Neither file has a point estimate, so neither result says anything about
  the system.
- **Where the search stops scaling.** Its size is 2ⁿ in the number of
  countermeasure goals, not of obstacles: simple.kaos's 183 obstacles are
  3 countermeasures, 8 selections, 40 ms. One evaluation (a copy of the
  model, the integration, the propagation) takes about 5 ms on ADS's
  155-element model (node, host). So 4096 selections take about 20 s.
  ADS's 29 countermeasure goals (2²⁹ selections) would take about 85
  years, and so would KAOSTools' naive optimiser: under Mono it evaluated
  ADS's 10-countermeasure cut's 1023 selections in 4.5 s. Past the limit
  only the cost order makes the answer exact, and only when a safe
  selection is cheap.
- **ADS's field run** (resolutions.kaos's 33 resolutions, 29 countermeasure
  goals, with the ambulance model). It is in the corpus CSV, not in the
  ambulance seed's: that seed is RE'15's model, without resolutions.kaos
  (RE'15: no countermeasure), and opens in kaosexpert's mode.
  - As the files are, every leaf is 0 (their estimates are per expert,
    which kaosprop doesn't read): 100 %, the empty selection is safe.
  - With each leaf at its experts' combined mean (kaosexpert over the
    ambulance seed's five experts), the root is 0.117 %. The 4096
    cheapest selections (every one of cost 3 or less) find none safe; the
    best is the weakening of Achieve [Mobilized Ambulance Intervention]
    with Obesity Ambulance When Required and Assign Destination Hospital,
    2.78 %. All 29 together give 9.24 %, far under 95 %, as RE'15's VU
    100 % says.
- **D3 unchanged**: no runtime monitoring or activation.

### Step 5: the CAIRIS corpus (goal-controller#192, #203, #204, #205)

CAIRIS (S. Faily, *Designing Usable and Secure Software with IRIS and
CAIRIS*, Springer 2018; `cairis-platform/cairis` at `44cc57d`, Apache 2.0)
stores KAOS goal and obstacle models in XML (`<cairis_model>`, DTD
`-//CAIRIS//DTD MODEL 1.0//EN`). It enforces enumerations, and a goal's or
an obstacle's definition, category and priority are per environment. Its
three exemplars are lib's fixtures (`test/importers/fixtures/cairis`, with
CAIRIS's LICENSE) and eight seeds. Results and the attempts log are on #368;
D-decisions on #189.

- **The importer** (`importers/cairis`): `readCairis(text)` returns one KAOS
  model per environment (D2), `<model>-<environment>`. The environment and
  the project's name are on the diagram (`cairisEnvironment`,
  `cairisProject`, typed as `CairisDiagramProperties`). The models are in
  kaosprop's mode, with obstacle probabilities as `Probability`.

  | CAIRIS | Model |
  | --- | --- |
  | `goal` with a `goal_environment` for E | `kaos.BehavioralGoal` with E's `definition` (`Description`), `category` (`Type`: the goal's pattern, Achieve … React), `priority` (`Priority`), `fit_criterion`, `issue`, concerns (`Concern`); `originator` its `Source` |
  | `obstacle` with an `obstacle_environment` for E | `kaos.Obstacle` with E's `definition`, `category` (`Category`), `probability` (`Probability`, kaosprop's) and its `rationale` (`Rationale`) |
  | `requirement` | a `kaos.BehavioralGoal` leaf (D3); `type`, `priority`, `label`, `reference`, `reference_type`, `rationale` as text keys (`RequirementType`, `RequirementPriority`, …) |
  | `domainproperty`, `role` | `kaos.DomainProperty` (`Kind` its type), `kaos.Agent` (`RoleType`, `ShortCode`) |
  | `and` | one refinement of the goal (or obstacle) by all its `and` children, in E |
  | `or` | one refinement per child: alternatives |
  | `obstruct`, `resolve`, `responsible`, `conflict` | an obstruction, a resolution (untyped: CAIRIS has no strategy), a responsibility assignment, a conflict |
  | `manual_association` requirement → role | a responsibility assignment, wherever both are |
  | a use case step's `exception` against a goal | the obstacle CAIRIS makes of it on import (`addUseCaseStepException`), obstructing that goal, with no probability (CAIRIS's default 0.0 isn't written) |

  - A link's `rationale` is its `Rationale`, and `alternative_id = 1` is a
    leg's `Alternative = Yes`. CAIRIS's propagation doesn't read
    `alternative_id`.
  - Every `ref_type` is mapped or reported. An association whose end is no
    KAOS element (a task, a use case, a vulnerability, a threat), or whose
    end the file doesn't declare, is kept as written in the diagram's
    `cairisUnsupported`, with a warning. So are a role dependency and a
    manual association to a response. Balkan Rail has one such association:
    its subgoal name is cut at 50 characters ("…information confident").
  - What else the file has (assets, threats, vulnerabilities, risks,
    personas, use cases, countermeasures, data flows) is counted in an info
    diagnostic. Nothing is dropped silently.
- **Where the project's elements go.** Requirements, domain properties and
  roles have no environment in CAIRIS. Each is in the environments whose
  associations name it (a requirement also where its asset, by its
  `security_property`s, or its environment is). An element nothing
  situates is in every environment, and the import says which.
- **D1, the vocabulary: the `cairis` profile** (`dialects/kaos/profiles.ts`).
  Read verbatim against the `kaos` dialect, the seeds drown in Problems:
  - every goal's `Priority` (`High`, not `high`);
  - every obstacle's `Category` (`Vulnerability`, `Confidentiality_Threat`:
    TSE'00 has five, CAIRIS sixteen);
  - every domain property's `Kind` (`Hypothesis`);
  - the security patterns' `Type` (`Prevent`, `Detect`).

  In ACME Water/Day that is all 78 goals and all 21 obstacles; NeuroGrid's
  seeds and Balkan Rail/Model are the same. Only Balkan Rail's two
  requirement-only seeds have none. So, as D1 of #192 allows, a **vocabulary profile** gives
  the same keys a second logged source: goals.dtd's enumerations, Type
  (14), Priority (3), obstacle Category (16) and Kind (2). It also declares
  the text keys the importer writes beyond `kaos`'s. A model records its
  profile (`diagram.customProperties.vocabulary = cairis`), and the
  importer writes it. Every KAOS mode reads such a model with it
  (`dialectForModel`): the workbench's Problems, conformity, the Notation
  view and the inspector. A value outside goals.dtd is still a Problem, and
  a model without a profile reads exactly as before. The seeds' Problems
  with the profile are only the source's five obstructions of refined
  goals (ACME Water/Day 1, NeuroGrid Psychosis and Stroke 2 each), a
  warning as KAOSTools' are. `kaos`'s own vocabularies are unchanged.
- **D3, as implemented:** CAIRIS's requirement `type` and `priority` are
  `RequirementType` and `RequirementPriority`, not `Type` and `Priority`.
  Those keys are a goal's pattern and priority, with their own
  vocabularies, so a requirement's `Functional` or `1` would be a Problem
  under either source.
- **D4:** there is no CAIRIS writer. A seed is its model's JSON, byte for
  byte as the importer writes it, and istar-ts writes it back the same.
- **The seeds** (`examples/kaos/cairis-<exemplar>-<environment>`, made by
  `scripts/kaos-stress/cairis-seeds.cjs`, pinned by lib's tests and
  `stress:kaos`):
  - NeuroGrid: psychosis, stroke, core-technology;
  - ACME Water: day, night;
  - Balkan Rail: model, balkan-rail-corprate-hq, central-station.

  Balkan Rail's goals are all in environment Model. Its other two
  environments hold only requirements, situated by their assets.
- **The oracle, reframed.** NeuroGrid and Balkan Rail give no obstacle a
  probability, so CAIRIS's propagation over them is all 0: no oracle, and
  their seeds' READMEs say so. ACME Water's environment Day does give one
  to its 20 obstacles (10 of them non-zero, each with a rationale; the
  scout had it as none). It is the field cross-check.
  - `cairis-oracle.csv` holds CAIRIS's own `obstacleProbability`, run in
    Docker by `scripts/kaos-stress/cairis-oracle.sh` (mysql:8.0 and
    CAIRIS's image, pinned by digest).
  - `cairisObstacleProbabilities` restates CAIRIS's rule and gives each of
    the 43 numbers exactly. The rule is AND × and OR +, summed, raised to
    the obstacle's own probability, and **the AND product starts from 0**
    (`andProb float default 0`, never set to 1).
  - Against kaosprop's RE'12 rules, each row is `agree` or attributed:
    - **synthetic** (`synthetic.xml`, ours, tests only): an AND gives 0 (or
      the obstacle's own 0.1) where RE'12 gives 0.2; an OR gives 0.9 where
      RE'12 gives 0.7, and **1.3** (above 1, no clamp) where it gives 0.88;
      AND and OR on one obstacle give 0.3 where RE'12 gives 0.44; nested
      ORs give 0.4 → 0.6 where RE'12 gives 0.37 → 0.496.
    - **ACME Water/Day**: 18 of 21 agree. Surplus equipment is 0 vs 0.48
      (the AND). Unscanned media is 0.9 vs 0.82, and Undetected malicious
      traffic 0.5 vs 0.46 (the OR). No sum exceeds 1 there.
  - CAIRIS's AND defect is reported to the owner, not to CAIRIS's tracker.
- **#205: one model per environment, for good** (logged on #189).
  - The test (`cairis.test.ts`) shows that the union of a file's
    environment models loses nothing: every goal's and obstacle's
    per-environment values, every requirement, domain property and role,
    and every association, as a link or kept as written.
  - Per-context values on one model would serve almost nothing in the
    corpus. Of NeuroGrid's 22 goals, all in two environments, 2 differ in
    a value (a priority, an issue, a definition). None of its 10 shared
    obstacles differs. ACME Water and Balkan Rail share no goal between
    environments.
  - What differs is structure: which elements and refinements an
    environment has (20 of NeuroGrid's 77 associations are in one
    environment only). A model per environment states that directly.
  - `cgm`'s contexts are on links: a refinement holds or not in a context,
    and variants are enumerated per context (#152). They would cover the
    refinements but not the per-context values. They would also need every
    KAOS engine to enumerate per environment, which no engine asks for.
  - Hub contexts are not built. Revisit when a model shares most of its
    elements across environments with diverging values, or when an
    analysis across environments is asked.
- **In the workbench.** The Open dialog takes `.xml`, and a file is
  CAIRIS's by its content (the DOCTYPE or `<cairis_model>`), whatever its
  name. Opening one makes the project of its environments' models, in
  kaosprop's mode, and the first one opens. A CAIRIS file isn't a model to
  add to a project. The seeds are on Home under KAOS, citing the book and
  the repository at its commit.
- **No `.kaos` for a CAIRIS model.** Every model of a kaosprop project would
  get a `.kaos` slot, and a missing one is written from the model.
  KAOSTools' syntax can't carry CAIRIS's keys, so the writer would report
  hundreds of them. It isn't the source either: there is no CAIRIS writer
  (D4). So a model entry may opt out of a native format: `"native": {
  "kaos": null }` in project.json means no slot, and none is looked for or
  written (`ModelEntry.native`, `nativeSlots`). A CAIRIS project's models
  and the seeds opt out of their mode's native files.

### Step 6: quantitative goals, simulation and design-space search (goal-controller#193, #206, #207, #208)

Letier and van Lamsweerde's partial goal satisfaction (FSE'04) simulated as
Heaven and Letier simulate it (RE'11): the `kaossim` engine. Results and the
attempts log are on #369. D1's encoding is logged on #189 ("#193 D1").

- **D1: its own dialect, over kaosprop's** (`engines/kaossim/definition.ts`).
  Every key is keyed by a name the model writes, `Key[name]` on disk, the
  form kaosexpert's `Probability[e1]` already has. It needs one generic
  schema change: `keyed: { names: 'written' }`, keyed by any name, with no
  resource listing the names. The inspector has no field per such name
  yet; the keys stay native-file and Notation lines.
  - On a goal:
    - `QualityVariable[v]`: its sort, `Time` (seconds), `Boolean` or
      `Number`. FSE'04 §3.1 gives a variable a name, a sort and a
      definition. RE'11's `Incident → Time` is sample space `Incident`,
      sort `Time`;
    - `SampleSpace[v]` and `QualityDefinition[v]`, both text;
    - `Distribution[v]`: a leaf variable's estimate in every design;
    - an objective function: `Objective[o]` (an assertion; the objective is
      its probability) or `Mean[o]` (an expression; its expectation), with
      `Modal[o]` (Max, Min), `Target[o]` / `Current[o]` (probabilities) and
      `ObjectiveSpec[o]`, its PCTL definition (a `formula` tagged `pctl`,
      §3.3, which nothing checks yet). A mean objective has no target this
      round, because `number` reads no `%` or exponent.
  - On a refinement's hub:
    - `Equation[v]`: an expression over variables, with `if(c, a, b)`,
      `min` and `max`. A Boolean is 0 or 1;
    - `BooleanEquation[v]`: an assertion over variables;
    - `Distribution[v]`: FSE'04 §4.1's equation "in terms of probability
      distribution functions".

    The equations are on the refinement, not the variable, because "in case
    of alternative goal refinements different refinement equations must be
    defined for each alternative" (FSE'04 §4.1). They are read by the goal
    language's expression and assertion readers (#120); there is no second
    parser.
  - On a responsibility assignment: `SysRef` and `Distribution[v]`, the
    responsible agent's estimate.
- **D2: options and designs.** A goal with several refinements, or several
  responsibility assignments, is a decision point. Its options are their
  `SysRef`s (RE'11 §II: "Options correspond to the system reference
  attribute attached to goal refinements, responsibility assignments"). A
  design is a project resource (`designs.json`, kind `design`). It picks one
  option per decision point it reaches, which is #152's selection shape, and
  it may `set` leaf estimates (FSE'04 §5.1's what-if). With no designs
  listed, the simulation runs every design, at most 256.
- **D3: shared back-end.**
  - The shared `distribution` type gains `exponential[mean]` and
    `normal[μ, σ]`, over the reals only. `exponential` takes its **mean**:
    RE'11's `Exp(60)` is "mean varies from 60 seconds to 30 seconds", as
    Matlab's `exprnd(mu)` takes it.
  - `numeric/special` gains Φ (through the incomplete gamma, from Q's side
    in the lower tail) and Φ⁻¹ (Acklam's approximation with one Halley
    step).
  - `distributionOfSamples` moved from kaosexpert to `numeric/samples`;
    kaosexpert re-exports it.
- **The simulation** (`simulation.ts`) is RE'11 §III.A's procedure:
  - a design keeps one alternative per decision point, from the roots
    down;
  - each variable has one definition in the design. With none it is
    **unresolved**, and so is every objective depending on it: no number,
    and the leaves it lacks are listed;
  - N samples, each leaf drawn independently (FSE'04 §4.3's assumption)
    and once per sample (§III.A's Gsim);
  - equations are evaluated element-wise;
  - objectives use the frequentist reading, with their standard error.

  A Boolean leaf's estimate is its probability of being true: a value, or
  a distribution of it (a draw, then a Bernoulli draw). Draws are seeded per
  variable, from its name and the run's seed. Designs therefore share a
  leaf's draws (common random numbers), and Pareto comparisons are not
  noise.
- **The search, D5** (`search.ts`): a design dominates another when it is
  at least as good on every objective and better on one; a Min objective
  counts negated (RE'11 §IV.A). There are two methods:
  - **every design**, the oracle: an odometer over the decision points, at
    most `limit` designs. Step 4's cost-ordered heap doesn't apply, because
    designs carry no cost order;
  - **NSGA-II** (Deb et al. 2002), seeded. A chromosome is one gene per
    decision point (RE'11 §IV.C: crossovers between decision points, so
    every child is a valid design). It uses binary tournaments on rank and
    crowding, uniform crossover, a mutation of 1/M per gene, and one copy
    per design in P ∪ Q. The result is the last population's first front.
    On a synthetic 4 × 3 × 3 × 3 × 6 = 648-design space (RE'11's shape),
    it reaches the exhaustive front at population 40 and 60 generations
    (`test/engines/kaossim/kaossim.test.ts`).
- **`.kaos`.** KAOSTools has no quantitative syntax, so these attributes are
  ours:
  - on a goal: `qualityvariable [v] Time`, `samplespace [v] "…"`,
    `qualitydefinition [v] "…"`, `distribution [v] exponential[60]`,
    `objective ["8MinRespRate"] "…"`, `mean [o] "…"`,
    `objectivespec [o] "…"`, `modal [o] Max`,
    `target [o] 50%`, `current [o] 35%`;
  - on a refinement: `refinedby [milestone, sysref = "1.2", T = "A + B"] a, b`.
    A `v = "…"` that reads as a distribution is `Distribution[v]`; any other
    is `BooleanEquation[v]` when v is declared Boolean, and `Equation[v]`
    otherwise;
  - on an assignment: `assignedto [sysref = "4.3", A = "exponential[5]"] agent`.

  A file with any of these opens in kaossim's mode (after kaosexpert's,
  before kaosres's). The writer writes a refinement's `SysRef` now, for
  every dialect, with an info diagnostic that KAOSTools doesn't read it.

- **The seeds and their oracles (the owner's decision: A plus B, #189).**
  - **A.** `examples/kaos/las-quantitative` (FSE'04, #206) and
    `examples/kaos/las-design-space` (RE'11, #207) re-key only what the
    papers print. Every unprinted input is marked in the `.kaos`.
    - kaossim reports each objective unresolved, naming what it lacks.
    - Their `expected.csv` list Table 3 (30 / 47 / 52 %, 84 / 93 / 95 %),
      §5.1's sensitivity (45 / 90 %) and RE'11's 61 / 97 / 73 % as "not
      reproducible: inputs not printed", each with its missing inputs.
    - The engine's numeric oracle is `test/engines/kaossim` (closed forms).
      On RE'11's structure with synthetic values, the exhaustive search over
      its 648 designs and seeded NSGA-II reach the same 19-design front
      (`designSpace.test.ts`).
    - `examples/kaos/mine-pump` (#208) re-keys FSE'04's targets and PCTL
      instances, and claims no value.
    - FSE'04 and RE'11 are two seeds, not one: their variables, structure and
      fifth decision point differ, and merging them would invent
      correspondences.
  - **B.** `examples/kaos/las-radar` re-keys RADAR's `LAS.rdr` (UCL-badass/radar
    `docs/LAS.rdr` at 53272ca, used with the owner's approval, no licence).
    RADAR (sbusari/RADAR e0a4503, run in Docker) is the design-by-design
    oracle.
    - RADAR has no goals. Each variable is a goal's quality variable, each
      equation is on the declaring goal's refinement, and each decision is an
      OR-assignment per option, with SysRef `<decision>: <option>`.
    - `normalci[a, b]` joins the shared distribution type: RADAR's 90 %
      interval, σ = (b − a)/3.29.
- **D4, as run.**
  - The seed takes the report's sign, `Pr(ResponseTime > 14*60)`.
  - The report's numbers are the file's sign's. RADAR's CLI prints 0
    decimals, so "Risk = 0" was rounding. With the file's sign, Risk is
    0.12–0.14 and the shortlist is 6 or 4 (RADAR is unseeded and the
    designs are within noise of each other); the report's 5 are a subset.
  - The report's text also gives the distance from location as
    `normalCI(10000,100000)` where the file, which produced its numbers, has
    `triangular(10000, 50000, 100000)`.
  - With the report's sign, RADAR and kaossim agree on all 648 designs
    within 4σ (worst 1.2σ) and on the single Pareto-optimal design. With the
    file's sign, they agree within 4σ (worst 1.1σ), and the exhaustive front
    is RADAR's 6.

### Models typed by their framework (goal-controller#185)

- **Framework-aware, option 1.** goal-tree's `Model<EK, LK>` (lib's
  `IStarModel`) is typed by the model's element and link kinds, iStar
  2.0's by default, so iStar engines compile as before. A model read with
  its framework's root keeps that root's kinds: `parsePistar(text, {
  metamodel: KAOS_OBSTACLES })` is a KAOS model, and the `as unknown as
  IStarModel` casts that made every model an iStar one are gone.
- **A mapper reads its framework's models.** `GoalTree.fromModel` and
  `GoalTree.goalModel` take `ModelFor<D, EK, LK>`: a model with an element
  kind of another framework than its dialect's (`FrameworkOf<D>`, iStar
  2.0 without a `framework`) doesn't compile. The frameworks' kinds come
  from `FRAMEWORK_KINDS` and core's `ElementKind`.
  `lib/src/engines/frameworkTypes.ts` pins this: a KAOS model given to
  Edge, an iStar one to kaosdoc, an NFR one to kaosdoc each fail to
  compile.
- **A framework known at run time is `string`.** A model whose framework
  is read from its file (the workbench's `parseModel`, a file's own
  metamodel) is `AnyModel`, `Model<string, string>`, which any mapper
  accepts; its dialect checks it then. goal-tree's own code reads
  `AnyModel`, as do the engine registry's `analysisModel`,
  `propertyErrors` and `refuseOnPropertyErrors`, which take any
  framework's model.
- **Each engine's model functions are typed by its dialect.**
  `kaosdocGoalModel`, `godaGoalModel` and the `…AnalysisModel` functions
  take `ModelFor` of their own dialect. cgm, grl and tropos4as register
  theirs at string kinds (`grlAnalysisModel<string, string>`, the same
  function): `defineEngine` infers no engine from a generic function
  beside `projectResources` (a TypeScript inference limit).
- **Actors and nodes by the model's root.** goal-tree asks
  `isActorIn(metamodelOf(model))` and `isNodeIn(…)`, not core's iStar-only
  `isActor`/`isNode`, wherever it reads a model of any framework. Today
  they answer the same; an extension with actor kinds would tell them
  apart. `Model.reduce` keeps `isNode` and `istar.Goal`: it reduces iStar
  goals only, and leaves another framework's model as it is.
- **The workbench's own model plumbing** (`dialects.ts`, `frameworks.ts`,
  `pistar.ts`, the canvas and its store) still types every model as iStar
  2.0's, with its own casts: goal-controller#316.

### Typed inspector fields for a framework engine's own properties (goal-controller#327)

- **`frameworkProperties.ts`'s `schemaOf`/`linkSchemaOf`** map a dialect's
  `PropertyDefinition`s of a kind to istar-ts's `prop.*` (`enum` → a select
  (`''` stays unset), `int`/`number` → a number field, `bool` → a checkbox,
  `text` → a text field), skipping value types istar-ts has no field for (a
  `reference`, an `assertion`, a conditional value, …): those stay property
  lines in the Notation view only, as before.
- **`FrameworkDiagram` takes the editor's dialect**, not the framework
  mode's: `ModelDiagram` passes `frameworkEditorOf(wb.mode)!` straight
  through (`{ mode, definition }`), so nfrprop's diagram types `initialLabel`
  while a plain `kaos`/`nfr` model types only its modelling dialect's own.
- **A dialect's properties are added to a kind's, not replacing them.**
  istar-ts's `applyExtensions` overwrites a kind's whole `properties` when a
  later extension sets one, so `dialectParts`'s schema and the kind's own
  (KAOS's `kaosExtension`, which types `kaos.BehavioralGoal` with
  `behavioralGoalProperties`) are merged in `FrameworkDiagram`
  (`withOwnProperties`) before either is applied. KAOS's dialect types every
  key istar-ts's own schema does, plus `Description`
  (goal-controller#229's `schemaProperties` guarantees the former), and
  NFR's own extension types none, so nothing changes visibly today; the
  merge is what keeps istar-ts's keys in that case.
- **A value outside a dialect's enum is a Problem.** `frameworkProblems`
  reports it with `unknown-property-value`, the way `unknown-label` does for
  a link's label outside `linkLabels`: istar-ts keeps the value as written
  (not every value outside a schema's `enum` is rejected: `open` enums and
  free text aren't), so a typo (`initialLabel propagated`, not one of
  `NFR_LABELS`) is flagged rather than silently kept.

### Add to project: a project of several frameworks (goal-controller#329)

- **A project may hold models of several frameworks** (the owner's decision,
  2026-10-19). The framework is each model entry's; the project's
  `framework` is the default for entries without one. A mixed project is
  never refused.
- **Add beside Open.** The top bar has an "Add" button next to Open while a
  project is open; it adds a model file (piStar's, or an importer's) to the
  project and opens it. Open keeps replacing the project, and still asks
  through `FrameworkSwitchDialog` for a model of another framework than the
  open model's own; adding never asks. An archive or a native file is a
  project of its own: Add refuses it ("Open it instead").
- **Drop: on the side bar, add; elsewhere, open.** While a project is open,
  a file dropped on the side bar (the project's files) is added; dropped
  anywhere else it opens, replacing the project, as before. The drop
  overlay says which, and where to drop to add.
- **The added model's framework is its content's.** `inItsFramework`
  records its framework's mode as Open does, and the only refusal
  (`addingMismatch`) is a model that isn't in the framework it declares: its
  framework record, or its recorded mode's. `withModel` writes the entry's
  `framework` only when it isn't the project's (`manifest.framework ??
  'istar-2.0'`), so an iStar model added to an iStar project leaves
  project.json as it was but for `{ "path": … }`. The entry also gets the
  model's recorded mode as `dialect` when the project's differs (an NFR
  project's `dialect: "nfr"` would otherwise be the KAOS model's mode).
- **A read-only project becomes a browser copy.** Adding to a file opened
  (or an example) copies the project to the browser first, as adding a
  project resource does; the original stays in Recent.
- **The open model, not the first.** The workbench keeps which model of the
  project is open (`modelPath`). Its options, outputs, export and conformity
  (`projectFrameworkOf(project, modelPath)`) read that model's entry, and
  Open's mismatch compares a file with the open model's own framework
  (`frameworkOfEntry`: its entry's, the project's, else its content's). The
  side bar lists the project's other models (with their frameworks when
  they differ); one clicked opens in its own framework: its entry's mode,
  else its framework's mode, so its palette. The left model's edits stay in
  the project in memory and in Recent, as an open model's always have.

### Step 7 part A: FormalSpec → LTL, a parser and an AST for the `formula` value (goal-controller#211)

One AST for a `formula` value tagged `ltl` (`kaos`'s `FormalSpec`,
`kaosres`'s `Condition`), goal-language's `src/ltl/` (not lib's: an LTL
value isn't KAOS-specific, so it sits beside the other generic value
readers, `src/parse.ts`'s). Two surface syntaxes write it — a word-based
sugar (`when … then sooner-or-later …`) and the symbolic RT-LTL of van
Lamsweerde's RE'01 "Guided Tour" — over one grammar and one AST (D4 of
#194); which surface a node was read with is recorded on the node
(`Surface`), so a writer reproduces it. The paper transcription is
`docs/papers/rt-ltl-re01.md`.

- **Provenance, since RE'01 itself prints no operator table** (the
  transcription's finding, §1–2 and §8): `◇`, `W`, `o`/next, the one
  bounded `■≤0.5 sec` example and plain `⇒` are attested in the paper's
  own formulas; the rest of the operator set `goal-controller#211`'s
  issue text lists (`●`, `♦`, unbounded `□`/`■`, bounded `◇≤d`/`□≤d`,
  `@P`, strong `⇒`, `⇔`) is the standard KAOS real-time LTL set, not this
  paper's. The sugar surface is `ancailliau/KAOSTools`'s grammar (MIT),
  `Parsing/Parsers/GoalModelParser.peg` (289 lines; transcription §7, one
  row per construct with its grammar line numbers) — every operator it has
  a spelling for, plus `release` (dual of until; not attested in RE'01,
  kept since a sugar corpus may use it).
- **Right-associative by construction, like the source grammar.** The
  sugar grammar's binary rules recurse their right-hand side to the top
  (`Formula`), not to the next tighter level; the parser mirrors this
  exactly (`src/ltl/parser.ts`'s module doc) rather than precedence-climb,
  since a different shape would silently diverge from the oracle grammar
  on anything past two operators deep.
- **A hand-written tokenizer and recursive-descent parser, not a Langium
  rule.** `formula` is a schema-level value (a `ValueConfig` tagged with a
  language, `dialect/src/schema.ts`), not one of goal-language's generic
  `ValueType`s the shared Langium grammar parses (`assertion`, `ocl`, …);
  it has no lexer start, so there is nothing for a Langium rule to plug
  into without widening that machinery for one value tag. `src/ltl/lexer.ts`
  tokenizes both surfaces alike (an identifier, matching the sugar
  grammar's own name terminal, so `sooner-or-later` is one token).
- **The checker is a parser, not a validator against the object model**
  (D3 of #194: no model checking this round). `ltlProblem` (`src/ltl/
  index.ts`) is wired into the `formula` value's check for tag `ltl`
  (`src/notation/values.ts`): a syntax error is a Problem, never a parse
  failure — the text is written back unchanged either way, as every other
  value type's is. The well-formedness check against a model's predicates
  and attributes (gt194's object model, items 1–2, in flight) is a hook,
  `ltlTypeProblems(formula, symbols)`, left unimplemented (always no
  Problems) until a follow-up PR wires a real `SymbolTable` in —
  goal-controller#385.
- **Epistemic operators (`Knows`/`Belief`, ICSE'04, #212): built, "Step
  8" below.** The grammar's shape (one node per operator, a `Unary`-level
  parsing slot) left room, as expected: an agent-indexed unary operator
  fits beside `Next`/`Always` without reshaping the rest.
- **Two details are the writer's own choice, unattested anywhere in the
  sources**: the quantifier's symbolic separator `·`/`∙` (no oracle spells
  a symbolic `forall`/`exists` out), and `@P` binding to the innermost
  atom rather than a whole formula (RE'01 uses it only on a dotted
  attribute comparison, p.6's example, never on a compound formula, so
  there is nothing to attest a wider binding against).
- **No actual document round trip is at stake.** A `formula` value's text
  is stored and written back verbatim regardless of this AST (as `ocl`
  and `text` values are); `src/ltl/print.ts`'s `printLtl` exists only to
  prove the AST is faithful (parse, print, re-parse, compare), and
  normalizes internal whitespace to one space doing it — the corpus wraps
  a `formalspec` over several indented lines, and `kaosFormulaText`
  (`src/formats/kaos/index.ts`) already turns each such gap into one
  space it cannot tell apart from a deliberate one, so a parser-and-printer
  pair cannot reproduce the file's original bytes either. The corpus test
  (`goal-language/test/ltl/corpus.test.ts`) additionally squashes
  whitespace touching `( ) , .` before comparing, for the same reason.
- **The oracle: every `formalspec` in the MIT corpora.** ADS's six models
  and KAOSTools' own `las.kaos` (`goal-language/test/fixtures/kaos`) and
  `examples/kaos/**`: 401 formulas across 6 files that have any, all
  parsing with zero Problems and printing back (squashed) byte-identical.
  Results are on #383.

### Step 8: anti-models (van Lamsweerde ICSE'04, goal-controller#212)

The owner's request reopened #212 under #196's D1; #196's D2 decided
anti-models ride on the obstacle machinery, not a parallel tree. This
section settles the two points #196 left open, logged on #189.

- **AntiGoal: a kind, or an `ObstacleCategory` value — the Category
  wins.** A new element kind (`kaosObstacles.AntiGoal`, parallel to
  `Obstacle`) would need its own properties, links, importer cases and
  kaosdoc entry, and every engine that switches on an obstacle's kind
  would need to learn the new one. The dialect's `ObstacleCategory`
  vocabulary (goal-controller#181) already exists on every obstacle for
  exactly this purpose — naming what kind of thing it is — so it gains one
  value, `AntiGoal` (van Lamsweerde & Letier TSE'00's own five,
  `Non-satisfaction`/`Non-information`/`Inaccuracy`/`Hazard`/`Threat`,
  stay as they are; `AntiGoal` is ICSE'04's addition, orthogonal to them).
  `kaosprop`, `kaosres`, `kaossim` and `kaosexpert` read every obstacle the
  same regardless of its Category, so every existing model (and engine
  test) is unaffected; only `kaosdoc`'s new "Threats" section reads it.
  `AntiGoal` marks every node of an anti-goal AND/OR tree, root to leaf
  (ICSE'04 Table 1 step 4), not only its terminals: the paper itself calls
  intermediate nodes like `PaymentMediumKnownByThief` anti-goals too.
- **Anti-requirement vs. vulnerability: the terminal anti-goal's
  responsible agent, not a further value or kind.** ICSE'04 §4: "the
  former [an anti-goal realizable by the attacker] are anti-requirements
  assigned to the attacker whereas the latter are vulnerabilities assigned
  to the attackee." This is exactly `kaos.ResponsibilityAssignment`
  (goal-controller#181's link from a goal to an agent, which already
  tells a requirement from an expectation by the agent's kind), extended
  to also accept an obstacle as its source. No dialect or link-list change
  was needed for this: `kaos.ResponsibilityAssignment` is the base KAOS
  metamodel's own link, declared with no endpoint-kind restriction and no
  properties schema in `@istar-ts/dsm3-kaos`; `istar-ts`'s `validateModel`
  accepts an obstacle source (checked directly: a model with one validates
  with no Problems, goal-controller#212's tests). The importer's
  `assignedto` case (`packages/lib/src/importers/kaos/read.ts`) and the
  writer's generic per-link-kind loop (`write.ts`, already keyed by link
  kind, not source kind) needed one condition each to accept
  `word === 'obstacle'` alongside a goal's.
- **Malicious agents: the diagnostic becomes a value, not a kind.**
  KAOSTools' `type malicious` (goal-controller#181 PR F) read as a plain
  `kaos.Agent` with an info diagnostic, discarding the distinction. The
  `kaos` dialect's agent vocabulary gains `Type` (its own vocabulary,
  `AgentType`, one value `malicious`; the key is `Type`, shared with a
  goal's own `Type` key, each dialect-typed independently) — the
  importer now sets it instead of discarding the fact, and the diagnostic
  is gone where `malicious` is now a valid, lossless read. Software vs.
  environment agent stays the structural `environment` field, as it was;
  a malicious agent reads as a (non-environment) `kaos.Agent`, per the
  existing behaviour.
- **SecurityGoal subclasses: six more `Category` values.** ICSE'04 §3
  lists the `SecurityGoal` meta-class's subclasses exactly: Confidentiality,
  Integrity, Availability, Privacy, Authentication, Non-repudiation. They
  sit beside TSE'00's five Category values on the same goal property
  (`Satisfaction`/`Information`/`Accuracy`/`Safety`/`Security`): the paper
  gives no further taxonomy under them (no sub-sub-classes), so nesting
  would invent structure the source doesn't have.
- **`Knows`/`Belief`/`KnowsV`: two AST node kinds, one extra flag — not
  three nodes.** ICSE'04 §2 defines `KnowsV ag (v) ≡ ∃x : Knows ag (x =
  v)` and uses both `Knows` and `KnowsV` directly in its formulas (never
  expanding `KnowsV` away), so both need to parse as written, not just the
  defined-from form. `Knows` (`goal-language/src/ltl/ast.ts`) carries an
  `asValue` flag distinguishing `KnowsV` from plain `Knows`, rather than a
  third node kind, since the two share every other field (`agent`,
  `expr`, `surface`) and differ only in which keyword was read. `Belief`
  is its own node (no value form in the paper). Both are agent-indexed
  unary operators, parsed at the same `parseUnary` level as `Next` and
  `Always` — exactly the slot frameworks.md's "Step 7 part A" left open
  for them.
  - **The `[ag]` subscript spelling is unattested on both surfaces, by
    design.** The paper's own PDF-to-text extraction prints the
    subscript with inconsistent spacing ("Knows ag (P)", "KnowsVp
    (acc.PIN)", "KnowsV p (acc.Acc#)" — three spacings for the same
    construct), so there is no one glyph sequence to mirror the way
    other operators mirror RE'01's. `[ag]` was chosen because it matches
    a convention the KAOS dialects already use for a keyed value
    (`Probability[e1]`, goal-controller#190) rather than inventing an
    unrelated one; a sugar spelling (`knows [ag]`, `knows-value [ag]`,
    `believes [ag]`) uses the same bracket, since KAOSTools' own sugar
    grammar has no epistemic construct to take a spelling from.
  - **Neither surface exists in KAOSTools' native `.kaos` grammar**
    (`packages/goal-language/src/formats/kaos/kaos.langium`'s `Formula`
    rule, which mirrors the PEG exactly and has no symbolic spelling for
    anything, let alone an agent-indexed operator). A `formalspec` using
    `Knows`/`Belief`/`KnowsV` therefore reads and writes as a quoted
    string (the existing `StringAtom` fallback for "a FormalSpec that is
    no \[native\] formula"), exactly as any other symbolic-surface
    formula in a `.kaos` file would — the ebanking seed's two such
    formulas round-trip this way.
- **kaosdoc's "Threats" section** mirrors "Requirements and expectations"
  exactly: one row per `AntiGoal`-category obstacle (in the model's
  obstacle order), its `Obstructs` (any `ObstructionLink`, as the
  Obstacles section already reads it), its responsible agent(s), and
  `anti-goal` (no agent — an interior node of the attacker's own tree),
  `anti-requirement` (a malicious agent), `vulnerability` (an attackee
  agent) or `shared` (both) by the same logic that table already has.
  Every existing kaosdoc snapshot (`kaos-welcome.expected.md`, the LAS
  Obstacles-section test) is untouched: neither has an `AntiGoal`
  obstacle, so the new section never appears for them.
- **The seed**: `examples/kaos/ebanking`, re-keyed structurally from
  ICSE'04 §2, §3 and §6 (no machine-readable model of this example
  exists); provenance and the mapping above's rationale are in its
  `README.md`. It opens in kaosres's mode (it has `resolvedby`
  annotations), round-trips through `.kaos`, and `stress:kaos` checks it
  with no numeric oracle (`oracle: skip`) — the oracle is the paper's
  anti-model tree, reproduced structurally and asserted directly in
  `packages/lib/test/engines/kaosdoc/kaosdoc.test.ts`'s Threats-section
  tests.

Out of scope, parked per #196 D1: #213 (RELAX) and #214 (SysML/KAOS). The
formula type check against the object model (goal-controller#385) and
#194's operations/objects are separate, in-flight work this step doesn't
touch.
