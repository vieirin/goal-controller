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
| A value per element and actor, drawn on the model, not a file (an evaluation, a strategy)     | **analysis engine**        | lib's toy (`packages/lib/test/engines/analysis/toy.ts`)                     | optional                     | none                                    |

If your engine reads something the goal language can't write (an id prefix, a construct, a value syntax), the language grows for every dialect: see `packages/goal-language/docs/extending-the-grammar.md`. Most new engines are the first row. If you are "reimplementing SLEEC", that's exactly it. Reimplementing EDGE is the second row. This guide does the first row fully and marks the extra steps for the second.

Running example below: engine id `mission`, goals get `priority` (enum) and `deadline` (int seconds); tasks get `robot` (text) and `duration` (int); output is a YAML mission plan.

## 2. Step 1: write the definition (`packages/lib`)

File: `packages/lib/src/engines/mission/definition.ts`, next to the engine that reads it. `packages/dialect` is only the framework (the schema and what is derived from a definition); it names no engine. Export the definition from `engines/mission/index.ts` and from `packages/lib/src/index.ts`, where the UI imports it.

```ts
import { defineDialect, element, property } from '@goal-controller/dialect';
import type { MissionCheckName } from './checks';

// `check:` takes only the names lib's registry has (step 3.3): a misspelt one doesn't compile
const { enum: choice, int, text } = property.for<MissionCheckName>();

const DEFAULT_FILL = '#CDFECD'; // istar-ts default green

export const mission = defineDialect({
  id: 'mission',
  name: 'Mission', // shown in the UI
  elements: {
    goal: element('G', { fill: DEFAULT_FILL }), // lines `G1: Name`
    task: element('T', { fill: DEFAULT_FILL }),
  },
  defaultFill: DEFAULT_FILL,
  properties: {
    goal: [
      choice('priority', [['', 'normal (default)'], 'high', 'low'], {
        required: 'always',
        help: 'how urgent the goal is',
      }),
      int('deadline', {
        min: 1,
        applies: { when: { key: 'priority', equals: 'high' } },
        notApplying: 'Only read for high-priority goals (priority is {priority})',
        help: 'seconds until the goal must be achieved',
        check: 'mission.goal.deadline', // implemented in lib (step 3.3)
      }),
    ],
    task: [
      text('robot', { input: { placeholder: 'robot id, e.g. r2' }, required: 'always', help: 'who executes it' }),
      int('duration', { min: 0, help: 'expected seconds' }),
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

The helpers come from `@goal-controller/dialect`, and a definition needs no other import: `property.<value type>(key, options)` for each property, `element(prefix?, { fill, declares?, annotated? })` for each kind, and `notation`, `links`, `actors`, `constructs`, `modifier`, `problems`, `projectResources`, `extensionKind` and `extensionLink` for the other parts (§2.3–2.5, §3.6). Each one keeps its literal types without `as const`, so `propertyKeys(mission, 'goal')` is `('priority' | 'deadline')[]`, and each one rejects a misspelt option where it is written.

**What the helpers build.** Each returns the object you would otherwise write by hand: `int('deadline', { min: 1, help, check })` is `{ key: 'deadline', value: { type: 'int', min: 1 }, help, check }`, and `element('G', { fill })` is `{ prefix: 'G', fill }`. Options that belong to the value (`min`, `max`, `open`, `resolves`, `prefixes`, `functions`, `declaredBy`, `candidates`, …) go in `value`, and the rest go beside it, in the order written. An enum option is a value that is also its own label, or a `[value, label]` pair. A definition written as those literals still compiles; to keep the literal types and the check-name typing, write each list `as const satisfies readonly PropertyDefinition<MissionCheckName>[]`. lib's definitions are written with the helpers, and `packages/lib/test/dialect/helpers.test.ts` checks that they deep-equal the literals they replaced.

`defineDialect` type-checks it, **freezes it**, and rejects: operators, standalone symbols or modifiers naming unknown constructs, a modifier no operator means, an id prefix on some kinds only, repeated keys, conditions on unknown keys, and a `propertyLineOrder` that doesn't list each property-line key exactly once.

### 2.1 Elements: what a kind's line has

The line's syntax is the goal language's (`<<s>> {tag = v} G1: Name [G2;G3] {int 0..9 = 3}`); a kind only says which parts it has:

- `prefix: 'G' | 'T' | 'R' | 'AT'` → lines name their element (`G1: Deliver sample`); every kind then needs one. An extension's kind you list takes a prefix of its own (§2.6). **Option:** no prefix on any kind → lines are annotated names matched _by position_ (used by dialects without ids); then no property lines are allowed.
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
| `assertion` `{resolves, functions?, members?}`   | one-line editor with completion | the assertion language (`battery > 20 & !charging`); completion offers the elements of the `resolves` kinds, the variables and the `functions`. With `functions` (`[{ name: 'previous', arity: 1 }]`, even `[]`), a comparison's sides are expressions (`previous(t) < 18`), and a call is a condition on its own (`previous(on) & !off`); a call to another function, or with another number of arguments, is an error. With `members` (below), a reference may be followed by `.member` (`room.clean`, `tank.level < 10`) |
| `expression` `{resolves?, functions?, members?}` | one-line editor with completion | a numeric expression (`0.5 + 0.9 * previous(t)`): numbers, `+ - * /`, a negation, parentheses, ids of elements of the `resolves` kinds, variables (declared by their use), members (`tank.level`, with `members`) and calls to the `functions`, each with its arity; completion offers those, hover shows the element an id names. Read it with `readExpression(value)`: a tree (`number`, `ref`, `var`, `member`, `call`, `binary`, `unary`) the engine walks, never the text |
| `refList` `{kind}`                               | editor with id completion       | ids, comma-separated, of elements of that kind (Edge's `dependsOn: G2, G5`)                                                   |
| `pairList` `{value}`                             | editor                          | `name:value` pairs, comma-separated, values of that type (Edge's `variables: speed:3, mode:2`)                                |
| `annotatedName`                                  | editor                          | a line without an id                                                                                                          |
| `ConditionalValue` `{when, matching, otherwise}` | depends on another property     | e.g. a resource's `initialValue` is an int or a bool depending on `type`                                                      |

**Members** (goal-controller#135). A condition may read a member of an
element (`room.clean`, `tank.level < 10`), where the element's kind says
what members it has. The value's `members` says where they come from:

- `members: { from: 'attributes' }`: the keys of the referenced element's
  `attributes` property, a `pairList` its kind declares (`defineDialect`
  checks one of the `resolves` kinds does). Each pair is a member and its
  type: `bool`, `int` or `number`, or its options (`low|high`):
  `clean:bool, level:number, mode:wet|dry`.
- `members: 'any'`: any name (members declared elsewhere, not checked).
- None: a member is an error.

The type says what a member compares to: a `bool` stands alone or is set
(`room.clean`, `room.clean = true`), a number is compared with a number
(`tank.level < 10`), an enum with `=` or `!=` and one of its options
(`room.mode = wet`). The validator reports a member on an element whose
kind declares none, an unknown member and one read as what it isn't;
completion offers an element's members after its dot, and hover shows a
member's type. A member of a variable (`x.y`, declared by its use) isn't
checked. Read a condition with `readAssertion` (`{ kind: 'member', ref,
member }`, and an `assign` with a `member`) and its members with
`assertionMembers(tree)`; never split the text.

Each row has a helper of the same name: `property.enum(key, options, { open? })`, `property.int(key, { min?, max? })`, `property.number`, `property.text`, `property.bool`, `property.annotatedName`, `property.assertion(key, { resolves, prefixes?, functions?, … })`, `property.expression(key, { resolves?, functions? })`, `property.refList(key, kind)`, `property.pairList(key, valueType)`, `property.ocl(key, { declaredBy?, candidates?, memberCandidates? })` and `property.conditional(key, { when, matching, otherwise })`. Each takes the per-property options below in the same object (`help` is required).

Per property:
- `applies` / `required`: `'always'`, `{ when: {key, equals} }`, or `{ not: {...} }`. `applies=false` greys the row and shows `notApplying` (with `{key}` placeholders). `required` shows the row even when unset.
- `check`: a **name** (`'mission.goal.deadline'`). The library implements it (step 3.3). Use it for anything the value type can't express (cross-property rules, cross-element rules); its message is shown before the type's.
- `inspector: false`: read by the engine but not offered as a field (Edge's `root`).
- `help`: shown as the field hint and used for hover text.

### 2.3 Notation (only for engines with execution semantics among children)

Add a `notation` block: enable operators from the goal language's catalog (`packages/goal-language/docs/operators.md`) and say what each one is. `notation({...})` completes the catalog's symbols in `operators` and `standalone` and rejects any other symbol. Copy `packages/lib/src/engines/edgeFamily/definition.ts`'s `edgeNotation` and `CONSTRUCTS` as a starting point:

```ts
notation: notation({
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
}),
```

A part written outside `defineDialect` and shared by several definitions (Edge's constructs and its retry modifier) keeps its literal types with `constructs({...})` and `modifier({...})`.

Any operator not listed is **disabled** for the dialect: the language parses it, the validator reports it (`` `?` is not an operator of Mission``), completion doesn't offer it. **Precedence and associativity are the language's**, not the definition's: `@` binds tightest, then `!`, then `^ | ? + & # ~ ; -> ,` (all left-associative). `relation` on a construct makes the editors flag a notation that contradicts the goal's AND/OR links.

Three more options, for what a lab dialect's text may be like (GODA's, [goda.md](goda.md)):

- `notation.leafBracket: 'cost'`: a leaf's bracket holds its cost (`T1.1: Pick [W = 0.5x]`), not a notation. The mapper reads it with `parseElementLine(text).value.cost` (`mapTaskProps` is given the task's `text`). The validator reports a cost on a refined element and a notation on a leaf.
- `notation.whitespace: 'ignore'`: the spaces in a bracket aren't read (`[D M(T1.1 2)]` is `[DM(T1.12)]`). The editors read the line without them and point at what they report where it is written. Read a text in the dialect with `parseElementLineIn(definition, text)`.
- `idScope: 'ancestorGoal'` (on the definition, not its notation): a task's id is unique under its goal only, so two goals may each have a `T1.1`.

### 2.4 Properties on links

A link kind's properties are declared like an element kind's, keyed by the
link kind: iStar's (`istar.ContributionLink`, `istar.AndRefinementLink`, …) or
one your extension adds (`<namespace>.<Kind>`):

```ts
links: links({
  'istar.ContributionLink': [ // iStar's link kinds are completed
    int('weight', { min: -100, max: 100, help: '…', check: 'mission.weight' }),
  ],
}),
```

- **Storage:** the link's `customProperties` in the piStar file, as an
  element's. iStar's own contribution value (`make`, `help`, `hurt`,
  `break`) is the link's `label`, not a property; don't declare it again.
- **Validated** by `defineDialect` as an element kind's list: an unknown link
  kind, a repeated key, a condition on an unknown key. A dialect with `links`
  may not key an element property `link` (the key their line is written with).
- **The inspector** shows a link's rows when the diagram selects it, from
  `linkSpecsFromDefinition`.
- **The Notation view** writes a link with properties as a `link` line under
  its source: `link G1 {weight = 50}` (the goal language's
  [link lines](../../goal-language/docs/goal-language.md#link-lines-properties-on-links)).
  `linkLines` says whether it does: by default a dialect with ids does, and
  one without doesn't. A dialect without ids that sets `linkLines: true`
  names the target by its text, quoted: `link "Comfort" {weight = 50}`, and
  `"Comfort"#2` for the second element with that text.
- **Checks:** a link property's check gets the link's piStar id as
  `context.self`, and `context.readLink(id)`: its kind, its ends' keys,
  its `ends` as the model has them (piStar id and kind, an extension's kinds
  too), its label and properties. The Notation view runs it on a link
  line's value.

### 2.5 Properties on actors

One list for every actor kind; `kinds` narrows a property to some
(`['istar.Agent', 'istar.Role']`, or an extension's actor kind):

```ts
actors: actors([int('importance', { min: 0, max: 100, help: '…' })]),
```

Stored in the actor's `customProperties`, edited in the inspector when the
diagram selects the actor (`actorSpecsFromDefinition`), read by checks with
`context.readActor(id)` (a property's check gets the actor's piStar id as
`self`). **The Notation view** writes an actor with properties as an
`actor` line at the top of the document: `actor "Patient" {importance = 50}`
(the goal language's
[actor lines](../../goal-language/docs/goal-language.md#actor-lines-properties-on-actors),
goal-controller#109). A dialect with `actors` may not key an element
property `actor`, the key those lines are written with.

### 2.6 Properties on an extension's own kinds

An extension's kinds declare properties the same way (goal-controller#132).
The dialect names its extension (`defineExtension`, what your engine adds
to iStar 2.0), and `properties` keys its node kinds by id beside iStar's:

```ts
export const mission = defineDialect({
  …,
  extension: missionExtension, // its kinds: mission.Sensor, mission.Display
  properties: {
    goal: [ assertion('when', { resolves: ['mission.Sensor', 'variable'], help: '…' }) ],
    task: [], resource: [], quality: [],
    'mission.Sensor': [
      number('rate', { help: 'readings per second', check: 'mission.sensor.rate' }),
      refList('feeds', 'mission.Display', { help: 'the displays it feeds' }),
    ],
  },
});
```

- **Typed from the extension.** A key that is neither one of iStar's four
  kinds nor a node kind of the dialect's extension doesn't compile; its
  actor kinds take `actors`' properties (§2.5). `defineDialect` rejects the
  same at run time. A kind without an entry has no properties.
- **References.** `assertion.resolves`, `expression.resolves`,
  `refList.kind` and `notation.operand.kinds` take the extension's kind ids
  too; `defineDialect` rejects one its extension doesn't have. The editors
  resolve, complete and hover them as goals: an element is named by the id
  its text starts with (`V1: Panel`), or by its piStar id. In an
  expression, such a name is that element.
- **Derived as an iStar kind's.** `propertyKeys(mission, 'mission.Sensor')`,
  `CheckNameOf` (its checks are the engine's to implement, §3.3),
  `specsFromDefinition` (the inspector shows a sensor's rows as a goal's),
  and the checks: an element of the extension's kind is in
  `context.elements` by its key, and `context.readElement(key)` reads any
  element, whatever its kind.
- **Lines (optional).** The Notation view lists the kinds in `elements`. To
  list one of the extension's, key it there with a prefix of its own, one
  or two capitals that are none of `G`, `T`, `R`, `AT`, `X`, `W` and no
  other kind's: `'mission.Sensor': element('S', { fill })`. Its elements
  get a line, `S1: Probe`, with their property lines under it (its keys go
  in `propertyLineOrder` with the others). The goal language reads that
  prefix in your dialect only. A kind you don't list has no line: its
  properties are the inspector's, and its text stays as written. A
  dialect without ids lists none (it writes no property lines).
- **The engine's kinds** are its dialect's extension: `defineEngine` takes
  them from `dialect.extension` (§3.9).

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
- Actors and links have mappers too (`mapActorProps`, `mapLinkProps`), and `afterCreationMapper` sees the whole model: see 3.8.

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
Build the definition's properties with these names
(`property.for<MissionCheckName>()`, as in step 1 and as
`edgeFamily/properties.ts` does with `EdgeCheckName`): a misspelt `check:`
then doesn't compile where it is written. `defineEngine` (§3.9) needs a
check for every name the definition gives, so a missing one doesn't compile
(and is reported at definition time); so does
`specsFromDefinition(definition, registry)`. Keep `checks.ts` free of
imports from `definition.ts`: the definition imports its names.

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
- **What an output function takes.** The tree (`missionOutput(tree, { modelName })`) is enough for most engines. An engine that needs more of the model, its actors or links (GODA names its MDP after the actor of the selected goal), takes the `GoalModel` (3.8): `godaOutput(godaGoalModel(model), { modelName })`, where `godaGoalModel` checks GODA's shape and builds the IR with its mapper.
- **Versions of a target.** When the references an engine is proved against come from several versions of the original generator, make each version a strategy object (its templates and the rules that differ) and let the output function take a `variant`. A version not implemented yet throws an error that names its issue, so a harness reports it as an expected failure (GODA's `GODA_GENERATORS`, `GodaUnsupported`).

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

### 3.7 An analysis engine: values on the model, not a file

An analysis computes a value per element and actor (a satisfaction level
under a strategy, a cost, a risk) and the workbench draws it on the
diagram. It writes no file and changes nothing in the model.

```ts
// packages/lib/src/engines/mission/analyses.ts
import { defineAnalyses, type AnalysisModel } from '../analysis';

export const missionAnalyses = defineAnalyses(mission, {
  load: {
    label: 'Robot load',
    input: 'plans', // optional: one of the definition's projectResources
    run: (model: AnalysisModel, resource) => ({
      cases: [{ id: 'all', label: 'All plans', values: { [actorId]: { value: 3, label: '3 tasks' } } }],
    }),
  },
});
```

- **Input:** `AnalysisModel`, the view of the engine's `GoalModel` (3.8):
  `analysisViewOf(GoalTree.goalModel(model, missionEngineMapper))`. It has
  every actor (kind, name, properties, its elements), every element (kind,
  name, properties, its actor) and every link (kind, ends, label,
  properties). An element's properties are as the piStar file has them. An
  actor's and a link's are what the mapper keeps: give it
  `mapActorProps: ({ raw }) => raw` and `mapLinkProps: ({ raw }) => raw`
  over the definition's keys, as GRL's does. An engine with analyses reads
  every actor and tree, so declare `model: { actors: 'many', treesPerActor:
  'many' }`. `resource` is the `input` kind's files, path → text, as the
  tabs hold them (a `many` kind: all its files).
- **Output:** `AnalysisResult = { cases: { id, label, values, steps? }[] }`, where
  `values` maps an element's or actor's piStar id to `{ value: number | string;
  label?; severity?: 'info' | 'warning' }`. A case is one evaluation (a
  strategy); a single-case analysis has one.
- **A step series** (goal-controller#135): a case run as a sequence (a
  scenario's steps, a lifecycle's states) gives `steps: [{ label, values }]`
  in order, each step's values as a case's, and its outcome (its last
  step's) as `values`. The workbench shows a step control beside the
  Analyse menu (previous, next, `2/7: <the step's label>`) over the same
  per-element values, each message `<case>, <step>: <value>`.
  `analysisText(result, nameOf?)` lists a result as text: each case, and
  each step of a case that has them, one `name: value` line per element.
- `defineAnalyses` checks that each analysis has a label and reads only a
  project resource the definition declares. `runAnalysis` gives `{ result }`
  or `{ error }` (what the analysis threw).
- **The workbench:** give them to the engine object as `analyses:
  missionAnalyses`, with `analysisModel: missionAnalysisModel`, which reads a
  model for them (GRL's `grlAnalysisModel`; §3.9). An analysis engine
  generates no file. `defineEngine` repeats `defineAnalyses`' checks against
  its dialect, and rejects analyses without an `analysisModel`. An "Analyse" menu appears beside
  Generate, with the engine's analyses; a click runs one on the model as it
  is. With several cases, a picker chooses the one drawn. The values go to
  the canvas as istar-ts host diagnostics, keyed by piStar id: `info`, or
  the value's own severity, with `<case>: <label or value>` as the message.
  istar-ts 0.12 badges elements, actors and links with them. Once the model
  changes the values are "out of date" and aren't drawn until the next run.
  Nothing runs without a click, and nothing is saved in the model file.

### 3.8 Generation options (optional): the template's knobs

An option the user sets for a whole model (EdgeV2's discretisation, GODA's generator version) is declared with the same value types as a property: `bool`, `number`, `int` (`min`, `max`) or `enum` (`options`, each with a `help` shown on hover), and a default. File: `packages/lib/src/engines/mission/options.ts`, exported from `packages/lib/src/index.ts`:

```ts
import { defineOptions } from '@goal-controller/dialect';
import { reduceOption } from '../options';

export const missionOptions = defineOptions([
  {
    key: 'horizon',
    label: 'Horizon',
    help: 'steps the plan looks ahead',
    value: { type: 'int', min: 1, max: 50 },
    default: 10,
    summary: 'horizon {value}', // what the options button says; a bool's only when on
  },
  reduceOption, // shared: generate without single-child goals (asks first: its `confirm`)
]);
```

`defineOptions` rejects a key declared twice and a default its option doesn't take, and keeps the literal types: the workbench's `GenerationOptions` is derived from every engine's declarations (an `enum`'s value is the union of its values). From them the workbench renders the options menu and the settings dialog's fields (a switch, a number, a segmented choice), checks a manifest's options (a value its option doesn't take is reported and not used), and keeps those that differ from the defaults. An option two engines read (`clean`, `reduce`) is one object both lists hold, so it has one default. An engine without knobs declares none. Your template still takes them as arguments: thread them through `TransformOptions` (#5 below).

### 3.9 The engine object: what the workbench registers

Everything the workbench needs to know about an engine goes in one object, in `engines/mission/engine.ts`, exported from `packages/lib/src/index.ts` (goal-controller#124):

```ts
import { defineEngine } from '../engine';
import { missionCheckRegistry } from './checks';
import { mission } from './definition';
import { missionEngineMapper } from './mapper';

export const missionEngine = defineEngine({
  id: 'mission', // the workbench's id (TransformEngine)
  // label: defaults to the definition's name
  help: 'A YAML mission plan for the robots',
  dialect: mission,
  checks: missionCheckRegistry, // every name the definition gives: one missing doesn't compile
  mapper: missionEngineMapper,
  output: { label: 'Mission plan', extension: 'yaml', language: 'text' },
  outputs: [{ id: 'mission', language: 'text' }], // the files its output function writes, by id
  // options: missionOptions,            its template's knobs (§3.8; none: no options menu)
  // projectResources: missionResources,  a parser per kind the definition declares (§3.6)
  // analyses: missionAnalyses,           an analysis engine (§3.7): no file
  // analysisModel: missionAnalysisModel, how it reads a model for them (§3.7)
  // pool: missionPool,                   its files share one definition pool (definition-pool.md)
  // fileKinds: true,                    its models declare its dialect's extension's kinds (importers.md)
});
```

`defineEngine` freezes the object and, at definition time, rejects:
- a check that a property names but `checks` lacks;
- a project resource without a parser, or a parser for a resource the definition doesn't declare;
- an analysis that reads a resource the definition doesn't declare;
- analyses without an `analysisModel`, or an `analysisModel` without analyses;
- an output id declared twice;
- `fileKinds` on an engine whose dialect names no `extension` (§2.6);
- checks or parsers on an engine without a dialect (SLEEC's case).

Each message starts with the engine's id. Check `outputs` against what the engine really writes in its tests (`test/engines/output.test.ts` does it for every engine).

### 3.10 The IR: actors, trees, links and the model shape

goal-tree reads a model into a typed IR, the `GoalModel` (goal-controller#125):

```ts
type GoalModel = {
  actors: { id; name; kind; properties: { engine: TActorEngine }; trees: TreeNode[]; elements: id[] }[];
  links: { id; kind; source; target; relation: 'and' | 'or' | 'neededBy' | null; label?; properties: { engine: TLinkEngine } }[];
  dependums: TreeNode[];   // outside every actor, each a node
  elements: { id; kind; name; actor?; properties }[]; // every element as written, an extension's kinds too
};
```

- **An actor holds one tree per root goal.** A root is an element of a tree
  kind, but a Quality, that refines nothing: it has no outgoing refinement
  link. A tree's children are its refinements only. A contribution, a
  qualification or a dependency is one of the model's `links`, with its
  `relation` `null`. Every node knows its actor (`node.actor`, a piStar id).
- **The mappers.** `mapActorProps({ raw, kind, id, name })` and
  `mapLinkProps({ raw, kind, id })`, typed by `allowedActorKeys` and
  `allowedLinkKeys` as `mapGoalProps` is by its keys. Both are optional: an
  engine without them gets `{}`. Take the keys from the definition:
  `actorPropertyKeys(mission)`, `linkPropertyKeys(mission)`.
  `afterCreationMapper` gets `model`, the whole `GoalModel`.
- **The shape your engine reads.** Declare it on the definition: `model: {
  actors: 'one' | 'many', treesPerActor: 'one' | 'many' }`. The default is
  `one`/`one`. Edge, edgeV2, MutRoSe and SLEEC keep it. GODA reads
  `many`/`one`: it generates from the actor holding the selected goal. GRL
  reads `many`/`many`. `modelShapeProblem(model, definition)` says what
  doesn't fit, for example `Mission reads one actor with one root goal; the
  model has 2 actors` or `…; actor "Lab" has 2 root goals (G1, G4)`.
  `Model.validate` and `GoalTree.fromModel` throw it before generation.
- **Which to call.** `GoalTree.fromModel(model, mapper)` gives the trees
  flat, which is all a one/one engine needs. `GoalTree.goalModel(model,
  mapper)` gives the whole IR, for any shape, without checking it.
- **A dialect without ids** (no element kind has a `prefix`, GRL) still has
  an IR. A node's id is its piStar id and its name is its text, unparsed.

## 4. Step 3: wire the UI (`packages/ui`), ~12 small edits

| #   | File | Edit |
| --- | --- | --- |
| 1   | `lib/types.ts` | add `'mission'` to `TransformEngine` and `TRANSFORM_ENGINES` |
| 2   | `lib/workbench/engineDialects.ts` | the one place an engine is registered: import `missionEngine` and add it to `registerEngines(…)`, at the place the UI should offer it. `ENGINE_DIALECTS`, `ENGINE_CHECKS`, `ENGINE_PROJECT_RESOURCES`, `ENGINE_POOLS`, `ENGINE_MAPPERS`, `ENGINE_OPTIONS` (its `options`, §3.8; `[]` for none), `ENGINE_LABEL`, `ENGINES`, `ENGINE_ANALYSES` and `ENGINE_FILE_KINDS` are derived from the engine objects, typed per engine, and so are `dialectOf`, `hasOptions` and `outputExtensionOf` |
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

Adding `'mission'` to `TransformEngine` makes the type-checker flag #2 (the registry must register every `TransformEngine`, and only those), #3, #9 and #11; the others fall back silently (`services/transform.ts` and `analyze.ts` to another engine, `pistar.ts` to piStar's own kinds), so do them from this list. Engine options (the top bar's menu, the settings modal) are rendered from `ENGINE_OPTIONS` (#2): nothing to add in the UI but #5's arguments.

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

**Definition (data), written with the helpers:** elements (prefix, declares, annotated) · properties per kind with value types, conditions, help · `check` names · `propertyLineOrder` · `problems` · notation (enabled operators, modifiers, constructs, defaultConstruct) if semantics among children.

**Library (code):** `types.ts` · `mapper.ts` with keys from `propertyKeys()` and `dialect: <definition>` · `checks.ts`: the registry, the one place check names are written, and the properties typed with its names (`property.for<…>()`) · `template/` (reads `executionDetail.ids`, `.modifiers`) · `engine.ts`: `defineEngine` · exports. No parser, no error reporting, no construct priority, no reshaping of the reading.

**UI (wiring):** the 12 edits in §4 (the registry is one import and one entry) · palette extension · engine options (§3.8) if any.

**Evidence:** examples · expected outputs · mapper/template tests · round-trip/differential tests.

## 7. The reference implementations

### 7.1 Reimplementing SLEEC with a definition (what it would look like)

SLEEC today has a mapper and template but **no definition** (its inspector is the generic one, and `KNOWN_PROPERTIES.sleec` comes from the mapper; it reads goal texts with Edge's reader). A definition would be: no `notation`; `properties.goal` = `Type` (enum achieve/maintain), `Source`, `Class`, `NormPrinciple`, `Proxy`, `AddedValue`, `Condition`, `Event`, `ContextEvent` (text, with `help`); `properties.task` = `PreCond`, `TriggeringEvent`, `PostCond`, `TemporalConstraint` (all `required: 'always'`, which the mapper enforces today with its `REQUIRED_TASK_KEYS` throw), `Obstacle`; `properties.quality` = `NormPrinciple`, `Proxy`. Checks: one named check for the required-task-keys rule, so the inspector flags it before generation. Then replace `SleecInspector` with `<DefinitionInspector engine='sleec' />`, write it in `packages/lib/src/engines/sleec/definition.ts`, and give it to `sleecEngine` as its `dialect` (`ENGINE_DIALECTS` derives from it). Everything else (mapper, template) stays. Effort: a day.

### 7.2 Reimplementing EDGE (the full case)

Already done on this branch; use it as the worked example. An engine author touches only the definition, the mapper, the types and the templates: `lib/src/engines/edgeFamily/{definition,properties,checks}.ts` (what edge and edgeV2 share: notation constructs, properties, the check registry), `lib/src/engines/edgeV2/{definition,mapper,types,template,validator}`, `ui/components/workbench/engines/edgeV2/` (two tiny files). The conformance harness in `experiments/edgev2-conformance/` shows how to prove a template against a reference.

### 7.3 MutRoSe (a new engine, and what the framework needed)

`lib/src/engines/mutrose/` and `ui/components/workbench/engines/mutrose/`: a notation engine with a call construct (`FALLBACK(a,b)`), task ids `AT1`, leaf goals, and checks across elements. [mutrose.md](mutrose.md) lists what fit, what the framework had to grow, and what is still open.

### 7.4 GODA-MDP (several files, a lab dialect's text, and an oracle)

`lib/src/engines/goda/` and `ui/components/workbench/engines/goda/`: a notation engine whose output is eight files (an MDP, four PCTL properties, two parametric formulas and a script), proved byte for byte against upstream's references for AND and OR. It needed variadic calls (`DM(…)`), a leaf's bracket as its cost, `TX` ids, ids scoped by their goal, spaces in brackets ignored, and conditions with a prefix and decimals. [goda.md](goda.md) lists what fit, what grew, the divergences from upstream, and what is still open.

## 8. Options summary

| Decision                    | Options                                                                      | Pick when                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Notation                    | none · enable operators from the catalog                                     | none unless children have execution semantics; the catalog has spares (`^ & ~ , !`, standalone `* ? #`) beyond Edge's |
| Value checks                | the value type (`type`, `min`, `options`, `kind`, `applies`) · named `check` | the type first; named for cross-property/cross-element rules                                                          |
| Where a property is written | property line · declaration on the element line · annotation before the id   | lines by default; declaration for a compact "type + bounds + initial"; annotations for stereotype-like tags           |
| Output emitter              | string templates · AST + printer                                             | strings for flat text; AST for structured targets or when you'll emit two formats                                     |
| Output files                | one (`singleFileOutput`) · several, one primary (`EngineOutput`)             | one unless the target is a set of files (a model and its properties, a runtime artefact and a readable one)            |
| Resources                   | `skipResource: true` · `allowedResourceKeys` + `mapResourceProps`            | skip unless the output models state/variables                                                                         |
| Engine options              | none · `defineOptions` (§3.8) + `TransformOptions`                           | only if the template has knobs                                                                                        |
| Validation of the output    | none · `validator/`                                                          | when the output has structure the generator can get wrong                                                             |

## 9. Pitfalls seen so far
- `properties` must list **every kind** (`goal`, `task`, `resource`, `quality`), even as `[]`; an extension's kinds only where they have properties (§2.6).
- Build the properties with the registry's names (`property.for<MissionCheckName>()`); without it, a misspelt `check:` is caught only by `defineEngine` and `specsFromDefinition`.
- Mapper keys typed by hand drift from the definition; derive them with `propertyKeys()`.
- Names on lines with ids can't have digits (`G1: Step 2` is an error), as with the ANTLR grammars.
- A notation needs its brackets: `G1: Name [+]`, not `G1: Name +`.
- Examples load from GitHub `main`; an unpushed example 404s in the workbench.
- Don't bump istar-ts or change `goal.langium` unless you mean to; run `pnpm --filter @goal-controller/goal-language generate` after a grammar change (a test checks the generated files are fresh).
