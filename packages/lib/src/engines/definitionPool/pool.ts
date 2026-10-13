/**
 * The pool's core: an engine's providers registered (`definePool`), each
 * document's facts extracted once per text (`createPool`'s `update`), the
 * references resolved against the definitions of every document, and the
 * providers' checks run over the result.
 */
import type {
  PoolDefinition,
  PoolDiagnostic,
  PoolDocument,
  PoolFacts,
  PoolKind,
  PoolLookup,
  PoolProvider,
  PoolReference,
  PoolRegistration,
} from './types';

/** What `update` gives: the pool as the documents are now. */
export type PoolIndex = PoolLookup & {
  registration: PoolRegistration;
  /** every definition, in the documents' order */
  definitions: readonly PoolDefinition[];
  /** what the providers' and the engine's checks find */
  diagnostics: readonly PoolDiagnostic[];
  /** the provider a document is read by */
  providerOf(documentId: string): PoolProvider | undefined;
  /** a qualified kind's declaration */
  kindOf(kind: string): (PoolKind & { provider: PoolProvider }) | undefined;
};

/** A provider's kind, qualified by its id (none: written qualified already). */
const qualified = (provider: PoolProvider, kind: string) =>
  provider.id ? `${provider.id}.${kind}` : kind;

/**
 * An engine's pool, checked: provider ids are unique, and what a provider
 * refers to is a kind one of them defines. (What it extracts is checked
 * against its namespace as it extracts it.)
 */
export const definePool = (
  registration: PoolRegistration,
): PoolRegistration => {
  const ids = new Set<string>();
  const kinds = new Set<string>();
  for (const provider of registration.providers) {
    if (ids.has(provider.id))
      throw new Error(
        `${registration.engine}'s pool: two providers are ${provider.id}`,
      );
    ids.add(provider.id);
    for (const kind of Object.keys(provider.kinds))
      kinds.add(qualified(provider, kind));
  }
  for (const provider of registration.providers)
    for (const kind of provider.refers ?? [])
      if (!kinds.has(kind))
        throw new Error(
          `${registration.engine}'s pool: ${provider.id} refers to ${kind}, which no provider defines`,
        );
  return registration;
};

/** The provider that reads a document: by its kind, the model, or its extension. */
const providerFor = (
  registration: PoolRegistration,
  document: PoolDocument,
): PoolProvider | undefined =>
  registration.providers.find(
    ({ documents }) =>
      documents.resources?.includes(document.kind) ||
      (document.kind === 'model' && documents.model) ||
      documents.extensions?.some((extension) =>
        document.id.toLowerCase().endsWith(extension),
      ),
  );

/** A provider's facts, held to its namespace and to what it says it refers to. */
const extractChecked = (
  provider: PoolProvider,
  document: PoolDocument,
): PoolFacts => {
  const facts = provider.extract(document);
  const own = (kind: string) =>
    !provider.id || kind.startsWith(`${provider.id}.`);
  for (const definition of facts.definitions)
    if (!own(definition.kind))
      throw new Error(
        `${provider.id} defines ${definition.kind}, outside its namespace`,
      );
  for (const reference of facts.references)
    for (const kind of reference.kinds)
      if (!own(kind) && !provider.refers?.includes(kind))
        throw new Error(
          `${provider.id} refers to ${kind} without saying so (refers)`,
        );
  return facts;
};

/**
 * A pool over an engine's providers. `update` takes the documents as they
 * are now and re-extracts only those whose text (or value) changed; the
 * resolution and the checks run over every document's facts.
 */
export const createPool = (registration: PoolRegistration) => {
  const cache = new Map<
    string,
    { source: unknown; provider: PoolProvider; facts: PoolFacts }
  >();
  const kinds = new Map<string, PoolKind & { provider: PoolProvider }>();
  for (const provider of registration.providers)
    for (const [kind, declaration] of Object.entries(provider.kinds))
      kinds.set(qualified(provider, kind), { ...declaration, provider });

  const normalize = (kind: string, name: string) =>
    kinds.get(kind)?.caseInsensitive ? name.toLowerCase() : name;

  const update = (documents: readonly PoolDocument[]): PoolIndex => {
    const present = new Map<string, PoolDocument>();
    const providers = new Map<string, PoolProvider>();
    const definitions: PoolDefinition[] = [];
    const references: PoolReference[] = [];
    for (const document of documents) {
      // a document no provider speaks is there for the checks to read, with no facts
      present.set(document.id, document);
      const provider = providerFor(registration, document);
      if (!provider) continue;
      providers.set(document.id, provider);
      const source = document.text ?? document.value;
      let held = cache.get(document.id);
      if (!held || held.source !== source || held.provider !== provider) {
        held = { source, provider, facts: extractChecked(provider, document) };
        cache.set(document.id, held);
      }
      definitions.push(...held.facts.definitions);
      references.push(...held.facts.references);
    }
    for (const id of [...cache.keys()]) if (!present.has(id)) cache.delete(id);

    // definitions by id (the first wins), and by kind, owner and name
    const byId = new Map<string, PoolDefinition>();
    const byName = new Map<string, Map<string, Map<string, PoolDefinition>>>();
    for (const definition of definitions) {
      if (byId.has(definition.id)) continue;
      byId.set(definition.id, definition);
      const owners = byName.get(definition.kind) ?? new Map();
      byName.set(definition.kind, owners);
      const names = owners.get(definition.owner ?? '') ?? new Map();
      owners.set(definition.owner ?? '', names);
      const key = normalize(definition.kind, definition.name);
      if (!names.has(key)) names.set(key, definition);
    }
    const byKind = new Map<string, PoolDefinition[]>();
    for (const definition of byId.values())
      byKind.set(definition.kind, [
        ...(byKind.get(definition.kind) ?? []),
        definition,
      ]);

    const find = (
      kindsToFind: readonly string[],
      name: string,
      owner?: string,
    ): PoolDefinition | undefined => {
      for (const kind of kindsToFind) {
        const owners = byName.get(kind);
        const key = normalize(kind, name);
        // in the owner, then in the owner's owner, and so on
        let found: PoolDefinition | undefined;
        for (
          let scope = owner;
          scope !== undefined && !found;
          scope = byId.get(scope)?.owner
        )
          found = owners?.get(scope)?.get(key);
        found ??=
          kinds.get(kind)?.scope === 'owner'
            ? undefined
            : owners?.get('')?.get(key);
        if (found) return found;
      }
      return undefined;
    };

    // resolution is lazy: a scope may read another reference's target
    const targets = new Map<PoolReference, PoolDefinition | null>();
    const resolving = new Set<PoolReference>();
    const lookup: PoolLookup = {
      definition: (id) => byId.get(id),
      definitionsOf: (kind) => byKind.get(kind) ?? [],
      find,
      target: (reference) => {
        const known = targets.get(reference);
        if (known !== undefined) return known ?? undefined;
        if (resolving.has(reference)) return undefined;
        resolving.add(reference);
        const owner = ownerOf(reference);
        const found =
          owner === null
            ? undefined
            : find(reference.kinds, reference.name, owner);
        resolving.delete(reference);
        targets.set(reference, found ?? null);
        return found;
      },
      referencesTo: (id) => referencesTo.get(id) ?? [],
      references: () => references,
      documents: present,
      has: (kind) => [...present.values()].some((d) => d.kind === kind),
    };
    /** the owner a reference is looked up in: undefined, none; null, its scope leads nowhere */
    const ownerOf = (reference: PoolReference): string | undefined | null => {
      const { scope } = reference;
      if (!scope) return undefined;
      if ('owner' in scope) return scope.owner;
      const via = lookup.target(scope.via);
      if (!via) return null;
      const owner =
        scope.through === 'type'
          ? via.type !== undefined
            ? registration.typeDefinition?.(via.type, lookup)
            : undefined
          : registration.resolvers?.[scope.through]?.(via, lookup);
      return owner ?? null;
    };

    const referencesTo = new Map<string, PoolReference[]>();
    for (const reference of references) {
      const target = lookup.target(reference);
      if (target)
        referencesTo.set(target.id, [
          ...(referencesTo.get(target.id) ?? []),
          reference,
        ]);
    }

    const diagnostics = [
      ...registration.providers.flatMap(
        (provider) => provider.checks?.(lookup) ?? [],
      ),
      ...(registration.checks?.(lookup) ?? []),
    ];
    // what resolves to nothing, every provider's: unless a check says it
    // already, an earlier name of its path failed, or what it refers to
    // isn't in the project
    const said = new Set(
      diagnostics.map((d) => `${d.document}\0${d.from}\0${d.to}`),
    );
    const speaking = new Set(providers.values());
    for (const reference of references) {
      if (reference.silent || lookup.target(reference)) continue;
      const { document, from, to } = reference.location;
      if (said.has(`${document}\0${from}\0${to}`)) continue;
      const kind = kinds.get(reference.kinds[0]!);
      if (!kind || !speaking.has(kind.provider)) continue;
      const owner = ownerOf(reference);
      if (owner === null) continue;
      const of = owner !== undefined ? byId.get(owner)?.name : undefined;
      diagnostics.push({
        ...reference.location,
        severity: 'warning',
        check: 'unresolved-reference',
        message: `${reference.name} is no ${kind.label}${of ? ` of ${of}` : ' the project defines'}`,
      });
    }
    return {
      ...lookup,
      registration,
      definitions: [...byId.values()],
      diagnostics,
      providerOf: (id) => providers.get(id),
      kindOf: (kind) => kinds.get(kind),
    };
  };

  return { update };
};

export type DefinitionPool = ReturnType<typeof createPool>;
