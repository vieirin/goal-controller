/**
 * What a document's annotated values mean to the pool (#68's facts):
 * definitions with their ids, owners and types; references with their
 * scopes; and the links between definitions. A path in an annotation is
 * resolved here, against the objects the value sits in.
 */
import type {
  PoolDefinition,
  PoolLocation,
  PoolReference,
  PoolScope,
} from '../engines/definitionPool';
import type {
  Annotation,
  DefinesOptions,
  KindDeclaration,
  Kind,
  Occurrence,
  Path,
  RefersToOptions,
  Scope,
  Unresolved,
} from './protocol';
import { pathKey, type Entity } from './walk';
import type { ValuePath } from './read';

type Defines = Extract<Annotation, { defines: Kind }>;
type RefersTo = Extract<Annotation, { refersTo: readonly Kind[] }>;
type Link = Extract<Annotation, { link: string }>;

/** A hidden definition's kind: a Langium scope node, which owns members and defines nothing. */
export const SCOPE_KIND = '#scope';
/** `scope.owner` through a reference: the definition it resolves to. */
export const SELF = '#self';
/** `scope.through('type', …)`: the definition the type names. */
export const TYPE = '#type';
export const linkResolver = (name: string) =>
  name === 'type' ? TYPE : `link:${name}`;

/** A scope that leads nowhere: what it names isn't written (#68 says nothing then). */
const NOWHERE: PoolReference = {
  kinds: [],
  name: '',
  location: { document: '', from: -1, to: -1 },
  silent: true,
};
const nowhere: PoolScope = { via: NOWHERE, through: SELF };

/** What a check reads of a definition or a reference, besides #68's fields. */
export type Meta = {
  file: string;
  document: string;
  path: ValuePath;
  value: unknown;
  /** the object (or Langium node) the value is in */
  parent: unknown;
};

export type DefinitionMeta = Meta;
export type ReferenceMeta = Meta & {
  /** the id of the definition of its object (`link`'s source) */
  owner?: string;
  unresolved?: Unresolved;
  /** what its scope names isn't written */
  nowhere?: true;
};

export const definitionMeta = new WeakMap<PoolDefinition, DefinitionMeta>();
export const referenceMeta = new WeakMap<PoolReference, ReferenceMeta>();

export type DocumentFacts = {
  definitions: PoolDefinition[];
  references: PoolReference[];
  /** a definition whose id another one of the document has already */
  duplicates: PoolDefinition[];
  links: { name: string; source: string; reference: PoolReference }[];
};

/** A name and where it is, from an annotated value and its part (null: no name there). */
const nameOf = (
  entity: Entity,
  part: DefinesOptions['name'] | RefersToOptions['name'],
): { name: string; location: PoolLocation } | null => {
  if (!entity.written) return null;
  const text =
    typeof entity.value === 'string' ? entity.value : entity.written.text;
  const piece = part ? part(text) : { text, offset: 0 };
  if (!piece || !piece.text) return null;
  const from = entity.written.from + piece.offset;
  return {
    name: piece.text,
    location: {
      document: entity.written.document,
      from,
      to: from + piece.text.length,
    },
  };
};

type Draft = {
  entity: Entity;
  annotation: Defines;
  name: string;
  location: PoolLocation;
};

export const factsOf = (
  entities: readonly Entity[],
  context: {
    file: string;
    document: string;
    root: unknown;
    kinds: Readonly<Record<Kind, KindDeclaration>>;
  },
): DocumentFacts => {
  const { kinds } = context;
  const normalize = (kind: Kind, name: string) =>
    kinds[kind]?.caseInsensitive ? name.toLowerCase() : name;
  const meta = (entity: Entity): Meta => ({
    file: context.file,
    document: context.document,
    path: entity.path,
    value: entity.value,
    parent: entity.parent,
  });

  const byPath = new Map<string, Entity[]>();
  for (const entity of entities)
    if (!entity.scopeNode) {
      const key = pathKey(entity.path, entity.isKey);
      byPath.set(key, [...(byPath.get(key) ?? []), entity]);
    }

  /** the entities at a path, from an entity (none written there: undefined) */
  const resolve = (
    entity: Entity,
    path: Path,
  ): { value: unknown; entities: Entity[] } | undefined => {
    if (typeof path === 'object') {
      let index = entity.path.length - 1;
      while (index >= 0 && typeof entity.path[index] !== 'number') index -= 1;
      const position = entity.path[index] as number | undefined;
      if (position === undefined || position === 0)
        return resolve(entity, path.previous);
      const previous = [...entity.path];
      previous[index] = position - 1;
      const found = byPath.get(pathKey(previous));
      return found && { value: found[0]!.value, entities: found };
    }
    const frames = entity.frames;
    let frame;
    let key = path;
    if (path.startsWith('^')) {
      key = path.slice(1);
      frame = [...frames].reverse().find((f) => key in f.value);
    } else {
      let up = 0;
      while (key.startsWith('../')) {
        key = key.slice(3);
        up += 1;
      }
      frame = frames[frames.length - 1 - up];
    }
    if (!frame || !(key in frame.value)) return undefined;
    return {
      value: (frame.value as Record<string, unknown>)[key],
      entities: byPath.get(pathKey([...frame.path, key])) ?? [],
    };
  };

  // the definitions, their names and where they are
  const drafts: Draft[] = [];
  const draftsOf = new Map<Entity, Draft[]>();
  for (const entity of entities)
    for (const annotation of entity.annotations)
      if ('defines' in annotation) {
        const named = nameOf(entity, annotation.name);
        if (!named) continue;
        const draft = { entity, annotation, ...named };
        drafts.push(draft);
        draftsOf.set(entity, [...(draftsOf.get(entity) ?? []), draft]);
      }

  // a scope node's hidden definition, and a definition's id (with its owner's)
  const ids = new Map<Draft | Entity, string | undefined>();
  const owners = new Map<Draft | Entity, string | undefined>();
  const scopeId = (entity: Entity): string | undefined => {
    if (ids.has(entity)) return ids.get(entity);
    ids.set(entity, undefined);
    const owner = entity.langiumOwner && ownerEntityId(entity.langiumOwner);
    const id = `${SCOPE_KIND}:${owner ? `${owner}/` : ''}${context.document}${pathKey(entity.path)}`;
    ids.set(entity, id);
    owners.set(entity, owner);
    return id;
  };
  /** the id of what an entity defines (a scope node: its hidden one) */
  const ownerEntityId = (entity: Entity): string | undefined => {
    if (entity.scopeNode) return scopeId(entity);
    const draft = draftsOf.get(entity)?.[0];
    return draft && idOf(draft);
  };
  const ownerOf = (draft: Draft): string | undefined => {
    if (owners.has(draft)) return owners.get(draft);
    owners.set(draft, undefined);
    let owner: string | undefined;
    if (draft.annotation.owner !== undefined) {
      const target = resolve(draft.entity, draft.annotation.owner);
      const found = target?.entities.find((e) => draftsOf.has(e));
      owner = found && ownerEntityId(found);
    } else if (draft.entity.lexical && draft.entity.langiumOwner)
      owner = ownerEntityId(draft.entity.langiumOwner);
    owners.set(draft, owner);
    return owner;
  };
  const idOf = (draft: Draft): string | undefined => {
    if (ids.has(draft)) return ids.get(draft);
    ids.set(draft, undefined);
    const owner = ownerOf(draft);
    const { defines: kind } = draft.annotation;
    const id = `${kind}:${owner ? `${owner}/` : ''}${normalize(kind, draft.name)}`;
    ids.set(draft, id);
    return id;
  };

  const definitions: PoolDefinition[] = [];
  const references: PoolReference[] = [];
  const duplicates: PoolDefinition[] = [];
  const defined = new Map<string, PoolDefinition>();
  // a first use's later uses (and those before a plain definition): references to it
  const uses = new Map<string, Draft[]>();
  const define = (draft: Draft) => {
    const id = idOf(draft)!;
    const owner = ownerOf(draft);
    const definition: PoolDefinition = {
      id,
      kind: draft.annotation.defines,
      name: draft.name,
      location: draft.location,
      ...(owner && { owner }),
    };
    definitionMeta.set(definition, meta(draft.entity));
    if (defined.has(id)) duplicates.push(definition);
    else defined.set(id, definition);
    definitions.push(definition);
    uses.set(id, [...(uses.get(id) ?? []), draft]);
  };
  for (const draft of drafts) if (!draft.annotation.firstUse) define(draft);
  for (const draft of drafts) {
    if (!draft.annotation.firstUse) continue;
    const id = idOf(draft)!;
    if (!defined.has(id)) {
      define(draft);
      continue;
    }
    uses.set(id, [...(uses.get(id) ?? []), draft]);
    const owner = ownerOf(draft);
    const reference: PoolReference = {
      kinds: [draft.annotation.defines],
      name: draft.name,
      location: draft.location,
      ...(owner && { scope: { owner } }),
      silent: true,
    };
    referenceMeta.set(reference, { ...meta(draft.entity), unresolved: false });
    references.push(reference);
  }
  for (const scopeNode of entities.filter((e) => e.scopeNode)) {
    const id = scopeId(scopeNode)!;
    const owner = owners.get(scopeNode);
    definitions.push({
      id,
      kind: SCOPE_KIND,
      name: id,
      location: { document: context.document, from: -1, to: -1 },
      ...(owner && { owner }),
    });
  }

  // types: a path's text, a literal, or what its occurrences make it
  for (const definition of definitions) {
    const [first, ...rest] = uses.get(definition.id) ?? [];
    if (!first || definitionMeta.get(definition)?.path !== first.entity.path)
      continue;
    const source = first.annotation.type;
    if (source === undefined) continue;
    let type: string | undefined;
    if (typeof source === 'function') {
      const occurrences: Occurrence[] = [first, ...rest].map(({ entity }) => ({
        value: entity.value,
        parent: entity.parent,
        text: entity.text,
      }));
      type = source(occurrences, context.root);
    } else if (typeof source === 'object' && 'literal' in source)
      type = source.literal;
    else {
      const value = resolve(first.entity, source)?.value;
      type = typeof value === 'string' ? value : undefined;
    }
    if (type !== undefined) definition.type = type;
  }

  // the definition an object holds: its first `defines`, by the object's path
  const objectDefinition = new Map<string, string>();
  for (const draft of drafts) {
    const parentPath = pathKey(draft.entity.path.slice(0, -1));
    if (!objectDefinition.has(parentPath))
      objectDefinition.set(parentPath, idOf(draft)!);
  }
  const definitionOfObject = (entity: Entity): string | undefined => {
    for (const frame of [...entity.frames].reverse()) {
      const id = objectDefinition.get(pathKey(frame.path));
      if (id) return id;
    }
    return undefined;
  };

  // the references, then their scopes (a scope may name another reference)
  const referenceOf = new Map<Entity, PoolReference>();
  const pending: {
    entity: Entity;
    annotation: RefersTo;
    reference: PoolReference;
  }[] = [];
  for (const entity of entities)
    for (const annotation of entity.annotations) {
      if (!('refersTo' in annotation) || referenceOf.has(entity)) continue;
      const named = nameOf(entity, annotation.name);
      if (!named) continue;
      const reference: PoolReference = {
        kinds: annotation.refersTo,
        name: named.name,
        location: named.location,
        silent: true,
      };
      const owner = definitionOfObject(entity);
      referenceMeta.set(reference, {
        ...meta(entity),
        ...(owner && { owner }),
        ...(annotation.unresolved !== undefined && {
          unresolved: annotation.unresolved,
        }),
      });
      referenceOf.set(entity, reference);
      pending.push({ entity, annotation, reference });
      references.push(reference);
    }

  /** a reference to what a definition draft defines (`through` from a definition) */
  const toDefinition = (draft: Draft): PoolReference => {
    const owner = ownerOf(draft);
    return {
      kinds: [draft.annotation.defines],
      name: draft.name,
      location: draft.location,
      ...(owner && { scope: { owner } }),
      silent: true,
    };
  };
  const scopeOf = (
    entity: Entity,
    where: Scope | undefined,
  ): PoolScope | undefined => {
    if (!where) {
      if (!entity.lexical || !entity.langiumOwner) return undefined;
      const owner = ownerEntityId(entity.langiumOwner);
      return owner ? { owner } : undefined;
    }
    const path = 'owner' in where ? where.owner : where.path;
    const target = resolve(entity, path)?.entities ?? [];
    const draft = target.flatMap((e) => draftsOf.get(e) ?? [])[0];
    const via = target.map((e) => referenceOf.get(e)).find(Boolean);
    if ('owner' in where) {
      if (draft) {
        const id = idOf(draft);
        return id ? { owner: id } : nowhere;
      }
      return via ? { via, through: SELF } : nowhere;
    }
    const through = linkResolver(where.through);
    if (via) return { via, through };
    return draft ? { via: toDefinition(draft), through } : nowhere;
  };
  for (const { entity, annotation, reference } of pending) {
    const scope = scopeOf(entity, annotation.scope);
    if (scope === nowhere) referenceMeta.get(reference)!.nowhere = true;
    if (scope) reference.scope = scope;
  }

  // the links: from a definition (its object's, or `from`'s) to a reference's target
  const links: DocumentFacts['links'] = [];
  for (const entity of entities)
    for (const annotation of entity.annotations) {
      if (!('link' in annotation)) continue;
      const reference = referenceOf.get(entity);
      if (!reference) continue;
      const { from } = annotation as Link;
      const source =
        from !== undefined
          ? (() => {
              const draft = (resolve(entity, from)?.entities ?? []).flatMap(
                (e) => draftsOf.get(e) ?? [],
              )[0];
              return draft && idOf(draft);
            })()
          : definitionOfObject(entity);
      if (source) links.push({ name: annotation.link, source, reference });
    }

  return { definitions, references, duplicates, links };
};
