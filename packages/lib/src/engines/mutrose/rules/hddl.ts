/**
 * HDDL domains (`*.hddl`) as facts (goal-controller#75): types, predicates,
 * tasks, methods, actions and their parameters, and what refers to them
 * inside the domain (a method's task and subtasks, a precondition's or
 * effect's predicates, `?x`, `- type`). hddl.rls: subtypes, unused tasks.
 */
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
  type RuleReference,
  type RuleRelation,
} from '../../ruleFacts/facts';
import {
  isAtom,
  isList,
  readExprs,
  word,
  type Atom,
  type Expr,
  type List,
} from '../projectResources/sexpr';

export const HDDL_KINDS: Readonly<Record<string, KindDefinition>> = {
  'hddl.type': { label: 'HDDL type', caseInsensitive: true },
  'hddl.predicate': { label: 'HDDL predicate', caseInsensitive: true },
  'hddl.task': { label: 'HDDL task', caseInsensitive: true },
  'hddl.method': { label: 'HDDL method', caseInsensitive: true },
  'hddl.action': { label: 'HDDL action', caseInsensitive: true },
  'hddl.param': {
    label: 'HDDL parameter',
    caseInsensitive: true,
    scope: 'owner',
  },
};

/** Logical connectives and quantifiers: not predicates. */
const CONNECTIVES = new Set([
  'and',
  'or',
  'not',
  'imply',
  'forall',
  'exists',
  'when',
  '=',
]);
/** Numeric effects: their arguments are functions, not predicates. */
const NUMERIC = new Set([
  'assign',
  'increase',
  'decrease',
  'scale-up',
  'scale-down',
]);

/**
 * An HDDL file's facts. `typesByUse`: a type used (`?r - robot`) but not in
 * `:types` is declared where it is first used, as MutRoSe's examples write
 * them; else it is unknown.
 */
export const readHddl = (
  document: string,
  text: string,
  { typesByUse = false }: { typesByUse?: boolean } = {},
): DocumentFacts => {
  const relations: RuleRelation[] = [];
  const facts: DocumentFacts = {
    document,
    text,
    definitions: [],
    references: [],
    relations,
  };
  const at = (expr: { from: number; to: number }) => ({
    document,
    from: expr.from,
    to: expr.to,
  });
  let counter = 0;
  const refer = (
    kinds: string[],
    atom: Atom,
    scope?: string,
  ): RuleReference => {
    const reference: RuleReference = {
      kinds,
      name: atom.atom,
      location: at(atom),
      id: `h${counter++}`,
      ...(scope && { scope: { owner: scope } }),
    };
    facts.references.push(reference);
    return reference;
  };
  const define = (
    kind: string,
    atom: Atom,
    owner?: string,
    type?: string,
  ): string => {
    const id = `hddl.${kind}:${owner ? `${owner}/` : ''}${atom.atom.toLowerCase()}`;
    facts.definitions.push({
      id,
      kind: `hddl.${kind}`,
      name: atom.atom,
      location: at(atom),
      ...(owner && { owner }),
      ...(type && { type }),
    });
    return id;
  };
  /** `?a ?b - t`: each name, then the type its `-` gives (object without one) */
  const typed = (
    exprs: readonly Expr[],
    each: (name: Atom, type: Atom | null) => void,
  ) => {
    let pending: Atom[] = [];
    for (let i = 0; i < exprs.length; i += 1) {
      const expr = exprs[i];
      if (!isAtom(expr)) continue;
      if (expr.atom === '-') {
        const type = exprs[i + 1];
        pending.forEach((name) => each(name, isAtom(type) ? type : null));
        pending = [];
        i += 1;
      } else pending.push(expr);
    }
    pending.forEach((name) => each(name, null));
  };
  /** a type named after `-`: a reference (`object` is HDDL's own) */
  const typeRef = (type: Atom | null): RuleReference | null => {
    if (!type || word(type) === 'object') return null;
    if (typesByUse && !declared.has(word(type)!)) {
      declared.add(word(type)!);
      define('type', type);
    }
    return refer(['hddl.type'], type);
  };
  const parameters = (list: List | undefined, owner: string) =>
    typed(list?.list ?? [], (name, type) => {
      const param = define('param', name, owner, type ? word(type) : 'object');
      const typeReference = typeRef(type);
      if (typeReference)
        relations.push(['hddl_paramType', param, ref(typeReference.id!)]);
    });
  const keyword = (list: readonly Expr[], key: string): Expr | undefined => {
    const i = list.findIndex((e) => word(e) === key);
    return i >= 0 ? list[i + 1] : undefined;
  };
  const args = (list: List, owner: string) =>
    list.list.slice(1).forEach((arg) => {
      if (isAtom(arg) && arg.atom.startsWith('?'))
        refer(['hddl.param'], arg, owner);
    });
  /** a precondition or effect: its predicates and parameters */
  const formula = (expr: Expr | undefined, owner: string): void => {
    if (!isList(expr) || !expr.list.length) return;
    const [head, ...rest] = expr.list;
    const name = word(head);
    if (name && NUMERIC.has(name)) return;
    if (name && CONNECTIVES.has(name)) {
      // a quantifier's first list declares its variables
      (name === 'forall' || name === 'exists' ? rest.slice(1) : rest).forEach(
        (e) => formula(e, owner),
      );
      return;
    }
    if (isAtom(head)) {
      refer(['hddl.predicate'], head);
      args(expr, owner);
    }
  };
  /** a method's subtasks: `(and …)`, `(label (task …))` or `(task …)` */
  const subtasks = (expr: Expr | undefined, owner: string): void => {
    if (!isList(expr) || !expr.list.length) return;
    const [head, second] = expr.list;
    if (word(head) === 'and')
      expr.list.slice(1).forEach((e) => subtasks(e, owner));
    else if (isAtom(head) && isList(second)) subtasks(second, owner);
    else if (isAtom(head)) {
      refer(['hddl.task', 'hddl.action'], head);
      args(expr, owner);
    }
  };

  const define_ = readExprs(text).exprs.find(
    (e): e is List => isList(e) && word(e.list[0]) === 'define',
  );
  // the types :types declares (the others, where typesByUse, at their first use)
  const declared = new Set<string>();
  for (const section of define_?.list ?? [])
    if (isList(section) && word(section.list[0]) === ':types')
      typed(section.list.slice(1), (type) => declared.add(word(type)!));
  for (const section of define_?.list.slice(1) ?? []) {
    if (!isList(section)) continue;
    const [head, ...rest] = section.list;
    const name = rest[0];
    switch (word(head)) {
      case ':types':
        typed(rest, (type, supertype) => {
          const id = define('type', type);
          const superRef = typeRef(supertype);
          if (superRef) relations.push(['hddl_super', id, ref(superRef.id!)]);
        });
        break;
      case ':predicates':
        for (const predicate of rest)
          if (isList(predicate) && isAtom(predicate.list[0]))
            parameters(
              { ...predicate, list: predicate.list.slice(1) },
              define('predicate', predicate.list[0]),
            );
        break;
      case ':task':
      case ':method':
      case ':action': {
        if (!isAtom(name)) break;
        const kind = word(head)!.slice(1);
        const id = define(kind, name);
        const params = keyword(section.list, ':parameters');
        parameters(isList(params) ? params : undefined, id);
        if (kind === 'method') {
          const task = keyword(section.list, ':task');
          if (isList(task) && isAtom(task.list[0])) {
            const decomposed = refer(['hddl.task'], task.list[0]);
            relations.push(['hddl_decomposes', ref(decomposed.id!)]);
            args(task, id);
          }
          subtasks(
            keyword(section.list, ':ordered-subtasks') ??
              keyword(section.list, ':subtasks') ??
              keyword(section.list, ':ordered-tasks') ??
              keyword(section.list, ':tasks'),
            id,
          );
          formula(keyword(section.list, ':precondition'), id);
        }
        if (kind === 'action') {
          formula(keyword(section.list, ':precondition'), id);
          formula(keyword(section.list, ':effect'), id);
        }
        break;
      }
      default:
        break;
    }
  }
  return facts;
};
