# lib/project: the workbench's projects

A **project** is the workbench's unit of work: one or more piStar goal models,
the **project resources** an engine reads beside them (MutRoSe's world
knowledge, HDDL domain and configuration; Edge's variables and property
suites), and the **outputs** the engines produced from them, described by a
**manifest** (issue #25).

> These are called *project resources* everywhere (the manifest's and the
> dialect's `projectResources`), never "resources", so they aren't confused
> with iStar's Resource element.

This module is the project manager. It holds the manifest's shape and its
validation, opens and saves projects over their storage layers, and keeps
Recent. It is data and storage only. It imports nothing from React, Next,
the workbench (`lib/workbench`), istar-ts, goal-tree, lib's engines or
goal-language: only `@goal-controller/dialect` types (for `projectResources`,
stage 2) and `fflate`. It reads no browser global at module load (the site
is a static export rendered on the server). Instead, a store resolves the
browser's handles when it is used, and Recent takes its storage as a port. The
rest of the UI uses it through `index.ts` only.
`packages/lib/test/dialect/project/manifest.test.ts` checks both rules.

The module does not parse project resources (the engine's library does,
issue #25 decision 4), and it does not know what a dialect does with them. An
engine's options are opaque here. The workbench checks them against what the
engine reads (`lib/workbench/projectSettings.ts`) and reports any other key
in Problems.

## The manifest

```jsonc
// project.json
{
  "version": 1,
  "dialect": "edgev2",                    // the project's default (none: plain piStar)
  "options": { "discretisation": 10 },    // the project's default engine options
  "models": [
    { "path": "models/lab.txt" },
    { "path": "models/lab-sleec.txt", "dialect": "sleec", "options": { "generateFluents": true } }
  ],
  "projectResources": { "properties": ["props/lab.pctl"] },
  "outputs": [{ "model": "models/lab.txt", "path": "out/lab.prism", "engine": "edgev2" }]
}
```

A model's entry overrides the project's `dialect` and, key by key, its
`options` (`settingsInManifest`), so a project can hold an EDGE model and its
SLEEC twin. Outputs live in the project (`out/`). A missing output means "not
generated yet", and opening a project never needs one. `parseManifest`
reports what is wrong with the path to it (`models[1].path: expected a
non-empty string`).

### One model: the manifest is in the model

A project of one model has no `project.json`. Its manifest is the piStar
file's own extra keys, so opening a bare model needs no migration and saving
one never creates a second file:

- its **dialect** is the model's **mode record**,
  `diagram.customProperties.engine`, where the workbench always kept it. It
  is not duplicated into the `project` key: the record is what single files
  carried before projects, and piStar keeps custom properties, so the mode
  survives a round-trip through the piStar tool;
- its **options** are a top-level `project` key, `{ "version": 1, "options":
  { … } }`. It is written only when the model has options that differ from
  the defaults, so a bare model stays byte for byte as it was.

`embedded.ts` is the one place that knows these two paths (`modeRecord`,
`EMBEDDED_KEY`). Edits are made on the JSON value in the file's own
indentation, key order and trailing newline, and a write that changes nothing
returns the text unchanged. istar-ts (and so the workbench) keeps unknown
top-level keys. The piStar web tool may drop them when it saves a file: the
mode survives that, the options don't.

**Promotion.** Once a project has a second file (a model, a project resource
or an output, `needsProjectFile`), `promote` moves its manifest to
`project.json`. The options leave the model's `project` key, and the mode
record stays in the model, which remains portable on its own. In a
`project.json` project the manifest takes precedence: a model's entry, then
the project's default, then (where the manifest says nothing) the model's own
record.

## Storage layers

```ts
interface ProjectStore {
  source: ProjectSource;          // serialisable: Recent keeps it
  readOnly: boolean;
  form?: 'embedded' | 'file';     // known in advance (the examples index)
  list(): Promise<string[]>;      // POSIX paths from the project root
  read(path): Promise<string>;
  write(path, text): Promise<void>;
}
```

| Store | Where | Notes |
|---|---|---|
| `fileStore(name, text, { onWrite?, source? })` | one file in memory | the implicit one-model project (an upload, a new model, a Recent entry with the source it came from); writes go back to the caller (the workbench downloads them) |
| `directoryStore(handle)` | a folder on disk (File System Access API, Chrome/Edge) | any handle with `DirectoryHandleLike`'s methods; tests use fakes |
| `opfsStore(name)` | the browser's private file system (OPFS) | the fallback where folders can't be opened (Safari, Firefox) and for scratch projects; in and out as a zip (`importZip`, `exportZip`) |
| `githubStore({ ref, path, files, form })` | a folder of the public repository, read-only | the examples. `files` and `form` come from the deploy-time index, so opening fetches only the files read, one request each |

`openProject(store)` returns one `Project` shape whatever the store:
`{ name, source, store, form, manifest, models: [{ path, text, settings }],
projectResources, outputs }`. `saveProject(project, changes, manifest?)`
writes the changed files and, for a `project.json` project, the manifest. A
model that isn't JSON still opens (`unreadable`, no settings): the module
reads the manifest, not the model, and the workbench reports the JSON
problem. Every model the workbench opens goes through `openProject`: an
example, an upload, a new model and a Recent entry.

### The examples index

`scripts/examples-manifest.mjs` lists `examples/` at build time as
`ProjectIndexEntry`s. A folder holding a `project.json` is one project with
its files. Any other goal model is a one-model project (`form: "embedded"`),
so opening it never looks for a `project.json`. The site loads the files from
GitHub at the deployed ref. `packages/lib/test/dialect/project/index.test.ts`
opens every entry and checks it against the index.

## Recent

`loadRecent` / `rememberRecent` / `forgetRecent` take a `RecentStorage` (the
workbench passes `localStorage`). The key `goal-workbench:recent:v1` is
unchanged, and entries written before projects read as they are. An entry is
identified by where its project came from and its file name (`recentId`). An
example and a local file of the same name are two entries, and an entry with
unsaved edits is never replaced by a clean file of the same identity with
other text: it is moved aside (`aside`) and listed as an edited copy.

## Project resources

`openProject(store, { projectResources })` takes the declarations of a
model's dialect (the workbench passes its engines' definitions'), and lists
each kind in `project.resources` (`slots.ts`):

- where the manifest's `projectResources` says (a folder entry, `props/`,
  stands for the files in it that the kind accepts);
- else at the declaration's default path (`knowledge/world_db.xml`; for a
  `many` kind, its folder's files);
- else **missing**, which is never an error: a project without its world is
  a model alone, as before. Files the manifest lists that aren't there are
  the slot's `absent`.

`withProjectResource(project, kind, file)` adds a file where the
declaration keeps it and lists it in the manifest (a one-model project is
promoted). Write the changes with `saveProject` where the store can be
written. Otherwise use `copyProject` to an `opfsStore(name, root, copyOf)`:
a copy in the browser whose source says what it copies
(`ward (browser copy of ward.txt)`), so Recent keeps the original apart.
`readProjectResources` reads the slots' texts; what they mean is the
engine's library's to parse.

The folders a user opens are kept between visits behind a `HandleStorage`
port (`handles.ts`): `indexedDbHandles()` in the browser, opened when first
used; `memoryHandles()` in tests. `rememberDirectory` keeps one;
`reopenDirectory` gives a Recent entry's folder back (null when the browser
forgot it).

## Stages (issue #25)

1. Project over a single file (this module, the workbench reading its model
   settings from the manifest, the examples index): done.
2. Project resources: the dialect's `projectResources` declaration, parsed
   by the engine's library, opened as CodeMirror tabs, handed to checks and
   completion: done.
3. Multi-model projects, side-by-side outputs; the workbench opens folders.
4. Workspace-level language services.
5. Experiments as projects.
