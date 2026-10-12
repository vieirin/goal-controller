/**
 * HDDL in a definition pool (goal-controller#59): a domain's types,
 * predicates, tasks, methods and actions, and their parameters, where they
 * are defined and used. It knows no engine: MutRoSe registers it, and so
 * may any engine whose resources include an HDDL domain.
 */
import type {
  PoolCompletion,
  PoolDefinition,
  PoolDocument,
  PoolFacts,
  PoolLookup,
  PoolProvider,
  PoolReference,
} from '../definitionPool';
import {
  atomOf,
  isList,
  readExprs,
  type Atom,
  type Expr,
  type List,
} from './read';

const PROVIDER = 'hddl';

/** HDDL's own root type: no definition of a domain's */
const OBJECT = 'object';

/** The formula words that are no predicate */
const CONNECTIVES = new Set([
  'and',
  'or',
  'not',
  'imply',
  'when',
  'forall',
  'exists',
]);

/** Numeric comparisons and effects: their arguments are functions' terms or numbers */
const NUMERIC = new Set([
  '=',
  '<',
  '>',
  '<=',
  '>=',
  'increase',
  'decrease',
  'assign',
  'scale-up',
  'scale-down',
]);

export type HddlProviderOptions = {
  /**
   * a type used without being listed in `:types` is declared where first
   * used (MutRoSe's domains use `robot`, `robotteam` so); otherwise such a
   * use resolves to nothing
   */
  typesDeclaredByUse?: boolean;
};

const SUBTASK_KEYS = new Set([
  ':subtasks',
  ':ordered-subtasks',
  ':tasks',
  ':ordered-tasks',
]);
const FORMULA_KEYS = new Set([':precondition', ':effect']);

const isAtom = (expr: Expr | undefined): expr is Atom =>
  expr !== undefined && !isList(expr);

/**
 * A document's facts. `kinds` of an operation's section: `task`, `method`,
 * `action`; a predicate's (and a function's) parameters are its own too.
 */
const extractWith = (
  options: HddlProviderOptions,
  document: PoolDocument,
): PoolFacts => {
  const text = document.text ?? '';
  const definitions: PoolDefinition[] = [];
  const references: PoolReference[] = [];
  const location = (atom: Atom) => ({
    document: document.id,
    from: atom.from,
    to: atom.to,
  });
  const written = (atom: Atom) => text.slice(atom.from, atom.to);
  const defined = new Set<string>();
  const define = (
    kind: string,
    atom: Atom,
    extra: Partial<PoolDefinition> = {},
  ): PoolDefinition => {
    const id = `${PROVIDER}.${kind}:${extra.owner ? `${extra.owner}/` : ''}${atom.atom}`;
    const definition: PoolDefinition = {
      id,
      kind: `${PROVIDER}.${kind}`,
      name: written(atom),
      location: location(atom),
      ...extra,
    };
    if (!defined.has(id)) {
      defined.add(id);
      definitions.push(definition);
    }
    return definition;
  };
  const refer = (kinds: string[], atom: Atom, owner?: string) =>
    references.push({
      kinds: kinds.map((kind) => `${PROVIDER}.${kind}`),
      name: written(atom),
      location: location(atom),
      ...(owner && { scope: { owner } }),
    });
  /** types used before (or without) `:types` lists them, when declared by use */
  const usedTypes: Atom[] = [];
  const referType = (atom: Atom | undefined) => {
    if (!atom || atom.atom === OBJECT) return;
    refer(['type'], atom);
    usedTypes.push(atom);
  };

  /** `?a ?b - t ?c`: each variable with its type, the type referred to */
  const typedVariables = (
    items: readonly Expr[],
  ): { variable: Atom; type: string }[] => {
    const typed: { variable: Atom; type: string }[] = [];
    let pending: Atom[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!isAtom(item)) continue;
      if (item.atom === '-') {
        const type = items[i + 1];
        referType(isAtom(type) ? type : undefined);
        const name = isAtom(type) ? written(type) : OBJECT;
        typed.push(...pending.map((variable) => ({ variable, type: name })));
        pending = [];
        i += 1;
      } else pending.push(item);
    }
    return [
      ...typed,
      ...pending.map((variable) => ({ variable, type: OBJECT })),
    ];
  };
  const parameters = (owner: string, items: readonly Expr[]) => {
    for (const { variable, type } of typedVariables(items))
      define('param', variable, { owner, type, detail: `${type} parameter` });
  };
  /** a variable's use: its operation's parameter, unless a quantifier binds it */
  const variables = (
    items: readonly Expr[],
    owner: string,
    bound: ReadonlySet<string>,
  ) => {
    for (const item of items)
      if (isAtom(item) && item.atom.startsWith('?') && !bound.has(item.atom))
        refer(['param'], item, owner);
  };
  const formula = (
    expr: Expr | undefined,
    owner: string,
    bound: ReadonlySet<string>,
  ): void => {
    if (!isList(expr)) return;
    const [head, ...rest] = expr.list;
    const word = atomOf(head);
    if (word === undefined) return;
    if (word === 'forall' || word === 'exists') {
      const [declared, body] = rest;
      const names = new Set(bound);
      if (isList(declared))
        for (const { variable } of typedVariables(declared.list))
          names.add(variable.atom);
      formula(body, owner, names);
      return;
    }
    if (CONNECTIVES.has(word)) {
      rest.forEach((part) => formula(part, owner, bound));
      return;
    }
    if (NUMERIC.has(word)) {
      for (const part of rest)
        if (isList(part) && isAtom(part.list[0])) {
          // a function's term: `(objects ?r)`
          refer(['function'], part.list[0]);
          variables(part.list.slice(1), owner, bound);
        } else if (isAtom(part)) variables([part], owner, bound);
      return;
    }
    refer(['predicate'], head as Atom);
    variables(rest, owner, bound);
  };
  const subtasks = (expr: Expr | undefined, owner: string): void => {
    if (!isList(expr)) return;
    const [head, second, ...rest] = expr.list;
    const word = atomOf(head);
    if (word === undefined) return;
    if (word === 'and') {
      [second, ...rest].forEach((part) => subtasks(part, owner));
      return;
    }
    // a labelled subtask: `(task0 (move ?b ?l))`
    if (!word.startsWith('?') && isList(second) && !rest.length) {
      subtasks(second, owner);
      return;
    }
    refer(['task', 'action'], head as Atom);
    variables(
      [second, ...rest].filter((e) => e !== undefined) as Expr[],
      owner,
      new Set(),
    );
  };
  /** `:key value` pairs after an operation's name */
  const sections = (items: readonly Expr[]) => {
    const pairs: [string, Expr | undefined][] = [];
    for (let i = 0; i < items.length; i += 1) {
      const key = atomOf(items[i]);
      if (key?.startsWith(':')) {
        pairs.push([key, items[i + 1]]);
        i += 1;
      }
    }
    return pairs;
  };

  const { exprs } = readExprs(text);
  const define_ = exprs.find(
    (expr): expr is List => isList(expr) && atomOf(expr.list[0]) === 'define',
  );
  for (const section of define_?.list.slice(1) ?? []) {
    if (!isList(section)) continue;
    const [head, ...rest] = section.list;
    const keyword = atomOf(head);
    if (keyword === ':types') {
      for (const { variable, type } of typedVariables(rest)) {
        const id = `${PROVIDER}.type:${variable.atom}`;
        // a type listed again (as another's supertype): a use
        if (defined.has(id)) refer(['type'], variable);
        else
          define('type', variable, {
            ...(type !== OBJECT && { type }),
            detail: `subtype of ${type}`,
          });
      }
      continue;
    }
    if (keyword === ':predicates' || keyword === ':functions') {
      for (const predicate of rest) {
        if (!isList(predicate)) continue;
        const [name, ...items] = predicate.list;
        if (!isAtom(name)) continue;
        const owner = define(
          keyword === ':predicates' ? 'predicate' : 'function',
          name,
        ).id;
        parameters(owner, items);
      }
      continue;
    }
    const kind =
      keyword === ':task'
        ? 'task'
        : keyword === ':method'
          ? 'method'
          : keyword === ':action'
            ? 'action'
            : null;
    const [name, ...items] = rest;
    if (!kind || !isAtom(name)) continue;
    const owner = define(kind, name).id;
    const pairs = sections(items);
    for (const [key, value] of pairs)
      if (key === ':parameters' && isList(value)) parameters(owner, value.list);
    for (const [key, value] of pairs) {
      if (key === ':task' && isList(value)) {
        const [task, ...args] = value.list;
        if (isAtom(task)) refer(['task'], task);
        variables(args, owner, new Set());
      } else if (SUBTASK_KEYS.has(key)) subtasks(value, owner);
      else if (FORMULA_KEYS.has(key)) formula(value, owner, new Set());
    }
  }
  if (options.typesDeclaredByUse)
    for (const atom of usedTypes)
      if (!defined.has(`${PROVIDER}.type:${atom.atom}`))
        define('type', atom, { detail: 'a type declared by its use' });
  return { definitions, references };
};

/** The innermost operation (`(:task`, `(:method`, `(:action`) around an offset. */
const operationAt = (text: string, offset: number) => {
  const { exprs } = readExprs(text);
  const define_ = exprs.find(
    (expr): expr is List => isList(expr) && atomOf(expr.list[0]) === 'define',
  );
  for (const section of define_?.list ?? []) {
    if (!isList(section) || section.from > offset || offset > section.to)
      continue;
    const keyword = atomOf(section.list[0]);
    const name = atomOf(section.list[1]);
    if (
      name &&
      (keyword === ':task' || keyword === ':method' || keyword === ':action')
    )
      return `${PROVIDER}.${keyword.slice(1)}:${name}`;
  }
  return undefined;
};

const complete = (
  pool: PoolLookup,
  document: PoolDocument,
  offset: number,
): PoolCompletion[] => {
  const text = document.text ?? '';
  const word = /[^\s()]*$/.exec(text.slice(0, offset))![0];
  const from = offset - word.length;
  const before = text.slice(0, from).trimEnd();
  const options = (kind: string, owner?: string) =>
    pool
      .definitionsOf(`${PROVIDER}.${kind}`)
      .filter((d) => d.owner === owner)
      .map((d) => ({
        label: d.name,
        kind: d.kind,
        detail: d.detail ?? d.type,
        from,
        to: offset,
      }));
  if (word.startsWith('?')) {
    const owner = operationAt(text, offset);
    return owner ? options('param', owner) : [];
  }
  if (before.endsWith(' -') || before.endsWith('\t-')) return options('type');
  if (before.endsWith('('))
    return [...options('task'), ...options('action'), ...options('predicate')];
  return [];
};

/** HDDL's provider, with options (`hddlProvider` has none). */
export const createHddlProvider = (
  options: HddlProviderOptions = {},
): PoolProvider => ({
  id: PROVIDER,
  documents: { resources: ['hddl'], extensions: ['.hddl'] },
  kinds: {
    type: { label: 'HDDL type', caseInsensitive: true },
    predicate: { label: 'HDDL predicate', caseInsensitive: true },
    function: { label: 'HDDL function', caseInsensitive: true },
    task: { label: 'HDDL task', caseInsensitive: true },
    method: { label: 'HDDL method', caseInsensitive: true },
    action: { label: 'HDDL action', caseInsensitive: true },
    param: { label: 'HDDL parameter', caseInsensitive: true, scope: 'owner' },
  },
  extract: (document) => extractWith(options, document),
  complete,
  // a parameter keeps its `?`; a name is HDDL's (letters, digits, `-`, `_`)
  renameText: (definition, newName) => {
    const name =
      definition.kind === 'hddl.param' && !newName.startsWith('?')
        ? `?${newName}`
        : newName;
    return /^\??[A-Za-z][\w-]*$/.test(name) ? name : null;
  },
});

/** HDDL's provider: what a domain declares, its types in `:types`. */
export const hddlProvider = createHddlProvider();
