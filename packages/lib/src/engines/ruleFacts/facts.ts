/**
 * What the engines' fact readers share (goal-controller#75): a document's
 * definitions, references and own relations, with where each is written,
 * made into the rule layer's core relations (`rules/core.rls`) and rows.
 * The ids follow #63's: a definition's is its reader's, a reference's
 * `<document>#<its id in the document>`.
 */
import { FactSet, type FactValue } from '../../rules';

/** Where something is: offsets in a document (a resource's path, or a model field's `model:<key>:<field>`). */
export type RuleLocation = { document: string; from: number; to: number };

export type RuleDefinition = {
  id: string;
  /** qualified: `hddl.task` (a string in the facts) */
  kind: string;
  name: string;
  location: RuleLocation;
  owner?: string;
  type?: string;
};

export type RuleScope =
  | { owner: string }
  | { via: RuleReference; through: string };

export type RuleReference = {
  kinds: readonly string[];
  name: string;
  location: RuleLocation;
  scope?: RuleScope;
  /** its id in its document (a relation names it so); else its position */
  id?: string;
};

/** A reference, as a relation's value names it. */
export type RefValue = { ref: string };
export const ref = (id: string): RefValue => ({ ref: id });

/** A reader's own relation (`hddl_super`, Nemo's names: no dots). */
export type RuleRelation = readonly [string, ...(FactValue | RefValue)[]];

export type DocumentFacts = {
  /** the document the facts were read from */
  document: string;
  text: string;
  definitions: RuleDefinition[];
  references: RuleReference[];
  relations?: RuleRelation[];
};

export type KindDefinition = {
  label: string;
  /** names compare lower-cased (HDDL) */
  caseInsensitive?: boolean;
  /** how a reference to it resolves (`kindScope`): global unless said */
  scope?: 'global' | 'owner' | 'rules' | 'optional';
};

/** `Sequence(Request)` names `Request`: a type's base, a collection unwrapped. */
const baseType = (type: string) => /^\w+\((.*)\)$/.exec(type)?.[1] ?? type;

/** The facts of a project's documents, and where each id is. */
export type ReadFacts = {
  facts: FactSet;
  locations: ReadonlyMap<string, RuleLocation>;
  /** each id's name as written */
  names: ReadonlyMap<string, string>;
  /** a reference's kinds */
  referenceKinds: ReadonlyMap<string, readonly string[]>;
  /** each document's text (a model field's too) */
  texts: ReadonlyMap<string, string>;
};

/** Documents' facts as the core relations, with the kinds' scopes. */
export const collectFacts = (
  kinds: Readonly<Record<string, KindDefinition>>,
  documents: readonly DocumentFacts[],
): ReadFacts => {
  const facts = new FactSet();
  const locations = new Map<string, RuleLocation>();
  const names = new Map<string, string>();
  const referenceKinds = new Map<string, readonly string[]>();
  const texts = new Map<string, string>();
  const key = (kind: string, name: string) =>
    kinds[kind]?.caseInsensitive ? name.toLowerCase() : name;
  for (const [kind, definition] of Object.entries(kinds))
    facts.add('kindScope', kind, definition.scope ?? 'global');
  for (const read of documents) {
    const { document } = read;
    texts.set(document, read.text);
    for (const definition of read.definitions) {
      locations.set(definition.id, definition.location);
      names.set(definition.id, definition.name);
      facts
        .add(
          'defines',
          definition.id,
          definition.kind,
          key(definition.kind, definition.name),
        )
        .add('name', definition.id, definition.name)
        .add('in', definition.id, document);
      if (definition.owner) facts.add('owns', definition.owner, definition.id);
      if (definition.type)
        facts
          .add('typeOf', definition.id, definition.type)
          .add('typeBase', definition.id, baseType(definition.type));
    }
    // a scope's via-reference not listed is listed after the others
    const references = [...read.references];
    for (const reference of read.references)
      if (
        reference.scope &&
        'via' in reference.scope &&
        !references.includes(reference.scope.via)
      )
        references.push(reference.scope.via);
    const idOf = (reference: RuleReference) =>
      `${document}#${reference.id ?? `r${references.indexOf(reference)}`}`;
    for (const reference of references) {
      const id = idOf(reference);
      locations.set(id, reference.location);
      names.set(id, reference.name);
      referenceKinds.set(id, reference.kinds);
      for (const kind of reference.kinds)
        facts.add('refers', id, kind, key(kind, reference.name));
      facts.add('name', id, reference.name).add('in', id, document);
      const { scope } = reference;
      if (scope) {
        facts.add('scoped', id);
        if ('owner' in scope) facts.add('scope', id, scope.owner);
        else facts.add('via', id, idOf(scope.via), scope.through);
      }
    }
    for (const [relation, ...values] of read.relations ?? [])
      facts.add(
        relation,
        ...values.map((value) =>
          typeof value === 'object' ? `${document}#${value.ref}` : value,
        ),
      );
  }
  return { facts, locations, names, referenceKinds, texts };
};
