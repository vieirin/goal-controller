# Adding a new engine: editor + transformer, step by step

> **Who this is for.** You have a new goal model with your own properties on goals and tasks, and you want (1) an editor for it in the workbench and (2) an engine that transforms the model into some output. This guide walks through exactly what must be defined, in which files, and which options you have at each step. The two existing engines are your templates: **SLEEC** (properties only, text output) and **EDGE/edgeV2** (properties plus a `[]` notation, PRISM output).

## 0. The mental model (read this first)

```
piStar JSON file                      ┌──────────────────────────┐
(elements, links,                     │  ENGINE DEFINITION (data) │  packages/lib/src/engines/<id>/definition.ts
 customProperties as strings)         │  elements · operators ·   │  (written with packages/dialect)
        │                             │  properties (value types) │
        │ parse (goal-tree)           └────────────┬─────────────┘
        │ texts read with the goal language        │ drives, through packages/goal-language
        ▼                                          │ (one grammar: parser, validator)
┌───────────────────┐  engine mapper  ┌────────────┴─────────────┐
│ GoalTree IR       │◄────────────────│ UI: inspector, Notation  │  packages/ui
│ typed engine props│                 │ view, lint, completion,  │
└─────────┬─────────┘                 │ palette, conformity      │
          │ template / back-end       └──────────────────────────┘
          ▼
   output text (PRISM, SLEEC, YAML, BT XML, …)        packages/lib
```

Three things you write, one you get. **You do not write a parser:** goal texts (`G1: Name [G2;G3]`) are read in your definition's dialect by the reader the framework derives from it (`goalNameParserFor`, in `@goal-controller/goal-language`), and goal-tree hands your mapper the result.

| You write          | Where                                                                                   | What it is                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The definition** | `packages/lib/src/engines/<id>/definition.ts` (written with `@goal-controller/dialect`) | Data: which properties exist, their value types, when they apply, which of the goal language's operators it enables and what each means. It describes no syntax: the language is fixed (`packages/goal-language/docs/goal-language.md`; its [reference](../../goal-language/docs/reference.md), [API](../../goal-language/docs/api.md), [diagnostics](../../goal-language/docs/diagnostics.md) and [examples](../../goal-language/docs/examples.md)). **The editor is generated from this.** |
| **The mapper**     | `packages/lib/src/engines/<id>/mapper.ts`                                               | Code: turns raw strings into typed engine properties, validates them, resolves references.                                                                                                                                                                                      |
| **The template**   | `packages/lib/src/engines/<id>/template/`                                               | Code: queries the typed tree and emits your output format.                                                                                                                                                                                                                      |
| You get            | `packages/ui`                                                                           | Inspector with typed fields, Notation tab, local lint and completion, palette, Problems panel, engine conformity and conversion, after ~12 small wiring edits.                                                                                                                  |

**Everything in a model file is a string.** iStar `customProperties` are `{ key: "value" }` strings. The definition says how to *edit and check* them; the mapper says how to *read* them. Keep both in sync (the definition's `propertyKeys()` is the source of the mapper's allowed keys, so they can't drift).

## 1. Decide what kind of engine you have

| Your situation                                                                                | Pattern                    | Template to copy                                                           | Notation?                    | Grammar work?                           |
| --------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | ---------------------------- | --------------------------------------- |
| Properties on goals/tasks, output is text                                                     | **properties-only engine** | SLEEC                                                                      | none                         | none                                    |
| Properties **and** ordering/choice semantics among children (sequence, alternative, retries…) | **notation engine**        | edgeV2                                                                     | `[G1;G2]` in the goal's name | none: enable operators from the catalog |
| New element kinds / symbols / stereotypes (an iStar dialect, no engine)                       | **dialect**                | piStar-ext (`packages/lib/src/dialects/pistarExt/istar4RationalAgents.ts`) | none                         | none                                    |

If your engine reads something the goal language can't write (an id prefix, a construct, a value syntax), the language grows for every dialect: see `packages/goal-language/docs/extending-the-grammar.md`. Most new engines are the first row. If you are "reimplementing SLEEC", that's exactly it. Reimplementing EDGE is the second row. This guide does the first row fully and marks the extra steps for the second.

Running example below: engine id `mission`, goals get `priority` (enum) and `deadline` (int seconds); tasks get `robot` (text) and `duration` (int); output is a YAML mission plan.

## 2. Step 1: write the definition (`packages/lib`)

File: `packages/lib/src/engines/mission/definition.ts`, next to the engine that reads it. `packages/dialect` is only the framework (the schema and what is derived from a definition); it names no engine. Export the definition from `engines/mission/index.ts` and from `packages/lib/src/index.ts`, where the UI imports it.

```ts
import { defineDialect } from '@goal-controller/dialect';

const DEFAULT_FILL = '#CDFECD'; // istar-ts default green

export const mission = defineDialect({
  id: 'mission',
  name: 'Mission', // shown in the UI
  elements: {
    goal: { prefix: 'G', fill: DEFAULT_FILL }, // lines `G1: Name`
    task: { prefix: 'T', fill: DEFAULT_FILL },
  },
  defaultFill: DEFAULT_FILL,
  properties: {
    goal: [
      { key: 'priority',
        value: { type: 'enum', options: [
          { value: '', label: 'normal (default)' }, { value: 'high', label: 'high' }, { value: 'low', label: 'low' } ] },
        required: 'always',
        help: 'how urgent the goal is' },
      { key: 'deadline',
        value: { type: 'int', min: 1 },
        applies: { when: { key: 'priority', equals: 'high' } },
        notApplying: 'Only read for high-priority goals (priority is {priority})',
        help: 'seconds until the goal must be achieved',
        check: 'mission.goal.deadline' },        // implemented in lib (step 3.3)
    ],
    task: [
      { key: 'robot', value: { type: 'text' }, input: { placeholder: 'robot id, e.g. r2' }, required: 'always', help: 'who executes it' },
      { key: 'duration', value: { type: 'int', min: 0 }, help: 'expected seconds' },
    ],
    resource: [],
    quality: [],
  },
  propertyLineOrder: ['priority', 'deadline', 'robot', 'duration'],
  indent: '  ',
  problems: {
    notAChild:          { severity: 'error',   message: 'Not a child of this goal' },
    missingFromNotation:{ severity: 'warning', message: 'Missing from the notation' },
    relationMismatch:   { severity: 'error',   message: '{construct} needs {needs} links, but this goal has {relation} links' },
    notInDiagram:       { severity: 'error',   message: 'Add this element in the diagram' },
  },
});
```

`defineDialect` type-checks it, **freezes it**, and rejects: operators, standalone symbols or modifiers naming unknown constructs, a modifier no operator means, an id prefix on some kinds only, repeated keys, conditions on unknown keys, and a `propertyLineOrder` that doesn't list each property-line key exactly once.

### 2.1 Elements: what a kind's line has

The line's syntax is the goal language's (`<<s>> {tag = v} G1: Name [G2;G3] {int 0..9 = 3}`); a kind only says which parts it has:

- `prefix: 'G' | 'T' | 'R' | 'AT'` → lines name their element (`G1: Deliver sample`); every kind then needs one. **Option:** no prefix on any kind → lines are annotated names matched _by position_ (used by dialects without ids); then no property lines are allowed.
- `declares: true` → the line ends with a declaration setting `type`, `lowerBound`, `upperBound`, `initialValue` (Edge's resource `{int 0..100 = 80}`); the kind must have those properties.
- `annotated: true` → the line starts with annotations setting `stereotype`, `tag`, `tagValue` (the piStar-ext mechanism, added by `withExtension`).
- Names on lines with ids are letters, spaces, `-` and `'` (as RTRegex.g4 read them).

### 2.2 Properties: the predefined value types

Each value type is a rule of the goal language that reads a value on its own; the validator checks every value against its config.

| `value.type`                                     | Inspector input                 | Checked                                                                                                                       |
| ------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `enum` `{options, open?}`                        | select                          | one of the options (`''` = unset), unless `open`                                                                              |
| `int` `{min?, max?}`                             | integer field                   | an integer within the bounds                                                                                                  |
| `number`                                         | number field                    | a number                                                                                                                      |
| `text`                                           | text field                      | nothing                                                                                                                       |
| `bool`                                           | true/false select               | `true` or `false`                                                                                                             |
| `assertion` `{resolves}`                         | one-line editor with completion | the assertion language (`battery > 20 & !charging`); completion offers the elements of the `resolves` kinds and the variables |
| `refList` `{kind}`                               | editor with id completion       | ids, comma-separated, of elements of that kind (Edge's `dependsOn: G2, G5`)                                                   |
| `pairList` `{value}`                             | editor                          | `name:value` pairs, comma-separated, values of that type (Edge's `variables: speed:3, mode:2`)                                |
| `annotatedName`                                  | editor                          | a line without an id                                                                                                          |
| `ConditionalValue` `{when, matching, otherwise}` | depends on another property     | e.g. a resource's `initialValue` is an int or a bool depending on `type`                                                      |

Per property:
- `applies` / `required`: `'always'`, `{ when: {key, equals} }`, or `{ not: {...} }`. `applies=false` greys the row and shows `notApplying` (with `{key}` placeholders). `required` shows the row even when unset.
- `check`: a **name** (`'mission.goal.deadline'`). The library implements it (step 3.3). Use it for anything the value type can't express (cross-property rules, cross-element rules); its message is shown before the type's.
- `inspector: false`: read by the engine but not offered as a field (Edge's `root`).
- `help`: shown as the field hint and used for hover text.

### 2.3 Notation (only for engines with execution semantics among children)

Add a `notation` block: enable operators from the goal language's catalog (`packages/goal-language/docs/operators.md`) and say what each one is. Copy `packages/lib/src/engines/edgeFamily/definition.ts`'s `edgeNotation` and `CONSTRUCTS` as a starting point:

```ts
notation: {
  operand: { kinds: ['goal', 'task'], skip: true },
  operators: { '@': 'retry', ';': 'sequence', '|': 'fallback' },  // symbol → construct (or modifier)
  standalone: { '*': 'any' },                                     // optional: `[*]`
  modifiers: {
    retry: { argument: { name: 'retries', value: { type: 'int', min: 1 }, default: '3' },
             label: 'Retry', help: '…', appliesTo: ['fallback'], action: 'Retry the first child up to {retries} times' },
  },
  constructs: {
    sequence: { label: 'Sequence', help: 'children in order', relation: 'and' },
    fallback: { label: 'Fallback', help: 'first child that succeeds', relation: 'or' },
    any:      { label: 'Any', help: 'whichever' },
  },
  defaultConstruct: { and: 'sequence', or: 'fallback' },
}
```

Any operator not listed is **disabled** for the dialect: the language parses it, the validator reports it (`` `?` is not an operator of Mission``), completion doesn't offer it. **Precedence and associativity are the language's**, not the definition's: `@` binds tightest, then `!`, then `^ | ? + & # ~ ; -> ,` (all left-associative). `relation` on a construct makes the editors flag a notation that contradicts the goal's AND/OR links.

**Reading the notation in the engine:** nothing to write. goal-tree reads each goal's text in your dialect and gives the mapper (`mapGoalProps`) and the template its `executionDetail`: `{ type, ids, modifiers }`, the notation's construct (its outermost enabled operator, or a standalone one), its operands' ids in the order written, and the arguments of the modifiers that apply to it (`modifiers.retry`: `{ G2: 3 }`). Syntax errors and operators your dialect doesn't enable are reported for you.

## 3. Step 2: write the engine library (`packages/lib`)

Directory: `packages/lib/src/engines/mission/`. Copy `sleec/` for the layout.

### 3.1 `types.ts`: the typed properties the template will read
```ts
export type MissionGoalProps = { priority: 'normal' | 'high' | 'low'; deadline: number | null };
export type MissionTaskProps = { robot: string; duration: number };
```

### 3.2 `mapper.ts`: strings → types, keys from the definition
```ts
import { createEngineMapper, type RawProps } from '@goal-controller/goal-tree';
import { propertyKeys } from '@goal-controller/dialect';
import { mission } from './definition';

export const MISSION_GOAL_KEYS = propertyKeys(mission, 'goal');  // ['priority','deadline'], typed
export const MISSION_TASK_KEYS = propertyKeys(mission, 'task');

export const missionEngineMapper = createEngineMapper<
  MissionGoalProps,
  MissionTaskProps,
  never
>()({
  dialect: mission, // the definition: goal texts are read in it (no parser to write)
  allowedGoalKeys: MISSION_GOAL_KEYS,
  allowedTaskKeys: MISSION_TASK_KEYS,
  skipResource: true,            // or allowedResourceKeys + mapResourceProps
  mapGoalProps: ({ raw, id /*, executionDetail */ }) => ({
    priority: (raw.priority || 'normal') as MissionGoalProps['priority'],
    deadline: raw.deadline ? parseInt(raw.deadline, 10) : null,
  }),
  mapTaskProps: ({ raw, name, id }) => {
    if (!raw.robot?.trim()) throw new Error(`Task "${name}" (${id}) needs a robot`);
    return { robot: raw.robot, duration: raw.duration ? parseInt(raw.duration, 10) : 0 };
  },
  // allowedQualityKeys: keys read on Qualities (SLEEC's NormPrinciple, Proxy), mapped with the goal's
  // afterCreationMapper: resolve cross-node refs (Edge's dependsOn) once all nodes exist
});
```
Rules of thumb (from Edge's mapper):
- Throw with the node id in the message; the Problems panel navigates to it.
- Put reusable validation in **checks** (3.3) and call them from the mapper (`firstGoalOrTaskIssue` pattern), so the inspector and the engine agree word for word.
- `dialect` is required: the definition (or, for an engine without one, `{ name }`: ids and names are read, no notation).
- `executionDetail` (`{ type, ids, modifiers }`, see 2.3) arrives in `mapGoalProps` for notation engines: the outermost construct and its operands. `text` is the goal's text as written; an engine that reads nested constructs or calls reads it with `parseElementLine` (MutRoSe does).
- Every node has its diagram position, `x`, for an engine that orders siblings by it (left to right; MutRoSe's decomposer does).
- A goal without children or tasks is a model error, unless the mapper sets `allowLeafGoals` (MutRoSe's Query goals).

### 3.3 `checks.ts`: the named checks the definition refers to
```ts
import type { Check } from '../checks';   // (raw, { self, kindOf, elements? }) => string | null

const deadline: Check = (raw) =>
  raw.priority === 'high' && !raw.deadline?.trim() ? 'High-priority goals need a deadline' : null;

// the one place the names are written
export const missionCheckRegistry: Record<'mission.goal.deadline', Check> = {
  'mission.goal.deadline': deadline,
};
export type MissionCheckName = keyof typeof missionCheckRegistry;
```
A check gets the element's properties and a context (the goal language's `CheckContext`):

- its id, `self`;
- the other elements' kinds, `kindOf`;
- the whole model, `elements`, when the caller has it: every element's kind, properties, children and `x`.

The editors, the inspector and the language server always have the model (`checkContextOf(model, self)` builds the context); the mapper doesn't. So a rule across elements (a name declared by an earlier element, say) says nothing in the mapper, and the template checks the model as a whole. Write such a rule once, over parsed values, and call it from both (MutRoSe's `scope.ts`: the variables a goal monitors must be declared by an earlier goal).
Type the definition's properties with these names
(`satisfies readonly PropertyDefinition<MissionCheckName>[]`, as
`edgeFamily/properties.ts` does with `EdgeCheckName`): a misspelt `check:`
then doesn't compile where it is written. `specsFromDefinition(definition,
registry)` needs a check for every name the definition gives, so a missing
one doesn't compile either.

### 3.4 `template/`: query the tree, emit the output
```ts
import { GoalTree, type GoalTreeType } from '@goal-controller/goal-tree';
export const missionTemplateEngine = (tree: GoalTreeType<MissionGoalProps, MissionTaskProps>, options = {}): string => {
  const goals = GoalTree.allByType(tree, 'goal');
  const tasks = GoalTree.allByType(tree, 'task');
  return ['mission:', ...goals.map(g => `  - goal: ${g.id} # ${g.name}\n    priority: ${g.properties.engine.priority}`),
          'tasks:', ...tasks.map(t => `  - ${t.id}: {robot: ${t.properties.engine.robot}, duration: ${t.properties.engine.duration}}`)].join('\n');
};
```
Useful queries: `GoalTree.allByType`, `leafGoals`, `allGoalsMap`, `Node.children`, `node.relationToChildren`, `node.properties.engine.<typed>`; for notation engines `executionDetail.type`, `.ids` (the children in the notation's order), `.modifiers`, and the ordered children (edgeV2's `orderedChildren` in `template/modules/goalModule/template/children.ts` reads `construct.relation` from the definition).

**Options for the emitter:** plain string templates (SLEEC, Edge); or build an AST and pretty-print (recommended for structured targets like JANI/XML/YAML). Add a `validator/` if the output has structure worth checking (Edge validates its PRISM against expected elements).

**What the workbench and the CLI run: an `EngineOutput`.** An engine makes one or more named text files of a model (`engines/output.ts`, goal-controller#33):

```ts
type EngineOutputFile = {
  id: string;          // stable across runs: 'model', 'reachability-max'
  fileName: string;    // relative to out/: 'BSN.nm', 'ReachabilityMax.pctl'
  text: string;
  language?: string;   // the editor's: 'prism', 'pctl', 'rannot' (others show as plain text)
  primary?: boolean;   // exactly one: shown first, traced, diffed, read back as previousOutput
  owners?: ReadonlyArray<readonly string[]>; // per line (0-based): the model elements it belongs to
};
type EngineOutput = { files: EngineOutputFile[] };
```

- **One file** (most engines): keep the string template and wrap it with `singleFileOutput`, as `edgeOutput`, `edgeV2Output`, `sleecOutput` and `mutroseOutput` do. The file is named after the model with the engine's extension, so downloads and the CLI's `output/` keep their names.
  ```ts
  export const missionOutput = (tree: MissionGoalTree, { modelName }: { modelName: string }): EngineOutput =>
    singleFileOutput({ id: 'mission', modelName, extension: 'yaml', language: 'text', text: missionTemplateEngine(tree) });
  ```
- **Several files** (a PRISM model and its property files, a runtime artefact and a readable one): return them all, the primary one marked, in the order the workbench should show them. Their ids must stay the same from run to run: a project keeps one entry per id and a later run replaces it. `engineOutputProblems(output)` says what is wrong (not exactly one primary, an id or a file name used twice). Run it in your engine's tests, as `test/engines/output.test.ts` does for every engine. That file also has a fixture engine of three files (`test/support/threeFileEngine.ts`).
- **Trace.** The primary file is traced to the model by the ids its identifiers embed (`g3_state`, `module G3`), as before. Any file can carry `owners` instead: for each line, the ids of the elements it belongs to. A file with neither is plain text.
- Keep the string-returning function exported. The CLI and external callers may use it, and the output function is a wrapper around it.

### 3.5 Exports
- `engines/mission/index.ts`: the definition, mapper, keys, types, template, check registry (the registry lives with the definition whose names it implements).
- `packages/lib/src/engines/index.ts` and `packages/lib/src/index.ts`: re-export.
- CLI (`packages/lib/src/cli.ts`): add the engine to the menu if you want `goal-controller-cli` to run it. Write its output with `writeOutputFiles('output', missionOutput(…))` (`cli/outputFiles.ts`): every file, by its name.

### 3.6 Project resources (optional): what the engine reads beside the model

If the engine reads files beside the model (MutRoSe's world knowledge, HDDL
domain and configuration; Edge's variables and property suites), its
definition declares them and its library parses them (goal-controller#25):

```ts
// the definition: data
projectResources: {
  world: { label: 'World knowledge', format: 'xml', role: 'knowledge', path: 'knowledge/world_db.xml', accept: ['.xml'] },
  properties: { label: 'Properties', format: 'pctl', many: true, path: 'props/' },
},
```

- `format` (`xml`, `hddl`, `json`, `pctl`, `text`) is the editor's language
  and the parser's input. `many` is a list of files, kept in a folder. `path`
  is where a new project keeps it.
- Write one parser per kind, `(files) => { symbols, data, diagnostics }`, and
  register them with `projectResourceParsers(definition)({ … })` (MutRoSe's
  `engines/mutrose/projectResources/`, the Edge engines'
  `engines/edgeFamily/projectResources/`). A kind without a parser doesn't
  compile.
  - `symbols` are generic, by category (`classes` with their attributes as
    members, `tasks` with their parameters): what completion reads.
  - `data` is the engine's own JSON, for its checks and template.
  - `diagnostics` are offsets in the file: the resource's tab underlines them,
    and Problems lists them under the resource's label.
- A check reads `context.projectResources?.<kind>?.data` and says nothing
  without it. A finding about an element (a type the world has no class
  for) is the check's diagnostic, not the parser's.
- An `ocl` value completes from a resource's symbols when the definition
  says where: `candidates: { resource: 'world', category: 'classes' }` (types),
  `memberCandidates` (after `name.`).

## 4. Step 3: wire the UI (`packages/ui`), ~12 small edits

| #   | File | Edit |
| --- | --- | --- |
| 1   | `lib/types.ts` | add `'mission'` to `TransformEngine` and `TRANSFORM_ENGINES` |
| 2   | `lib/workbench/engineDialects.ts` | the one place an engine is described: `ENGINE_DIALECTS.mission`, `ENGINE_CHECKS.mission` (typed by the definition's check names: a registry that lacks one doesn't compile), `ENGINE_MAPPERS.mission`, `ENGINE_PROJECT_RESOURCES.mission` (its parsers, if it declares project resources), `ENGINE_LABEL.mission` (the definition's `name`), and its `ENGINES` entry (label, what it generates, the output file's extension, help, whether it takes options) |
| 3   | `lib/models/knownProperties.ts` | `mission: definedKeys(ENGINE_DIALECTS.mission)` |
| 4   | `services/goalModel.ts` | `parseForMission(json, options) { return this.parseWith(json, missionEngineMapper, options) }` |
| 5   | `services/transform.ts` | its branch: `GoalModel.parseForMission(…)`, then `({ files } = missionOutput(tree, { modelName, … }))`: the pane shows a tab per file, "Download all" zips them, and "Save the output in the project" writes them under `out/` |
| 6   | `services/analyze.ts` | its branch in `parsed`; the problems its template finds across elements (MutRoSe's variable scoping) go to `response.problems` |
| 7   | `components/workbench/engines/mission/MissionDiagram.tsx` | `<WorkbenchCanvas extensions={[rtNumbering, missionPalette]} rejectEdit={…} />` (problem badges come from the diagnostics store; nothing to add): the palette offers the kinds your definition lists (copy `mutrose/MutroseDiagram.tsx`); `oneActorOnly(message)` if it reads one actor |
| 8   | `components/workbench/engines/mission/MissionInspector.tsx` | `return <DefinitionInspector engine='mission' />` (that's the whole file) |
| 9   | `engines/ModelDiagram.tsx`, `engines/ModelInspector.tsx`, `engines/pistar/PistarDiagram.tsx` | its `case` (the last: its palette for piStar mode's toggle, or `null`) |
| 10  | `lib/workbench/pistar.ts` | `ENGINE_READS.mission`: the iStar kinds a model converted to it may have (new elements get its definition's id prefixes) |
| 11  | `components/workbench/engines/shared/inspector.tsx` | `ENGINE_KEYS.mission`: where its keys are declared and read (the inspector's "add it to …" hint for unread properties) |
| 12  | `services/examples.ts` | `EXAMPLE_ENGINES`: `mission: 'mission'`, so `examples/mission/` opens for it (a project folder with a `project.json` opens with its `dialect`) |

Adding `'mission'` to `TransformEngine` makes the type-checker flag #2, #3, #9 and #11; the others fall back silently (`services/transform.ts` and `analyze.ts` to another engine, `pistar.ts` to piStar's own kinds), so do them from this list. Engine options (#7's top bar menu, the settings modal) come from `EngineOptionFields` in `TopBar.tsx`: add yours there if your template has any (edgeV2's `taskLayout`, `discretisation` are the pattern, threaded through `TransformOptions`).

The **Notation tab** appears automatically (`modelTabs.tsx` offers it for every engine in `ENGINE_DIALECTS`), with highlighting, lint, completion and selection sync from the goal language (its tokens, its parser and its validator, given the definition). **The language server needs nothing from you.** It is dialect-agnostic, and the client sends it your definition and the model in `goal/context`. Its worker (`lib/workbench/goalWorker.ts`) takes the named checks from `ENGINE_CHECKS` (#2), so the Notation view and the inspector's fields get its diagnostics, completion, hover and F12 for the new engine. Without a worker, the local support gives the same diagnostics and completion. See `packages/goal-language/docs/lsp.md`.

### Bringing your own language server

The shared server covers what a definition can say. If your engine has a
server of its own (MutRoSe's `lsp-mutrose` reads the whole model and
checks its OCL), register it next to the shared one
(goal-controller#24); nothing else changes:

1. **Mark what it serves.** `servedBy: 'engine'` on a property: the goal
   language still reads the key and where it applies, but leaves its value
   to your server (no value diagnostics, completion or hover).
2. **Register it** in `ENGINE_SERVICES` (`packages/ui/lib/workbench/languageServices.ts`):

   ```ts
   mission: [
     {
       id: 'mission', // its diagnostics' source in Problems
       documents: ['pistar-json'], // and/or 'goal-notation', 'field'
       anchoring: 'data',
       transport: () => serviceClient(missionTransport()),
     },
   ],
   ```

   Build the client with `serviceClient` (`goalLsp.ts`), so what it publishes
   reaches the store. Return null while it can't be reached.

3. **Anchor its diagnostics.** Put `{ elementId, key? }` (or `{ nodeId }`)
   in each diagnostic's `data`, as the goal language does
   ([lsp.md](../../goal-language/docs/lsp.md#anchoring)). With `anchoring:
'range'`, the workbench places them by the document: a field's URI, a
   Notation line's id; a `pistar-json` diagnostic without data has no
   element and is dropped from the store.

The shared service stays first: an editor's completion and hover come from
the first service that speaks its document, and the others are kept in sync
with it. Every service's diagnostics are merged, one group per source under
each element in Problems, and drawn as the canvas's badges.

## 5. Step 4: examples and tests

- **Examples:** `examples/mission/*.txt` (piStar JSON). The Explorer groups by folder; `scripts/examples-manifest.mjs` regenerates the list at build time. Files load from GitHub at `main`, so they appear in the hosted workbench once merged.
- **lib tests** (`packages/lib/test/engines/mission/`): mapper (good and bad properties, error messages), template snapshot per example (byte-for-byte expected output committed next to the example, as `examples/edgeV2/*.expected.txt` does), checks.
- **definition tests** (`packages/lib/test/dialect/`, with the engines' other definition tests; `packages/dialect/test` and `packages/goal-language/test` only test the framework, on small inline definitions): a round-trip test that `notationDocument(view)` → `notationEdits` → model is stable for your examples, and the operators your engine reads (copy from `harness.test.ts` and `language.test.ts`).
- `pnpm test` at the root runs the dialect's, the goal language's and lib's tests (its own and `test:dialect`, the definitions' tests); `pnpm build` builds all packages (dialect → goal-language → goal-tree → lib → ui). Its last step is `next build` into `packages/ui/.next`: don't run it while a `next dev` serves from that folder (type-check the UI with `npx tsc --noEmit -p packages/ui/tsconfig.json`, or build a copy).

## 6. Checklists

**Definition (data):** elements (prefix, declares, annotated) · properties per kind with value types, conditions, help · `check` names · `propertyLineOrder` · `problems` · notation (enabled operators, modifiers, constructs, defaultConstruct) if semantics among children.

**Library (code):** `types.ts` · `mapper.ts` with keys from `propertyKeys()` and `dialect: <definition>` · `checks.ts`: the registry, the one place check names are written, and the properties typed with its names · `template/` (reads `executionDetail.ids`, `.modifiers`) · exports. No parser, no error reporting, no construct priority, no reshaping of the reading.

**UI (wiring):** the 12 edits in §4 · palette extension · engine options if any.

**Evidence:** examples · expected outputs · mapper/template tests · round-trip/differential tests.

## 7. The reference implementations

### 7.1 Reimplementing SLEEC with a definition (what it would look like)

SLEEC today has a mapper and template but **no definition** (its inspector is the generic one, and `KNOWN_PROPERTIES.sleec` comes from the mapper; it reads goal texts with Edge's reader). A definition would be: no `notation`; `properties.goal` = `Type` (enum achieve/maintain), `Source`, `Class`, `NormPrinciple`, `Proxy`, `AddedValue`, `Condition`, `Event`, `ContextEvent` (text, with `help`); `properties.task` = `PreCond`, `TriggeringEvent`, `PostCond`, `TemporalConstraint` (all `required: 'always'`, which the mapper enforces today with its `REQUIRED_TASK_KEYS` throw), `Obstacle`; `properties.quality` = `NormPrinciple`, `Proxy`. Checks: one named check for the required-task-keys rule, so the inspector flags it before generation. Then replace `SleecInspector` with `<DefinitionInspector engine='sleec' />` and write it in `packages/lib/src/engines/sleec/definition.ts` and add it to `ENGINE_DIALECTS`. Everything else (mapper, template) stays. Effort: a day.

### 7.2 Reimplementing EDGE (the full case)

Already done on this branch; use it as the worked example. An engine author touches only the definition, the mapper, the types and the templates: `lib/src/engines/edgeFamily/{definition,properties,checks}.ts` (what edge and edgeV2 share: notation constructs, properties, the check registry), `lib/src/engines/edgeV2/{definition,mapper,types,template,validator}`, `ui/components/workbench/engines/edgeV2/` (two tiny files). The conformance harness in `experiments/edgev2-conformance/` shows how to prove a template against a reference.

### 7.3 MutRoSe (a new engine, and what the framework needed)

`lib/src/engines/mutrose/` and `ui/components/workbench/engines/mutrose/`: a notation engine with a call construct (`FALLBACK(a,b)`), task ids `AT1`, leaf goals, and checks across elements. [mutrose.md](mutrose.md) lists what fit, what the framework had to grow, and what is still open.

## 8. Options summary

| Decision                    | Options                                                                      | Pick when                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Notation                    | none · enable operators from the catalog                                     | none unless children have execution semantics; the catalog has spares (`^ & ~ , !`, standalone `* ? #`) beyond Edge's |
| Value checks                | the value type (`type`, `min`, `options`, `kind`, `applies`) · named `check` | the type first; named for cross-property/cross-element rules                                                          |
| Where a property is written | property line · declaration on the element line · annotation before the id   | lines by default; declaration for a compact "type + bounds + initial"; annotations for stereotype-like tags           |
| Output emitter              | string templates · AST + printer                                             | strings for flat text; AST for structured targets or when you'll emit two formats                                     |
| Output files                | one (`singleFileOutput`) · several, one primary (`EngineOutput`)             | one unless the target is a set of files (a model and its properties, a runtime artefact and a readable one)            |
| Resources                   | `skipResource: true` · `allowedResourceKeys` + `mapResourceProps`            | skip unless the output models state/variables                                                                         |
| Engine options              | none · `TransformOptions` + Model Settings card                              | only if the template has knobs                                                                                        |
| Validation of the output    | none · `validator/`                                                          | when the output has structure the generator can get wrong                                                             |

## 9. Pitfalls seen so far
- `properties` must list **every kind** (`goal`, `task`, `resource`, `quality`), even as `[]`.
- Type the properties with the registry's names (`PropertyDefinition<keyof typeof registry>`); without it, a misspelt `check:` is caught only where `specsFromDefinition` is called.
- Mapper keys typed by hand drift from the definition; derive them with `propertyKeys()`.
- Names on lines with ids can't have digits (`G1: Step 2` is an error), as with the ANTLR grammars.
- A notation needs its brackets: `G1: Name [+]`, not `G1: Name +`.
- Examples load from GitHub `main`; an unpushed example 404s in the workbench.
- Don't bump istar-ts or change `goal.langium` unless you mean to; run `pnpm --filter @goal-controller/goal-language generate` after a grammar change (a test checks the generated files are fresh).
