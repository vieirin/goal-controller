# The goal language server

One Langium language server for every dialect. It doesn't know any dialect
in advance: the client tells it, per document or for all of them, which
dialect the text is written in and which model it is checked against. The
server then reports what the local support reports (`documentDiagnostics`,
`fieldDiagnostics`, `completionsAt`, `hoverAt`, `definitionAt`: the same
functions, text in and offsets out).

| Entry point                             | What it is                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@goal-controller/goal-language/lsp`    | `createGoalLspServices`, `listenForContext`, `serverDiagnostics`, `GoalContextStore`                                                 |
| `@goal-controller/goal-language/worker` | `startGoalWorkerServer(scope, { checks })`: the server in a Web Worker, over postMessage                                             |
| `@goal-controller/goal-language/light`  | the protocol (`GOAL_CONTEXT_NOTIFICATION`, `GoalContextParams`, `fieldUri`, `readFieldUri`), without a parser: what a client imports |

## Protocol

LSP, plus one notification from the client:

```ts
// 'goal/context'
type GoalContextParams = {
  uri?: string; // the document it is for; without one, every document without its own
  dialect: AnyDialect; // the dialect's definition, as data
  context: DefinitionContext; // the model's elements and the workbench's variables
  saved?: Record<string, { line: string; error: string | null }>; // the engine's error on each saved line, by id
};
```

On each notification the server re-reads and re-validates its open
documents. A context changes how an inspector field is read, as well as
what is valid in it.

Without a context, a document is read as a Notation view document and only
its syntax errors are reported.

### Documents

- **A Notation view document** has any URI (the workbench uses
  `file:///notation.goal`). It is read as a `Document`, or as a
  `PlainDocument` when the dialect's lines carry no ids.
- **An inspector field** is one element's property value:
  `file:///fields/<id>/<key>.goal` (`fieldUri(id, key)`, URI-encoded). It is
  read with the property's value type (`parseValue`'s rule), and checked
  with the element's other properties.

## Features

| Feature                | What it gives                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics            | everything in [diagnostics.md](diagnostics.md): syntax, what the dialect allows, the notation against the model, properties and values, the engine's named checks, the saved lines' errors                                                                                                                              |
| Completion             | inside a notation: the goal's children, `skip` and the enabled operators; on a property line: the keys the kind reads, then a value's options (enums, ids of the kind a `refList` names, resources and variables in an assertion); `<<` stereotypes, `{` tags and `{tag =` values. Triggers: `[ ; \| ? + # > < { = , (` |
| Hover                  | an operator's construct or modifier (or that it isn't enabled), an element id with its name and construct, a property key's help, a name in a value (an element's line, a variable)                                                                                                                                     |
| Go to definition (F12) | from an id in a notation or a list, or a name in a value, to its element's line                                                                                                                                                                                                                                         |

Highlighting is not a server feature: there are no semantic tokens. The
client keeps the goal language's CodeMirror highlighter
(`documentLanguage`, `valueLanguage`), which reads the same tokens.

### Named checks

A definition names its engine's checks (`check: 'edge.goal.maintain'`). It
doesn't hold the checks themselves, and this package can't import lib. The
host passes them when it starts the server, by dialect id:

```ts
startGoalWorkerServer(self, {
  checks: { edgeV2: edgeCheckRegistry, edge: edgeCheckRegistry },
});
```

A dialect without checks, or a host that passes none, gets everything else.

## Embedding the worker

The UI does this in three files (`packages/ui/lib/workbench`):

1. **`goalWorker.ts`**, the worker script, starts the server with the
   engines' checks:

   ```ts
   import { startGoalWorkerServer } from '@goal-controller/goal-language/worker';
   startGoalWorkerServer(self as unknown as DedicatedWorkerGlobalScope, {
     checks,
   });
   ```

2. **`goalLsp.ts`** holds one `LSPClient` (`@codemirror/lsp-client`) for
   the page, over the worker:

   ```ts
   const worker = new Worker(new URL('./goalWorker.ts', import.meta.url), {
     type: 'module',
   });
   const client = new LSPClient({
     rootUri: 'file:///',
     extensions: languageServerExtensions(),
   }).connect(workerTransport(worker));
   ```

   lsp-client sends and receives JSON strings, while the worker's
   `BrowserMessageReader`/`Writer` post objects. The transport converts
   between them. If the worker fails, the views fall back to the local
   support.

3. **`serverLanguageSupport.ts`** is the `LanguageSupport` the views take.
   - `documentExtension(uri)` and `fieldExtension(id, key)` are the
     dialect's highlighter plus `client.plugin(uri, 'goal')`.
   - `setContext`/`setSaved` send `goal/context`.

   `GoalLanguageServer.tsx` provides it through `LanguageSupportContext`
   to the engines' views and to piStar-ext's.

In Next.js, webpack emits the worker as a chunk of its own (`new URL(…,
import.meta.url)`). The server build aliases
`@goal-controller/goal-language/worker` to `false`.

A Node host would call `createGoalLspServices({ connection, ...NodeFileSystem }, { checks })`,
then `listenForContext` and `startLanguageServer`, as `src/lsp/worker.ts` does.

## Tests

- `test/lsp.test.ts` checks that the server reports what the local support
  reports, runs a host's checks, shows the saved lines' errors, and reads a
  field by its type.
- `packages/lib/test/dialect/docs.test.ts` runs every `goal-check` and
  `goal-document` block of [reference.md](reference.md), [api.md](api.md),
  [diagnostics.md](diagnostics.md) and [examples.md](examples.md) through
  the server as well.
