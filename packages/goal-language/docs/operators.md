# The RT notation's operators

The goal language has one operator catalog (`src/catalog.ts`), and
`src/goal.langium` follows it. A test checks that the two agree. A dialect
doesn't add operators or change their precedence. Its definition enables some
of them and says which construct each one means. The validator reports any
operator a dialect hasn't enabled. Precedence belongs to the language, so
`G2;G3->G4` reads the same in every dialect.

## Precedence and associativity

Level 1 binds tightest. Every binary operator is left-associative: `G2;G3;G4`
reads as `(G2;G3);G4`, as ANTLR's left-recursive alternatives did.

| Level | Symbol | Form                   | Associativity  | Example  | Reads as   | edgeV2                 | edge                   |
| ----: | :----: | ---------------------- | -------------- | -------- | ---------- | ---------------------- | ---------------------- |
|     1 |  `@`   | postfix, with a number | left (repeats) | `G2@2@3` | `(G2@2)@3` | retry (on degradation) | retry (on degradation) |
|     2 |  `!`   | prefix                 | —              | `!G2;G3` | `(!G2);G3` | —                      | —                      |
|     3 |  `^`   | binary                 | left           | `G2^G3`  |            | —                      | —                      |
|     4 |  `\|`  | binary                 | left           | `G2\|G3` |            | alternative            | alternative            |
|     5 |  `?`   | binary                 | left           | `G2?G3`  |            | choice                 | —                      |
|     6 |  `+`   | binary                 | left           | `G2+G3`  |            | anyOrder               | —                      |
|     7 |  `&`   | binary                 | left           | `G2&G3`  |            | —                      | —                      |
|     8 |  `#`   | binary                 | left           | `G2#G3`  |            | interleaved            | interleaved            |
|     9 |  `~`   | binary                 | left           | `G2~G3`  |            | —                      | —                      |
|    10 |  `;`   | binary                 | left           | `G2;G3`  |            | sequence               | sequence               |
|    11 |  `->`  | binary                 | left           | `G2->G3` |            | degradation            | degradation            |
|    12 |  `,`   | binary                 | left           | `G2,G3`  |            | —                      | —                      |
|     — |  `+`   | standalone             | —              | `[+]`    |            | —                      | choice                 |
|     — |  `*`   | standalone             | —              | `[*]`    |            | —                      | —                      |
|     — |  `?`   | standalone             | —              | `[?]`    |            | —                      | —                      |
|     — |  `#`   | standalone             | —              | `[#]`    |            | —                      | —                      |

A dash in an engine's column means the engine leaves that operator disabled,
so the validator reports it there (for example "`?` is not an operator of
Edge"). The spare operators (`^`, `&`, `~`, `,`, `!`, standalone `*`) are
there for dialects that need more constructs than Edge does.

Edge's and edgeV2's operators keep the order their ANTLR grammars gave them
(`@ > | > ? > + > # > ; > ->`; edge has no `?` and no binary `+`). The spare
operators are placed around them, so neither engine reads a notation
differently.

## Operands

- An element id: a prefix `G`, `T`, `R` or `AT`, followed by `1`, `1.2`, `1X`
  or `1a` (`GX` reads as a name: see [reference.md](reference.md#ids)).
- `skip`.
- A group: `[...]` or `(...)`.
- A standalone symbol.

A space inside a notation is an error (`[G2; G3]`). RTRegex.g4 read a space
as part of a name, and the language keeps that behaviour so engines read
goal texts as they did before.

## The assertion language

Conditions such as `maintain` and `assertion` use the assertion language:

- `&` binds tighter than `|`.
- `!` negates everything after it: `!a & b` is `!(a & b)`.
- Parentheses group.
- An operand is one of:
  - an identifier (`charging`);
  - `x = true` or `x = false`;
  - an integer comparison `x op n`, where `op` is one of `= != < <= > >=`;
  - `true` or `false`.

AssertionRegex.g4 couldn't parse `x > 0`, because its `INT` had no zero. The
goal language drops that quirk.
