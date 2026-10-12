/**
 * The pool's services, for every document of every provider: what is at a
 * position, where it is defined, where it is used, what renaming it
 * changes, what hovering it shows, what may be written there.
 */
import type { PoolIndex } from './pool';
import type {
  PoolCompletion,
  PoolDefinition,
  PoolDiagnostic,
  PoolEdit,
  PoolLocation,
  PoolReference,
} from './types';

/** A position in a document. */
export type PoolPosition = { document: string; offset: number };

const contains = (location: PoolLocation, { document, offset }: PoolPosition) =>
  location.document === document &&
  location.from <= offset &&
  offset <= location.to;

/** What is at a position: a definition, or a reference and what it resolves to. */
export type PoolSymbolAt = {
  definition: PoolDefinition | undefined;
  reference?: PoolReference;
  /** where the name is, at the position */
  location: PoolLocation;
};

export const symbolAt = (
  index: PoolIndex,
  position: PoolPosition,
): PoolSymbolAt | null => {
  const reference = index
    .references()
    .find((r) => contains(r.location, position));
  if (reference)
    return {
      definition: index.target(reference),
      reference,
      location: reference.location,
    };
  const definition = index.definitions.find((d) =>
    contains(d.location, position),
  );
  return definition ? { definition, location: definition.location } : null;
};

/** Where what is at a position is defined (null: nothing there, or it resolves to nothing). */
export const definitionAt = (
  index: PoolIndex,
  position: PoolPosition,
): PoolLocation | null =>
  symbolAt(index, position)?.definition?.location ?? null;

/**
 * Where a definition is used: its own location first, then its references',
 * each place once (a definition by use is its first reference too).
 */
export const referencesOf = (
  index: PoolIndex,
  definition: PoolDefinition,
): PoolLocation[] => {
  const seen = new Set<string>();
  return [
    definition.location,
    ...index.referencesTo(definition.id).map((r) => r.location),
  ].filter(({ document, from, to }) => {
    const key = `${document}\0${from}\0${to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The references of what is at a position (empty: nothing there). */
export const referencesAt = (
  index: PoolIndex,
  position: PoolPosition,
): PoolLocation[] => {
  const definition = symbolAt(index, position)?.definition;
  return definition ? referencesOf(index, definition) : [];
};

/**
 * What renaming what is at a position changes: its definition and every
 * reference to it, each written as its provider writes the name. A string
 * when it can't be renamed so (and why).
 */
export const renameEdits = (
  index: PoolIndex,
  position: PoolPosition,
  newName: string,
): PoolEdit[] | string => {
  const at = symbolAt(index, position);
  if (!at) return 'Nothing to rename here';
  const { definition } = at;
  if (!definition)
    return `${at.reference!.name} is defined nowhere: nothing to rename`;
  const provider = index.kindOf(definition.kind)?.provider;
  const text = provider?.renameText
    ? provider.renameText(definition, newName)
    : newName;
  if (text === null || !newName.trim())
    return `${definition.name} can't be renamed to ${JSON.stringify(newName)}`;
  return referencesOf(index, definition).map((location) => ({
    ...location,
    text,
  }));
};

/** What hovering a position shows. */
export type PoolHover = {
  location: PoolLocation;
  definition?: PoolDefinition;
  /** its kind's label (`HDDL task`) */
  label?: string;
  /** its owner, if it has one */
  owner?: PoolDefinition;
  /** how many references it has */
  references: number;
  /** what the checks say there */
  diagnostics: PoolDiagnostic[];
  /** the name, when it resolves to nothing */
  unresolved?: string;
};

export const hoverAt = (
  index: PoolIndex,
  position: PoolPosition,
): PoolHover | null => {
  const diagnostics = index.diagnostics.filter((d) => contains(d, position));
  const at = symbolAt(index, position);
  if (!at)
    return diagnostics.length
      ? {
          location: diagnostics[0]!,
          references: 0,
          diagnostics,
        }
      : null;
  const { definition } = at;
  return {
    location: at.location,
    definition,
    label: definition && index.kindOf(definition.kind)?.label,
    owner: definition?.owner ? index.definition(definition.owner) : undefined,
    references: definition ? index.referencesTo(definition.id).length : 0,
    diagnostics,
    ...(!definition && { unresolved: at.reference!.name }),
  };
};

/**
 * The document a location is in: the one with its id, or the one whose id
 * it extends with `:` (a part of it: `model:AT1:Params` is `model`'s).
 */
export const documentOf = (index: PoolIndex, id: string): string | undefined =>
  index.documents.has(id)
    ? id
    : [...index.documents.keys()]
        .filter((document) => id.startsWith(`${document}:`))
        .sort((a, b) => b.length - a.length)[0];

/** What may be written at a position: its document's provider says. */
export const completionsAt = (
  index: PoolIndex,
  position: PoolPosition,
): PoolCompletion[] => {
  const documentId = documentOf(index, position.document);
  if (!documentId) return [];
  const document = index.documents.get(documentId);
  const provider = index.providerOf(documentId);
  return document && provider?.complete
    ? provider.complete(
        index,
        { ...document, id: position.document },
        position.offset,
      )
    : [];
};

/** The diagnostics in a document (a model field's, for `model:…`). */
export const diagnosticsIn = (
  index: PoolIndex,
  document: string,
): PoolDiagnostic[] => index.diagnostics.filter((d) => d.document === document);
