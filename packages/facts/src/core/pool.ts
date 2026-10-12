/**
 * The pool: an engine's providers (`definePool`), and its documents' facts
 * (`FactPool`), from which the rules derive name resolution, types and
 * diagnostics, and the services (definition, references, rename) query.
 *
 * Incrementality is Salsa-style at the inputs: each document is extracted
 * once per text (a provider may split one, as the goal model is, field by
 * field), and when a document's facts are the same but for their locations
 * (an edit in a comment, a description, whitespace) the derived relations
 * are kept: only the locations move (early cut-off). Otherwise the rules run
 * again on every document's facts.
 */
import { Database, Program } from '../datalog/evaluate';
import { parseRules, type Tuple, type Value } from '../datalog/syntax';
import { CORE_RULES, OPEN_RELATIONS, RENAME_RULES } from './rules';
import type {
  KindDefinition,
  PoolDefinition,
  PoolDiagnostic,
  PoolDocument,
  PoolEdit,
  PoolGlue,
  PoolLocation,
  PoolProvider,
  PoolReference,
} from './types';

export class PoolDefinitionError extends Error {}

/** An engine's pool: its providers, their kinds, and every rule, compiled once. */
export type PoolSetup = {
  engine: string;
  providers: readonly PoolProvider[];
  glue: PoolGlue | null;
  kinds: ReadonlyMap<string, KindDefinition & { provider: PoolProvider }>;
  program: Program;
  messages: Readonly<Record<string, string>>;
};

/** The relations a rule text derives. */
const headsOf = (rules: string) => [
  ...new Set(parseRules(rules).map((rule) => rule.head.relation)),
];

/**
 * An engine's pool of providers, and the glue rules across them. Fails when
 * two share an id, or when one's rules derive a relation outside its
 * namespace other than the open ones (which compose by union).
 */
export const definePool = (
  engine: string,
  providers: readonly PoolProvider[],
  glue: PoolGlue | null = null,
): PoolSetup => {
  const ids = [...providers.map((p) => p.id), ...(glue ? [glue.id] : [])];
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice)
    throw new PoolDefinitionError(`Two providers of ${engine} are ${twice}`);
  const kinds = new Map<string, KindDefinition & { provider: PoolProvider }>();
  for (const provider of providers)
    for (const [kind, definition] of Object.entries(provider.kinds)) {
      if (kind.includes('.'))
        throw new PoolDefinitionError(
          `${provider.id} defines ${kind}: a kind is named in its provider's namespace, unqualified`,
        );
      kinds.set(`${provider.id}.${kind}`, { ...definition, provider });
    }
  const sources = [
    ...providers.map((p) => ({ id: p.id, rules: p.rules })),
    ...(glue ? [{ id: glue.id, rules: glue.rules }] : []),
  ];
  for (const { id, rules } of sources) {
    if (!rules) continue;
    const outside = headsOf(rules).find(
      (head) => !head.startsWith(`${id}.`) && !OPEN_RELATIONS.includes(head),
    );
    if (outside)
      throw new PoolDefinitionError(
        `${id}'s rules derive ${outside}, outside its namespace (${id}.…) and the open relations`,
      );
  }
  for (const provider of providers)
    for (const kind of provider.refers ?? [])
      if (!kinds.has(kind))
        throw new PoolDefinitionError(
          `${provider.id} refers to ${kind}, which no provider of ${engine} defines`,
        );
  return {
    engine,
    providers,
    glue,
    kinds,
    program: new Program(
      [CORE_RULES, ...sources.map((s) => s.rules ?? '')].join('\n'),
    ),
    messages: Object.assign(
      {},
      ...providers.map((p) => p.messages ?? {}),
      glue?.messages ?? {},
    ),
  };
};

/** What one document gave: its facts as tuples, and where each id is. */
type Extracted = {
  provider: PoolProvider;
  /** the input it was extracted from */
  input: string;
  text: string;
  tuples: (readonly [string, Tuple])[];
  /** the tuples, as one string: equal when only locations moved */
  semantic: string;
  locations: Map<string, PoolLocation>;
  definitions: Map<string, PoolDefinition>;
};

/** `Sequence(Request)` names `Request`: a type's base, a collection unwrapped. */
const baseType = (type: string) => /^\w+\((.*)\)$/.exec(type)?.[1] ?? type;

export type PoolStats = {
  /** documents extracted (not taken from the memo) */
  extracted: number;
  /** updates whose facts changed only in their locations */
  cutOffs: number;
  /** full runs of the rules */
  evaluations: number;
  /** the last update's time (split, memo, extraction), and the last run's, in ms */
  lastUpdate: number;
  lastEvaluation: number;
};

export type Hover = {
  kind: string;
  label: string;
  name: string;
  type?: string;
  detail?: string;
  location: PoolLocation;
};

export type RenameResult = { edits: PoolEdit[] } | { refused: string };

export class FactPool {
  private readonly documents = new Map<string, Extracted>();
  private database: Database | null = null;
  private locations = new Map<string, PoolLocation>();
  private definitions = new Map<string, PoolDefinition>();
  readonly stats: PoolStats = {
    extracted: 0,
    cutOffs: 0,
    evaluations: 0,
    lastUpdate: 0,
    lastEvaluation: 0,
  };

  constructor(readonly setup: PoolSetup) {}

  private providerOf(document: PoolDocument): PoolProvider | undefined {
    return this.setup.providers.find(
      ({ documents }) =>
        (document.kind === 'model' && documents.model) ||
        documents.resources?.includes(document.kind) ||
        documents.extensions?.some((ext) => document.id.endsWith(ext)),
    );
  }

  /** The name a kind compares by: lower-cased where it is case-insensitive. */
  private key(kind: string, name: string): string {
    return this.setup.kinds.get(kind)?.caseInsensitive
      ? name.toLowerCase()
      : name;
  }

  private extract(
    provider: PoolProvider,
    document: PoolDocument,
    input: string,
  ): Extracted {
    this.stats.extracted += 1;
    const facts = provider.extract(document);
    const tuples: (readonly [string, Tuple])[] = [];
    const locations = new Map<string, PoolLocation>();
    const definitions = new Map<string, PoolDefinition>();
    const add = (relation: string, ...values: Value[]) =>
      tuples.push([relation, values]);
    for (const definition of facts.definitions) {
      definitions.set(definition.id, definition);
      locations.set(definition.id, definition.location);
      add(
        'defines',
        definition.id,
        definition.kind,
        this.key(definition.kind, definition.name),
      );
      add('name', definition.id, definition.name);
      add('in', definition.id, document.id);
      if (definition.owner) add('owns', definition.owner, definition.id);
      if (definition.type) {
        add('typeOf', definition.id, definition.type);
        add('typeBase', definition.id, baseType(definition.type));
      }
    }
    // a via-reference not listed is listed after the others
    const references: PoolReference[] = [...facts.references];
    for (const reference of facts.references)
      if (
        reference.scope &&
        'via' in reference.scope &&
        !references.includes(reference.scope.via)
      )
        references.push(reference.scope.via);
    const idOf = (reference: PoolReference) =>
      `${document.id}#${reference.id ?? `r${references.indexOf(reference)}`}`;
    for (const reference of references) {
      const id = idOf(reference);
      locations.set(id, reference.location);
      for (const kind of reference.kinds)
        add('refers', id, kind, this.key(kind, reference.name));
      add('name', id, reference.name);
      add('in', id, document.id);
      const { scope } = reference;
      if (scope) {
        add('scoped', id);
        if ('owner' in scope) add('scope', id, scope.owner);
        else add('via', id, idOf(scope.via), scope.through);
      }
    }
    for (const [relation, ...values] of facts.relations ?? [])
      add(
        relation,
        ...values.map((value) =>
          typeof value === 'object' ? `${document.id}#${value.ref}` : value,
        ),
      );
    return {
      provider,
      input,
      text: document.text ?? '',
      tuples,
      semantic: tuples.map(([r, t]) => `${r}(${t.join('\u0001')})`).join('\n'),
      locations,
      definitions,
    };
  }

  /**
   * The project's documents now: each is extracted again only when its text
   * (or value) changed, and the rules run again only when some document's
   * facts did. Documents no provider speaks are ignored.
   */
  update(documents: readonly PoolDocument[]): void {
    const started = performance.now();
    const seen = new Set<string>();
    let changed = false;
    let moved = false;
    const visit = (document: PoolDocument, provider: PoolProvider) => {
      seen.add(document.id);
      const input = `${document.text ?? ''}\u0000${document.value === undefined ? '' : JSON.stringify(document.value)}`;
      const before = this.documents.get(document.id);
      if (before && before.input === input && before.provider === provider)
        return;
      const extracted = this.extract(provider, document, input);
      this.documents.set(document.id, extracted);
      if (before?.semantic === extracted.semantic) moved = true;
      else changed = true;
    };
    for (const document of documents) {
      const provider = this.providerOf(document);
      if (!provider) continue;
      for (const part of provider.split ? provider.split(document) : [document])
        visit(part, provider);
    }
    for (const id of this.documents.keys())
      if (!seen.has(id)) {
        this.documents.delete(id);
        changed = true;
      }
    if (changed) this.database = null;
    else if (moved) this.stats.cutOffs += 1;
    if (changed || moved) {
      this.locations = new Map(
        [...this.documents.values()].flatMap((d) => [...d.locations]),
      );
      this.definitions = new Map(
        [...this.documents.values()].flatMap((d) => [...d.definitions]),
      );
    }
    this.stats.lastUpdate = performance.now() - started;
  }

  /** The kinds' scopes: what the core's resolution rules read. */
  private *kindFacts(): Generator<readonly [string, Tuple]> {
    for (const [kind, definition] of this.setup.kinds)
      yield ['kindScope', [kind, definition.scope ?? 'global']];
  }

  /** The derived relations (the rules run when a document's facts changed). */
  get db(): Database {
    if (!this.database) {
      const started = performance.now();
      this.stats.evaluations += 1;
      const documents = [...this.documents.values()];
      this.database = this.setup.program.run(
        (function* (kinds) {
          yield* kinds;
          for (const d of documents) yield* d.tuples;
        })(this.kindFacts()),
      );
      this.stats.lastEvaluation = performance.now() - started;
    }
    return this.database;
  }

  /** A document's text (a model field's, after the split). */
  textOf(document: string): string | undefined {
    return this.documents.get(document)?.text;
  }

  locationOf(id: string): PoolLocation | undefined {
    return this.locations.get(id);
  }

  definition(id: string): PoolDefinition | undefined {
    return this.definitions.get(id);
  }

  /** The written name of a definition or reference. */
  nameOf(id: string): string {
    return String(this.db.query('name', [id])[0]?.[1] ?? '');
  }

  private label(kind: string): string {
    return this.setup.kinds.get(kind)?.label ?? kind;
  }

  private message(id: string, code: string, arg: Value): string {
    const name = this.nameOf(id);
    if (code === 'unresolved') {
      const kinds = this.db
        .query('refers', [id])
        .map((t) => this.label(String(t[1])));
      return `No ${[...new Set(kinds)].join(' or ')} named \`${name}\``;
    }
    if (code === 'ambiguous')
      return `\`${name}\` names ${this.db.query('resolves', [id]).length} definitions`;
    const template = this.setup.messages[code] ?? code;
    return template.replace(/\{name\}/g, name).replace(/\{arg\}/g, String(arg));
  }

  /** What the rules find wrong, where (a problem whose id has no location is dropped). */
  diagnostics(): PoolDiagnostic[] {
    return this.db.query('problem').flatMap(([id, severity, code, arg]) => {
      const location = this.locations.get(String(id));
      return location
        ? [
            {
              location,
              severity: severity as PoolDiagnostic['severity'],
              code: String(code),
              message: this.message(String(id), String(code), arg ?? ''),
            },
          ]
        : [];
    });
  }

  /**
   * The definition or reference at an offset: the narrowest one, a reference
   * over a definition at the same place (a location type is a world class's
   * name).
   */
  idAt(document: string, offset: number): string | null {
    let best: string | null = null;
    let width = Infinity;
    const extracted = this.documents.get(document);
    for (const [id, at] of extracted?.locations ?? []) {
      if (at.from > offset || offset > at.to) continue;
      const span = at.to - at.from;
      if (
        span < width ||
        (span === width &&
          this.definitions.has(best!) &&
          !this.definitions.has(id))
      ) {
        best = id;
        width = span;
      }
    }
    return best;
  }

  /** The definitions a definition or reference stands for (a definition, itself). */
  targetsOf(id: string): string[] {
    return this.definitions.has(id)
      ? [id]
      : this.db.query('resolves', [id]).map((t) => String(t[1]));
  }

  /** Go to definition. */
  definitionAt(document: string, offset: number): PoolLocation[] {
    const id = this.idAt(document, offset);
    return id
      ? this.targetsOf(id).flatMap((t) => this.locations.get(t) ?? [])
      : [];
  }

  /** A definition's references (not itself). */
  referencesTo(definition: string): PoolLocation[] {
    return this.db
      .query('resolves', [undefined, definition])
      .flatMap(([r]) => this.locations.get(String(r)) ?? []);
  }

  /** Find references: the definition at an offset, and every reference to it. */
  referencesAt(document: string, offset: number): PoolLocation[] {
    const id = this.idAt(document, offset);
    return id
      ? this.targetsOf(id).flatMap((t) => [
          ...(this.locations.has(t) ? [this.locations.get(t)!] : []),
          ...this.referencesTo(t),
        ])
      : [];
  }

  hoverAt(document: string, offset: number): Hover | null {
    const id = this.idAt(document, offset);
    const [target] = id ? this.targetsOf(id) : [];
    const definition = target ? this.definitions.get(target) : undefined;
    // its type: as extracted, else as the rules derived it (a world attribute's)
    const type =
      definition?.type ?? this.db.query('typeOf', [target])[0]?.[1]?.toString();
    return definition
      ? {
          kind: definition.kind,
          label: this.label(definition.kind),
          name: definition.name,
          ...(type && { type }),
          ...(definition.detail && { detail: definition.detail }),
          location: definition.location,
        }
      : null;
  }

  /**
   * Rename the symbol at an offset: its definition and every reference to
   * it, in every document. Refused where nothing is, where its provider
   * keeps it, and when the new name is defined for its kind in its scope
   * (`rename.conflict`, a rule).
   */
  renameAt(document: string, offset: number, newName: string): RenameResult {
    const id = this.idAt(document, offset);
    const targets = id ? this.targetsOf(id) : [];
    if (targets.length !== 1)
      return {
        refused: targets.length
          ? `\`${this.nameOf(id!)}\` names ${targets.length} definitions`
          : 'Nothing to rename here',
      };
    const target = targets[0]!;
    const definition = this.definitions.get(target)!;
    const provider = this.setup.kinds.get(definition.kind)?.provider;
    const text = provider?.renameText
      ? provider.renameText(definition, newName)
      : newName;
    if (text === null)
      return { refused: `A ${this.label(definition.kind)} can't be renamed` };
    const check = RENAME_PROGRAM.run(
      (function* (db: Database, request: Tuple) {
        for (const t of db.query('defines')) yield ['defines', t] as const;
        for (const t of db.query('owns')) yield ['owns', t] as const;
        yield ['rename.request', request] as const;
      })(this.db, [target, this.key(definition.kind, text)]),
    );
    const [clash] = check.query('rename.conflict');
    if (clash)
      return {
        refused: `A ${this.label(definition.kind)} named \`${text}\` is already defined here`,
      };
    const edits = [definition.location, ...this.referencesTo(target)].map(
      (at) => ({ ...at, text }),
    );
    return { edits };
  }
}

const RENAME_PROGRAM = new Program(RENAME_RULES);
