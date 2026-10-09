# The goal language: reference

This reference follows `src/goal.langium` and `src/lexer.ts` rule by rule.
Every fenced block tagged `goal…` is an example, and
`packages/lib/test/dialect/docs.test.ts` runs it through the parser. Each tag
names what is checked:

- `goal accept` / `goal reject`: each line is read as one element line.
- `goal-document`: the whole block is read as a document.
- `goal-value <type>`: each line is read as one value of that type.
- `goal-rt`: each line is `notation ⇒ grouping`, with the operators
  parenthesised.

For an overview, see [goal-language.md](goal-language.md). The other docs
are [api.md](api.md), [diagnostics.md](diagnostics.md) and
[examples.md](examples.md).

## Documents

```
Document      : (NL | Line)* ;          Line : ElementLine | PropertyLine ;
PlainDocument : (NL | AnnotatedName)* ;
```

- **Lines.** Each line is an element line or a property line, and a line
  break ends it. Two element lines on one line are an error.
- **Blank lines** are allowed anywhere.
- **Indentation** (spaces or tabs at the start of a line) is presentation
  only. It doesn't nest anything: the Notation view indents by depth when
  it writes, and ignores indentation when it reads.
- **Which element a property line belongs to:** the nearest element line
  above it. A property line before any element line parses, but the
  validator reports it ([diagnostics.md](diagnostics.md)).
- **How a line start is classified.** At the start of a line (after
  indentation), a line is an element line if it starts with `<<`, `{`, or
  `G`/`T`/`R` followed by a digit or `X`. Otherwise it is a property line
  if it starts with a key (`[A-Za-z][A-Za-z0-9_]*`).
- **Comments:** none.

```goal-document accept
G1: Deliver sample [G2;T1]

   maintain battery > 20
	G2: Reach lab
  root
T1: Pick sample
```

```goal-document reject
G1: Deliver sample
  % a comment is not part of the language
```

```goal-document reject
G1: Deliver sample G2: Reach lab
```

A **plain document** (`PlainDocument`) is for a dialect whose kinds have no
id prefix, such as piStar-ext's own definition:

- every non-blank line is an `AnnotatedName`;
- a line may start with an id (`G1: Deliver`). That id names the element
  whose name starts with the same id, wherever the line is;
- a line without an id is the element at its position: the n-th non-blank
  line is the n-th element of the model, in the order the Notation view
  writes them. Every line counts in the positions, with or without an id;
- lines with and without ids may be mixed;
- there are no property lines.

A line's id that names no element is reported, and so is an id written
twice ([diagnostics.md](diagnostics.md#lines)). The Notation view writes an
element's id when its name starts with one: it writes the name as it is.

```goal-document-plain accept
<<goal-based>> {Id = A1} Robot: arm (1)
  Deliver sample
  G1: Deliver sample
  <<action>> {type = duty} T1.2: Book a room
```

## Element lines

```
ElementLine   : Annotation* ElementId ':' WORD ('[' RtExpr ']')? Declaration? ;
AnnotatedName : Annotation* (ElementId ':')? PLAIN_NAME ('[' RtExpr ']')? Declaration? ;
ElementId     : ('G' | 'T' | 'R' | 'AT') (FLOAT 'X'? | 'X' | DIGIT_SUBID) ;
```

### Ids

An id is a prefix `G`, `T`, `R` or `AT` (MutRoSe's tasks) followed by one of:

- `1` (FLOAT): digits;
- `1.2` (FLOAT): digits, a dot, and optionally more digits;
- `1X` (FLOAT `X`);
- `1a` (DIGIT_SUBID): **one** digit and one lowercase letter.

```goal accept
G1: Deliver sample
G1.2: Deliver sample
G1.2X: Deliver sample
G1X: Deliver sample
G1a: Deliver sample
T3: Pick sample
R4: Battery
AT1: ApproachNurse
```

The grammar also has a bare `X` alternative (`GX`), but the lexer never
produces it. `GX` matches WORD (letters) for two characters, which beats
`G` for one (see [the lexer](#the-lexer)), so `GX` is read as a name. This
was the same in RTRegex.g4. Prefixes other than `G`, `T` and `R` are not
ids, and `G12a` is not one either (DIGIT_SUBID is one digit):

```goal reject
GX: Deliver sample
Q1: Deliver sample
G12a: Deliver sample
```

### Names

- **On a line with an id** a name is WORD: letters, spaces, `-` and `'`.
  It may follow the `:` with or without spaces, and it is trimmed. Digits
  aren't allowed.
- **On an annotated name** (PLAIN_NAME), a name is anything on one line
  except brackets and braces. It can't start with `<` or whitespace, and
  its trailing spaces aren't part of it. If it starts with an id and a `:`
  (`G1: Deliver`, `T1.2X :Pick`), that is the line's id, and the name is
  what follows. `G12a: Robot` has no id form, so it is all name.

```goal accept
G1:Deliver
G1: Don't stop - go
```

```goal reject
G1: Step 2
```

### Annotations

```
Annotation : '<<' stereotype=TEXT '>>'
           | '{' tag=TEXT ('=' tagValue=TEXT)? '}' ;
```

Annotations come before the id (or the name), in any order and any number,
with or without spaces between them. TEXT is any run of characters except
`< > { } =` and line breaks, trimmed. A stereotype or tag can therefore
have several words (`model-based reflex`, `Reference to`).

The language accepts a repeated annotation, but **only the first of each
kind is read** (one stereotype, one tagged value). The validator reports
the others. Which kinds carry annotations at all is the dialect's
`annotated`.

```goal accept
<<action>> {type = duty} T1: Book a room
{type=duty}<<action>>T1: Book a room
<<model-based reflex>> {Reference to} G1: Deliver
<<a>> <<b>> G1: Deliver
```

```goal reject
{} G1: Deliver
<<>> G1: Deliver
```

### The notation `[...]`

The notation (an `RtExpr`, see [below](#the-rt-notation)) goes after the
name, between brackets. Spaces aren't allowed inside the brackets, or after
the closing one. RTRegex.g4 read a space as part of a name, and the
language keeps that. Tabs inside the brackets are skipped.

```goal accept
G1: Deliver [G2;T1]
G1: Deliver[G2;T1]
G1: Deliver [G2;	T1]
```

```goal reject
G1: Deliver [G2; T1]
G1: Deliver [ G2]
G1: Deliver [G2] 
G1: Deliver [G2;T1
```

### Declarations

```
Declaration : '{' type=IDENT (lowerBound=INTEGER '..' upperBound=INTEGER)?
                  ('=' initialValue=(INTEGER | IDENT))? '}' ;
```

A declaration comes last on the line. Its parts:

- the **type** is required (`IDENT`: a letter or `_`, then letters, digits
  or `_`);
- **bounds** are optional, but take both (`-5..5`);
- the **initial value** is optional: an integer or a word.

Spaces around the parts are free. The declaration sets the properties
`type`, `lowerBound`, `upperBound` and `initialValue`. Which kinds declare
is the dialect's `declares`.

```goal accept
R1: Battery {int 0..100 = 80}
R1: Battery {int}
R1: Battery {int = 3}
R1: Battery {int -5..5}
R2: Alarm {bool = false}
R1: Battery {int 0 .. 9=5}
```

```goal reject
R1: Battery {0..9}
R1: Battery {int 0..}
R1: Battery {int 0..9 3}
```

After a notation, a declaration must follow the `]` with no space (a space
there is read as a name). No dialect has kinds that both declare and have a
notation.

```goal reject
G1: Deliver [G2;T1] {int}
```

### Property lines

```
PropertyLine : KEY VALUE? ;
```

A property line is a key, then optionally spaces and a value: the rest of
the line, trimmed. The parser keeps the value as text. The validator reads
it with the property's value type (see [Value types](#value-types)).
`root` alone is a key without a value. Whether the kind reads the key is
the dialect's to say. The language accepts any key.

```goal-document accept
G1: Deliver sample
  maintain battery > 20 & !charging
  dependsOn G2, G5
  root
  unknownKey any value
```

## The RT notation

```
RtExpr     : RtBinary (',' RtBinary)* ;
infix RtBinary on RtPrefix : '^' > '|' > '?' > '+' > '&' > '#' > '~' > ';' > '->' ;
RtPrefix   : '!' RtPrefix | RtPostfix ;
RtPostfix  : RtPrimary ('@' FLOAT)* ;
RtPrimary  : '[' RtExpr ']' | '(' RtExpr ')' | 'FALLBACK' '(' RtBinary (',' RtBinary)* ')'
           | 'skip' | ('+' | '*' | '?' | '#') | ElementId ;
```

### Operands

- An element id (any [id form](#ids)).
- `skip`.
- A group, `[...]` or `(...)`. Groups can't be empty.
- A standalone symbol, `+ * ? #`, which is a whole operand on its own.
- A call, `FALLBACK(G2,G3)` (MutRoSe's runtime annotations). Its commas
  separate its operands; they are not the `,` operator, which is why `,` is
  read apart from the other binary operators. The catalog gives each call
  its number of operands (`FALLBACK`: 2), and the validator reports another
  number. Like a group, a call is an operand of its own: `G1;FALLBACK(G2,G3)`
  is a sequence of `G1` and the fallback.

```goal accept
G1: A [G2;skip]
G1: A [[G2;G3]#(G4|G5)]
G1: A [+]
G1: A [*]
G1: A [FALLBACK(G2,G3)]
G1: A [G2;FALLBACK(G3#G4,AT1)]
```

```goal reject
G1: A [[]]
G1: A [G2G3]
G1: A [FALLBACK()]
G1: A [FALLBACK G2]
```

### Operators, tightest first

| Level | Symbol | Form | Associativity / repetition |
| ---: | :---: | --- | --- |
| 1 | `@n` | postfix, a number argument (`FLOAT`: `3`, `1.5`) | repeats: `G2@2@3` |
| 2 | `!` | prefix | repeats: `!!G2` |
| 3 | `^` | binary | left |
| 4 | `\|` | binary | left |
| 5 | `?` | binary | left |
| 6 | `+` | binary | left |
| 7 | `&` | binary | left |
| 8 | `#` | binary | left |
| 9 | `~` | binary | left |
| 10 | `;` | binary | left |
| 11 | `->` | binary | left |
| 12 | `,` | binary | left |

How notations group (each result is checked against the parse tree):

```goal-rt
G2;G3->G4 ⇒ ((G2;G3)->G4)
G2->G3;G4 ⇒ (G2->(G3;G4))
G2;G3;G4 ⇒ ((G2;G3);G4)
G2|G3?G4+G5#G6;G7->G8 ⇒ ((((((G2|G3)?G4)+G5)#G6);G7)->G8)
G2#G3|G4 ⇒ (G2#(G3|G4))
G2@3->G3 ⇒ (G2@3->G3)
G2@2@3 ⇒ G2@2@3
!G2;G3 ⇒ (!G2;G3)
!G2@2 ⇒ !G2@2
[G2;G3]@2->G4 ⇒ ([(G2;G3)]@2->G4)
(G2|G3)#G4 ⇒ (((G2|G3))#G4)
G2^G3~G4,G5&G6 ⇒ (((G2^G3)~G4),(G5&G6))
G2;FALLBACK(G3#G4,AT1;G5) ⇒ (G2;FALLBACK((G3#G4),(AT1;G5)))
FALLBACK(G2,G3),G4 ⇒ (FALLBACK(G2,G3),G4)
```

`@`'s argument is a number written without a sign (`1.5` is read; engines
take its integer part). An empty or signed argument is an error:

```goal reject
G1: A [G2@]
G1: A [G2@-1]
```

A dialect gives each symbol its meaning. A binary or prefix symbol is a
construct, a postfix symbol is a **modifier** (its argument applies to the
operand: `retry`, `{ G2: 3 }` by operand text), and a standalone symbol and
a call are constructs. Any other symbol is disabled for that dialect. See
[goal-language.md](goal-language.md#how-a-dialect-enables-operators) and
[operators.md](operators.md).

## Value types

Each type has its own rule, which reads one value on its own (an inspector
field, or a property line's value). An empty value is always accepted, and
means unset.

### `int`

`INTEGER`: an optional `-`, then digits. A dialect can add `min` and
`max`, which the validator checks.

```goal-value int accept
-3
0
42
```

```goal-value int reject
+3
1.5
three
```

### `number`

`INTEGER` or `NUMBER`: an optional `-`, digits, and optionally `.` and
digits.

```goal-value number accept
1.5
-2
```

```goal-value number reject
.5
1.
```

### `bool`

`true` or `false`, lowercase.

```goal-value bool accept
true
false
```

```goal-value bool reject
True
1
```

### `text`

Anything on one line, trimmed.

```goal-value text accept
any: thing [with] {brackets} = 3
```

### `enum`

One value on one line, trimmed. A dialect adds the `options`, and `open`
when other values may be written too. The validator checks a value against
the options unless the enum is open.

```goal-value enum accept
maintain
model-based reflex
```

### `refList`

Element ids, separated by commas, with optional spaces. A dialect adds the
`kind` the ids must name. The validator checks that each id is an element
of the model, of that kind.

```goal-value refList accept
G2, G5
G2,G5
T1.2X, R3
```

```goal-value refList reject
G2 G5
G2,
```

### `pairList`

`name:value` pairs, separated by commas. A name is an identifier (a letter
or `_`, then letters, digits or `_`). A value is anything but `,`, `:` and
line breaks. A dialect adds the pair `value` type (`int`, `number` or
`text`), which the validator checks.

```goal-value pairList accept
t:9, loc:3
x:abc
```

```goal-value pairList reject
x:
x
2x:1
```

### `annotatedName`

A modelling dialect's line: annotations, an optional id and `:`, a name, and
optionally a notation and a declaration (see [AnnotatedName](#element-lines)).
`parseValue('annotatedName', …)` returns the id (`''` without one).

```goal-value annotatedName accept
<<goal-based>> {Id = A1} Robot: arm (1)
<<s>> Deliver [G2]
G1: Deliver sample
<<action>> T1.2X :Book a room
G12a: Robot
```

```goal-value annotatedName reject
<<s>>
G1:
```

### `assertion`

The assertion language (next section). A dialect adds `resolves`: the
element kinds, and `variable`, that identifiers may name. Completion
offers those.

## The assertion language

```
AssertionValue : AssertExpr? ;
infix AssertBinary on AssertUnary : '&' > '|' ;
AssertUnary    : '!' AssertExpr | AssertPrimary ;
AssertPrimary  : '(' AssertExpr ')'
               | A_ID '=' ('true' | 'false')
               | A_ID ('=' | '!=' | '<' | '<=' | '>' | '>=') A_INT
               | A_ID
               | 'true' | 'false' ;
```

- `&` binds tighter than `|`, and both are left-associative.
- `!` negates **everything after it**: `!a & b` is `!(a & b)`. Use
  parentheses to negate one operand (`(!a) & b`).
- **Comparators:** `= != < <= > >=`. The identifier comes first and an
  unsigned integer last (`0` included; AssertionRegex.g4 couldn't read
  `0`).
- **Literals:** integers on the right of a comparator, and `true`/`false`.
  `x = true` sets a boolean variable. `x != false` is not part of the
  language.
- **Identifiers:** `A_ID`, a letter or `_`, then letters, digits or `_`.
  They name the resources of the model, or the workbench's variables (the
  property's `resolves`).
- Whitespace, line breaks included, is free.

```goal-value assertion accept
battery > 20 & !charging
x > 0
x = 3
x = true & y
(a | b) & c
!a & b
_x1
true
```

```goal-value assertion reject
x != false
3 > x
x >= -1
x == 1
a b
```

## The lexer

GoalLexer (`src/lexer.ts`) makes the tokens. Langium's own lexer can't do
two things this needs:

- **Token sets by position.** The same characters mean different things in
  different parts of a line, so the lexer switches token sets as it goes:

  | Where | Tokens |
  | --- | --- |
  | line start (a document) | indentation (skipped); then `<<` / `{` (annotations), an id start (`G`/`T`/`R`/`AT` + digit or `X`), or a KEY (a property line) |
  | `<<…>>` | TEXT, `>>` |
  | `{…}` before the id | TEXT, `=`, `}` |
  | the id, the name and the notation | RTRegex.g4's set: `G T R [ ] : @ \| ? + # ; ->` (with `AT`), then `, ^ & ~ ! ( ) *` and the calls (`FALLBACK`), DIGIT_SUBID, FLOAT, `skip`, `X`, WORD, tabs (skipped) |
  | an annotated name | an optional id and `:` (`G1:` as an element line's tokens), then PLAIN_NAME, then the RT set with spaces skipped |
  | `{…}` after the name | `}`, `..`, `=`, INTEGER, IDENT, spaces (skipped) |
  | a property value | VALUE (the rest of the line) |
  | a value on its own | the type's set (an assertion: `& \| ! ( ) = != < <= > >=`, `true`, `false`, A_ID, A_INT) |

- **Longest match** (ANTLR's rule). Of all the tokens that match at a
  position, the longest wins, and a tie goes to the one listed first. This
  is why:
  - `Goal` is one WORD and not `G` followed by `oal`;
  - `G1` is `G` and the FLOAT `1`;
  - `GX` is a WORD;
  - a space in a notation starts a WORD, which is an error (`[G2; G3]`);
  - `->` beats a WORD `-`.

A character that no token of the current set matches is a **token
recognition error** (`token recognition error at: '$'`). The lexer skips
it and carries on.

```goal reject
G1: Deliver [G2$G3]
G1: Deliver [G2; G3]
```
