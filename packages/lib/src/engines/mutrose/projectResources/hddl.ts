/**
 * MutRoSe's HDDL domain (`hddl/*.hddl`): its types, predicates, abstract
 * tasks and actions, with their parameters. A goal model's abstract task
 * stands for one of the domain's tasks (the first word of its name); the
 * configuration maps the model's variables onto their parameters.
 */
import type {
  ProjectResourceParser,
  ResourceDiagnostic,
} from '../../projectResources';

type Atom = { atom: string; from: number; to: number };
type List = { list: Expr[]; from: number; to: number };
type Expr = Atom | List;

const isList = (expr: Expr | undefined): expr is List =>
  expr !== undefined && 'list' in expr;
const atomOf = (expr: Expr | undefined): string | undefined =>
  expr && 'atom' in expr ? expr.atom : undefined;

/** The s-expressions of a text (`;` comments to the end of the line), and what is unbalanced. */
const readExprs = (
  text: string,
): {
  exprs: Expr[];
  problems: { message: string; from: number; to: number }[];
} => {
  const problems: { message: string; from: number; to: number }[] = [];
  const stack: List[] = [{ list: [], from: 0, to: text.length }];
  const TOKEN = /\s+|;[^\n]*|\(|\)|[^\s();]+/gy;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const [token] = match;
    const from = match.index;
    if (/^\s|^;/.test(token)) continue;
    if (token === '(') stack.push({ list: [], from, to: from });
    else if (token === ')') {
      if (stack.length === 1) {
        problems.push({ message: 'Unbalanced )', from, to: from + 1 });
        continue;
      }
      const done = stack.pop()!;
      done.to = from + 1;
      stack[stack.length - 1]!.list.push(done);
    } else
      stack[stack.length - 1]!.list.push({
        atom: token.toLowerCase(),
        from,
        to: from + token.length,
      });
  }
  while (stack.length > 1) {
    const open = stack.pop()!;
    problems.push({
      message: 'Unclosed (',
      from: open.from,
      to: open.from + 1,
    });
    open.to = text.length;
    stack[stack.length - 1]!.list.push(open);
  }
  return { exprs: stack[0]!.list, problems };
};

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
