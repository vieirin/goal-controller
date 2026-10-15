# The definition pool (goal-controller#59)

A project is several files that only make sense together: a goal model, and
the resources its engine reads beside it (#25). The definition pool reads
them as one language. Every name has one definition site (a file and a
range) and a list of references (each a file and a range), whatever the
format of the file it is in. Every editor tab gets the same services from
it: diagnostics, completion, hover, go-to-definition, find references and
rename.

The core knows no format and no dialect. An engine plugs in **providers**.
Each provider speaks some documents, extracts their definitions and
references with ranges, and may check what spans them.

| Where | What |
| --- | --- |
| `lib/src/engines/definitionPool/` | the core: `definePool`, `createPool`, the services |
| `lib/src/providers/` | providers no engine owns, any engine may register: HDDL's |
| `lib/src/formats/` | the readers of the formats resources are written in, with ranges: XML, JSON, HDDL's s-expressions |
| `lib/src/engines/mutrose/pool/` | MutRoSe's providers and its cross-file checks ([mutrose.md](mutrose.md)) |
| `ui/lib/workbench/poolSupport.ts` | a pool as a language service, in every tab |
| `ui/lib/workbench/poolDocuments.ts` | the pool's documents in the workbench: the Notation view ↔ model fields, a rename applied |

## Documents and locations

A **document** is `{ id, kind, text?, value? }`:

- a resource file has its path as `id`, its project-resource kind (`world`,
  `hddl`) as `kind`, and its `text`;
- the goal model has `id: 'model'`, `kind: 'model'`, and its view
  (goal-tree's GoalView) as `value`.

A **location** is `{ document, from, to }`, offsets in a document. The goal
model's fields are documents of their own: `model:<element key>:<field>`,
where the field is `id`, `name` or a property key (`model:AT1:Params`). A
location therefore depends on no view of the model. The workbench maps it
onto the Notation view's line (`notationRange`) or an inspector field.

A location in a document that extends another's id with `:` belongs to that
document (`documentOf`): `model:AT1:Params` is the model's.

## A provider

```ts
type PoolProvider = {
  id: string; // its namespace: 'hddl'
  documents: { resources?: string[]; extensions?: string[]; model?: boolean };
  kinds: Record<string, { label: string; caseInsensitive?: boolean; scope?: 'global' | 'owner' }>;
  refers?: string[]; // the qualified kinds it refers to: ['world.class']
  extract(document: PoolDocument): { definitions: PoolDefinition[]; references: PoolReference[] };
  checks?: (pool: PoolLookup) => PoolDiagnostic[];
  complete?: (pool: PoolLookup, document: PoolDocument, offset: number) => PoolCompletion[];
  renameText?: (definition: PoolDefinition, newName: string) => string | null;
};
```

- **Kinds are namespaced** by the provider's id: the HDDL provider's `task`
  is `hddl.task`, the world's `class` is `world.class`. `definePool` fails on
  two providers with one id, and on a `refers` kind that no provider
  defines. Extracting fails on a definition outside the provider's
  namespace, and on a reference to a kind the provider didn't declare in
  `refers`.
- A **definition**: `{ id, kind, name, location, owner?, type?, detail? }`.
  - Its id is unique in the pool: `${kind}:${owner ? owner + '/' : ''}${name}`.
  - Its `owner` is another definition: a task owns its parameters, a class
    its attributes.
  - Its `type` is a string the dialect gives meaning to (`Sequence(Request)`,
    `Boolean`, the class an attribute's values name). Types are kept, not
    only names, so that typed checks (#58) can read them later.
- A **reference**: `{ kinds, name, location, scope? }`.
  - Its `kinds` are what it may resolve to, in order: a method's subtask is
    `['hddl.task', 'hddl.action']`.
  - Its `scope` says where its name is looked up:
    - `{ owner }`: among a definition's members, then among the global
      definitions (unless the kind's `scope` is `owner`);
    - `{ via, through }`: among the members of what another reference's
      target leads to. `through: 'type'` is the definition its type names,
      as the registration's `typeDefinition` says (`name.attr`: the
      attribute of the class of `name`'s type). Any other `through` names a
      resolver the registration declares (MutRoSe's `gm.standsFor`: the HDDL
      task a goal-model task stands for).
- **Case:** a kind with `caseInsensitive` compares names lowercased (HDDL's).

An engine registers its providers, with the glue between them:

```ts
definePool({ engine, providers, checks?, resolvers?, typeDefinition? })
```

and gives the registration to the engine object the workbench registers:
`defineEngine({ id: 'mutrose', …, pool: mutrosePool })` (see
[adding-an-engine.md §3.9](adding-an-engine.md#39-the-engine-object-what-the-workbench-registers)).

A document that no provider speaks is still in the pool, for checks to read.
MutRoSe passes the project's other goal models so, as `otherModel`.

## Resolution and rebuilds

- `createPool(registration).update(documents)` re-extracts only the
  documents whose text (or value) changed, then resolves every reference.
  Resolution is lazy: a scope that reads another reference's target
  resolves that one first (a cycle resolves to nothing).
- The providers' checks and the registration's run over the result.
- **What resolves to nothing** is reported by the core, for every provider:
  an `unresolved-reference` warning (`objects_picked is no World attribute
  of Room`). It isn't reported where a check already reports that place,
  after an earlier name of its path failed, when the provider that would
  define it has no document in the project, or when the reference is
  `silent` (its absence is reported elsewhere: MutRoSe's property checks
  already report a type the world has no class for).
- One keystroke in the goal model re-extracts the whole model, because the
  model is one document. A model split into per-field documents would cut
  that; #61 measures the difference.

## The services

`symbolAt`, `definitionAt`, `referencesOf`/`referencesAt`, `renameEdits`,
`hoverAt` and `completionsAt` work on any document of any provider:

- **rename** writes each place as the definition's provider says. HDDL keeps
  a parameter's `?`; the goal model renames variables but not ids, which the
  diagram and the runtime annotation hold. A location appears once, even
  when a definition by use is also its first reference;
- **completion** asks the provider of the document the position is in.

In the workbench, an engine with a pool gets a service in the
language-service registry. The pool is given to the engine object
(`defineEngine({ …, pool: mutrosePool })`, in `engines/mutrose/engine.ts`), and
`ENGINE_POOLS` is derived from the registered engines. It runs in the page and speaks the
`goal-notation`, `field` and `resource` documents, beside the shared
language:

- **F12** (or Mod-click) goes to the definition, opening its tab and
  selecting its range;
- **Shift-F12** lists the references, with links;
- **F2** renames across the files. In a project that can't be written (an
  example), it asks for a browser copy;
- **hover** shows the kind, the type, the owner, where the name is defined
  and how many uses it has;
- **completion** in every tab;
- **the checks** are underlined in the tab where the reference is, and
  listed in Problems as "project files". A problem in a resource goes to its
  place when clicked.

The workbench tells the service about the project once, whatever tab is
shown (`useProjectWorkspace`).

## What is MutRoSe-specific, and what could move into the framework (input to #60, #61)

**Already framework (this issue):**
- the core;
- the provider interface and its namespacing;
- lazy resolution with `owner` and `via` scopes;
- per-document rebuilds;
- every service;
- the registry service, and the Notation ↔ field mapping;
- the format readers in `lib/src/formats/` (XML, JSON and HDDL, with ranges);
- the HDDL provider (`lib/src/providers/`).

**MutRoSe-specific (`engines/mutrose/pool/`):**
- the world provider (MutRoSe's XML layout: an entity per element, its tag
  its class);
- the goal-model provider (its fields' OCL, read with MutRoSe's own Langium
  language, #62);
- the configuration provider (`var_mapping`, `type_mapping`,
  `location_types`, `semantic_mapping`);
- the glue: `gm.standsFor` (a task's first word is its HDDL task),
  `typeDefinition` (`Sequence(X)` is X's class, OCL's basic types none), and
  the checks.

**Could move into the framework:**
- **Messages per role for what resolves to nothing.** The core reports it
  generically; most of MutRoSe's mapping checks are the same check, with
  a message per role. A reference could carry its message.
- **A declarative provider for JSON and XML resources.** The configuration
  provider is mostly paths to strings (`var_mapping[].task_id → gm.task`).
  A table of JSON paths (or XML element paths) to kinds, with `via` scopes,
  would replace most of it. That is #60's option 2.
- **Several goal models per project.** Today the open model is indexed and
  the others are only read by checks (`otherModel`). Indexing them needs
  per-model ids for model definitions.
- **Types.** Definitions carry types as strings. #58's typed checks would
  want them structured (a class, a collection of one, a basic type).
- **The model's documents per field.** A provider-level `split` would let a
  keystroke re-read one field instead of the whole model (#61).

## Still open

- **Only the open model is indexed.** The project's other goal models are
  read by checks only (`otherModel`: MutRoSe's unused-task check), and the
  workbench doesn't pass them yet.
- **The model is one document.** A keystroke in it re-extracts the whole
  model; #61 measures a per-field split.
- **A rename's saves.** A rename writes several files at once; the
  workbench's resource saves share one timer, fixed separately from this
  issue.
