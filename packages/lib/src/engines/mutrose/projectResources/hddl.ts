/**
 * MutRoSe's HDDL domain (`hddl/*.hddl`): its types, predicates, abstract
 * tasks and actions, with their parameters. A goal model's abstract task
 * stands for one of the domain's tasks (the first word of its name); the
 * configuration maps the model's variables onto their parameters.
 */
import {
  atomOf,
  isList,
  readExprs,
  type Expr,
  type List,
} from './sexpressions';
import type {
  ProjectResourceParser,
  ResourceDiagnostic,
} from '../../projectResources';

export type HddlParameter = { name: string; type: string };
export type HddlOperation = { name: string; parameters: HddlParameter[] };

export type HddlDomain = {
  name: string;
  types: string[];
  predicates: HddlOperation[];
  tasks: HddlOperation[];
  actions: HddlOperation[];
};

/** `?a ?b - room ?c - nurse` (and `room nurse - object` for types): each name with its type */
const typedList = (exprs: readonly Expr[]): HddlParameter[] => {
  const typed: HddlParameter[] = [];
  let pending: string[] = [];
  for (let i = 0; i < exprs.length; i += 1) {
    const atom = atomOf(exprs[i]);
    if (atom === undefined) continue;
    if (atom === '-') {
      const type = atomOf(exprs[i + 1]) ?? 'object';
      typed.push(...pending.map((name) => ({ name, type })));
      pending = [];
      i += 1;
    } else pending.push(atom);
  }
  return [...typed, ...pending.map((name) => ({ name, type: 'object' }))];
};

/** `:parameters (…)` among a definition's keywords */
const parametersOf = (list: readonly Expr[]): HddlParameter[] => {
  const at = list.findIndex((expr) => atomOf(expr) === ':parameters');
  const parameters = list[at + 1];
  return at >= 0 && isList(parameters) ? typedList(parameters.list) : [];
};

export const parseHddl: ProjectResourceParser<HddlDomain> = (files) => {
  const diagnostics: ResourceDiagnostic[] = [];
  const domain: HddlDomain = {
    name: '',
    types: [],
    predicates: [],
    tasks: [],
    actions: [],
  };
  for (const file of files) {
    const { exprs, problems } = readExprs(file.text);
    for (const problem of problems)
      diagnostics.push({ path: file.path, severity: 'error', ...problem });
    const define = exprs.find(
      (expr): expr is List => isList(expr) && atomOf(expr.list[0]) === 'define',
    );
    if (!define) {
      diagnostics.push({
        path: file.path,
        severity: 'error',
        message: 'An HDDL domain is `(define (domain name) …)`',
        from: 0,
        to: Math.min(file.text.length, 1),
      });
      continue;
    }
    for (const section of define.list.slice(1)) {
      if (!isList(section)) continue;
      const [head, ...rest] = section.list;
      switch (atomOf(head)) {
        case 'domain':
          domain.name = atomOf(rest[0]) ?? '';
          break;
        case ':types':
          for (const { name } of typedList(rest))
            if (!domain.types.includes(name)) domain.types.push(name);
          break;
        case ':predicates':
          for (const predicate of rest)
            if (isList(predicate) && atomOf(predicate.list[0]))
              domain.predicates.push({
                name: atomOf(predicate.list[0])!,
                parameters: typedList(predicate.list.slice(1)),
              });
          break;
        case ':task':
        case ':action': {
          const name = atomOf(rest[0]);
          if (!name) {
            diagnostics.push({
              path: file.path,
              severity: 'error',
              message: `${atomOf(head)} needs a name`,
              from: section.from,
              to: head!.to,
            });
            break;
          }
          (atomOf(head) === ':task' ? domain.tasks : domain.actions).push({
            name,
            parameters: parametersOf(rest),
          });
          break;
        }
        default:
          break;
      }
    }
  }
  const operation = ({ name, parameters }: HddlOperation) => ({
    name,
    detail:
      parameters.map((p) => `${p.name} - ${p.type}`).join(' ') || undefined,
    members: parameters.map((p) => ({ name: p.name, detail: p.type })),
  });
  return {
    symbols: {
      tasks: domain.tasks.map(operation),
      actions: domain.actions.map(operation),
      predicates: domain.predicates.map(operation),
      types: domain.types.map((name) => ({ name })),
    },
    data: domain,
    diagnostics,
  };
};
