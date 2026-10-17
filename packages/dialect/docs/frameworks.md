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
| `dialect/src/schema.ts` | `Framework`, `FRAMEWORKS`, `DEFAULT_FRAMEWORK`; `DialectDefinition.framework?`; `FRAMEWORK_KINDS`, the KAOS and NFR kinds a dialect may name; `defineDialect`'s checks per framework |
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
| kinds named in `elements`, `properties` and references | `goal`, `task`, `resource`, `quality` and the extension's node kinds | the root's element kinds (`FRAMEWORK_KINDS[f].elements`), with the hub that an n-ary link generates (`kaos.RefinementLinkHub`) |
| id prefixes | `G`, `T`, `R`, `AT` for iStar's kinds; one or two capitals, unique, for an extension's | one or two capitals other than `X` and `W`; kinds may share a prefix (KAOS's two goal kinds both use `G`) |
| `links` keys | iStar's link kinds or namespaced kinds | the root's link kinds (`FRAMEWORK_KINDS[f].links`) |
| `extension`, `actors`, `notation` | allowed | none |
| every element has an id prefix, or none does | yes | yes |

`PropertyKindOf` accepts the framework's kinds at the type level. A kind that
has properties but no line in the text view (KAOS's refinement hub) therefore
still compiles.

`FRAMEWORK_KINDS` copies the kind lists of the istar-ts roots, so the dialect
package keeps no dependencies. A UI test (`test/workbench/frameworks.test.ts`)
pins it to `KAOS` / `NFR` and to `KAOS_ELEMENT_KINDS` / `NFR_ELEMENT_KINDS`.

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
