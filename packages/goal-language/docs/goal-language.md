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

  The id is `G`, `T`, `R` or `AT` (MutRoSe's tasks) followed by `1`, `1.2`, `1X` or `1a` (`GX`
  reads as a name: see the [reference](reference.md#ids)). A
  name on a line with an id is letters, spaces, `-` and `'`, as RTRegex.g4
  read it.

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
| `assertion`     | `AssertionValue` | `battery > 20 & !charging` (below) | `resolves`: the kinds identifiers may name, or `variable` |
| `int`           | `IntValue`       | `-3`                               | `min`, `max`                                              |
| `number`        | `NumberValue`    | `1.5`                              |                                                           |
| `bool`          | `BoolValue`      | `true`, `false`                    |                                                           |
| `text`          | `TextValue`      | anything on one line               |                                                           |
| `enum`          | `EnumValue`      | words (`model-based reflex`)       | `options`, `open`                                         |
| `refList`       | `RefListValue`   | `G2, G5`                           | `kind`: of the elements it refers to                      |
| `pairList`      | `PairListValue`  | `t:9, loc:3`                       | `value`: `int`, `number` or `text`                        |
| `annotatedName` | `AnnotatedName`  | `<<s>> {tag = v} Name [RT]`        |                                                           |
| `ocl`           | `OclValue`       | `world_db->select(r:Room \| r.dirty)` |                                                       |

The **assertion language** works as follows:

- `&` binds tighter than `|`.
- `!` negates everything after it.
- Parentheses group.
- An operand is an identifier, `x = true`/`false`, `x op n` (where `op` is
  one of `= != < <= > >=`), or `true`/`false`.

### Declarations and annotations

The language fixes the properties these parts set. A dialect only says which
kinds carry them (`declares`, `annotated`).

- A declaration `{type lowerBound..upperBound = initialValue}` sets
  `DECLARATION_KEYS`. The bounds are written when both are set, and the
  initial value when it is set. Nothing is written without a type.
- Annotations `<<stereotype>>` and `{tag = tagValue}` (or `{tag}`) set
  `ANNOTATION_KEYS`. Only the first of each kind is read.

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
2. **12 texts both parsers reject** but recover from differently (what is
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

## Not done yet

- Spaces inside a notation are an error (`[G2; G3]`), as in RTRegex.g4.
  Relaxing this is a language decision.
