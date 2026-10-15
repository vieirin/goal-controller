# The goal language

> Reference: [reference.md](reference.md) (the grammar rule by rule) ·
> [api.md](api.md) · [diagnostics.md](diagnostics.md) ·
> [examples.md](examples.md) · [operators.md](operators.md) ·
> [lsp.md](lsp.md) (the language server) ·
> [extending-the-grammar.md](extending-the-grammar.md). Their examples run in
> `packages/lib/test/dialect/docs.test.ts`.

Every dialect is written in the same language: one Langium grammar,
`src/goal.langium`. A dialect doesn't change that grammar. Its definition
(`@goal-controller/dialect`) is descriptive. It says:

- which kinds of element it has, and whether their lines carry ids,
  annotations or a declaration;
- which operators it enables, and which construct each one means;
- which predefined value type each property has.

The definition knows nothing about parsing. Parsing, its semantics, the
check of a text against a dialect and the goal-text reader of a dialect live
in this package. An engine writes its definition, a mapper and a template:
no parser.

```
@goal-controller/dialect        what a dialect is (data): kinds, enabled operators,
        ▲                       constructs, value types, checks by name
        │ types, helpers
@goal-controller/goal-language  the grammar, its parser (plain data out), the
        ▲                       Notation view (read, write, edit), the validator,
        │                       completion, highlighting, goalNameParserFor,
        │                       the language server (/lsp, /worker)
@goal-controller/goal-tree      the tree: reads goal texts with the reader derived
        ▲                       from the engine's dialect (never imports lib)
        │
@goal-controller/lib            engines: definitions, mappers, templates
```

## Grammar overview

A **document** is lines (`Document`). There are two kinds of line:

- **Element lines** (`ElementLine`) have this shape:

  ```
  <<stereotype>> {tag = value} G1: Name [RT notation] {int 0..100 = 80}
  └── annotations ──────────┘ id  name  └ notation ┘ └ declaration ─┘
  ```

  The id is `G`, `T`, `R` or `AT` (MutRoSe's tasks) followed by `1`, `1.2`, `1X`, `1a` or `X`
  (GODA's `TX`: see the [reference](reference.md#ids)). A
  name on a line with an id is letters, spaces, `-` and `'`, as RTRegex.g4
  read it.

  A dialect that lists an extension's kind gives it a prefix of its own,
  one or two capitals (`S1: Probe`, goal-controller#132). The language
  reads that prefix in that dialect only: the parser is given the dialect's
  own prefixes (`idPrefixesOf(definition)`, `ElementId`'s `ID_PREFIX`
  token), so in any other dialect `S1: Probe` is still a property line.

- **Property lines** go under their element: `maintain battery > 20`, or a
  key alone (`root`). The parser reads the value as text. The validator then
  reads it with its property's value type.

A dialect without ids (piStar-ext's own definition) writes a `PlainDocument`
of `AnnotatedName` lines. A name there is any text on one line except
brackets and braces. A line may start with an id (`G1: Deliver`), which
names its element; a line without one is the element at its position.

### Predefined value types

Each value type has a rule of its own, so an inspector field can read one
value alone (`parseValue(type, text)`).

| Type            | Rule             | Reads                              | A dialect adds                                            |
| --------------- | ---------------- | ---------------------------------- | --------------------------------------------------------- |
| `assertion`     | `AssertionValue` | `battery > 20 & !charging` (below) | `resolves`: the kinds identifiers may name, or `variable`; `functions` |
| `expression`    | `ExpressionValue` | `0.5 + 0.9 * previous(t)` (below) | `resolves`: the kinds ids may name; `functions`: `{ name, arity }` |
| `int`           | `IntValue`       | `-3`                               | `min`, `max`                                              |
| `number`        | `NumberValue`    | `1.5`                              |                                                           |
| `bool`          | `BoolValue`      | `true`, `false`                    |                                                           |
| `text`          | `TextValue`      | anything on one line               |                                                           |
| `enum`          | `EnumValue`      | words (`model-based reflex`)       | `options`, `open`                                         |
| `refList`       | `RefListValue`   | `G2, G5`, `V1` (any prefix)        | `kind`: of the elements it refers to (an extension's too) |
| `pairList`      | `PairListValue`  | `t:9, loc:3`                       | `value`: `int`, `number` or `text`                        |
| `annotatedName` | `AnnotatedName`  | `<<s>> {tag = v} Name [RT]`        |                                                           |
| `ocl`           | `OclValue`       | `world_db->select(r:Room \| r.dirty)` |                                                       |

The **assertion language** works as follows:

- `&` binds tighter than `|`.
- `!` negates everything after it.
- Parentheses group.
- An operand is an identifier, `x = true`/`false`, `x op n` (where `op` is
  one of `= != < <= > >=`), or `true`/`false`.
- Where the property declares `functions`, a comparison is `e op e` between
  two expressions (`previous(t) < 18`, `0.9 * x >= 1`), and a call to one
  of them is an operand on its own (`previous(on) & !off`); elsewhere any
  comparison but `x op n`, and any call, is an error.

The **expression language** (the catalog's `EXPRESSION`) works as follows,
tightest first:

| Level | Operators | Associativity |
| --- | --- | --- |
| 0 | `.` between a reference and its member (`tank.level`) | |
| 1 | `-` before an operand (`-x`) | |
| 2 | `*` `/` | left |
| 3 | `+` `-` | left |

- A **member** (goal-controller#135), `ref.member`: an element's id or a
  variable, a dot, and a name (`room.clean`, `T1.1.done`; `room . clean`
  reads the same: the dot is a token of its own, so `T1.1` and `0.5` are
  as before). It binds tighter than everything: `-tank.level * 2` is
  `(-(tank.level)) * 2`. It is an operand of an expression (`member`) and,
  in an assertion, a condition on its own (`room.clean`) or set
  (`room.clean = true`: an `assign` with a `member`). The property's
  `members` says which members an element has; see the engine guide's
  [value types](../../dialect/docs/adding-an-engine.md#22-properties-the-predefined-value-types).
- An operand is a number (`2`, `0.5`; no sign of its own), an element id
  (`G1`, `T2.1`: a `ref`), a member (`room.level`), a call (`previous(t)`, to a function the property
  declares, with as many arguments as it declares), another name (a
  variable, declared by its use), or an expression in parentheses. A name
  that is an element's key in the model (an extension's kind's, `S1`,
  which the expression language reads as a name) is that element: the
  validator checks it against `resolves` as an id (goal-controller#132).
- `readExpression(text)` gives the tree (`number`, `ref`, `var`, `call`,
  `binary`, `unary`), and `readAssertion(text)` an assertion with its
  comparisons' sides as such trees: an engine walks them to write its own
  syntax, and never reads the text. `expressionText` writes a tree back.

### Declarations and annotations

The language fixes the properties these parts set. A dialect only says which
kinds carry them (`declares`, `annotated`).

- A declaration `{type lowerBound..upperBound = initialValue}` sets
  `DECLARATION_KEYS`. The bounds are written when both are set, and the
  initial value when it is set. Nothing is written without a type.
- Annotations `<<stereotype>>` and `{tag = tagValue}` (or `{tag}`) set
  `ANNOTATION_KEYS`. Only the first of each kind is read.

### Link lines: properties on links

A dialect that gives links properties (`links` in its definition,
goal-controller#107) writes a link with properties as a **property line with
the key `link`**, under the link's **source** element:

```
G1: Deliver
  T1: Drive
    robot r2
    link G1 {weight = 50} {note = cheap}
```

- The value is the target's id, then one `{key = value}` per property, in
  annotation syntax. The keys are written in the link kind's order, and only
  the ones it declares and the link has. A value with a brace can't be read
  back, so it is not written: the link keeps it, the line shows the others
  (`isWritableLinkValue`).
- It is a `PropertyLine` as the grammar reads any (`KEY VALUE`): no token,
  rule or lexer state of its own (#105 D2). `notation/linkLine.ts` reads and
  writes the value; every document without links reads and prints as before.
- **Editing:** a changed value sets the link's `customProperties`, and a
  removed line removes them. While a line can't be read (being typed), the
  link keeps its properties.
- **Which link:** the link from the element to the target whose kind has
  properties in the dialect. Two such links of different kinds between the
  same elements make the line ambiguous: it is reported, and changes nothing.
- **Diagnostics:** the target isn't an element; no link from the element to
  it has properties; ambiguous; the link written twice; a key the link's
  kind doesn't declare; a value its type rejects. A property with a named
  `check` runs it with the link's piStar id as `self`, so its context's
  `readLink` reads the link; its message comes first, as an element's.
- **Whether they're written** is the dialect's `linkLines`: by default a
  dialect with ids writes them, and one without doesn't. `false` turns them
  off; then the view leaves the links' properties to the inspector.
- In a dialect without `links`, `link` is an unknown property key, as any.

**Without ids.** A dialect without ids that sets `linkLines: true` names
the target by its element line's text, quoted (`\"` and `\\` escaped). When
several elements have that text, `#n` names the n-th of them in the
document's order:

```
Heat with the heat pump
  link "Low running cost" {weight = 100}
  link "Comfort"#2 {weight = 25}
```

- Such a document has no property lines, so a line starting `link "` is read
  as a link line, and any other line as an element line. An element whose
  text starts `link "` would be read as a link line.
- A link line keeps its place in the document's order: lines are still their
  elements' by position, and a link line's is its source's.
- **Diagnostics** besides the ones above: a text no element has
  (`No element "Nope"`); a text several have, without `#n`
  (`2 elements are named "Heat": write "Heat"#1, "Heat"#2`); an `#n` past
  them. While a target names no element, or several, its line changes
  nothing.
- **Completion and hover** (goal-controller#109): after `link `, the targets
  of the source's links whose kinds have properties, written as the line
  names them (an id, or a quoted text); inside `{ }`, the keys the link's
  kind declares that the line hasn't written; on a key, its `help`.

### Actor lines: properties on actors

A dialect that gives actors properties (`actors` in its definition,
goal-controller#109) writes an actor with properties as a **property line with
the key `actor`**. The Notation view writes all of them at the **top of the
document**, before the first element line, in the model's order of actors:

```
actor "Patient" {importance = High} {importanceQuantitative = 50}
actor "Robot"#2 {importance = Low}
G1: Deliver the medicine
  T1: Fetch it
```

- The value is the actor's **name, in quotes** (actors have no ids, in any
  dialect), then one `{key = value}` per property, as a link line's. `#n`
  picks the n-th of several actors with that name, in the model's order.
- It names its actor **wherever it is**: it belongs to no element, so a
  line moved under the elements still sets its actor. In a dialect without
  ids it takes no element's position, as a link line doesn't.
- It is a `PropertyLine` as the grammar reads any; a document without ids
  reads a line starting `actor "` as one. No token, rule or lexer state of
  its own: a document without actor properties reads and prints as before.
- The keys written are the ones the actor's kind has (`actors[].kinds`),
  in the declaration's order; a value with a brace isn't written (it couldn't
  be read back) and stays in the model.
- **Editing:** a changed value sets the actor's `customProperties` (the edit
  `{ actor, key, value }`), and a removed line removes its kind's keys.
  While a line can't be read, or names no actor, the actors keep their
  properties.
- **Diagnostics:** no actor of that name (`No actor "Anna"`); a name several
  share, without `#n` (`2 actors are named "Robot": write "Robot"#1,
  "Robot"#2`); an actor written twice; a key its kind doesn't declare; a
  value its type rejects; the engine's named check, the actor its `self`.
- **Completion and hover:** after `actor `, the names of the actors whose
  kinds have properties; inside `{ }`, the keys the actor's kind declares;
  on a key, its `help`.
- In a dialect without `actors`, `actor` is an unknown property key, as any.

## The RT notation: operators and precedence

The catalog is `src/catalog.ts`. Every operator, with its form, precedence,
associativity, an example and the construct edge and edgeV2 map it to, is
listed in [`operators.md`](operators.md). In short, from tightest to
loosest:

| Level | Operators                                 | Form                                       |
| ----: | ----------------------------------------- | ------------------------------------------ |
|     1 | `@n`                                      | postfix, with a number; repeats (`G2@2@3`) |
|     2 | `!`                                       | prefix                                     |
|  3–12 | `^` `\|` `?` `+` `&` `#` `~` `;` `->` `,` | binary, left-associative                   |
|     — | `+` `*` `?` `#`                           | standalone (`[+]`)                         |

Operands are element ids, `skip`, groups `[...]` and `(...)`, and standalone
symbols. **Precedence belongs to the language.** A dialect can't reorder the
operators, so `G2;G3->G4` reads `(G2;G3)->G4` in every dialect.
`test/language.test.ts` checks that the grammar's infix rule agrees with the
catalog, level by level.

## How a dialect enables operators

```ts
notation: {
  operand: { kinds: ['goal', 'task'], skip: true },
  operators: { '@': 'retry', '|': 'alternative', '?': 'choice', '+': 'anyOrder',
               '#': 'interleaved', ';': 'sequence', '->': 'degradation' },   // edgeV2
  standalone: { '+': 'choice' },                                            // edge: `[+]`
  modifiers: { retry: { argument: { name: 'retries', value: { type: 'int', min: 1 }, default: '3' }, appliesTo: ['degradation'], … } },
  constructs: { sequence: { label, help, relation: 'and' }, … },
  defaultConstruct: { and: 'interleaved', or: 'alternative' },
}
```

- A binary or prefix symbol maps to a **construct**. A postfix symbol maps to
  a **modifier** (it changes its operand and takes an argument). A
  standalone symbol maps to a construct.
- Anything not listed is **disabled** for that dialect. The parser still
  reads it, the validator reports it (`` `?` is not an operator of Edge``),
  completion doesn't offer it, and the engine reports it as a syntax error.
- `readNotation(dialect, tree)` reads a notation's tree with this table:
  each construct's last (outermost) operands (`operandIds`, groups opaque),
  the standalone constructs written, each modifier's arguments by operand
  text, and the operators the dialect does not enable (`isEnabled`, the
  same rule the validator reports with).

## The goal-text reader, derived from a dialect

`goalNameParserFor(dialect)` is every engine's reader; goal-tree builds it
from the definition given to `createEngineMapper({ dialect })` and
`goalView(model, dialect)`. It:

1. reads the element line (`G1: Name [notation]`);
2. reports syntax errors, and each operator the dialect does not enable
   (`` 1:21 `?` is not an operator of Edge``), to `onSyntaxError` or the
   console;
3. gives the id, the name and the **execution detail**:

```ts
type ExecutionDetail = {
  type: string;          // the construct: a standalone one when written,
                         // else the notation's outermost enabled operator's
  ids: string[];         // that operator's operands, in the order written
  modifiers: Record<string, Record<string, number>>;
                         // the modifiers that apply to the construct, by the
                         // modified operand's text: { retry: { G2: 3 } }
};
```

A dialect without a notation (SLEEC's `{ name: 'SLEEC' }`) reads ids and
names only. `assertionVariables(text)` reads the variables a condition
names. Engines no longer keep a construct priority: the language is
unambiguous, and on every recorded text ANTLR accepted the outermost
operator is the construct its listener's cascade picked, but one (named
below).

## Validation (dialect-aware)

`documentDiagnostics(definition, text, context)` validates the Notation
view, and `fieldDiagnostics` validates the inspector's fields. The
`context` holds the model's elements and the workbench's variables (the
shape of an `rt/context` notification). The validator reports:

- what a line can't read: one error where it starts, or the engine's saved
  error while the line is unchanged; an annotation or declaration that
  can't be read;
- operators, standalone symbols and `skip` the dialect doesn't enable;
- a property key the kind doesn't read, a property that doesn't apply
  (`applies`), and a value not of its type, options, bounds or kind of
  element. The engine's named check comes first when it has a message;
- annotations or a declaration on a kind that carries none, and a repeated
  stereotype or tagged value;
- a notation naming a non-child, a child missing from it, a construct
  contradicting the refinement links, a line naming no element of the
  diagram, and a duplicate id.

Completion (`completionsAt`, `fieldCompletionsAt`) offers:

- inside a notation: the goal's children, `skip`, and only the enabled
  operators, each with its construct;
- on a property line: the keys the kind reads that aren't set yet;
- in a field: element ids, or the names an assertion may use.

## Packaging: ESM, with a CommonJS bundle

The package is ESM: `tsc` builds `out/esm`, which the UI and the tests use.
Langium is ESM-only, so `build.mjs` (esbuild) bundles Langium into
`out/cjs/index.cjs` for the CommonJS packages (goal-tree, lib, their tests and the CLI).
That bundle is about 1 MB, and `@goal-controller/dialect` stays external.
`@goal-controller/goal-language/light` (`out/cjs/light.cjs`, a few kB)
holds the catalog and the writers, for code that only writes lines.

The generated Langium files (`src/generated`) are committed. After changing
the grammar, run `pnpm --filter @goal-controller/goal-language generate`; a
test fails if they are stale. The tests use mocha with tsx, and the root
`pnpm test` runs them.

## What replaced what

- **ANTLR.** `RTRegex.g4` (edge, edgeV2) and `AssertionRegex.g4` are gone
  from the build. They are pinned as references
  (`lib/test/dialect/reference/*.g4`, by `scripts/sync-reference.sh`).
  `lib/test/engines/edgeFamily/parity.test.ts` compares the readers with
  ANTLR's recorded readings (`antlr-oracle.json`).
- **The LSP branch's `rt-notation.langium`** (vn/rt-langium-notation,
  pinned as a reference). That grammar hard-coded edgeV2's operators and
  property keys. Here the grammar is the same for every dialect, the
  property keys are the dialect's, and the validator takes the dialect as
  data. GoalLexer and the one-entry-rule-per-value idea come from that
  branch's `lexer.ts`/`module.ts`.
- **The dialect's syntax description.** Regexes, line templates,
  declaration parts and `languages` are gone from the schema. The Notation
  view reads lines with the parser instead of regexes built from the
  definition.
- **edgeLangium** is folded into edgeV2. It was edgeV2's definition with
  another parser name.

## Divergences from the ANTLR grammars (named in the tests)

1. **Shapes ANTLR accepted that no model uses:**
   - a notation without brackets (`G1;G2`, `G1`), or after them
     (`G1: After [G2];G3`);
   - a name without an id (`:Name`), and nested names
     (`G1: Nested [: Inner [G2]]`);
   - glued ids (`[G2G3]`);
   - RTRegex.g4's argument list `[G2,G3]` (`,` is now the catalog's
     operator);
   - edge's bare `G11: Choice Goal +`: the language needs `[+]`.
2. **11 texts both parsers reject** but recover from differently (what is
   read past an error).
3. **A group under another operator** (`G1: Group [[G2;G3]#G4]`, not in any
   model): ANTLR's listener kept each construct's last exit and picked one
   by a cascade, so the group's sequence won; the goal language reads the
   outermost operator, interleaved over `G4`.
4. **Edge reading edgeV2 texts with `?` or a binary `+`.** ANTLR rejected
   them and recovered unpredictably. Now edge reports the operator and reads
   the rest. In PRISM, these are the 50 outputs (of 232) that differ from
   the ANTLR build: 40 were errors and 10 were garbled models; all 50
   generate now. Every engine on its own corpus, and edgeV2 on everything,
   is byte-identical.
5. **`x > 0`.** AssertionRegex.g4's `INT` had no zero, so it couldn't parse
   this. The language can.
6. **`GX`, `TX` are ids** (GODA's unknown elements, goal-controller#32):
   RTRegex.g4's WORD read them as a name for two letters, so `[GX|TX]` and
   `GX: name` were rejected. In every dialect, Edge's included, the goal
   language now reads them as ids (`G1X: Variant [GX|TX]`), except right
   after a line's colon, where a WORD is a name (`G1:GX`).
7. **A cost bracket** (`T1: Pick [W = 1]`, GODA's CostRegex.g4): RTRegex.g4
   couldn't read it. The language reads it, and a dialect without
   `notation.leafBracket: 'cost'` reports it (`A cost is not part of
   Edge`), both in the editors and in the engine's reader, so Edge rejects
   it as it did.

## Not done yet

- Spaces inside a notation are an error (`[G2; G3]`), as in RTRegex.g4. A
  dialect may ignore them (`notation.whitespace: 'ignore'`, GODA); Edge
  doesn't.
