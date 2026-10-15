/**
 * RE-Context's input (REJ 2010 §6, #151 D12): a contextual goal model as a
 * disjunctive Datalog program for DLV, as Codes 2–4 write one by hand.
 * RE-Context was never published and wrote no such file itself; this is
 * the encoding its listings show, for DLV 2 (the oracle, docker/dlv):
 *
 * - **Code 2, the tree and its contexts.** A goal is `ach(g)`, a task
 *   `todo(t)`; a root is a fact. An OR (or means-end) is a disjunction of
 *   its children under its parent, an AND child a rule; a context at a
 *   variation point is an atom the child derives (`c5 :- ach(g2).`). An AND
 *   child with a context is kept or dropped (`ach(g) | drop(g) :- …`), a
 *   dropped one deriving its context's negation (`not_c2`); a dependency
 *   derives its dependum and, from it, the dependee's goal. Each answer set
 *   is a variant: its `ach`/`todo` atoms, and its contexts.
 * - **Code 3, a situation.** `phi(c)` for each context that holds,
 *   `softgoal(sg, priority)`, and `contrib(x, sg, pos|neg)`, conditioned on
 *   the contexts the contribution's sign depends on (#151 D10).
 * - **Code 4, costs.** `cost(r, k) :- needed(r).` and `needed(r) :-
 *   todo(t).`: each task has a resource of its own and each cost relation a
 *   shared one, of its amount. A task's own resource costs its cost less
 *   what it shares, which may be negative (Fig. 13's T4 shares 90 of its
 *   80): only then does the sum over a set's resources give #151 D11's
 *   pairwise cost. `total(S)` sums them.
 *
 * DLV 2 writes a disjunction `|`; DLV of 2008, and Code 2, `v`. Ids are
 * lower-cased, a `.` made `_` (`g3_1`). A context written as a formula is
 * one atom named after it (`c7_and_not_c8`).
 */
import type { AssertionTree } from '@goal-controller/goal-language';
import type { AnalysisModel } from '../analysis';
import { formulaOf } from './formulas';
import { readCgmModel, type CgmModel } from './model';
import type { Situation } from './resources';
import { contextsHolding, contributionSign } from './situation';
import { CGM_KEYS } from './vocabulary';

/** A DLV constant for an id: lower case, `.` as `_` (`G3.1` → `g3_1`). */
export const dlvConstant = (id: string): string =>
  id.toLowerCase().replace(/[^a-z0-9_]/g, '_');

/** The atom a context formula is (`C5` → `c5`, `!C9` → `not_c9`, `C7 & !C8` → `c7_and_not_c8`). */
export const dlvFormulaAtom = (tree: AssertionTree | null): string => {
  if (!tree) return 'true';
  switch (tree.kind) {
    case 'var':
      return dlvConstant(tree.variable);
    case 'assign':
      return `${tree.value !== !!tree.negated ? '' : 'not_'}${dlvConstant(tree.variable)}`;
    case 'not':
      return `not_${dlvFormulaAtom(tree.expr)}`;
    case 'paren':
      return dlvFormulaAtom(tree.expr);
    case 'and':
    case 'or':
      return `${dlvFormulaAtom(tree.left)}_${tree.kind}_${dlvFormulaAtom(tree.right)}`;
    case 'bool':
      return String(tree.value);
    default:
      throw new Error(
        `A context is a formula of names: ${tree.kind} is not written`,
      );
  }
};

/** The atom a guard passed at a variation point gives: its formula's, negated when it doesn't hold there. */
export const dlvGuardAtom = (literal: {
  condition: AssertionTree;
  holds: boolean;
}): string => {
  const atom = dlvFormulaAtom(literal.condition);
  return literal.holds ? atom : `not_${atom}`;
};

/**
 * A formula over contexts as DLV rule bodies over `phi/1`, one body per
 * disjunct (its disjunctive normal form); none when it can't hold.
 */
const phiBodies = (tree: AssertionTree | null): string[][] => {
  const dnf = (node: AssertionTree | null, negated: boolean): string[][] => {
    if (!node) return negated ? [] : [[]];
    switch (node.kind) {
      case 'paren':
        return dnf(node.expr, negated);
      case 'not':
        return dnf(node.expr, !negated);
      case 'var':
        return [[`${negated ? 'not ' : ''}phi(${dlvConstant(node.variable)})`]];
      case 'assign':
        return dnf(
          { kind: 'var', variable: node.variable },
          negated !== (node.value === !!node.negated),
        );
      case 'bool':
        return node.value !== negated ? [[]] : [];
      case 'and':
      case 'or': {
        const conjunction = (node.kind === 'and') !== negated;
        const left = dnf(node.left, negated);
        const right = dnf(node.right, negated);
        return conjunction
          ? left.flatMap((a) => right.map((b) => [...a, ...b]))
          : [...left, ...right];
      }
      default:
        throw new Error(
          `A context is a formula of names: ${node.kind} is not written`,
        );
    }
  };
  return dnf(tree, false);
};

const rule = (head: string, body: readonly string[]) =>
  body.length ? `${head} :- ${body.join(', ')}.` : `${head}.`;

/** Code 2: the variants' rules, from each root. */
const treeRules = (cgm: CgmModel): string[] => {
  const lines: string[] = [];
  const head = (id: string) =>
    `${cgm.element(id)?.kind === 'istar.Task' ? 'todo' : 'ach'}(${dlvConstant(cgm.idOf(id))})`;
  const seen = new Set<string>();
  const guard = (
    tree: AssertionTree | null,
    body: string,
    dropped?: string,
  ) => {
    if (!tree) return;
    const atom = dlvFormulaAtom(tree);
    lines.push(rule(atom, [body]));
    if (dropped) lines.push(rule(`not_${atom}`, [dropped]));
  };
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const here = head(id);
    const refinements = cgm.refinementsOf(id);
    const or = refinements.filter((r) => r.relation === 'or');
    if (or.length) {
      lines.push(rule(or.map((r) => head(r.child)).join(' | '), [here]));
      for (const r of or)
        guard(formulaOf(r.link.properties[CGM_KEYS.context]), head(r.child));
    }
    for (const r of refinements.filter((r) => r.relation === 'and')) {
      const condition = formulaOf(r.link.properties[CGM_KEYS.context]);
      if (condition) {
        const drop = `drop(${dlvConstant(cgm.idOf(r.child))})`;
        lines.push(rule(`${head(r.child)} | ${drop}`, [here]));
        guard(condition, head(r.child), drop);
      } else lines.push(rule(head(r.child), [here]));
    }
    for (const dependency of cgm.dependenciesOf(id)) {
      const dependum = `ach(${dlvConstant(cgm.idOf(dependency.dependum))})`;
      lines.push(rule(dependum, [here]));
      guard(formulaOf(dependency.link.properties[CGM_KEYS.context]), dependum);
      if (dependency.dependee) {
        lines.push(rule(head(dependency.dependee), [dependum]));
        walk(dependency.dependee);
      }
    }
    for (const r of refinements) walk(r.child);
  };
  for (const root of cgm.roots) {
    lines.push(rule(head(root), []));
    guard(
      formulaOf(cgm.element(root)?.properties[CGM_KEYS.activation]),
      head(root),
    );
    walk(root);
  }
  return lines;
};

/** Code 3: a situation's contexts, the softgoals' priorities, and the contributions. */
const situationRules = (cgm: CgmModel, situation: Situation): string[] => {
  const lines = [...contextsHolding(cgm, situation)].map(
    (id) => `phi(${dlvConstant(id)}).`,
  );
  for (const [softgoal, priority] of Object.entries(situation.priorities))
    lines.push(`softgoal(${dlvConstant(softgoal)},${priority}).`);
  for (const link of cgm.contributions) {
    const head = (sign: string) =>
      `contrib(${dlvConstant(cgm.idOf(link.source))},${dlvConstant(cgm.idOf(link.target))},${sign})`;
    const always = contributionSign(link, () => false);
    const context = link.properties[CGM_KEYS.context];
    const opposite = link.properties[CGM_KEYS.opposite];
    if (!context?.trim() && !opposite?.trim()) {
      lines.push(rule(head(always!), []));
      continue;
    }
    const sign = contributionSign(link, () => true);
    const other = sign === 'pos' ? 'neg' : 'pos';
    for (const body of context?.trim() ? phiBodies(formulaOf(context)) : [])
      lines.push(rule(head(sign!), body));
    for (const body of opposite?.trim() ? phiBodies(formulaOf(opposite)) : [])
      lines.push(rule(head(other), body));
  }
  return lines;
};

/** Code 4: a resource per task and per cost relation, and their sum. */
const costRules = (cgm: CgmModel): string[] => {
  const lines: string[] = [];
  const tasks = cgm.model.elements.filter(
    (element) =>
      element.kind === 'istar.Task' &&
      element.properties[CGM_KEYS.cost]?.trim(),
  );
  for (const task of tasks) {
    const shared = cgm.overlaps
      .filter(({ a, b }) => a === task.id || b === task.id)
      .reduce((sum, { amount }) => sum + amount, 0);
    const t = dlvConstant(cgm.idOf(task.id));
    lines.push(
      rule(`cost(r_${t},${cgm.costOf(task.id) - shared})`, [`needed(r_${t})`]),
      rule(`needed(r_${t})`, [`todo(${t})`]),
    );
  }
  for (const { a, b, amount } of cgm.overlaps) {
    const [ta, tb] = [a, b].map((id) => dlvConstant(cgm.idOf(id)));
    const r = `r_${ta}_${tb}`;
    lines.push(
      rule(`cost(${r},${amount})`, [`needed(${r})`]),
      rule(`needed(${r})`, [`todo(${ta})`]),
      rule(`needed(${r})`, [`todo(${tb})`]),
    );
  }
  lines.push('total(S) :- #sum{K,R : cost(R,K)} = S.');
  return lines;
};

export type ReContextOptions = {
  /** Code 3: the situation's contexts, priorities and contributions */
  situation?: Situation;
  /** Code 4: the tasks' costs (default: when a task has one) */
  costs?: boolean;
};

/** RE-Context's DLV program for a model (#151 D12): Code 2, and Codes 3 and 4 when asked. */
export const reContextDlv = (
  model: AnalysisModel,
  options: ReContextOptions = {},
): string => {
  const cgm = readCgmModel(model);
  const costs =
    options.costs ??
    model.elements.some((element) => element.properties[CGM_KEYS.cost]?.trim());
  return [
    '% RE-Context (REJ 2010 Code 2): the goal model and its contexts',
    ...treeRules(cgm),
    ...(options.situation
      ? [
          `% Code 3: ${options.situation.label}`,
          ...situationRules(cgm, options.situation),
        ]
      : []),
    ...(costs ? ['% Code 4: development costs', ...costRules(cgm)] : []),
    '',
  ].join('\n');
};
