/**
 * A declared engine, as #68's pool: one provider reads every file it
 * declares (its kinds are written qualified), resolves through the links
 * its files declare, and checks: the files' syntax and schema, what
 * resolves to nothing or to two kinds, what is defined twice or never used,
 * and the engine's own checks over the typed pool.
 */
import { safeParse, type $ZodType } from 'zod/v4/core';
import {
  definePool,
  type PoolCompletion,
  type PoolDefinition,
  type PoolDiagnostic,
  type PoolDocument,
  type PoolLookup,
  type PoolProvider,
  type PoolReference,
  type PoolRegistration,
} from '../engines/definitionPool';
import {
  definitionMeta,
  factsOf,
  linkResolver,
  referenceMeta,
  SCOPE_KIND,
  SELF,
  TYPE,
  type DocumentFacts,
} from './facts';
import { isLangium, isTreeParser, type LangiumParser } from './parsers';
import {
  annotationOf,
  type Annotation,
  type DeclaredEngine,
  type DeclaredFile,
  type Definition,
  type Kind,
  type Location,
  type MessageArgs,
  type Problem,
  type Reference,
  type Severity,
  type TypedPool,
} from './protocol';
import { read, type TreeReader, type ValuePath } from './read';
import {
  walkLangium,
  walkValue,
  type Locator,
  type Walk,
  type Written,
} from './walk';

/** A document read: its file, typed value, facts and what is wrong with it. */
type Extraction = DocumentFacts & {
  file: DeclaredFile;
  source: unknown;
  value: unknown;
  locate: (path: ValuePath) => Location | undefined;
  problems: PoolDiagnostic[];
};

/** A goal-model element, as `goalModel`'s schema reads it. */
type Element = {
  key: string;
  id: string;
  kind: string;
  name: string;
  properties: Record<string, string>;
};
type ModelNode = Omit<Element, 'key' | 'properties'> & {
  properties: Readonly<Record<string, string>>;
};

const at = (document: string, text: string): Written => ({
  document,
  from: 0,
  to: text.length,
  text,
});

/** Every annotation a schema carries, and those of the Langium values in it. */
const annotationsOf = (file: DeclaredFile): Annotation[] => {
  const found: Annotation[] = [];
  const seen = new Set<unknown>();
  const langium = (parser: LangiumParser) => {
    if (seen.has(parser)) return;
    seen.add(parser);
    for (const kind of Object.values(parser.options.kinds ?? {}))
      if (kind) found.push({ defines: kind }, { refersTo: [kind] });
    for (const properties of Object.values(parser.options.annotate ?? {}))
      for (const marks of Object.values(properties ?? {}))
        if (marks && typeof marks !== 'function')
          for (const mark of marks) {
            const annotation = annotationOf(mark);
            if (annotation) found.push(annotation);
          }
  };
  const visit = (schema: $ZodType | undefined): void => {
    if (!schema || seen.has(schema)) return;
    seen.add(schema);
    const def = schema._zod.def as Record<string, unknown> & {
      checks?: object[];
      type: string;
    };
    for (const zodCheck of def.checks ?? []) {
      const annotation = annotationOf(zodCheck);
      if (!annotation) continue;
      found.push(annotation);
      if ('written' in annotation && isLangium(annotation.written))
        langium(annotation.written);
    }
    if (def.type === 'lazy') visit((def.getter as () => $ZodType)());
    for (const key of [
      'innerType',
      'in',
      'out',
      'element',
      'keyType',
      'valueType',
      'left',
      'right',
    ])
      visit(def[key] as $ZodType | undefined);
    for (const child of [
      ...Object.values((def.shape as Record<string, $ZodType>) ?? {}),
      ...((def.options as $ZodType[]) ?? []),
      ...((def.items as $ZodType[]) ?? []),
    ])
      visit(child);
  };
  visit(file.schema);
  if (isLangium(file.parser)) langium(file.parser);
  return found;
};

const format = (
  message: string | ((args: MessageArgs) => string),
  args: MessageArgs = {},
) =>
  typeof message === 'function'
    ? message(args)
    : message.replace(/\{(\w+)\}/g, (whole, key: string) =>
        key in args ? String(args[key]) : whole,
      );

/** What the provider made of each document, by id: its last reading. */
const extractions = new WeakMap<DeclaredEngine, Map<string, Extraction>>();

const enginePools = new WeakMap<DeclaredEngine, PoolRegistration>();

/**
 * The pool of a declared engine (#68's registration): `createPool(…)` of it
 * gives the index every service of the pool reads.
 */
export const poolOf = <K extends string, M extends string, L extends string>(
  declared: DeclaredEngine<K, M, L>,
): PoolRegistration => {
  // within the core, kinds and messages are strings
  const engine = declared as unknown as DeclaredEngine;
  const known = enginePools.get(engine);
  if (known) return known;
  const { files, kinds } = engine;
  const messages = engine.messages ?? {};
  const read$ = extractions.get(engine) ?? new Map<string, Extraction>();
  extractions.set(engine, read$);

  // what each file may define, and every kind and link the files name
  const definedIn = new Map<Kind, Set<string>>();
  const links = new Set<string>(['type']);
  for (const file of files)
    for (const annotation of annotationsOf(file)) {
      const named =
        'defines' in annotation
          ? [annotation.defines]
          : 'refersTo' in annotation
            ? annotation.refersTo
            : [];
      for (const kind of named)
        if (!kinds[kind])
          throw new Error(
            `${file.kind} names ${kind}, which the engine's kinds don't declare`,
          );
      if ('defines' in annotation)
        definedIn.set(
          annotation.defines,
          (definedIn.get(annotation.defines) ?? new Set()).add(file.kind),
        );
      if ('link' in annotation) {
        if (engine.links && !engine.links.includes(annotation.link))
          throw new Error(
            `${file.kind} links by ${annotation.link}, which the engine's links don't declare`,
          );
        links.add(annotation.link);
      }
      if (
        'refersTo' in annotation &&
        annotation.scope &&
        'through' in annotation.scope
      )
        links.add(annotation.scope.through);
    }

  const fileOf = (document: PoolDocument) =>
    files.find(
      (file) =>
        file.kind === document.kind ||
        file.extensions?.some((extension) =>
          document.id.toLowerCase().endsWith(extension),
        ),
    );

  const readDocument = (
    file: DeclaredFile,
    document: PoolDocument,
  ): Omit<Extraction, keyof DocumentFacts | 'file' | 'source'> & {
    walk: Walk;
  } => {
    const walk: Walk = { entities: [], syntax: [] };
    const problems: PoolDiagnostic[] = [];
    const id = document.id;
    if (file.parser.name === 'goalModel') {
      const nodes = (
        document.value as { nodes?: ReadonlyMap<string, ModelNode> } | undefined
      )?.nodes;
      const elements: Element[] = [];
      for (const [key, node] of nodes ?? []) {
        const element: Element = {
          key,
          id: node.id,
          kind: node.kind,
          name: node.name,
          properties: { ...node.properties },
        };
        // an element the schema doesn't take isn't the engine's (an actor, a
        // resource): it is left out, and the dialect says what is wrong with it
        const result = file.schema
          ? safeParse(file.schema, element)
          : { success: true as const, data: element };
        if (result.success) elements.push(result.data as Element);
      }
      const locator: Locator = {
        at: (path, part) => {
          const [index, field, property] = path;
          const element = elements[index as number];
          if (!element || part) return undefined;
          if (field === 'id' || field === 'name')
            return at(`model:${element.key}:${field}`, element[field]);
          if (field === 'properties' && typeof property === 'string')
            return element.properties[property] !== undefined
              ? at(
                  `model:${element.key}:${property}`,
                  element.properties[property]!,
                )
              : undefined;
          return undefined;
        },
      };
      if (file.schema)
        elements.forEach((element, index) =>
          walkValue(file.schema!, element, locator, [index], [], walk),
        );
      return {
        value: elements,
        locate: (path) => locator.at(path),
        problems,
        walk,
      };
    }
    const text = document.text ?? '';
    if (isLangium(file.parser)) {
      const root = walkLangium(
        file.parser,
        text,
        at(id, text),
        undefined,
        [],
        [],
        walk,
      );
      return { value: root, locate: () => undefined, problems, walk };
    }
    if (!isTreeParser(file.parser) || !file.schema)
      throw new Error(
        `${file.kind}: a ${file.parser.name} file needs a schema`,
      );
    const reading = read(readerOf(file), id, text);
    for (const problem of reading.problems)
      problems.push({
        document: id,
        from: problem.from,
        to: problem.to,
        severity: problem.severity,
        message: problem.message,
        check: problem.schema ? 'schema' : 'syntax',
      });
    const locator: Locator = {
      at: (path, part) => {
        const span = reading.at(path, part);
        return span && { document: id, ...span };
      },
    };
    if (reading.value !== undefined)
      walkValue(file.schema, reading.value, locator, [], [], walk);
    return {
      value: reading.value,
      locate: (path) => locator.at(path),
      problems,
      walk,
    };
  };

  const extract = (document: PoolDocument) => {
    const file = fileOf(document)!;
    const source = document.text ?? document.value;
    const held = read$.get(document.id);
    if (held && held.source === source && held.file === file) return held;
    const { walk, ...reading } = readDocument(file, document);
    for (const error of walk.syntax)
      reading.problems.push({
        ...error,
        severity: 'error',
        check: 'syntax',
      });
    const facts = factsOf(walk.entities, {
      file: file.kind,
      document: document.id,
      root: reading.value,
      kinds,
    });
    const extraction: Extraction = { ...facts, ...reading, file, source };
    read$.set(document.id, extraction);
    return extraction;
  };

  /** the documents read, as the pool is now */
  const present = (pool: PoolLookup) =>
    [...pool.documents.values()].flatMap((document) => {
      const extraction = read$.get(document.id);
      return extraction &&
        extraction.source === (document.text ?? document.value)
        ? [extraction]
        : [];
    });

  /** each update's links, by name and source */
  const linkIndexes = new WeakMap<
    PoolLookup,
    Map<string, Map<string, PoolReference[]>>
  >();
  const linksOf = (pool: PoolLookup, name: string, source: string) => {
    let index = linkIndexes.get(pool);
    if (!index) {
      index = new Map();
      for (const extraction of present(pool))
        for (const link of extraction.links) {
          const sources = index.get(link.name) ?? new Map();
          index.set(link.name, sources);
          sources.set(link.source, [
            ...(sources.get(link.source) ?? []),
            link.reference,
          ]);
        }
      linkIndexes.set(pool, index);
    }
    return index.get(name)?.get(source) ?? [];
  };

  const typeDefinition = (definition: PoolDefinition, pool: PoolLookup) => {
    const typeOf = kinds[definition.kind]?.typeOf;
    if (!typeOf || definition.type === undefined) return undefined;
    const name = typeOf.name ? typeOf.name(definition.type) : definition.type;
    return name === null ? undefined : pool.find(typeOf.kinds, name);
  };

  const resolvers: PoolRegistration['resolvers'] = {
    [SELF]: (definition) => definition.id,
    [TYPE]: (definition, pool) => typeDefinition(definition, pool)?.id,
    ...Object.fromEntries(
      [...links]
        .filter((name) => name !== 'type')
        .map((name) => [
          linkResolver(name),
          (definition: PoolDefinition, pool: PoolLookup) => {
            for (const reference of linksOf(pool, name, definition.id)) {
              const target = pool.target(reference);
              if (target) return target.id;
            }
            return undefined;
          },
        ]),
    ),
  };

  /** the owner a reference is looked up in: undefined, none; null, its scope leads nowhere */
  const ownerOf = (pool: PoolLookup, reference: PoolReference) => {
    const { scope } = reference;
    if (!scope) return undefined;
    if ('owner' in scope) return scope.owner;
    const via = pool.target(scope.via);
    if (!via) return null;
    return resolvers[scope.through]?.(via, pool) ?? null;
  };

  const label = (kind: Kind) => kinds[kind]?.label ?? kind;

  const typedPool = (pool: PoolLookup): TypedPool => {
    const definitions = new Map<PoolDefinition, Definition>();
    const ids = new WeakMap<Definition, string>();
    const idOf = (d: Definition) => {
      const id = ids.get(d);
      if (id === undefined)
        throw new Error(`${d.name} is no definition of this pool`);
      return id;
    };
    const references = new Map<PoolReference, Reference>();
    const problem = (
      location: Location,
      severity: Severity,
      check: string,
      args?: MessageArgs,
    ): Problem => ({
      document: location.document,
      from: location.from,
      to: location.to,
      severity,
      check,
      ...(args && { args }),
    });
    const definition = (d: PoolDefinition): Definition => {
      const known = definitions.get(d);
      if (known) return known;
      const meta = definitionMeta.get(d)!;
      const wrapped: Definition = {
        kind: d.kind,
        name: d.name,
        location: d.location,
        ...meta,
        get owner() {
          const owner = d.owner ? pool.definition(d.owner) : undefined;
          return owner && owner.kind !== SCOPE_KIND
            ? definition(owner)
            : undefined;
        },
        ...(d.type !== undefined && { type: d.type }),
        problem: (severity, check, args) =>
          problem(d.location, severity, check, args),
      };
      definitions.set(d, wrapped);
      ids.set(wrapped, d.id);
      return wrapped;
    };
    const reference = (r: PoolReference): Reference => {
      const known = references.get(r);
      if (known) return known;
      const { owner, file, document, path, value, parent } =
        referenceMeta.get(r)!;
      const meta = { file, document, path, value, parent };
      const wrapped: Reference = {
        kinds: r.kinds,
        name: r.name,
        location: r.location,
        ...meta,
        get target() {
          const target = pool.target(r);
          return target && definition(target);
        },
        get owner() {
          const found = owner ? pool.definition(owner) : undefined;
          return found && definition(found);
        },
        problem: (severity, check, args) =>
          problem(r.location, severity, check, args),
      };
      references.set(r, wrapped);
      return wrapped;
    };
    const asKinds = (kinds: Kind | readonly Kind[]) =>
      typeof kinds === 'string' ? [kinds] : kinds;
    return {
      definitions: (kind) => pool.definitionsOf(kind).map(definition),
      references: (kinds) => {
        const wanted = kinds === undefined ? undefined : asKinds(kinds);
        return pool
          .references()
          .filter(
            (r) =>
              referenceMeta.has(r) &&
              r.name !== '' &&
              (!wanted || r.kinds.some((k) => wanted.includes(k))),
          )
          .map(reference);
      },
      referencesTo: (d) => pool.referencesTo(idOf(d)).map(reference),
      links: (name, d) => {
        if (!d) return [];
        const id = idOf(d);
        return linksOf(pool, name, id).flatMap((r) => {
          const target = pool.target(r);
          return target ? [definition(target)] : [];
        });
      },
      typeOf: (d) => {
        const found = pool.definition(idOf(d));
        const type = found && typeDefinition(found, pool);
        return type && definition(type);
      },
      find: (kinds, name, owner) => {
        const found = pool.find(asKinds(kinds), name, owner && idOf(owner));
        return found && definition(found);
      },
      has: (file) => present(pool).some((e) => e.file.kind === file),
      values: (file) =>
        [...pool.documents.values()].flatMap((document) => {
          const extraction = read$.get(document.id);
          return extraction?.file.kind === file
            ? [{ document: document.id, value: extraction.value }]
            : [];
        }),
      locate: (document, path) => read$.get(document)?.locate(path),
      problem,
    };
  };

  const diagnosticOf = (problem: Problem): PoolDiagnostic => {
    const message = messages[problem.check];
    return {
      document: problem.document,
      from: problem.from,
      to: problem.to,
      severity: problem.severity,
      check: message ? problem.check : 'engine',
      message: message ? format(message, problem.args) : problem.check,
    };
  };

  const checks = (pool: PoolLookup): PoolDiagnostic[] => {
    const read = present(pool);
    const diagnostics: PoolDiagnostic[] = read.flatMap((e) => e.problems);
    const files = new Set(read.map((e) => e.file.kind));

    // defined twice: the later ones
    const first = new Map<string, PoolDefinition>();
    for (const extraction of read)
      for (const d of extraction.definitions) {
        if (d.kind === SCOPE_KIND) continue;
        const earlier = first.get(d.id);
        if (!earlier) first.set(d.id, d);
        else
          diagnostics.push({
            ...d.location,
            severity: 'error',
            check: 'duplicate-definition',
            message: `${d.name} is already defined as a ${label(d.kind)}`,
          });
      }

    for (const extraction of read)
      for (const r of extraction.references) {
        const meta = referenceMeta.get(r)!;
        // a name about to be typed: a place to complete, nothing to say
        if (!r.name) continue;
        const target = pool.target(r);
        if (target) {
          // ambiguous: another of its kinds has the name too
          const owner = ownerOf(pool, r) ?? undefined;
          const other = r.kinds
            .filter((k) => k !== target.kind)
            .map((k) => pool.find([k], r.name, owner))
            .find(Boolean);
          if (other)
            diagnostics.push({
              ...r.location,
              severity: 'warning',
              check: 'ambiguous-reference',
              message: `${r.name} is both a ${label(target.kind)} and a ${label(other.kind)}: it is taken as the ${label(target.kind)}`,
            });
          continue;
        }
        if (meta.unresolved === false || meta.nowhere) continue;
        // what it refers to isn't in the project: nothing to say
        if (
          !r.kinds.some((k) =>
            [...(definedIn.get(k) ?? [])].some((f) => files.has(f)),
          )
        )
          continue;
        const owner = ownerOf(pool, r);
        if (owner === null) continue;
        const of = owner !== undefined ? pool.definition(owner) : undefined;
        const ofName = of && of.kind !== SCOPE_KIND ? of.name : undefined;
        const candidates = r.kinds
          .flatMap((k) => pool.definitionsOf(k))
          .filter((d) => (d.owner ?? undefined) === owner)
          .map((d) => d.name);
        if (meta.unresolved) {
          diagnostics.push(
            diagnosticOf({
              ...r.location,
              severity: meta.unresolved.severity,
              check: meta.unresolved.message,
              args: {
                name: r.name,
                kind: label(r.kinds[0]!),
                owner: ofName ?? '',
                candidates: candidates.join(', '),
              },
            }),
          );
          continue;
        }
        diagnostics.push({
          ...r.location,
          severity: 'warning',
          check: 'unresolved-reference',
          message: `${r.name} is no ${label(r.kinds[0]!)}${ofName ? ` of ${ofName}` : ' the project defines'}`,
        });
      }

    // never used, for the kinds that ask
    for (const [kind, declaration] of Object.entries(kinds))
      if (declaration.reportUnused)
        for (const d of pool.definitionsOf(kind))
          if (!pool.referencesTo(d.id).length)
            diagnostics.push({
              ...d.location,
              severity: 'warning',
              check: 'unused-definition',
              message: `${d.name} is a ${label(kind)} nothing refers to`,
            });

    const typed = typedPool(pool);
    for (const check of engine.checks ?? [])
      diagnostics.push(...check(typed).map(diagnosticOf));
    return diagnostics;
  };

  /** the names a reference at an offset may be: its kinds' definitions, in its scope */
  const complete = (
    pool: PoolLookup,
    document: PoolDocument,
    offset: number,
  ): PoolCompletion[] => {
    const reference = pool
      .references()
      .find(
        (r) =>
          r.location.document === document.id &&
          r.location.from <= offset &&
          offset <= r.location.to,
      );
    if (!reference) return [];
    const owner = ownerOf(pool, reference);
    if (owner === null) return [];
    const owners = new Set<string | undefined>([undefined]);
    for (
      let scope = owner;
      scope !== undefined;
      scope = pool.definition(scope)?.owner
    ) {
      if (owners.has(scope)) break;
      owners.add(scope);
    }
    const seen = new Set<string>();
    return reference.kinds
      .flatMap((kind) => pool.definitionsOf(kind))
      .filter(
        (d) =>
          owners.has(d.owner) &&
          (d.owner !== undefined || kinds[d.kind]?.scope !== 'owner'),
      )
      .filter((d) => !seen.has(d.name) && Boolean(seen.add(d.name)))
      .map((d) => ({
        label: d.name,
        kind: d.kind,
        ...(d.type !== undefined && { detail: d.type }),
        from: reference.location.from,
        to: reference.location.to,
      }));
  };

  const provider: PoolProvider = {
    id: '',
    documents: {
      resources: files.map((file) => file.kind),
      extensions: files.flatMap((file) => file.extensions ?? []),
      model: files.some((file) => file.kind === 'model'),
    },
    kinds: Object.fromEntries(
      Object.entries(kinds).map(([kind, declaration]) => [
        kind,
        {
          label: declaration.label,
          ...(declaration.caseInsensitive && { caseInsensitive: true }),
          ...(declaration.scope && { scope: declaration.scope }),
        },
      ]),
    ),
    extract: (document) => {
      const { definitions, references } = extract(document);
      return { definitions, references };
    },
    checks,
    complete,
    renameText: (definition, newName) => {
      const rename = kinds[definition.kind]?.rename;
      return rename === false ? null : rename ? rename(newName) : newName;
    },
  };
  const registration = definePool({
    engine: 'declared',
    providers: [provider],
    resolvers,
  });
  enginePools.set(engine, registration);
  return registration;
};

/** each tree file's reader (the memo of its readings is held by it) */
const readers = new WeakMap<DeclaredFile, TreeReader>();
const readerOf = (file: DeclaredFile): TreeReader => {
  const known = readers.get(file);
  if (known) return known;
  if (!isTreeParser(file.parser) || !file.schema)
    throw new Error(`${file.kind}: no tree parser and schema`);
  const reader = { parse: file.parser.tree, schema: file.schema };
  readers.set(file, reader);
  return reader;
};
