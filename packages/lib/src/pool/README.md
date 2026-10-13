# The definition pool's protocol

An engine tells the pool which files it reads and what they mean. The pool does
the rest: it parses the files, checks their shape, works out what each name
refers to, and gives every editor tab diagnostics, go-to-definition,
references, rename, hover and completion (goal-controller#82).

An engine writes **declarations**: a schema for each file, annotations on
those schemas, a catalogue of kinds, and TypeScript checks. An engine never
parses a file, never emits facts and never resolves a name. This folder names
no engine.

```ts
import * as z from 'zod/mini';
// an engine's folder, lib/src/engines/<engine>/
import {
  defineEngine,
  defineFile,
  defines,
  json,
  langium,
  refersTo,
  scope,
} from '../../pool';

const shelves = defineFile({
  kind: 'shelves', // the project-resource kind
  parser: json,
  schema: z.object({
    shelves: z.array(
      z.object({
        name: z.string().check(defines('toy.shelf')),
        holds: z.array(
          z.object({
            thing: z.string().check(refersTo('toy.thing', 'global')),
            part: z.optional(
              z.string().check(refersTo('toy.part', scope.owner('thing'))),
            ),
          }),
        ),
      }),
    ),
  }),
});

const things = defineFile({
  kind: 'things',
  extensions: ['.toy'],
  parser: langium(toyLanguage, {
    kinds: { Thing: 'toy.thing', Part: 'toy.part', Shelf: 'toy.shelf' },
  }),
});

export const toy = defineEngine({
  files: [shelves, things],
  kinds: {
    'toy.shelf': { label: 'shelf' },
    'toy.thing': { label: 'thing' },
    'toy.part': { label: 'part', scope: 'owner', reportUnused: true },
  },
});
```

That is a whole engine. `test/pool/toy/engine.ts` is this engine, and
`test/pool/toy.test.ts` shows every service working from it.

## Running it

```ts
import {
  createPool,
  definitionAt,
  pool as protocol,
} from '@goal-controller/lib';

const pool = createPool(protocol.poolOf(toy)); // once per editor
const index = pool.update(documents); // on every change; only changed documents are read again
index.diagnostics; // every problem, in every document
definitionAt(index, { document: 'shelves.json', offset: 42 });
```

`documents` holds the project's documents, in #68's `PoolDocument` shape:

- a file: `{ id: 'shelves.json', kind: 'shelves', text }`. The file
  declaration whose `kind` is `document.kind` reads it, and if none does, the
  first declaration whose `extensions` match the id.
- the goal model: `{ id: 'model', kind: 'model', value: DocumentTree }`. Another
  document of the same shape can have another kind, such as `otherModel`.

The services are #68's: `definitionAt`, `referencesAt`, `renameEdits`,
`hoverAt`, `completionsAt` and `diagnosticsIn`, from `engines/definitionPool`.
Kinds keep the names you declared.

## Files

`defineFile({ kind, extensions?, parser, schema? })`.

The parsers are a closed set. An engine picks one and never writes its own.

| parser                       | reads                           | the value the schema sees                                                                                                                                                                                                                                                         | locations                                                                                                                 |
| ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `json`                       | strict JSON (`jsonc-parser`)    | the parsed value                                                                                                                                                                                                                                                                  | a string's text, without its quotes                                                                                       |
| `xml`                        | XML (`@rgrove/parse-xml`)       | each element is `{ name, close?, attributes, children, text? }`: `name` is the opening tag's name, `close` the closing tag's (absent when self-closed), `attributes` a record, `children` the child elements, `text` the trimmed text of an element with no children              | the tag name, the closing tag name, an attribute's value                                                                  |
| `yaml`                       | YAML (`yaml`)                   | the parsed value; an alias reads as what it names                                                                                                                                                                                                                                 | a scalar's text, without its quotes                                                                                       |
| `goalModel(options?)`        | the goal model's `DocumentTree` | one element at a time: `{ key, id, kind, name, parent, children, notation, properties }` (`parent` and `children` are keys, `notation` the bracket's text). The schema describes ONE element, and an element it rejects is left out without a word (the dialect checks the model) | `model:<key>:<field>`, where `<field>` is `id`, `name`, `notation` or a property's key, and offsets are within that field |
| `langium(services, options)` | a Langium language              | the AST (no schema)                                                                                                                                                                                                                                                               | the CST's offsets                                                                                                         |

A Zod schema (classic or `zod/mini`) checks a JSON, XML or YAML file. What the
schema rejects becomes a `schema` diagnostic where it is written: a missing
key, a wrong type, or an unknown key in a `strictObject`. The rejected part is
left out and the rest is still read. A key written twice in JSON is a warning,
and the later one is read. A file that doesn't parse gets `syntax` diagnostics
and keeps its last good reading.

### The goal model's tree

An element's `id` that `defines` is known by the element's key: in a dialect
whose ids are scoped by their goal, BSN's two `T1.2` are `gm.task:G3/T1.2`
and `gm.task:G4/T1.2`, both named `T1.2`, and neither is defined twice. A
path to `'^id'` reaches the scoped one. A global lookup by name
(`find('gm.task', 'T1.2')`) still gets the first.

`goalModel({ children: { kind, unresolved? } })` reads what notations name.
For each element whose `id` defines:

- each child is a definition of `kind`, a member of the element, named by
  the child's id and written where the child's id is (`model:<child>:id`;
  the child's own definition comes first there, so hover says what the
  child is);
- each id the notation lists refers to `kind`, among the element's own
  children, at its offsets in `model:<key>:notation`. The ids are the
  view's (read in the dialect, once each); the core finds them in the
  bracket's text left to right, each a whole token, spaces inside one
  skipped (`T1.1 2` is `T1.12`).

So F12, references and completion in a bracket work on the element's
children. A bracket's id that is no child gets `unresolved` as `refersTo`'s
does: the pool's warning by default, or `false` when the dialect says it
already. The engine declares `kind` (`scope: 'owner'`, `rename: false`).

## Annotations

An annotation is a check you add with `.check(...)` to the schema of the value
it describes. It accepts every value, so it never changes what the schema
accepts. A value may carry several annotations, and every one of them applies.

### `defines(kind, options?)`

The value is a name of `kind`. The value is a string, a record's key (annotate
the key schema of `z.record`), or a Langium node.

- `owner: path`: it is a member of what the value at `path` defines. Members
  are looked up inside their owner (see Scopes).
- `type: path | { literal } | (occurrences, root) => string | undefined`: its
  type is the text at a path, a literal, or computed from what is written.
  The function gets every occurrence (`{ value, parent, text(key?) }`, where
  `text` returns the source text of the value or of a key of its parent) and
  the file's whole value. It can't look anything up. A type that needs another
  file belongs in a check.
- `name: (text) => { text, offset } | null`: only part of the string is the
  name, such as `Room` in `Sequence(Room)`, starting at offset 9. `null` means
  the value names nothing.
- `firstUse: true`: the first occurrence of a (kind, owner, name) in a document
  defines it, and every later occurrence refers to it. A plain definition of
  the same name wins over every first use, including first uses written
  before it. Use it for a class defined by its first tag, or a variable
  defined by its first use. For the goal model, the document is the whole
  model, read in element order, then `id`, `name` and the properties in key
  order. A first use's owner has to be a definition, so it is known while the
  file is read.

### `refersTo(kinds, scope, options?)`

The value is a name of one of `kinds`, which are tried in order. A name that
more than one of them has is ambiguous, and an ambiguous reference is not
allowed: it is an `ambiguous-reference` error, for every kind, with no
opt-out. Until it is fixed, the reference resolves to the first kind's
definition, so that go-to-definition, references and rename keep working on
it.

- `name`: as for `defines`.
- `unresolved`: what is said when it resolves to nothing. By default the
  pool's `unresolved-reference` warning. With
  `{ severity, message: '<key of messages>' }`, the engine's message is used,
  with args `name`, `kind` (its label), `owner` (the scope's owner) and
  `candidates` (the names it could have been, comma-separated). With `false`,
  nothing is said, because one of the engine's checks says it.

Nothing is said when no file that can define its kinds is in the project, or
when its scope leads nowhere (the value it is scoped by doesn't resolve). An
empty string (a name about to be typed) is a reference with an empty name.
Completion offers what may be written there, and nothing is said about it.
It isn't among `TypedPool.references`.

### `leadsTo(name, { from? })`

It goes on a reference, next to its `refersTo`. It says that a definition
leads, by `name`, to what the reference resolves to. The definition is its
object's: the first `defines` among the keys of the object the value is in,
else the first in an enclosing object, or the definition at `from`. A task
can lead to what its name's first word names:

```ts
id: z.string().check(defines('gm.task')),
name: z.string().check(refersTo('x.action', 'global', { name: firstWord }), leadsTo('performs')),
```

`scope.leadsTo('performs', path)` and `TypedPool.leadsTo('performs', task)`
follow it.

### `written(langium(services, { start, ... }), { part? })`

The string is written in a Langium language and is parsed with the rule
`start`. Its nodes are read with the language's `kinds` and `annotate`. Their
locations are offsets within the string, or within its `part` (a `name`-style
function). Paths go from the AST up into the objects around the string, so
`'^id'` inside a goal-model property reaches the element's `id`.

## Paths

An annotation finds a related value by a path. Lists don't count as levels.
An object counts, and so does a Langium node.

| path                   | the value at                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `'task_id'`            | that key of the object the value is in                                                     |
| `'../task_id'`         | that key of the object one level up (one `../` per level)                                  |
| `'^id'`                | that key of the nearest enclosing object that has it, starting with the value's own object |
| `scope.previous(path)` | the same place in the item before this one in its list; for the first item, `path`         |

There are no indexes and no descent into children. Between two elements of
the goal model there is only what `goalModel({ children })` reads (a
notation's ids, among the element's children); a check reads `parent` and
`children` off the element's value.

## Scopes

Where a reference's name is looked up. `refersTo` always says it, because
there is no default and `undefined` doesn't compile. There are three
cases.

- `'global'`: among the definitions of its kinds that have no owner.
- `scope.owner(path)`: among the members of what the value at `path` defines.
  If that value is a reference, among the members of what it resolves to.
  The lookup then goes on to the owner's owner, and so on, and finally to the
  global definitions. A kind declared `scope: 'owner'` is never found
  globally.
- `scope.leadsTo(name, path)`: the value at `path` resolves to a definition.
  The name is looked up among the members of what that definition leads to
  by `name`. `'type'` is built in: the definition that the type names, found
  through the kind's `typeOf`. `a.b.c` is
  `scope.leadsTo('type', scope.previous('head'))` on each attribute.

Names compare exactly, or lowercased for a kind declared `caseInsensitive`.

## Langium languages

`langium(services, { start?, kinds?, scopes?, annotate? })`. `services` are the
language's injected core services, as `langium generate` makes them. The core
calls `services.parser.LangiumParser.parse(text, { rule: start })` and nothing
else: no documents, no linker, no scope provider. The pool resolves the names.

- `kinds: { AstType: kind }`. A node of a mapped type that has a `name`
  defines that kind, as a member of the nearest enclosing definition or scope
  node. A cross-reference `[Type:ID]` refers to the type's kind, or to its
  mapped subtypes in the reflection's order. It is looked up from the nearest
  enclosing definition outwards, then globally.
- `scopes: [AstType]`: nodes that own the members written inside them without
  being definitions, such as a quantifier's variables, which then shadow the
  enclosing definition's members.
- `annotate: { AstType: { property: [annotations] | (node) => [annotations] } }`
  covers what the grammar can't say. A `defines` of the node's own kind on
  `name` gives that definition its options (`type`, `owner`, ...) instead of
  making a second definition. A `refersTo` on a cross-reference property
  replaces what the grammar says about it (kind and lexical scope).
  Ownership and lexical lookup belong only to what the grammar says. Any
  other annotated `defines`, a first use on a cross-reference included, is
  owned only through its `owner:` path, and without one it is global.

The language's syntax errors are `syntax` diagnostics.

## Kinds

`kinds: { 'ns.name': { label, caseInsensitive?, scope?, reportUnused?, rename?, typeOf? } }`.
Every kind a file names must be declared here, or `poolOf` throws.

- `label`: the word people see in hover and in messages.
- `scope: 'owner'`: only found among its owner's members.
- `reportUnused`: a definition nothing refers to gets an `unused-definition`
  warning.
- `rename: false` means it isn't renamed here (an id a diagram holds). A
  function `(newName) => text | null` gives the text a new name is written
  as, and `null` means the name is invalid.
- `typeOf: { kinds, name? }`: the definition that a type of this kind's
  definitions names, among `kinds`. `name` maps the type to that
  definition's name, for example `Sequence(Room)` to `Room`, or returns
  `null` when it names none.

## Typed kinds and messages

Kinds, message keys and lead names are strings, so on their own they
neither complete nor catch typos. To get both, declare them once as
constants and take the annotations from them:

```ts
const KINDS = { 'toy.shelf': { label: 'shelf' }, 'toy.thing': { label: 'thing' } } as const satisfies Record<string, KindDeclaration>;
const MESSAGES = { 'toy.noThing': '{name} is no thing on any shelf' } as const;
const LEADS = ['holds'] as const;
const { defines, refersTo, leadsTo, scope, written, langium } = annotationsFor(KINDS, MESSAGES, LEADS);

const check: Check<keyof typeof KINDS, keyof typeof MESSAGES, (typeof LEADS)[number]> = (pool) => …;
export const toy = defineEngine({ files, kinds: KINDS, messages: MESSAGES, leads: LEADS, checks: [check] });
```

A Langium language is typed by the AST types `langium generate` writes, which
is the `<Language>AstType` map in its `ast.ts`. The language's services say
which AST they parse, with a key that exists only for the type checker. The
language declares it without importing lib:

```ts
export type ToyServices = LangiumCoreServices & { readonly $ast?: ToyAstType };
export const toyLanguage: ToyServices = inject(…);
```

`langium(…)` infers the AST from the services and checks its options with it:

```ts
langium(toyLanguage, {
  start: 'Model',                                  // an AST type's name
  kinds: { Thing: 'toy.thing' },                   // AST types → the engine's kinds
  annotate: { Put: { part: (node) => … } },        // node: Put, its properties checked
});
```

`start` is typed by the AST types' names, because no union of rule names is
generated, and the rules a text starts from are AST types too. Plain
`LangiumCoreServices` accept any name, as before. `langium<ToyAstType>(…)`
gives the AST explicitly.

After that, `defines('toy.shelff')`, `refersTo([... 'toy.thinng'], 'global')`, `refersTo('toy.thing')`,
`unresolved: { message: 'toy.noThin' }`, `pool.definitions('toy.shelve')`,
`problem(…, 'toy.emptyShelve')`, `typeOf: { kinds: ['toy.shelve'] }`,
`leadsTo('hold')`, `scope.leadsTo('hold', …)` and `pool.leadsTo('hold', …)`
all fail to compile, and an editor completes each of them. `scope.leadsTo`
also takes the built-in `'type'`. `defineEngine` infers the kinds from
`kinds`, the message keys from `messages` and the lead names from `leads`,
and types the checks with all three. With `leads` declared, `poolOf` also
refuses a file that leads by any other name. Without it, any name goes. An engine without `messages` may give a problem's text
itself. The untyped `defines`/`refersTo`/`leadsTo`/`scope` are the same
functions.

Paths (`'../task_id'`) aren't typed: an annotation is built before it is put
on a schema, so it can't know the objects around it. `test/pool/typed.test.ts` is the example.

## Checks

A check is `(pool: TypedPool) => Problem[]`. It reads typed values and
resolved names, never facts.

| `TypedPool`                                 |                                                        |
| ------------------------------------------- | ------------------------------------------------------ |
| `definitions(kind)`                         | every definition of a kind                             |
| `references(kinds?)`                        | every reference (to these kinds)                       |
| `referencesTo(definition)`                  | what refers to it                                      |
| `leadsTo(name, definition)`                 | what it leads to, by a name                            |
| `typeOf(definition)`                        | the definition its type names                          |
| `find(kinds, name, owner?)`                 | a definition by name, in an owner, then globally       |
| `has(file)`                                 | whether a document of that file kind is in the project |
| `values(file)`                              | the typed values of a file kind's documents            |
| `locate(document, path)`                    | where a path of a document's value is written          |
| `problem(location, severity, check, args?)` | a problem anywhere                                     |

A `Definition` and a `Reference` carry `name`, `location`, `file`,
`document`, `path`, `value` (what was annotated) and `parent` (the object or
Langium node it is in). A definition also has `kind`, `owner` and `type`. A
reference also has `kinds`, `target` and `owner` (its object's definition).
Both have `problem(severity, check, args?)`, which places the problem at the
name.

`document` is the id of the `PoolDocument` the value was read from, such as
`model`. `location.document` is where the name is written, such as
`model:AT2:Params` for a goal-model field. To tell fields apart, read
`location.document`, or better, `path`.

Diagnostics come as a set. Their order isn't part of the protocol.

`check` is a key of the engine's `messages`. Its text is that message, with
`{arg}` replaced by the arg, or computed by a function of the args. A `check`
that isn't a key is shown as the text itself, under the check name `engine`.

## What the pool says by itself

| check                  | severity                             | when                                                            |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `syntax`               | error                                | the file doesn't parse (JSON, XML, YAML, a Langium language)    |
| `schema`               | error, or warning for an unknown key | the schema rejects a value                                      |
| `unresolved-reference` | warning                              | a reference resolves to nothing (see `refersTo`'s `unresolved`) |
| `ambiguous-reference`  | error                                | two of a reference's kinds have the name                        |
| `duplicate-definition` | error                                | a definition's (kind, owner, name) is defined already           |
| `unused-definition`    | warning                              | nothing refers to it (`reportUnused` kinds only)                |

## Decisions (from #82's open questions)

- **Paths.** Sibling keys, `../` and `^` for parents, and `scope.previous` for
  a chain in a list. There are no general relative paths.
- **Leads that need computing.** A `name` function on `refersTo` (for example
  "the first word of the name") together with `leadsTo`. Anything more is a
  check.
- **First-use definitions.** `defines(kind, { firstUse: true })`, rather than
  a hook.
- **Types.** A path, a literal, or a pure function of the occurrences and the
  file. `typeOf` on the kind turns a type into a definition.
- **Conditional annotations.** On a `z.union`, the first option that accepts
  the value is the one whose annotations apply. For Langium,
  `annotate[Type][property]` can be a function of the node.
- **A format the default parsers can't read** (an s-expression language) gets
  a Langium grammar the engine ships. There is no hand-written reader.
- **The goal model's structure.** Ids scoped by their goal and a notation's
  children are the core's (`goalModel({ children })`, above), not an
  engine's walk over the tree. Paths between elements (a parent's
  property, a sibling's) are not there: a check reads `parent` and
  `children` off the element.

## Limits

- JSON being typed still has a tree (`jsonc-parser` reads past errors), so
  completion works in it. XML or YAML that doesn't parse keeps its last good
  reading, so its locations, and completion in it, are those of the last
  text that parsed.

## Inside (for whoever changes the core)

- `read.ts` reads a tree file with its schema. This is #81's reader:
  positions are kept, and what is rejected is left out.
- `walk.ts` walks the schema and the value together, and a Langium AST with
  its options, into _entities_: an annotated value, its path, the objects
  around it, and where it is written.
- `facts.ts` turns entities into #68's `PoolDefinition`/`PoolReference`. It
  computes ids and owners, first uses, types, scopes (`{ owner }`, or
  `{ via, through }` with the resolvers `#self`, `#type` and `leadsTo:<name>`),
  and what leads where.
- `engine.ts` turns a declared engine into #68's `PoolRegistration`: one
  provider with an empty id, so kinds keep their names. Every reference is
  `silent` to #68, and the generic diagnostics above are computed here.
- Evaluation is #68's TS pool (`engines/definitionPool`). Replacing it changes
  nothing above.
