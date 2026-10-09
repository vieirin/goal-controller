# Extending the goal language

Every dialect is written in one language. A dialect picks from it: which
kinds have ids, which operators mean which construct, which value type
each property has. Most new engines need nothing more (see
[adding-an-engine.md](../../dialect/docs/adding-an-engine.md)). This page
is for the rest: when the language can't write what an engine reads, the
language grows, for every dialect.

Two changes made this way are the worked examples below. Both came from
MutRoSe:

- its task ids, `AT1`, as a new **id prefix**;
- its runtime annotation `FALLBACK(G2,G3)`, as a new **call** construct.

## Before you change the language

1. **Check that a dialect can't already do it.**
   - An operator may already be in the catalog, disabled by default: `^ & ~ , !`
     and standalone `*` are spare
     ([operators.md](operators.md#precedence-and-associativity)).
   - A value may fit an existing type: `text`, `enum` with `open: true`,
     `pairList`.
   - A rule the type can't express can be a named `check` in lib.
2. **Add, don't change.**
   - Every existing model must read as it did. Precedence belongs to the
     language: `G2;G3->G4` reads the same in every dialect, so a new
     operator takes a level of its own and doesn't move the others.
   - A new token must not change how existing text is cut into tokens (see
     [the lexer](reference.md#the-lexer): longest match, ties to the first
     listed).
3. **What's new is off until a dialect turns it on.**
   - The language reads it in every dialect, and the validator reports it
     where it isn't enabled (`` `FALLBACK` is not an operator of EdgeV2 ``).
   - Only id prefixes are read everywhere: a dialect's kinds still say which
     prefix each kind uses.

## Where a change goes

Make the change in the order of this table: each row reads the ones above
it, and the [gates](#gates) fail until they agree.

| What | File | Notes |
| --- | --- | --- |
| The catalog | `src/catalog.ts` | The source of truth: `ID_PREFIXES`, `INFIX_SYMBOLS`, `PREFIX_SYMBOLS`, `POSTFIX_SYMBOLS`, `STANDALONE_SYMBOLS`, `CALLS`, `VALUE_TYPES`, `ASSERTION`. The grammar, the lexer, the highlighter and the docs follow it. |
| The tokens | `src/lexer.ts` | GoalLexer makes every token itself. A keyword in `goal.langium` that it never emits can't be parsed. Build literal lists from the catalog (`literal(...ID_PREFIXES, …)`, `...CALL_NAMES`). |
| The grammar | `src/goal.langium`, then `pnpm --filter @goal-controller/goal-language run generate` | Commit `src/generated/` with it. |
| The parse tree's data | `src/parse.ts` | `RtTree`, `toRtTree` and `rtText`. |
| The editor's reading | `src/notation/lines.ts` | `operatorOf`: what the validator, hover and completion see as written, with its span. |
| A dialect's reading | `src/notation/reading.ts` and `src/notation/goalNames.ts` | `isEnabled`, `readNotation` and `executionOf`'s `outermost`: what a dialect enables and what an engine is handed. |
| Diagnostics | `src/notation/diagnostics.ts` | A rule of the language itself, such as a call's number of operands. |
| Completion, hover, highlighting | `src/notation/completion.ts`, `navigation.ts`, `highlight.ts` | |
| The dialect schema | `packages/dialect/src/schema.ts` | Only if a definition can now say something new, such as `prefix: 'AT'`. |
| Docs | `docs/reference.md`, `docs/operators.md`, `docs/api.md`, `docs/diagnostics.md` | Their `goal` blocks are tests (below). |

## Gates

Run all of these before committing a language change:

- **`pnpm --filter @goal-controller/goal-language run test`.** Among others:
  - *binds the binary operators as the catalog lists them* and *has the
    catalog's prefix, postfix and standalone symbols* check the grammar
    against the catalog;
  - *is generated from goal.langium as committed* fails if you didn't
    regenerate.
- **`pnpm --filter @goal-controller/lib run test`.** Its `test:dialect` part
  runs every `goal`, `goal-rt`, `goal-reads`, `goal-check` and `goal-value`
  block in the docs, through the validator and through the language server.
  Add accept and reject lines for what you added.
- **Every example reads as before.** Take a snapshot with the code before
  the change, and another after it:

  ```sh
  pnpm run build:lib && pnpm snapshot:language /tmp/before
  # … the change …
  pnpm run build:lib && pnpm snapshot:language /tmp/after
  diff -r /tmp/before /tmp/after
  ```

  The script writes each Edge example's Notation document and PRISM in
  both engines, and piStar-ext's documents. Nothing may differ unless the
  change meant it.
- **The UI type-checks.** Run `npx tsc --noEmit -p packages/ui/tsconfig.json`.
  `RtTree` and `WrittenOperator` are switched on there too.

## Worked example: an id prefix (`AT`)

MutRoSe names tasks `AT1`. The language read only `G`, `T` and `R`, so
`AT1: ApproachNurse` read as a property line with the key `AT1`.

1. **Catalog:** add `'AT'` to `ID_PREFIXES`.
2. **Lexer:**
   - The notation's literals, the `refList` literals, the line-start test
     (`ELEMENT_START`) and the optional id of a plain line (`PLAIN_ID`) are
     built from `ID_PREFIXES`.
   - The prefix alternation lists the longest first, so `AT` is tried before
     `T`.
   - `AT` is a literal: on `AT1` it ties with a WORD `AT` and wins, because
     literals are listed first. A name like `ATtend` is a longer WORD and
     stays a name. Add a test for that.
3. **Grammar:** `ElementId: ('G' | 'T' | 'R' | 'AT') (…)`. Regenerate.
4. **Highlighter:** an id is its prefix and its number joined. The test
   for "joined" had assumed a one-letter prefix (`startOffset + 1`); use the
   token's length.
5. **Schema:** add `'AT'` to `ElementDefinition.prefix`.
6. **Docs:** the [ids](reference.md#ids) section, with an `AT1` accept line,
   the lexer table, `operators.md` and `api.md`.

## Worked example: a call construct (`FALLBACK(a,b)`)

MutRoSe writes `FALLBACK(G2,G3)`. The catalog had no named constructs, and
its `,` is a binary operator, the loosest. If a call's arguments were read
as `RtExpr`, `,` would swallow them, and a dialect that doesn't enable `,`
would see it flagged.

1. **Catalog:** `CALLS = { FALLBACK: { arity: 2 } }`. Add `'call'` to
   `OperatorForm`, `CallName` to `OperatorSymbol`, and the calls to
   `OPERATORS`.
2. **Grammar:**
   - `,` leaves the infix rule and gets a rule of its own:
     `RtExpr: RtBinary ({infer RtComma.left=current} operator=',' right=RtBinary)*;`.
     It is still the loosest operator and left-associative, so every
     notation groups as before.
   - The call reads its arguments one level below `,`:
     `{infer RtCall} function='FALLBACK' '(' args+=RtBinary (',' args+=RtBinary)* ')'`.
   - **Langium pitfall:** an `infix` rule written `on` another infix rule
     makes Langium infer types without the inner rule's node in `RtExpr`,
     and a declared `interface` can't share an infix rule's name. A plain
     rule with an action that infers a type of its own (`RtComma`) gives
     correct types. Read the generated `ast.ts` after regenerating.
3. **Lexer:** add `...CALL_NAMES` to the notation's literals. Without it,
   the grammar's `'FALLBACK'` keyword never arrives and every call is a
   syntax error.
4. **Parse tree:**
   - `RtTree` gets `{ kind: 'call'; name; args }`.
   - `toRtTree` maps `RtCall`, and maps `RtComma` like `RtBinary`.
   - `rtText` prints `FALLBACK(a,b)`.
5. **Readers:**
   - `operatorOf` reports the call's name with `form: 'call'` and its
     number of operands.
   - `isEnabled` accepts `'call'`.
   - `readNotation` and `outermost` read a call's construct with its
     arguments' ids (`callOperands`).
   - A call is opaque to its parent, like a group: in `G1;FALLBACK(G2,G3)`
     the sequence's operands are `G1` alone.
6. **Diagnostics:** another number of operands than the catalog's is an
   error (`` `FALLBACK` takes 2 operands, not 1 ``).
7. **Completion and highlighting:** completion offers `FALLBACK(`, and the
   highlighter styles the name as a keyword.
8. **Docs:** the grammar in [reference.md](reference.md#the-rt-notation),
   accept and reject lines, `goal-rt` groupings, and the `operators.md`
   table. The harness's `grouped` helper
   (`packages/lib/test/dialect/docs.test.ts`) learned to print a call.

A dialect then enables it like any operator:
`notation.operators: { ';': 'sequence', '#': 'parallel', FALLBACK: 'fallback' }`.

## Recipes

- **A binary operator.**
  - Add it to `INFIX_SYMBOLS` at the level it binds, and at the same place in
    `infix RtBinary`.
  - If its symbol starts like an existing token (`-` and `->`, `|` and
    `||`), add the longer one first and test both.
  - If it gets a level between existing ones, the existing operators keep
    their relative order, so existing notations group as before. Prove it
    with a snapshot.
- **A prefix, postfix or standalone symbol.** The same, in
  `PREFIX_SYMBOLS` / `RtPrefix`, `POSTFIX_SYMBOLS` / `RtPostfix`, or
  `STANDALONE_SYMBOLS` / `RtPrimary`.
- **A call.** Add an entry to `CALLS` and to `RtCall`'s `function`
  alternatives. Everything else follows from the catalog.
- **A value type.**
  - Add it to `VALUE_TYPES` and write a rule of its own (an inspector field
    reads one value alone).
  - Give it a lexer start in `VALUES`, and the `Reach` rule a slot so Langium
    builds it.
  - Then wire: `parseValue`, `valueProblem` (what is wrong with a value),
    `fieldCompletionsAt`, the highlighter's `START`, the schema's
    `ValueConfig`, and a section in [reference.md](reference.md#value-types)
    with `goal-value` blocks.
  - Prefer a general type (a condition language) over one engine's syntax;
    an engine's own rules go in its named checks.
