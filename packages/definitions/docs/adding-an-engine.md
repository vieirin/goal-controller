# Adding a new engine: editor + transformer, step by step

> **Who this is for.** You have a new goal model with your own properties on goals and tasks, and you want (1) an editor for it in the workbench and (2) an engine that transforms the model into some output. This guide walks through exactly what must be defined, in which files, and which options you have at each step. The two existing engines are your templates: **SLEEC** (properties only, text output) and **EDGE/edgeV2** (properties plus a `[]` notation, PRISM output).

## 0. The mental model (read this first)

```
piStar JSON file                      ┌──────────────────────────┐
(elements, links,                     │  ENGINE DEFINITION (data) │  packages/definitions
 customProperties as strings)         │  elements · notation ·    │
        │                             │  properties · languages   │
        │ parse (goal-tree)           └────────────┬─────────────┘
        ▼                                          │ drives
┌───────────────────┐  engine mapper  ┌────────────┴─────────────┐
│ GoalTree IR       │◄────────────────│ UI: inspector, Notation  │  packages/ui
│ typed engine props│                 │ view, lint, completion,  │
└─────────┬─────────┘                 │ palette, conformity      │
          │ template / back-end       └──────────────────────────┘
          ▼
   output text (PRISM, SLEEC, YAML, BT XML, …)        packages/lib
```

Three things you write, one you get:

| You write | Where | What it is |
|---|---|---|
| **The definition** | `packages/definitions/src/engines/<id>.ts` | Data: which properties exist, their types, when they apply, which notation operators exist. **The editor is generated from this.** |
| **The mapper** | `packages/lib/src/engines/<id>/mapper.ts` | Code: turns raw strings into typed engine properties, validates them, resolves references. |
| **The template** | `packages/lib/src/engines/<id>/template/` | Code: queries the typed tree and emits your output format. |
| You get | `packages/ui` | Inspector with typed fields, Notation tab, local lint and completion, palette, Problems panel, engine conformity and conversion, after ~15 small wiring edits. |

**Everything in a model file is a string.** iStar `customProperties` are `{ key: "value" }` strings. The definition says how to *edit and check* them; the mapper says how to *read* them. Keep both in sync (the definition's `propertyKeys()` is the source of the mapper's allowed keys, so they can't drift).

## 1. Decide what kind of engine you have

| Your situation | Pattern | Template to copy | Notation? | Grammar work? |
|---|---|---|---|---|
| Properties on goals/tasks, output is text | **properties-only engine** | SLEEC | none | none |
| Properties **and** ordering/choice semantics among children (sequence, alternative, retries…) | **notation engine** | edgeV2 | `[G1;G2]` in the goal's name | reuse edgeV2's grammar, or write one |
| New element kinds / symbols / stereotypes (an iStar dialect, no engine) | **dialect** | piStar-ext (`src/extensions/istar4RationalAgents.ts`) | none | none |

Most new engines are the first row. If you are "reimplementing SLEEC", that's exactly it. Reimplementing EDGE is the second row. This guide does the first row fully and marks the extra steps for the second.

Running example below: engine id `mission`, goals get `priority` (enum) and `deadline` (int seconds); tasks get `robot` (text) and `duration` (int); output is a YAML mission plan.

## 2. Step 1: write the definition (`packages/definitions`)

File: `packages/definitions/src/engines/mission.ts`. Export it from `src/index.ts`.

```ts
import { defineEngine, type PropertyDefinition } from '../schema';

const DEFAULT_FILL = '#CDFECD';           // istar-ts default green
const ID = '(?:[0-9]+\\.?[0-9]*X?|X|[0-9][a-z])'; // Edge's id pattern; pick your own

export const mission = defineEngine({
  id: 'mission',
  name: 'Mission',                        // shown in the UI
  // grammar/parser: only for notation engines (see 2.3)
  elements: {
    goal: { prefix: 'G', idPattern: ID, line: '{id}: {name}', nameCharset: "[A-Za-z\\- ']", fill: DEFAULT_FILL },
    task: { prefix: 'T', idPattern: ID, line: '{id}: {name}', nameCharset: "[A-Za-z\\- ']", fill: DEFAULT_FILL },
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
  propertyLine: { separator: ' ', keyPattern: '[A-Za-z]+' },
  propertyLineOrder: ['priority', 'deadline', 'robot', 'duration'],
  indent: '  ',
  problems: {
    notAChild:          { severity: 'error',   message: 'Not a child of this goal' },
    missingFromNotation:{ severity: 'warning', message: 'Missing from the notation' },
    relationMismatch:   { severity: 'error',   message: '{construct} needs {needs} links, but this goal has {relation} links' },
    notInDiagram:       { severity: 'error',   message: 'Add this element in the diagram' },
  },
  languages: {},
});
```

`defineEngine` type-checks it, **freezes it**, and rejects: operators naming unknown constructs, element lines with `{id}` but no `prefix`/`idPattern`, repeated keys, conditions on unknown keys, expression values in unknown languages, and a `propertyLineOrder` that doesn't list each property-line key exactly once.

### 2.1 Elements: what the Notation tab's lines look like
- `line: '{id}: {name}'` → lines name their element (`G1: Deliver sample`). All kinds must then have `prefix` + `idPattern`. **Option:** omit `{id}` on every kind → lines are matched *by position* (used by dialects without ids); then no property lines are allowed (everything goes on the element line).
- `declaration` → a bracketed tail on the line that sets several properties at once, e.g. Edge's resource `{int 0..100 = 80}`. Declared as a `parts` sequence of `{key, pattern}`, `{literal}`, `{optional: [...]}`. Use it when a kind's properties read better as one declaration than as lines.
- `annotations` → bracketed heads *before* the id (`<<action>> {type = duty} T1: …`), the piStar-ext mechanism. Rare for engines.
- `nameCharset` must match what your grammar accepts if you have one.

### 2.2 Properties: the `ValueConfig` options

| `value.type` | Inspector input | Notes |
|---|---|---|
| `enum` `{options, open?}` | select | `''` option = "unset". `open: true` allows free text besides the options. |
| `int` `{min?, max?}` | integer field | |
| `number` | number field | |
| `text` | text field | |
| `bool` | true/false select | |
| `expression` `{language}` | one-line editor with lint/completion | language must exist in `languages` (see 2.4) |
| `refList` `{kind, separator}` | editor with id completion | e.g. Edge's `dependsOn: G2, G5` |
| `pairList` `{separator, pair, value}` | editor | e.g. Edge's `variables: speed:3, mode:2` |
| `ConditionalValue` `{when, matching, otherwise}` | depends on another property | e.g. a resource's `initialValue` is an int or a bool depending on `type` |

Per property:
- `applies` / `required`: `'always'`, `{ when: {key, equals} }`, or `{ not: {...} }`. `applies=false` greys the row and shows `notApplying` (with `{key}` placeholders). `required` shows the row even when unset.
- `check`: a **name** (`'mission.goal.deadline'`). The library implements it (step 3.3). Use it for anything the declarative config can't express (cross-property rules, cross-element rules). Everything declarative (type, min, options, applies) is checked for free.
- `inspector: false`: read by the engine but not offered as a field (Edge's `root`).
- `help`: shown as the field hint and used for hover text.

### 2.3 Notation (only for engines with execution semantics among children)
Add `grammar`, `parser` and a `notation` block. Copy `edgeShared.ts`'s `edgeNotation` and `CONSTRUCTS` as a starting point:

```ts
notation: {
  delimiters: ['[', ']'],
  operand: { kinds: ['goal', 'task'], keywords: ['skip'] },
  operators: [        // tightest → loosest
    { symbol: '@', form: 'postfix', assoc: 'left', argument: { name: 'retries', value: { type: 'int', min: 1 }, default: '3' },
      label: 'Retry', help: '…', appliesTo: ['fallback'], action: 'Retry the first child up to {retries} times' },
    { symbol: ';', form: 'infix', construct: 'sequence', assoc: 'left' },
    { symbol: '|', form: 'infix', construct: 'fallback', assoc: 'left' },
  ],
  constructs: {
    sequence: { label: 'Sequence', help: 'children in order', relation: 'and' },
    fallback: { label: 'Fallback', help: 'first child that succeeds', relation: 'or' },
  },
  defaultConstruct: { and: 'sequence', or: 'fallback' },
}
```
Operator **forms**: `infix` (`a ; b`), `postfix` with an argument (`G1@3`), `standalone` (edge v1's lone `+`). `relation` on a construct makes the editors flag a notation that contradicts the goal's AND/OR links.

**Grammar options for reading the notation in the engine:**
1. **Reuse edgeV2's grammar** (`grammar: 'edgeV2', parser: 'antlr'`): your operators must be a subset of `; + # | ? -> @`. Zero grammar work; the mapper receives `executionDetail` from goal-tree.
2. **Write an ANTLR grammar**: `packages/lib/grammar/<id>/RTRegex.g4`, add `<id>` to `RT_ENGINES` in `packages/lib/Makefile`, then `pnpm grammar` (root) generates into `packages/goal-tree/src/antlr/<id>/` → add a `goalNameParser/<id>.ts` that walks the parse tree into `GoalExecutionDetail`, and register it in `packages/goal-tree/src/parsers/goalNameParser/index.ts` (`RTGrammar` union + `goalDetailParsers`). This is what edge and edgeV2 do.
3. **Langium** (branch `vn/rt-langium-notation`): one grammar serves the engine *and* a language server in a Web Worker (real LSP: diagnostics, completion, hover, go-to-definition). Not on this branch yet; the `LanguageSupport` slot in the UI is where it plugs in.

Whichever you choose, add a **differential test**: the definition's operator table must equal what the grammar accepts (the harness in `packages/definitions/test/harness.test.ts` does this for edge/edgeV2 against both `.g4` files and the Langium grammar; copy its pattern).

### 2.4 Sub-languages (`languages`)
If a property is an `expression`, declare its language once: operators (infix/prefix, tightest first), parens, comparators, literal regexes, keywords, identifier regex, and what identifiers `resolve` to (`'resource'`, `'variable'`, other kinds). Edge's `assertion` language is in `src/engines/assertion.ts`. The editors derive highlighting, completion of resolvable names and basic lint from it; the engine still needs its own parser if it interprets the expression (Edge uses `AssertionRegex.g4`).

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
import { mission, propertyKeys } from '@goal-controller/definitions';

export const MISSION_GOAL_KEYS = propertyKeys(mission, 'goal');  // ['priority','deadline'], typed
export const MISSION_TASK_KEYS = propertyKeys(mission, 'task');

export const missionEngineMapper = createEngineMapper<MissionGoalProps, MissionTaskProps, never>()({
  // grammar: 'edgeV2',          // notation engines only
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
- `executionDetail` (parsed notation) arrives in `mapGoalProps` for notation engines.

### 3.3 `checks.ts`: the named checks the definition refers to
```ts
import type { Check } from '../checks';   // (raw, { self, kindOf }) => string | null
import type { CheckNameOf } from '@goal-controller/definitions';
import { mission } from '@goal-controller/definitions';

const deadline: Check = (raw) =>
  raw.priority === 'high' && !raw.deadline?.trim() ? 'High-priority goals need a deadline' : null;

export const missionCheckRegistry = { 'mission.goal.deadline': deadline }
  satisfies Record<CheckNameOf<typeof mission>, Check>;   // compile error if a name is missing
```
`satisfies Record<CheckNameOf<…>>` is the type-level guarantee that every `check:` in the definition has an implementation.

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
Useful queries: `GoalTree.allByType`, `leafGoals`, `allGoalsMap`, `Node.children`, `node.relationToChildren`, `node.properties.engine.<typed>`; for notation engines `executionDetail.type` and the ordered children (edgeV2's `orderedChildren` in `template/modules/goalModule/template/children.ts` reads `construct.relation` from the definition).

**Options for the emitter:** plain string templates (SLEEC, Edge); or build an AST and pretty-print (recommended for structured targets like JANI/XML/YAML). Add a `validator/` if the output has structure worth checking (Edge validates its PRISM against expected elements).

### 3.5 Exports
- `engines/mission/index.ts`: mapper, keys, types, template, check registry.
- `packages/lib/src/engines/index.ts` and `packages/lib/src/index.ts`: re-export.
- CLI (`packages/lib/src/cli.ts`): add the engine to the menu if you want `goal-controller-cli` to run it.

## 4. Step 3: wire the UI (`packages/ui`), ~15 small edits

| # | File | Edit |
|---|---|---|
| 1 | `lib/types.ts` | add `'mission'` to `TransformEngine` and `TRANSFORM_ENGINES` |
| 2 | `lib/workbench/definitions.ts` | `ENGINE_DEFINITIONS = { edge, edgev2: edgeV2, mission }` and `ENGINE_CHECKS.mission = missionCheckRegistry` |
| 3 | `lib/models/knownProperties.ts` | `mission: definedKeys(ENGINE_DEFINITIONS.mission)` |
| 4 | `services/goalModel.ts` | `parseForMission(modelJson, {reduce})` = `GoalTree.fromModel(model, missionEngineMapper)` (copy `parseForSleec`) |
| 5 | `services/transform.ts` | `else if (engine === 'mission') output = missionTemplateEngine(tree, options)` |
| 6 | `components/workbench/engines/mission/MissionDiagram.tsx` | `<WorkbenchCanvas extensions={[problemBadges, rtNumbering, missionPalette]} />`; palette = the kinds your definition lists (copy `edgeFamily/extensions.tsx`'s `edgePalette`) |
| 7 | `components/workbench/engines/mission/MissionInspector.tsx` | `return <DefinitionInspector engine='mission' />` (that's the whole file) |
| 8 | `engines/ModelDiagram.tsx`, `engines/ModelInspector.tsx` | add the `case 'mission'` |
| 9 | `components/workbench/engineConformity.tsx` | add `{ id: 'mission', label: 'Mission', output: 'YAML' }` so Open/Convert check conformity |
| 10 | `components/workbench/ModelSettingsModal.tsx` | add it to `ENGINES` (its card) and `TARGET_IDS` (its conformity); add engine-specific options here if your template has any (edgeV2's `taskLayout`, `discretisation` are the pattern, threaded through `TransformOptions`) |
| 11 | `services/analyze.ts` | parse with your mapper (`engine === 'mission' ? GoalModel.parseForMission(…)`): anything else falls back to Edge's parser |
| 12 | `components/workbench/TopBar.tsx`, `components/workbench/Workbench.tsx` | the engine's label in their `ENGINE_LABEL` |
| 13 | `components/workbench/engines/shared/inspector.tsx` | its label in `ENGINE_LABEL`, and in `ENGINE_KEYS` where its keys are declared (the inspector's "add it to …" hint for unread properties) |
| 14 | `components/workbench/engines/pistar/PistarDiagram.tsx` | `pistarPaletteFor`: its palette (or `null`) for piStar mode's palette toggle |
| 15 | `components/workbench/Explorer.tsx` | `EXAMPLE_ENGINES`: `mission: 'mission'`, so `examples/mission/` opens for it |

Adding `'mission'` to `TransformEngine` makes the type-checker flag #3, #12, #13 and #14 (and #2 once the definition is listed); the others are not exhaustive and fall back silently (`services/transform.ts` to SLEEC, `services/analyze.ts` to Edge, `ModelDiagram`/`ModelInspector` to nothing), so do them from this list.

The **Notation tab** appears automatically (`modelTabs.tsx` offers it for every engine in `ENGINE_DEFINITIONS`), with highlighting, lint, completion and selection sync derived from the definition. The `LanguageSupport` slot (`engines/definition/useLanguageSupport.ts`) is where a real language server would be provided; without one, the local support is used.

## 5. Step 4: examples and tests

- **Examples:** `examples/mission/*.txt` (piStar JSON). The Explorer groups by folder; `scripts/examples-manifest.mjs` regenerates the list at build time. Files load from GitHub at `main`, so they appear in the hosted workbench once merged.
- **lib tests** (`packages/lib/test/engines/mission/`): mapper (good and bad properties, error messages), template snapshot per example (byte-for-byte expected output committed next to the example, as `examples/edgeV2/*.expected.txt` does), checks.
- **definitions tests:** a round-trip test that `notationDocument(view)` → `notationEdits` → model is stable for your examples; and if you have a grammar, the differential operator/precedence test (copy from `harness.test.ts`).
- `pnpm test` at the root runs definitions and lib tests; `pnpm build` builds all packages (definitions → goal-tree → lib → ui). Its last step is `next build` into `packages/ui/.next`: don't run it while a `next dev` serves from that folder (type-check the UI with `npx tsc --noEmit -p packages/ui/tsconfig.json`, or build a copy).

## 6. Checklists

**Definition (data):** elements + lines · properties per kind with types, conditions, help · `check` names · `propertyLineOrder` · `problems` · `languages` if expressions · notation (operators, constructs, defaultConstruct, grammar/parser) if semantics among children.

**Library (code):** `types.ts` · `mapper.ts` with keys from `propertyKeys()` · `checks.ts` registry `satisfies Record<CheckNameOf<def>, Check>` · `template/` · exports · grammar + goal-tree parser if a new notation.

**UI (wiring):** the 15 edits in §4 · palette extension · engine options in Model Settings if any.

**Evidence:** examples · expected outputs · mapper/template tests · round-trip/differential tests.

## 7. The two reference reimplementations

### 7.1 Reimplementing SLEEC with a definition (what it would look like)
SLEEC today has a mapper and template but **no definition** (its inspector is the generic one, and `KNOWN_PROPERTIES.sleec` comes from the mapper). A definition would be: no `notation`, no `grammar`; `properties.goal` = `Type` (enum achieve/maintain), `Source`, `Class`, `NormPrinciple`, `Proxy`, `AddedValue`, `Condition`, `Event`, `ContextEvent` (text, with `help`); `properties.task` = `PreCond`, `TriggeringEvent`, `PostCond`, `TemporalConstraint` (all `required: 'always'`, which the mapper enforces today with its `REQUIRED_TASK_KEYS` throw), `Obstacle`; `properties.quality` = `NormPrinciple`, `Proxy`. Checks: one named check for the required-task-keys rule, so the inspector flags it before generation. Then replace `SleecInspector` with `<DefinitionInspector engine='sleec' />` and move it into `ENGINE_DEFINITIONS`. Everything else (mapper, template) stays. Effort: a day.

### 7.2 Reimplementing EDGE (the full case)
Already done on this branch; use it as the worked example: `definitions/src/engines/{edgeShared,edgeProperties,assertion,edgeV2}.ts` (definition, incl. notation, resource declaration and the assertion language), `lib/src/engines/edgeV2/{mapper,types,template,validator}` and `edgeChecks.ts` (registry), `lib/grammar/edgeV2/RTRegex.g4` + `goal-tree/src/parsers/goalNameParser/edgeV2.ts` (grammar), `ui/components/workbench/engines/edgeV2/` (two tiny files). The conformance harness in `experiments/edgev2-conformance/` shows how to prove a template against a reference.

## 8. Options summary

| Decision | Options | Pick when |
|---|---|---|
| Notation | none · reuse edgeV2 grammar · own ANTLR grammar · Langium (other branch) | none unless children have execution semantics; reuse if a subset of edgeV2's operators; Langium if you want a real LSP |
| Value checks | declarative (`type`, `min`, `options`, `applies`) · named `check` | declarative first; named for cross-property/cross-element rules |
| Where a property is written | property line · declaration on the element line · annotation before the id | lines by default; declaration for a compact "type + bounds + initial"; annotations for stereotype-like tags |
| Output emitter | string templates · AST + printer | strings for flat text; AST for structured targets or when you'll emit two formats |
| Resources | `skipResource: true` · `allowedResourceKeys` + `mapResourceProps` | skip unless the output models state/variables |
| Engine options | none · `TransformOptions` + Model Settings card | only if the template has knobs |
| Validation of the output | none · `validator/` | when the output has structure the generator can get wrong |

## 9. Pitfalls seen so far
- `properties` must list **every kind** (`goal`, `task`, `resource`, `quality`), even as `[]`.
- A check name in the definition without an implementation is a compile error only if you write the `satisfies Record<CheckNameOf<…>>` line. Write it.
- Mapper keys typed by hand drift from the definition; derive them with `propertyKeys()`.
- `nameCharset` and the grammar's name token must agree, or the Notation tab and the engine disagree on valid names.
- Examples load from GitHub `main`; an unpushed example 404s in the workbench.
- Don't bump istar-ts or regenerate ANTLR output unless you mean to; both are committed artefacts.
