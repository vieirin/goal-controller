# The goal language: diagnostics

This page catalogues every message `documentDiagnostics` and
`fieldDiagnostics` report. A notation's problems (`notAChild`,
`missingFromNotation`, `relationMismatch`, `notInDiagram`) take their text
and severity from the dialect's `problems`. Edge's and edgeV2's are shown
here.

Each example is a `goal-check <dialect>` block, and
`packages/lib/test/dialect/docs.test.ts` validates it. Its model is its
lines' elements:

- each element's kind comes from its id's prefix;
- an element's children are the ids its notation names;
- `%% only`, `%% children`, `%% relation`, `%% construct` and `%% variables`
  lines change that.

`%% severity [span] message` lines list **every** diagnostic the block must
give, where `span` is the text the diagnostic covers.

## Lines

| Message | Severity | Trigger |
| --- | --- | --- |
| `A property belongs under an element line` | error | a property line before any element line |
| `Not a property line` | error | a line under an element that is neither an element line nor a property line |
| `Not an element line` | error | a line at or left of the open element's indentation, where an element line would be, that reads as none (an element's text without an id, as TAS's Resources write it); it is no element's |
| `Duplicate id G1` | error | a second line with the same id (with or without ids in the definition) |
| `Duplicate id T1.1 under G4` | error | with `idScope: 'ancestorGoal'` (GODA): a second line with the same id under the same goal (the nearest goal line above, by indentation) |
| `Add this element in the diagram` (`notInDiagram`) | error | a line whose id isn't an element of the model (without ids: no element's name starts with it) |
| `N lines for M elements: each line is an element's, in order (add or remove elements in the diagram)` | error | a plain document whose line count isn't its element count |

```goal-check edgeV2
  maintain x
G1: Deliver [G2]
  [G2]
9eba9454-0f53: battery msg
G2: Reach lab
G2: Reach it
G7: New one
%% only G1 G2
%% error [maintain x] A property belongs under an element line
%% error [[G2]] Not a property line
%% error [G2] Duplicate id G2
%% error [G7] Add this element in the diagram
%% error [9eba9454-0f53: battery msg] Not an element line
```

In a dialect without ids, a line's optional id names the element whose name
starts with it, and a line without one is the element at its position
(`%% model` lists the elements, in order):

```goal-check rationalAgents
<<goal-based>> Robot
  G1: Deliver sample
  G1: Deliver it again
  G7: Unknown
%% model <<goal-based>> Robot | G1: Deliver sample | Plan it | Other
%% error [G1] Duplicate id G1
%% error [G7] Add this element in the diagram
```

With `idScope: 'ancestorGoal'`, a task's id is scoped by its goal (GODA's
`G3_T1_1` and `G4_T1_1`):

```goal-check goda
G3: Collect data
  T1.1: Read sensor
G4: Report
  T1.1: Read sensor
  T1.1: Read again
%% error [T1.1] Duplicate id T1.1 under G4
```

```goal-check rationalAgents
Robot
  T1: Plan it
  G1: Deliver sample
Other
%% model Robot | G1: Deliver sample | T1: Plan it | Other
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
G1: Deliver [G2;;G3]
%% error [;] Unexpected ;
```

```goal-check edgeV2
G1: Deliver [G2;G3$]
%% error [$] Not part of the goal language: '$'
```

```goal-check edgeV2
G1: Deliver [G2;G3
%% error [3] The line ends before it is complete
```

```goal-check edgeV2+rationalAgents
{} G1: Deliver
%% error [{}] This annotation cannot be read
```

```goal-check edgeV2
R1: Battery {int 0..}
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
G1: Deliver [G2?G3]
%% error [?] `?` is not an operator of Edge
```

```goal-check edgeV2
G1: Deliver [+]
%% error [+] A standalone `+` is not a construct of EdgeV2
```

```goal-check edgeV2
<<action>> G1: Deliver
T1: Pick {int}
%% error [<<action>>] A goal carries no annotations in EdgeV2
%% error [{int}] A task declares nothing on its line in EdgeV2
```

```goal-check edgeV2+rationalAgents
<<action>> <<other>> T1: Pick
%% error [<<other>>] An element has one stereotype: this one is not read
```

A call is an operator like any other: off until a dialect enables it
(MutRoSe does), and then read with its number of operands:

```goal-check edgeV2
G1: Deliver [FALLBACK(G2,G3)]
%% error [FALLBACK] `FALLBACK` is not an operator of EdgeV2
```

```goal-check mutrose
G1: Deliver [AT1;FALLBACK(G2)]
%% error [FALLBACK] `FALLBACK` takes 2 operands, not 1
```

In GODA, `DM` takes two or more operands, a leaf's bracket is its cost, and
the spaces in a bracket aren't read (`notation.whitespace: 'ignore'`):
`T1.1 1` is `T1.11`, and a diagnostic points at it as written.

```goal-check goda
T1: Process sample [DM(T1.1)]
T1.1: Pick sample [W = 0.5x]
T2: Store sample [W = 2]
%% children T2: T2.1
%% error [DM] `DM` takes at least 2 operands, not 1
%% error [W = 2] Only a leaf's bracket holds a cost: a refined element's holds its notation
```

```goal-check goda
T1: Process [D M(T1.1 1,T1.2)]
%% children T1: T1.11
%% error [T1.2] Not a child of this element
```

```goal-check edgeV2
T1: Pick sample [W = 1]
%% error [W = 1] A cost is not part of EdgeV2
```

## The notation against the model

| Message | Severity | Trigger |
| --- | --- | --- |
| `Not a child of this goal` (`notAChild`) | error | a notation naming an element that isn't the goal's child |
| `Missing from the notation: G3` (`missingFromNotation`) | warning | a child the notation doesn't name |
| `Sequence needs AND refinement links, but this goal is refined with OR links (the engine ignores the notation)` (`relationMismatch`) | error | a construct whose `relation` contradicts the goal's links |

```goal-check edgeV2
G1: Deliver [G2;T9]
%% children G1: G2 G3
%% error [T9] Not a child of this goal
%% warning [G2;T9] Missing from the notation: G3
```

```goal-check edgeV2
G1: Deliver [G2;G3]
%% relation G1: or
%% construct G1: sequence
%% error [G2;G3] Sequence needs AND refinement links, but this goal is refined with OR links (the engine ignores the notation)
```

MutRoSe rejects a sequential or fallback annotation on an OR-refined goal:

```goal-check mutrose
G1: Deliver [G2;AT1]
%% relation G1: or
%% construct G1: sequential
%% error [G2;AT1] Sequential needs AND refinement links, but this goal is refined with OR links (MutRoSe rejects it)
```

## Properties

| Message | Severity | Trigger |
| --- | --- | --- |
| `Not read for a goal` | warning | a key the kind doesn't read |
| the property's `notApplying` (`Only read when type is maintain`), else `Not read with these properties` | warning | a property set where it doesn't apply (`applies`) |
| the engine check's message | error | the named `check` rejects the value (`runCheck`) |

```goal-check edgeV2
G1: Deliver
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
| `x is not a resource of this model or a known variable` | info | `assertion` naming neither an element of a kind it `resolves` nor a workbench variable (with `declaresVariables`, any name that isn't an element is a variable) |
| `Element ids, comma-separated (G2, G5)` | error | `refList` that doesn't parse |
| `G9 is not an element of this model` | error | `refList` naming a missing element |
| `T1 is a task, not a goal` | error | `refList` naming another kind |
| `name:value pairs, comma-separated (x:3, y:2)` | error | `pairList` that doesn't parse |
| `t: Not an integer: x` | error | `pairList` value not of its type |

```goal-check edgeV2
G1: Deliver
  type achieve
  maxRetries -1
  utility lots
  assertion battery >
  dependsOn G9, T1
  variables t:x
T1: Pick
%% error [type achieve] One of maintain, not achieve
%% error [maxRetries -1] At least 0
%% error [utility lots] Not a number: lots
%% error [assertion battery >] Not a condition: Expecting end of file but found `>`.
%% error [dependsOn G9, T1] G9 is not an element of this model
%% error [variables t:x] t: Not an integer: x
```

```goal-check edgeV2
G1: Deliver
  dependsOn T1
  variables t
T1: Pick
%% error [dependsOn T1] T1 is a task, not a goal
%% error [variables t] name:value pairs, comma-separated (x:3, y:2)
```

```goal-check edgeV2
R1: Alarm {bool = 1}
%% error [{bool = 1}] true or false, not 1
```

The workbench's variables are those the model's conditions name, so a name
is reported until the model is analysed with it (`%% variables` lists them):

```goal-check edgeV2
T1: Pick
  assertion R1=true & charged & chargd
R1: Battery {bool = true}
%% variables charged
%% info [assertion R1=true & charged & chargd] chargd is not a resource of this model or a known variable
```

GODA's context conditions (`creationProperty`, CtxRegex.g4) start with a
prefix and may compare with decimals; Edge's conditions take neither. Their
names are the context's meta-variables, declared by their use
(`declaresVariables`), so they need no workbench variable:

```goal-check goda
T1: Pick
  creationProperty assertion trigger battery > 0.5 & ready = true
T2: Drop
  creationProperty battery > 1
T3: Hold
  creationProperty assertion trigger
T4: Wait
  creationProperty assertion condition docked != false
%% error [creationProperty battery > 1] Starts with assertion condition or assertion trigger
%% error [creationProperty assertion trigger] A condition after assertion trigger
```

```goal-check edgeV2
T1: Pick
  assertion x > 0.5
T2: Drop
  assertion assertion trigger x > 1
T3: Hold
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
