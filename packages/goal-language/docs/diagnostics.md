# The goal language: diagnostics

This page catalogues every message `documentDiagnostics` and
`fieldDiagnostics` report. A notation's problems (`notAChild`,
`missingFromNotation`, `relationMismatch`) take their text and severity
from the dialect's `problems`. Edge's and edgeV2's are shown here.

Each example is a `goal-check <dialect>` block, and
`packages/lib/test/dialect/docs.test.ts` validates it. Its model is its
lines' elements:

- each element's kind comes from its id's prefix;
- an element's children are the ids its notation names;
- `%% only`, `%% children`, `%% relation`, `%% construct` and `%% variables`
  lines change that. A line whose element `%% only` leaves out is a new
  element's: it creates it (goal-controller#518).

`%% severity [span] message` lines list **every** diagnostic the block must
give, where `span` is the text the diagnostic covers.

## Lines

An element line starts with its kind's word (`kindWord`: `goal`, `task`,
`behavioral_goal`), after its annotations, and names its element by the id
after it: the element's written id, or, for an element without one, the
first 8 characters of its piStar id (`shortId`), never by its position. A
line whose id names no element of the model creates one, and an element no
line names is removed (`notationEdits`): neither is a diagnostic.

| Message | Severity | Trigger |
| --- | --- | --- |
| `A property belongs under an element line` | error | a property line before any element line |
| `Not a property line` | error | a line under an element that is neither an element line nor a property line |
| `Not an element line` | error | a line at or left of the open element's indentation, where an element line would be, that reads as none (an element's text without an id, as TAS's Resources write it); it is no element's |
| `An element line starts with its kind: goal, task, resource` | error | an element line without a word: the dialect's kinds' words, in order |
| `colour is no kind of EdgeV2's: goal, task, resource` | error | a word that is no kind's word, followed by an id and `:`, at a line's head (a property key, `link` or `actor` there is its line's) |
| `G1 is a goal, not a task` | error | a word that isn't the kind of the element the id names: the line changes nothing |
| `A goal needs an id G… in EdgeV2` | error | an engine dialect (its kinds have prefixes): a line whose id is no runtime id (an element without one shows its piStar id's first characters) |
| `A task needs an id T… in EdgeV2: G7 is not one` | error | an engine dialect: a new line whose id is another kind's (its prefix says its kind) |
| `2 elements show the id 7857cb00: give each its own` | error | elements without a written id whose piStar ids start with the same 8 characters: the line names none of them |
| `Duplicate id G1` | error | a second line with the same id (with or without ids in the definition), a new line's included |
| `Duplicate id T1.1 under G4` | error | with `idScope: 'ancestorGoal'` (GODA): a second line with the same id under the same goal (the nearest goal line above, by indentation) |
| `AndRefinementLink 3f2a91c0 has lost its end 7857cb00: write it back, or remove the link in the diagram` (code `orphan`) | error | a link or refinement one of whose ends the model has lost (its element line was removed); on the line of its other end, else on the document's first line |

```goal-check edgeV2
  maintain x
goal G1: Deliver [G2]
  9 lives
9eba9454-0f53: battery msg
goal G2: Reach lab
goal G2: Reach it
G3: No word
colour G4: Paint
task G7: New one
goal G8: Fly back
%% only G1 G2
%% error [maintain x] A property belongs under an element line
%% error [9 lives] Not a property line
%% error [9eba9454-0f53: battery msg] Not an element line
%% error [G2] Duplicate id G2
%% error [G3: No word] An element line starts with its kind: goal, task, resource
%% error [colour] colour is no kind of EdgeV2's: goal, task, resource
%% error [G7] A task needs an id T… in EdgeV2: G7 is not one
```

`G8` is a new goal: its line creates it. In an engine dialect the id is the
runtime id the engine reads. An element without one (imported, or drawn in
the diagram) shows its piStar id's first characters, which no engine reads:

```goal-check edgeV2
goal G1: Deliver [G2]
task G2: Pick
goal 7857cb00: Bring back
%% error [task] G2 is a goal, not a task
%% error [7857cb00] A goal needs an id G… in EdgeV2
```

In a dialect without runtime ids (KAOS, NFR, piStar-ext), an element shows
the id its text gives it (`net_up: Internet connection available`), else
its short id, and a line names it by that id. Two elements whose short ids
are the same are named by neither line, until one is given an id:

```
behavioral_goal 7857cb00: Achieve [Manual Backup]
behavioral_goal 7857cb00: Maintain [Backup Copied]
```

reports `2 elements show the id 7857cb00: give each its own` on both ids.

Removing an element line removes its element, not its links: a refinement
or a dependency that loses an end stays in the model, an orphan (the
context's `orphans`, from goal-tree's view). Each is an error on the line
of its remaining end, with code `orphan` and the end as its `elementId`;
it blocks generation (lib's `refuseOnPropertyErrors`) until the line is
written back or the link removed in the diagram.

With `idScope: 'ancestorGoal'`, a task's id is scoped by its goal (GODA's
`G3_T1_1` and `G4_T1_1`):

```goal-check goda
goal G3: Collect data
  task T1.1: Read sensor
goal G4: Report
  task T1.1: Read sensor
  task T1.1: Read again
%% error [T1.1] Duplicate id T1.1 under G4
```

## What a line can't read

| Message | Severity | Trigger |
| --- | --- | --- |
| `Unexpected X` | error | the first token the line can't read (one per line) |
| `Not part of the goal language: 'c'` | error | a character no token matches |
| `The line ends before it is complete` | error | a line that stops early (an unclosed `[`) |
| `This annotation cannot be read` | error | an error inside an annotation |
| `This declaration cannot be read` | error | an error inside a declaration |
| `Not valid for this engine: …` | error | the engine's saved error, while the line is as saved (`saved`) |

```goal-check edgeV2
goal G1: Deliver [G2;;G3]
%% error [;] Unexpected ;
```

```goal-check edgeV2
goal G1: Deliver [G2;G3$]
%% error [$] Not part of the goal language: '$'
```

```goal-check edgeV2
goal G1: Deliver [G2;G3
%% error [3] The line ends before it is complete
```

```goal-check edgeV2+rationalAgents
{} goal G1: Deliver
%% error [{}] This annotation cannot be read
```

```goal-check edgeV2
resource R1: Battery {int 0..}
%% error [{int 0..}] This declaration cannot be read
```

## What the dialect allows

| Message | Severity | Trigger |
| --- | --- | --- |
| ``\`?\` is not an operator of Edge`` | error | a binary, prefix or postfix operator the dialect doesn't enable |
| ``A standalone \`+\` is not a construct of EdgeV2`` | error | a standalone symbol the dialect doesn't enable |
| ``\`skip\` is not an operand of …`` | error | `skip` in a dialect without it (`operand.skip`) |
| `A goal carries no annotations in EdgeV2` | error | an annotation on a kind that isn't `annotated` |
| `A task declares nothing on its line in EdgeV2` | error | a declaration on a kind that doesn't `declare` |
| `An element has one stereotype: this one is not read` | error | a second stereotype (likewise `…one tagged value…`) |
| ``\`FALLBACK\` takes 2 operands, not 1`` | error | a call with another number of operands than the catalog gives it |
| ``\`DM\` takes at least 2 operands, not 1`` | error | a variadic call with fewer operands than its minimum |
| `A cost is not part of EdgeV2` | error | a cost bracket (`[W = 0.1]`) in a dialect without `notation.leafBracket: 'cost'` |
| `Only a leaf's bracket holds a cost: a refined element's holds its notation` | error | a cost on an element with children |
| `A leaf's bracket holds its cost: W = 0.1, W = 0.1x or W = x` | error | a notation on a leaf, where leaves hold costs |

```goal-check edge
goal G1: Deliver [G2?G3]
%% error [?] `?` is not an operator of Edge
```

```goal-check edgeV2
goal G1: Deliver [+]
%% error [+] A standalone `+` is not a construct of EdgeV2
```

```goal-check edgeV2
<<action>> goal G1: Deliver
task T1: Pick {int}
%% error [<<action>>] A goal carries no annotations in EdgeV2
%% error [{int}] A task declares nothing on its line in EdgeV2
```

```goal-check edgeV2+rationalAgents
<<action>> <<other>> task T1: Pick
%% error [<<other>>] An element has one stereotype: this one is not read
```

A call is an operator like any other: off until a dialect enables it
(MutRoSe does), and then read with its number of operands:

```goal-check edgeV2
goal G1: Deliver [FALLBACK(G2,G3)]
%% error [FALLBACK] `FALLBACK` is not an operator of EdgeV2
```

```goal-check mutrose
goal G1: Deliver [AT1;FALLBACK(G2)]
%% error [FALLBACK] `FALLBACK` takes 2 operands, not 1
```

In GODA, `DM` takes two or more operands, a leaf's bracket is its cost, and
the spaces in a bracket aren't read (`notation.whitespace: 'ignore'`):
`T1.1 1` is `T1.11`, and a diagnostic points at it as written.

```goal-check goda
task T1: Process sample [DM(T1.1)]
task T1.1: Pick sample [W = 0.5x]
task T2: Store sample [W = 2]
%% children T2: T2.1
%% error [DM] `DM` takes at least 2 operands, not 1
%% error [W = 2] Only a leaf's bracket holds a cost: a refined element's holds its notation
```

```goal-check goda
task T1: Process [D M(T1.1 1,T1.2)]
%% children T1: T1.11
%% error [T1.2] Not a child of this element
```

```goal-check edgeV2
task T1: Pick sample [W = 1]
%% error [W = 1] A cost is not part of EdgeV2
```

## The notation against the model

| Message | Severity | Trigger |
| --- | --- | --- |
| `Not a child of this goal` (`notAChild`) | error | a notation naming an element that isn't the goal's child |
| `Missing from the notation: G3` (`missingFromNotation`) | warning | a child the notation doesn't name |
| `Sequence needs AND refinement links, but this goal is refined with OR links (the engine ignores the notation)` (`relationMismatch`) | error | a construct whose `relation` contradicts the goal's links |

```goal-check edgeV2
goal G1: Deliver [G2;T9]
%% children G1: G2 G3
%% error [T9] Not a child of this goal
%% warning [G2;T9] Missing from the notation: G3
```

```goal-check edgeV2
goal G1: Deliver [G2;G3]
%% relation G1: or
%% construct G1: sequence
%% error [G2;G3] Sequence needs AND refinement links, but this goal is refined with OR links (the engine ignores the notation)
```

MutRoSe rejects a sequential or fallback annotation on an OR-refined goal:

```goal-check mutrose
goal G1: Deliver [G2;AT1]
%% relation G1: or
%% construct G1: sequential
%% error [G2;AT1] Sequential needs AND refinement links, but this goal is refined with OR links (MutRoSe rejects it)
```

## Properties

| Message | Severity | Trigger |
| --- | --- | --- |
| `Not read for a goal` | warning | a key the kind doesn't read |
| the property's `notApplying` (`Only read when type is maintain`), else `Not read with these properties` | warning | a property set where it doesn't apply (`applies`) |
| the engine check's message | error | the named `check` rejects the value (`runCheck`); it is run only on a value that reads as its type, and its message comes before the value check's |

```goal-check edgeV2
goal G1: Deliver
  maintain battery > 20
  colour red
%% warning [colour] Not read for a goal
%% warning [maintain battery > 20] Only read when type is maintain
```

## Values

These are reported where the property is written: a property line, a
declaration or an annotation, or a whole inspector field. When the engine
has a check for the property and it rejects the value, its message comes
first.

| Message | Severity | Type, trigger |
| --- | --- | --- |
| `Not an integer: x` | error | `int` |
| `At least 0`, `At most 9` | error | `int` with `min`/`max` |
| `Not a number: x` | error | `number` |
| `true or false, not 1` | error | `bool` |
| `One of maintain, not achieve` | error | `enum` that isn't `open` |
| `Not a condition: …` | error | `assertion` that doesn't parse |
| `Starts with assertion condition or assertion trigger` | error | `assertion` with `prefixes`, without one of them |
| `No prefix: assertion trigger is not read` | error | `assertion` without `prefixes`, with a prefix |
| `A condition after assertion trigger` | error | a prefix alone |
| `Not an integer: 0.5` | error | `assertion` without `decimals`, comparing with a decimal |
| `A boolean is compared with =, not != (x != false)` | error | `assertion` without `booleanInequality`, comparing a boolean with `!=` |
| `A name is compared with a number here, not 3 > x` | error | `assertion` without `functions`, comparing anything but a name and a number |
| `Not an expression: …` | error | `expression` that doesn't parse |
| `next is not a function here (previous)` | error | `expression`, or `assertion` with `functions`, calling a function it doesn't declare |
| `previous takes 1 argument, not 2` | error | a call with another number of arguments than its function declares |
| `R9 is not an element of this model`, `G2 is a goal, not a resource` | error | `expression` naming an id that is no element, or one of a kind it doesn't `resolve` |
| `x is not a resource of this model or a known variable` | info | `assertion` naming neither an element of a kind it `resolves` nor a workbench variable (with `declaresVariables`, any name that isn't an element is a variable) |
| `Element ids, comma-separated (G2, G5)` | error | `refList` that doesn't parse |
| `G9 is not an element of this model` | error | `refList` naming a missing element |
| `T1 is a task, not a goal` (`… not a goal or task` for several kinds) | error | `refList` naming another kind |
| `name:value pairs, comma-separated (x:3, y:2)` | error | `pairList` that doesn't parse |
| `t: Not an integer: x` | error | `pairList` value not of its type |
| `Names, comma-separated (cost, roomTemperature)` | error | `nameList` that doesn't parse |
| `An element's id (G1), not G1, G2` | error | `reference` that is neither one id, as a `refList` reads them, nor the piStar id of an element of the model |
| `G9 is not an element of this model`, `A1 is a kaos.Agent, not a kaos.BehavioralGoal` | error | `reference` naming a missing element, or one of a kind it doesn't take |
| `A probability in [0, 1] (0.8, .8 or 80%), not 120%` | error | `probability` that is neither a decimal nor a percentage in [0, 1] |
| `Quantiles don't decrease: 0.1 after 0.3`, `pert[min, mode, max]: min ≤ mode ≤ max, not …`, `No distribution gamma: …`, `uniform[…] takes 2 parameters, not 1` | error | `distribution` that isn't one of its forms, or whose parameters aren't its form's |

```goal-check edgeV2
goal G1: Deliver
  type achieve
  maxRetries -1
  utility lots
  assertion battery >
  dependsOn G9, T1
  variables t:x
task T1: Pick
%% error [type achieve] One of maintain, not achieve
%% error [maxRetries -1] At least 0
%% error [utility lots] Not a number: lots
%% error [assertion battery >] Not a condition: Expecting end of file but found `>`.
%% error [dependsOn G9, T1] G9 is not an element of this model
%% error [variables t:x] t: Not an integer: x
```

```goal-check edgeV2
goal G1: Deliver
  dependsOn T1
  variables t
task T1: Pick
%% error [dependsOn T1] T1 is a task, not a goal
%% error [variables t] name:value pairs, comma-separated (x:3, y:2)
```

```goal-check edgeV2
resource R1: Alarm {bool = 1}
%% error [{bool = 1}] true or false, not 1
```

The workbench's variables are those the model's conditions name, so a name
is reported until the model is analysed with it (`%% variables` lists them):

```goal-check edgeV2
task T1: Pick
  assertion R1=true & charged & chargd
resource R1: Battery {bool = true}
%% variables charged
%% info [assertion R1=true & charged & chargd] chargd is not a resource of this model or a known variable
```

GODA's context conditions (`creationProperty`, CtxRegex.g4) start with a
prefix and may compare with decimals; Edge's conditions take neither. Their
names are the context's meta-variables, declared by their use
(`declaresVariables`), so they need no workbench variable:

```goal-check goda
task T1: Pick
  creationProperty assertion trigger battery > 0.5 & ready = true
task T2: Drop
  creationProperty battery > 1
task T3: Hold
  creationProperty assertion trigger
task T4: Wait
  creationProperty assertion condition docked != false
%% error [creationProperty battery > 1] Starts with assertion condition or assertion trigger
%% error [creationProperty assertion trigger] A condition after assertion trigger
```

```goal-check edgeV2
task T1: Pick
  assertion x > 0.5
task T2: Drop
  assertion assertion trigger x > 1
task T3: Hold
  assertion x != false
%% variables x
%% error [assertion x > 0.5] Not an integer: 0.5
%% error [assertion x != false] A boolean is compared with =, not != (x != false)
%% error [assertion assertion trigger x > 1] No prefix: assertion trigger is not read
```

## The engine's reader

`goalNameParserFor(dialect)` reports a goal text's problems to
`onSyntaxError`, or to the console as `line …`, in ANTLR's format: the
1-based line and 0-based column, then the message.

- Syntax errors are reported with the parser's message.
- A disabled operator is reported as ``1:21 `?` is not an operator of
  Edge``, and the rest of the text is still read.
