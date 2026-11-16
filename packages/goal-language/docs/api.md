# The goal language: API

This page lists the public exports of `@goal-controller/goal-language` and of
`@goal-controller/goal-language/light`. Signatures are simplified: `D` is a
dialect definition (`@goal-controller/dialect`'s `AnyDialect`), and readonly
modifiers are left out. Examples tagged `goal…` run in
`packages/lib/test/dialect/docs.test.ts`.

## Entry points

| Import | ESM (`import`) | CommonJS (`require`) | Holds |
| --- | --- | --- | --- |
| `@goal-controller/goal-language` | `out/esm/index.js` | `out/cjs/index.cjs` (Langium bundled in, ~1 MB) | everything below |
| `@goal-controller/goal-language/light` | `out/esm/light.js` | `out/cjs/light.cjs` (a few kB) | the [catalog](#catalog) and the [writers](#writers): no parser, no Langium |

`@goal-controller/dialect` is a dependency, and it stays external to both
bundles.

## Parsing

| Export | Signature | Example |
| --- | --- | --- |
| `parseElementLine` | `(text) => Parsed<ElementLineData \| null>` | `parseElementLine('G1: A [G2;G3]').value.notation` |
| `parseElementLineIn` | `(dialect, text) => Parsed<ElementLineData \| null>` | the line as its dialect reads it: without the spaces in its bracket under `notation.whitespace: 'ignore'` |
| `withoutBracketSpaces` | `(text) => { text, origin(offset) }` | GODA's `removeBlankSpaceInBrackets`, and where each offset was written |
| `parseCondition` | `(text) => Parsed<{ prefix, tree }>` | `parseCondition('assertion trigger x > 1').value.prefix` → `'assertion trigger'` |
| `parseDocument` | `(text, { ids? = true, prefixes?, keys? }) => Parsed<DocumentLine[]>` | `parseDocument(doc, { ids: false, keys: propertyKeysOf(d) })` for a plain document, its property lines read by its keys |
| `parseValue` | `(type: ValueType, text) => Parsed<ValueData[type]>` | `parseValue('refList', 'G2, G5').value` → `['G2', 'G5']`, a [`RefList`](#value-types) |
| `readProperties` | `(D, { element \| actor \| link: kind }, stored) => { values, text, keyed }` | a whole record read against a dialect (goal-controller#187): `readProperties(edgeV2, { element: 'task' }, { maxRetries: '3' })` → `{ values: { maxRetries: 3 }, text: { maxRetries: '3' }, keyed: {} }`; only the keys the dialect gives the kind, a value with an error unset in `values`; a keyed property's names' values in `keyed`, by its key, then by name (branded by its target, goal-controller#354) |
| `keyedKeyOf` | `(text) => { key, name } \| null` | a keyed key on disk read by the grammar's `PropertyKey` (goal-controller#354): `keyedKeyOf('Probability[e1]')` → `{ key: 'Probability', name: 'e1' }`; null for any other text |
| `propertyOf` | `(D, kind, key) => PropertyDefinition \| undefined` | the property a kind's key is: its own, or the keyed property of `Probability[e1]` |
| `readExpression` | `(text) => Expression \| null` | `readExpression('2 * R1')` → `{ kind: 'binary', operator: '*', left: { kind: 'number', value: '2' }, right: { kind: 'ref', id: 'R1' } }`; null when empty or not an expression |
| `readAssertion` | `(text) => Assertion<AssertionReading> \| null` | an assertion (its prefix aside) whose comparisons are `{ kind: 'comparison', operator, left, right }`, both sides `ExpressionTree`s |
| `assertionMembers` | `(tree) => { ref, member }[]` | the members a condition reads (`room.clean`, `tank.level < 3`, `room.clean = true`), in order (goal-controller#135); an `ExpressionTree`'s member is `{ kind: 'member', ref, member }` |
| `errorText` | `(error: GoalSyntaxError) => string` | `` `1:10 Unexpected …` `` (1-based line, 0-based column) |
| `toRtTree`, `toAssertionTree`, `toElementLine` | Langium AST → plain data | for a Langium service's own AST |
| `goalServices` | `() => GoalCoreServices` | the shared Langium services, created on first use |
| `createGoalCoreServices`, `parseWith`, `START_RULE`, `GoalLexer`, `syntaxErrorsOf` | Langium-level | a language server, or one rule on its own |

`Parsed<T>` is `{ value: T; errors: GoalSyntaxError[] }`, and a
`GoalSyntaxError` is `{ line, column, offset, length, message }`. These
functions return plain data, with no Langium types:

- `RtTree` is one of `ref`, `skip`, `standalone`, `group`, `prefix`,
  `postfix` (with `argument`) or `binary`;
- `AssertionTree` is one of `and`, `or`, `not`, `paren`, `assign`,
  `compare`, `var` or `bool`;
- `ValueData[type]` is what a value type reads into: `int` and `number` a
  `number`, `bool` a `boolean`, `text` and `enum` a string, `refList` a
  `RefList` (its ids), `pairList` a `PairList` (its `{ name, value }`
  pairs), `nameList` a `NameList` (its names), `assertion` an `Assertion`, `expression` an `Expression` (each its
  tree, with its [members](#value-types)), `annotatedName` an
  `ElementLineData`, `ocl` its tokens; `null` (`[]` for a list) when empty.
  `ValueDataOf<config>` is the same for a dialect's value config: an enum is
  its options' values (when the definition keeps their literal types, as
  `property.enum` does) or any word when it is `open`; a `reference` is the
  id written, a `formula` its text, a `probability` its number in [0, 1],
  a `distribution` the dialect package's `Distribution` (goal-controller#190),
  and a `pairList` a `PairList` of its value type (`PairList<number>` for
  `int` and `number`, `PairList<string>` for `text`; a member that isn't
  of its type leaves the whole value unset, goal-controller#235).
  `PropertyValues<properties>` is a record's (`readProperties`'s `values`):
  a conditional value is either of its two configs' data.
- `ElementLineData` is `{ id, name, annotations, notation, cost,
  declaration }`. `cost` is a leaf's bracket when it holds a cost
  (`[W = 0.5x]`: `{ value: '0.5', variable: 'x' }`), and `notation` is then
  null.
  For an annotated name (`parseValue('annotatedName', …)`, a plain
  document's lines), `id` is the optional id it starts with, or `''`.

```goal accept
G1: Deliver sample [G2;G3@2]
```

```goal-value annotatedName accept
<<goal-based>> G1: Deliver sample
```

## Value types

What the language reads (`parseValue`, `readAssertion`, `readExpression`,
`readProperties`, an element line's `notation`) is its plain data (a
`kind`-discriminated tree, an array) with its operations on it as members
(goal-controller#188): `props.assertion.variables()`. The members aren't
enumerable, so JSON, a structured clone and a deep comparison see the data
only, and the snapshot script snapshots it. An operation takes the value,
never its text; one that needs the dialect takes it as an argument. Every
type has `text()`, its value as the language writes it (it reads back as the
same value), and `refs()` where it can name elements. `asAssertion(tree)`,
`asExpression`, `asNotation`, `asRefList`, `asNameList` and `asPairList` give stored data its
members (once: a value that has them is returned as it is).

### `Assertion` (`AssertionTree` and its members)

| Member | Gives |
| --- | --- |
| `tree` | the data: the tree itself |
| `text()` | `previous(t) < 18 & !on`, its groups its `paren` nodes |
| `variables()` | `{ name, value }[]`: the names it reads, in order; `x = true` sets a value each time, any other use names it once |
| `comparisons()` | its comparisons of expressions and its calls, in order |
| `expressions()` | the expressions those hold: each side, a call whole |
| `asReading()` | every comparison's sides as expressions (`x > 3`: a `var` and a `number`), as `readAssertion` reads it |
| `refs()` | the element ids it names (`G1 > 2`, `T1.1.done`), each once |

### `Expression` (`ExpressionTree` and its members)

| Member | Gives |
| --- | --- |
| `tree` | the data: the tree itself |
| `text()` | `0.5 + 0.9 * previous(t)`, with the parentheses its shape needs |
| `nodes()` | every node, each before its operands (what a check walks) |
| `calls()` | its calls, outermost first |
| `refs()` | the element ids it names (a member's reference too), each once |

### `RefList` (`string[]` and its members)

| Member | Gives |
| --- | --- |
| `ids` | the data: the ids themselves |
| `text()` | `G2, G5` |
| `refs()` | its ids |

### `NameList` (`string[]` and its members)

Names that aren't element ids (goal-controller#286): it has no `refs()`.

| Member | Gives |
| --- | --- |
| `names` | the data: the names themselves |
| `text()` | `cost, roomTemperature` |

### `PairList<V>` (`{ name, value: V }[]` and its members)

`V` is its value type's: a number for an `int` or a `number` list read
against its config (`readProperties`), a string for a `text` list and for
one parsed without a config (`parseValue('pairList', …)`).

| Member | Gives |
| --- | --- |
| `pairs` | the data: the pairs themselves |
| `text()` | `x:3, y:2` |
| `get(name)` | the first pair of that name's value (a `V`), or `undefined` |
| `names()` | its pairs' names, in order |

### `Notation` (`RtTree` and its members)

An element line's notation (`ElementLineData.notation`).

| Member | Gives |
| --- | --- |
| `tree` | the data: the tree itself |
| `text()` | the notation with no spaces: `G2@2->G3` (an operand's text in `modifiers`) |
| `operandIds()` | its operand's ids through operators (a group's and a call's own aren't its parent's) |
| `refs()` | every element id it names, in the order written, through groups and calls |
| `execution(dialect)` | `{ type, ids, modifiers }` in that dialect (`executionOf`), or null |
| `reading(dialect)` | what it says in that dialect (`readNotation`) |

`isElementId(name)` says whether a name, as an assertion writes it, is an
element's id (the lexer reads `G1`, `T1.1`, `GX` as ids; `E1`, `x` are names).

**Deprecated free functions** (one release, then removed): `assertionText`,
`comparisonsOf`, `assertionExpressions`, `expressionText`, `expressionNodes`,
`rtText`, `operandIds`, `notationRefs`, `executionOf` (the members above) and
`assertionVariables(text)`, which parses the text again (an assertion's
`variables()` reads the value).

## Reading a notation in a dialect

| Export | Signature | What it gives |
| --- | --- | --- |
| `goalNameParserFor` | `(dialect: ReadingDialect) => GoalNameParser` | every engine's goal-text reader: `({ goalText, onSyntaxError? }) => { id, goalName, executionDetail }`; reports syntax errors and disabled operators |
| `executionOf` (deprecated: `notation.execution(dialect)`) | `(dialect, tree) => ExecutionDetail \| null` | `{ type, ids, modifiers }`: a standalone construct, or the outermost enabled operator's construct with its operands and the modifiers that apply |
| `readNotation` | `(dialect, tree) => NotationReading` | `{ constructs, standalone, modifiers, disabled }`: each construct's outermost operands, standalone constructs, modifier arguments by operand text, disabled operators |
| `isEnabled` | `(dialect, symbol, form) => boolean` | the one rule for whether a dialect enables an operator |

The execution detail is typed by the dialect: `goalNameParserFor(edgeV2)`
gives `ExecutionDetailOf<typeof edgeV2>`, whose `type` is one of edgeV2's
constructs and whose `modifiers` has its modifiers (`retry`), so a misspelt
name doesn't compile. goal-tree's `createEngineMapper({ dialect })` passes
that type to each element entry's `mapProps`. `ExecutionDetail<C, M>` is the generic shape.

`ReadingDialect` is `{ name, notation? }`. A dialect without a notation
(`{ name: 'SLEEC' }`) reads ids and names only. What each reader gives
(`type(ids) modifier{operand:argument}`):

```goal-reads edgeV2
G1: Deliver [G2;G3] ⇒ sequence(G2, G3)
G1: Deliver [G2@3->G3] ⇒ degradation(G2, G3) retry{G2:3}
G1: Deliver [G2@3;G3] ⇒ sequence(G2, G3)
G1: Deliver [G2?G3] ⇒ choice(G2, G3)
G1: Deliver [G2|G3;T4] ⇒ sequence(G2, G3, T4)
G1: Deliver ⇒ none
```

```goal-reads edge
G1: Deliver [+] ⇒ choice()
G1: Deliver [G2?G3] ⇒ none
G1: Deliver [G2#G3] ⇒ interleaved(G2, G3)
```

## The Notation view

A Notation document's element line is `kind id: name …`
(goal-controller#518): its kind's word, the id it shows and its text. Its
id names its element, never its position; a line naming no element creates
one, an element no line names is removed (its links stay: orphans).

| Export | Signature | What it does |
| --- | --- | --- |
| `notationDocument` | `(D, tree: DocumentTree) => { text, ids }` | writes the model as a document (`documentLine` per element); `ids`: the key of the element each line is or is under, for every element, property and link line (actor lines, at the top, have none) |
| `notationEdits` | `(D, text, tree, { newId?, base? }) => NotationEdit[]` | what a document changes: element texts, properties set or removed, elements created and removed (below), read from a line diff between `base` (default: the document written from `tree`) and `text`; `newId` gives a new element's piStar id (default: a random UUID) |
| `notationReading` | `(D, text, tree, { newId?, base? }) => { edits, base }` | `notationEdits`, and the text the model has once they are made (`DocumentBase`: its lines, each line's element by piStar id, each line's role): an editor that keeps what is typed reads its next text against it |
| `documentBase` | `(D, tree) => DocumentBase` | the document written from a tree, as a base |
| `contextFromView` | `(D, tree, variables) => DefinitionContext` | what the text is checked against: each element with its `iStarId` and `hasId` (whether its text gave it an id), and the tree's `orphans` when it has any |
| `readLine` | `(D, line) => LineReading` | one line: an element (with spans for the word, id, annotations, notation refs and operators, declaration) or a property |
| `readHead` | `(D, line) => { word, wordSpan, kind, id, idSpan } \| null` | an element line's head: its kind word (`kind` null: no kind's), and the id before its colon (null: none); null: no head ([reference.md](reference.md#the-kind-word)) |
| `headWordAt` | `(line, offset) => { from, typed } \| null` | where a kind word is being typed: the cursor at a line's head, after its indentation and annotations |
| `lineKeyWords` | `(D) => Set<string>` | the words a line may start with that are no kind's: its property keys, `link`, `actor` |
| `lineIdentities` | `(D, Identified[]) => { resolve(indent, id), element(key) }` | which element each element line names, read in order: `{ key }`, `{ ambiguous: keys }` (several show that id) or null (none: a new element) |
| `identifiedOfContext`, `contextKeyOf` | `(context) => Identified[]`, `(context, id) => key \| null` | a context's elements as lines name them; the key of the element an id names in a context (its key, or the one element that shows it) |
| `lineId`, `readPropertyLine` | `(D, line) => …` | a line's id; a property line's key and value |
| `annotatedProperties` | `(reading) => DeclaredProperties` | what a line's annotations set (the first of each kind) |
| `nodeLine` | `(D, node) => string` | a node's element text, as its name stores it (no word, no short id) |
| `writtenName`, `unquotedName` | `(D, name) => string`, `(written) => string \| null` | a name as a line without ids writes it: quoted where it would read as a property line, or is quoted (goal-controller#138); the name in a quoted one |
| `isValidName` | `(D, kind, name) => boolean` | whether a name can be written on that kind's line |
| `operatorsFor` | `(D & WithNotation) => { constructs, arguments }` | the inspector's operator buttons, for the enabled operators only |

`ElementReading` (an element `LineReading`) has a `word`, `{ text, kind,
span }`: the word as written and the kind it is (null: no kind's), or null
for a line without one; `id` and `idSpan` are the written id, any
`[A-Za-z0-9_][A-Za-z0-9_.-]*`, and `text` runs from the id to the
declaration (`7857cb00: Achieve [Manual Backup]`).

A `NotationEdit` is one of:

- `{ iStarId, text }`: an element's text (a line showing its short id
  stores none);
- `{ iStarId, key, value }`, `{ link, key, value }`, `{ actor, key, value }`:
  a property set, or removed (`value` null);
- `{ create: { iStarId, kind, text, properties, after, line, writeId } }`: an
  element a line adds, of the iStar kind its word says (`istarKindOf`: an
  engine's `task` is `istar.Task`), its annotations', declaration's and
  property lines' properties, `after` the key of the element line above it
  (its container is that one's), `line` its index (from 0), and `writeId`
  the short id the editor writes on a line that had no id (null: it had);
- `{ remove: iStarId, writtenId? }`: an element no line names any more;
  `writtenId` the id its author wrote, which the workbench keeps on its
  orphan links (`MISSING_END_ID_KEYS`) so that writing its line again
  repairs them (a `create` with its piStar id, and `{ link, key, value:
  null }` clearing what was kept).

What an edit means is decided by six rules, read from the line diff and
stated in `notation/document.ts`'s header: an unchanged line keeps its
element; a new property line is the element line's above it, by
indentation; a property line removed unsets, one changed in place sets; an
element line replaced in place (same kind, the id alone or the name alone
changed) is a rename or relabel of its element; a line only added creates,
an element no line names is removed; a line being typed or in error (no
word or no kind's, a second line with an element's id, another kind's word
on an element's line, in an engine dialect a new id not its word's kind's)
edits nothing, changes what no other line means, and holds the lines it
replaces.

`DefinitionContext.orphans` (the dialect package's `DocumentOrphan[]`, from
`DocumentTree.orphans`) are the links missing an end: `{ iStarId, kind,
source, target, missing }`, `source` and `target` the keys of the ends
still listed (or null), `missing` the piStar ids of those the model lacks.
The validator reports each (code `orphan`).

## Validation and completion

| Export | Signature | What it does |
| --- | --- | --- |
| `documentDiagnostics` | `(D, text, context, { runCheck?, saved? }) => Diagnostic[]` | checks a whole document; see [diagnostics.md](diagnostics.md) |
| `fieldDiagnostics` | `(D, context, id, key, value, runCheck) => Diagnostic[]` | checks one inspector field |
| `checkContextOf` | `(context, self) => CheckContext` | what a named check is given in a model: `self`, `kindOf` (the dialect's kinds, as iStar's: `istar.Goal`), and `elements` (every element's kind, properties, children and `x`); `NamedCheck` is `({ props, raw, kind }, CheckContext) => string \| null` |
| `checkInputOf` | `(D, owner, stored) => AnyCheckInput` | what every check on an element (`{ element: 'goal' }`), an actor or a link is given: `readProperties`'s `props` and `raw`, and its `kind` (goal-controller#222) |
| `parses` | `(input, key) => boolean` | whether a key's value reads as its type (unset reads): a check is run on a key only then |
| `valueProblem` | `(config: ValueConfig, text, context?) => string \| null` | whether a value fits its type, options, bounds and element kind |
| `completionsAt` | `(D, text, pos, context) => CompletionResult \| null` | at a line's head: the kinds' words (`keyword`, the kind as `detail`); in a notation: children, `skip` and the enabled operators; on a property line: the keys not set yet |
| `fieldCompletionsAt` | `(D, config, text, pos, context, elementId?) => CompletionResult \| null` | ids (`refList`), names and declared functions (`assertion`, `expression`), and in an `ocl` value the operations after `->` and the names in scope of the element (see [reference.md](reference.md#ocl)) |
| `fieldHover` | `(D, context, id, key, text, pos) => Hover \| null` | in an inspector field: the element an id or a name is (`**R1**: heater (a resource of this model)`), a variable, a declared function |
| `constructHint` | `(D, construct) => string \| null` | `Sequence — does every child, one after another` |

A `Diagnostic` is `{ from, to, severity, message }`, with offsets into the
text. A completion is `{ label, type, detail?, snippet? }`: `snippet` is
what to insert instead of the label, in LSP snippet syntax (the server sends
it as a snippet; CodeMirror's `snippetCompletion` reads it as it is). `runCheck(check, input, self)` runs an engine's named checks, given the
record `checkInputOf` reads once for every check on an element (or actor, or
link); a check on a key whose value doesn't read as its type is not run (the
value check says what is wrong).

## Highlighting

| Export | Signature | What it does |
| --- | --- | --- |
| `highlightLine` | `(D, line) => Highlight[]` | one document line, from the lexer's tokens; an element line's kind word is a `keyword`; a property value is highlighted by its type |
| `highlightValue` | `(config, text, offset?) => Highlight[]` | one value |

A `Highlight` is `{ from, to, style }`, where `style` is one of
`labelName`, `propertyName`, `string`, `punctuation`, `bracket`, `brace`,
`paren`, `operator`, `keyword`, `number`, `typeName`, `atom`, `meta` or
`variableName`. These are the names of CodeMirror's highlight tags.

## Writers

These are also in `/light`.

| Export | Signature | Example |
| --- | --- | --- |
| `elementLine` | `(D, { id, name, notation, hasId? }, declaration?, annotations?) => string` | an element's text as its name stores it: `G1: Deliver [G2;G3]`; without runtime ids, `Deliver`, or `net_up: Deliver` with `hasId` |
| `documentLine` | `(D, { kind, id, iStarId, hasId?, name, notation }, declaration?, annotations?) => string` | an element's line in a document: `goal G1: Deliver [G2;G3]`, `behavioral_goal 7857cb00: Achieve [Manual Backup]`, annotations first |
| `shownId`, `hasWrittenId` | `({ id, iStarId, hasId? }) => string`, `=> boolean` | the id a line shows: its written one, else `shortId(iStarId)`; whether it has a written one (`hasId`, else an id other than its piStar id) |
| `writeAnnotations` | `(properties) => string \| null` | `<<action>> {type = duty}` |
| `writeDeclaration` | `(properties) => string \| null` | `{int 0..100 = 80}` |
| `propertyLine` | `(key, value) => string` | `maintain battery > 20` |

## Catalog

These are also in `/light`.

| Export | What it is |
| --- | --- |
| `OPERATORS` | every operator: `{ symbol, form, precedence, assoc, example }` |
| `INFIX_SYMBOLS` | binary symbols, tightest first |
| `PREFIX_SYMBOLS`, `POSTFIX_SYMBOLS`, `STANDALONE_SYMBOLS` | the other forms' symbols |
| `CALLS`, `CALL_NAMES` | constructs written as calls, with their number of operands (`FALLBACK`: 2, `DM`: `{ min: 2 }`) |
| `takesOperands`, `arityText` | whether a call takes a number of operands, and its arity in words |
| `EXPRESSION` | the expression language: `infix` levels tightest first (`*` `/`, then `+` `-`), `prefix` (`-`), `parens`, `separator`, `member` (`.`, goal-controller#135) |
| `ASSERTION_PREFIXES` | a condition's prefixes: `assertion condition`, `assertion trigger` |
| `ASSERTION` | the assertion language's operators, comparators and literals |
| `VALUE_TYPES` | the predefined value types |
| `ID_PREFIXES` | `G`, `T`, `R`, `AT` |
| `idPrefixesOf(definition)` | the prefixes a dialect gives its extension's kinds besides these (`S` in `S1`), read in its element lines only (goal-controller#132) |
| `propertyKeysOf(definition)` | a dialect without ids' declared keys (`propertyLineOrder`), which start its property lines (goal-controller#138); none with ids |
| `propertyKeyOf(keys, line)` | the key a line without ids starts with (indentation aside), followed by a space or its end; null: an element line |
| `SKIP` | `skip` |
