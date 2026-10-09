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
| `parseDocument` | `(text, { ids? = true }) => Parsed<DocumentLine[]>` | `parseDocument(doc, { ids: false })` for a plain document |
| `parseValue` | `(type: ValueType, text) => Parsed<ValueData[type]>` | `parseValue('refList', 'G2, G5').value` → `['G2', 'G5']` |
| `rtText` | `(tree: RtTree \| null) => string` | the notation with no spaces: `G2@2->G3` (an operand's text in `modifiers`) |
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
- `ElementLineData` is `{ id, name, annotations, notation, declaration }`.
  For an annotated name (`parseValue('annotatedName', …)`, a plain
  document's lines), `id` is the optional id it starts with, or `''`.

```goal accept
G1: Deliver sample [G2;G3@2]
```

```goal-value annotatedName accept
<<goal-based>> G1: Deliver sample
```

## Reading a notation in a dialect

| Export | Signature | What it gives |
| --- | --- | --- |
| `goalNameParserFor` | `(dialect: ReadingDialect) => GoalNameParser` | every engine's goal-text reader: `({ goalText, onSyntaxError? }) => { id, goalName, executionDetail }`; reports syntax errors and disabled operators |
| `executionOf` | `(dialect, tree) => ExecutionDetail \| null` | `{ type, ids, modifiers }`: a standalone construct, or the outermost enabled operator's construct with its operands and the modifiers that apply |
| `readNotation` | `(dialect, tree) => NotationReading` | `{ constructs, standalone, modifiers, disabled }`: each construct's outermost operands, standalone constructs, modifier arguments by operand text, disabled operators |
| `operandIds` | `(tree) => string[]` | an operand's ids through operators (a group's and a call's own aren't its parent's) |
| `notationRefs` | `(tree) => string[]` | every element id a notation names, in the order written, through groups and calls |
| `isEnabled` | `(dialect, symbol, form) => boolean` | the one rule for whether a dialect enables an operator |
| `assertionVariables` | `(text) => { name, value }[]` | the variables a condition names, in order (`x = true` gives a value) |

The execution detail is typed by the dialect: `goalNameParserFor(edgeV2)`
gives `ExecutionDetailOf<typeof edgeV2>`, whose `type` is one of edgeV2's
constructs and whose `modifiers` has its modifiers (`retry`), so a misspelt
name doesn't compile. goal-tree's `createEngineMapper({ dialect })` passes
that type to `mapGoalProps`. `ExecutionDetail<C, M>` is the generic shape.

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

| Export | Signature | What it does |
| --- | --- | --- |
| `notationDocument` | `(D, tree: DocumentTree) => { text, ids }` | writes the model as a document, one id per line |
| `notationEdits` | `(D, text, tree) => NotationEdit[]` | what a document changes: element texts, and properties set or removed |
| `contextFromView` | `(D, tree, variables) => DefinitionContext` | what the text is checked against; for a definition without ids, `order` (the elements by position) and `named` (the elements whose names start with an id, by that id) |
| `writtenIds` | `(tree) => Record<id, key>` | the elements whose names start with an id (`G1: Deliver`), by that id |
| `readLine` | `(D, line) => LineReading` | one line: an element (with spans for the id, annotations, notation refs and operators, declaration) or a property |
| `lineId`, `readPropertyLine` | `(D, line) => …` | a line's id; a property line's key and value |
| `annotatedProperties` | `(reading) => DeclaredProperties` | what a line's annotations set (the first of each kind) |
| `nodeLine` | `(D, node) => string` | a node's element text |
| `isValidName` | `(D, kind, name) => boolean` | whether a name can be written on that kind's line |
| `operatorsFor` | `(D & WithNotation) => { constructs, arguments }` | the inspector's operator buttons, for the enabled operators only |

## Validation and completion

| Export | Signature | What it does |
| --- | --- | --- |
| `documentDiagnostics` | `(D, text, context, { runCheck?, saved? }) => Diagnostic[]` | checks a whole document; see [diagnostics.md](diagnostics.md) |
| `fieldDiagnostics` | `(D, context, id, key, value, runCheck) => Diagnostic[]` | checks one inspector field |
| `checkContextOf` | `(context, self) => CheckContext` | what a named check is given in a model: `self`, `kindOf`, and `elements` (every element's kind, properties, children and `x`); `NamedCheck` is `(properties, CheckContext) => string \| null` |
| `valueProblem` | `(config: ValueConfig, text, context?) => string \| null` | whether a value fits its type, options, bounds and element kind |
| `completionsAt` | `(D, text, pos, context) => CompletionResult \| null` | in a notation: children, `skip` and the enabled operators; on a property line: the keys not set yet |
| `fieldCompletionsAt` | `(D, config, text, pos, context) => CompletionResult \| null` | ids (`refList`) and names (`assertion`) |
| `constructHint` | `(D, construct) => string \| null` | `Sequence — does every child, one after another` |

A `Diagnostic` is `{ from, to, severity, message }`, with offsets into the
text. `runCheck(check, properties, self)` runs an engine's named checks.

## Highlighting

| Export | Signature | What it does |
| --- | --- | --- |
| `highlightLine` | `(D, line) => Highlight[]` | one document line, from the lexer's tokens; a property value is highlighted by its type |
| `highlightValue` | `(config, text, offset?) => Highlight[]` | one value |

A `Highlight` is `{ from, to, style }`, where `style` is one of
`labelName`, `propertyName`, `string`, `punctuation`, `bracket`, `brace`,
`paren`, `operator`, `keyword`, `number`, `typeName`, `atom`, `meta` or
`variableName`. These are the names of CodeMirror's highlight tags.

## Writers

These are also in `/light`.

| Export | Signature | Example |
| --- | --- | --- |
| `elementLine` | `(D, { id, name, notation }, declaration?, annotations?) => string` | `G1: Deliver [G2;G3]` |
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
| `CALLS`, `CALL_NAMES` | constructs written as calls, with their number of operands (`FALLBACK`: 2) |
| `ASSERTION` | the assertion language's operators, comparators and literals |
| `VALUE_TYPES` | the predefined value types |
| `ID_PREFIXES` | `G`, `T`, `R`, `AT` |
| `SKIP` | `skip` |
