/**
 * Whether an operation model operationalises its requirements completely
 * (goal-controller#209): FSE'02's Definition 3, condition 1, "[|R1|], …,
 * [|Rn|] ⊨ G", for each requirement G and the required conditions R1…Rn
 * its operationalisations give it (Definition 2: a ReqPre R is
 * `[|op|] ⇒ R`, a ReqTrig `R ∧ DomPre(op) ⇒ [|op|]`, a ReqPost `[|op|] ⇒
 * ○R`; Definition 1: `[|op|] ⇔ DomPre(op) ∧ ○DomPost(op)`).
 *
 * Decided syntactically, over the LTL AST (goal-controller#211), for the one
 * pattern of FSE'02 §4 whose premises are state formulas: **Immediate
 * Achieve** (Fig. 1), `C ⇒ ○T` (read under `□`, a `∀`, or KAOS's strong
 * `⇒`/`when … then`; the "After" invariance of Fig. 4 is the same
 * formula). With C, T, every DomPre, DomPost and required condition a state
 * formula (no temporal operator), its proof obligation `(C ∧ ¬T) ⇒ ○T,
 * (T ∧ ○¬T) ⇒ ¬C ⊨ C ⇒ ○T` is two propositional entailments, which lib's
 * solver (../propositional.ts) decides:
 *
 * - **the trigger**: in every state where C holds and T doesn't, some
 *   operation that establishes T (its DomPost, with its ReqPost for G,
 *   entails T) is obliged by a ReqTrig for G, its DomPre holding:
 *   `C ∧ ¬T ⊨ ⋁ (ReqTrig(op, G) ∧ DomPre(op))`;
 * - **the precondition**: no operation that may falsify T (its DomPost
 *   names T's variables and doesn't entail T) may be applied where C and T
 *   hold: `C ∧ T ∧ DomPre(op) ∧ ⋀ ReqPre(op, G)` is unsatisfiable.
 *
 * Both rest on FSE'02's frame axioms (§3): a variable no operation's
 * DomPost names is unchanged, and every change is some operation's
 * application. A Problem is reported only on a refutation the solver finds
 * with no opaque atom (a comparison other than with true or false): an
 * attribute's values are not known to exclude each other, so a refutation
 * that needs them is no proof. What is not decided is said, never a
 * Problem:
 *
 * - a requirement without a formal definition, or one that doesn't parse;
 * - the other patterns: Bounded Achieve (Fig. 2) and "InBetween"
 *   invariance (Fig. 3) need the past operators S and B in their required
 *   conditions, which the AST has no node for; Unbounded Achieve, Global
 *   and Transition invariance have no operationalisation pattern in FSE'02;
 * - any condition the decision needs that is not a state formula.
 */
import type { GoalDiagnostic } from '@istar-ts/core';
import {
  printLtl,
  type AssertionTree,
  type LtlNode,
} from '@goal-controller/goal-language';
import { implies, satisfiable, type Assignment } from '../propositional';
import type {
  Condition,
  Operation,
  OperationModel,
  Operationalisation,
  Requirement,
} from './operations';

/** A formula as a state formula: the solver's tree, or why it isn't one. */
export type StateFormula =
  | { tree: AssertionTree; reason: null }
  | { tree: null; reason: string };

const state = (tree: AssertionTree): StateFormula => ({ tree, reason: null });
const notState = (reason: string): StateFormula => ({ tree: null, reason });

/** A comparison's operand as an atom's name (`sump.level`, `x`), or null. */
const operandName = (node: LtlNode): string | null =>
  node.kind === 'attributeAccess'
    ? `${node.variable}.${node.attribute}`
    : node.kind === 'variableRef'
      ? node.name
      : null;

/**
 * An LTL formula with no temporal operator and no quantifier, as the
 * solver's tree: an attribute (`sump.highWater`), a name, a predicate or a
 * relation instance (`p(x)`, `(x, y) in R`) each an atom; `x == true`,
 * `x != false` the atom `x`, and their negations; any other comparison an
 * opaque atom by its text (`c.PumpSwitch == "On"`), `!=` its negation.
 */
export const stateFormula = (node: LtlNode): StateFormula => {
  const both = (
    left: LtlNode,
    right: LtlNode,
    build: (l: AssertionTree, r: AssertionTree) => AssertionTree,
  ): StateFormula => {
    const l = stateFormula(left);
    if (!l.tree) return l;
    const r = stateFormula(right);
    return r.tree ? state(build(l.tree, r.tree)) : r;
  };
  const not = (expr: AssertionTree): AssertionTree => ({ kind: 'not', expr });
  switch (node.kind) {
    case 'paren': {
      const inner = stateFormula(node.expr);
      return inner.tree ? state({ kind: 'paren', expr: inner.tree }) : inner;
    }
    case 'not': {
      const inner = stateFormula(node.expr);
      return inner.tree ? state(not(inner.tree)) : inner;
    }
    case 'and':
    case 'or':
      return both(node.left, node.right, (left, right) => ({
        kind: node.kind,
        left,
        right,
      }));
    case 'implies':
      return both(node.left, node.right, (left, right) => ({
        kind: 'or',
        left: not(left),
        right,
      }));
    case 'iff':
      return both(node.left, node.right, (left, right) => ({
        kind: 'or',
        left: { kind: 'and', left, right },
        right: { kind: 'and', left: not(left), right: not(right) },
      }));
    case 'attributeAccess':
      return state({
        kind: 'member',
        ref: node.variable,
        member: node.attribute,
      });
    case 'variableRef':
      return state({ kind: 'var', variable: node.name });
    case 'predicateCall':
      return state({
        kind: 'var',
        variable: `${node.name}(${node.args.join(', ')})`,
      });
    case 'relationMembership':
      return state({
        kind: 'var',
        variable: `${node.relation}(${node.args.join(', ')})`,
      });
    case 'literal':
      return typeof node.value === 'boolean'
        ? state({ kind: 'bool', value: node.value })
        : notState(`the value ${String(node.value)} is no condition`);
    case 'comparison': {
      const name = operandName(node.left);
      if (name === null) return notState('a comparison of two expressions');
      const { right, operator } = node;
      if (
        right.kind === 'literal' &&
        typeof right.value === 'boolean' &&
        (operator === '==' || operator === '!=')
      ) {
        const [variable, member] =
          node.left.kind === 'attributeAccess'
            ? [node.left.variable, node.left.attribute]
            : [name, undefined];
        return state({
          kind: 'assign',
          variable,
          value: right.value,
          ...(operator === '!=' && { negated: true }),
          ...(member !== undefined && { member }),
        });
      }
      const value =
        right.kind === 'literal'
          ? String(right.value)
          : (operandName(right) ?? null);
      if (value === null) return notState('a comparison of two expressions');
      const compare: AssertionTree = {
        kind: 'compare',
        variable: name,
        operator: operator === '!=' ? '==' : operator,
        value,
      };
      return state(operator === '!=' ? not(compare) : compare);
    }
    default:
      return notState(`it has a ${node.kind} operator`);
  }
};

/** A node's subformulas. */
const childrenOf = (node: LtlNode): readonly LtlNode[] => {
  switch (node.kind) {
    case 'forall':
    case 'exists':
      return [node.body];
    case 'iff':
    case 'implies':
    case 'strongImplies':
    case 'or':
    case 'and':
    case 'until':
    case 'release':
    case 'weakUntil':
    case 'comparison':
      return [node.left, node.right];
    case 'not':
    case 'next':
    case 'previous':
    case 'eventually':
    case 'once':
    case 'always':
    case 'historically':
    case 'atLabel':
    case 'paren':
      return [node.expr];
    default:
      return [];
  }
};

/** The state variables a formula names (`sump.highWater`, `x`), by text. */
export const variablesOf = (node: LtlNode): string[] => {
  const name = operandName(node);
  return name !== null ? [name] : childrenOf(node).flatMap(variablesOf);
};

/** Immediate Achieve's C and T (FSE'02 Fig. 1), or null for another form. */
export const immediateAchieve = (
  node: LtlNode,
): { current: LtlNode; target: LtlNode } | null => {
  const bare = (n: LtlNode): LtlNode =>
    n.kind === 'paren' || n.kind === 'forall'
      ? bare(n.kind === 'paren' ? n.expr : n.body)
      : n.kind === 'always' && !n.bound
        ? bare(n.expr)
        : n;
  const formula = bare(node);
  if (formula.kind !== 'implies' && formula.kind !== 'strongImplies')
    return null;
  let target = formula.right;
  while (target.kind === 'paren') target = target.expr;
  return target.kind === 'next'
    ? { current: formula.left, target: target.expr }
    : null;
};

/** What the check makes of one requirement it is given operationalisations for. */
export type CompletenessVerdict =
  | { requirement: string; status: 'complete'; pattern: 'Immediate Achieve' }
  | {
      requirement: string;
      status: 'incomplete';
      pattern: 'Immediate Achieve';
      problems: GoalDiagnostic[];
    }
  | { requirement: string; status: 'undecided'; reason: string };

/** The code of the Problem an incomplete operationalisation is. */
export const INCOMPLETE = 'incomplete-operationalisation';

const and = (...trees: AssertionTree[]): AssertionTree =>
  trees.reduce((left, right) => ({ kind: 'and', left, right }));
const or = (...trees: AssertionTree[]): AssertionTree =>
  trees.reduce((left, right) => ({ kind: 'or', left, right }));
const not = (expr: AssertionTree): AssertionTree => ({ kind: 'not', expr });
const TRUE: AssertionTree = { kind: 'bool', value: true };
const FALSE: AssertionTree = { kind: 'bool', value: false };

/** A state, as a counterexample reads: `sump.highWater, ¬mine.methane`. */
const stateText = (assignment: Assignment): string =>
  Object.entries(assignment)
    .map(([atom, value]) => (value ? atom : `¬${atom}`))
    .join(', ');

/** Thrown by a reading the decision needs, when it is no state formula. */
class Undecided extends Error {}

/**
 * Each requirement's verdict, for the requirements some operationalisation
 * names, in the model's order (FSE'02 Def. 3, condition 1).
 */
export const operationalisationCompleteness = (
  model: OperationModel,
): CompletenessVerdict[] => {
  /** a condition as a state formula, `absent` when unset; throws Undecided */
  const read = (
    condition: Condition | null,
    what: string,
    absent: AssertionTree,
  ): AssertionTree => {
    if (!condition) return absent;
    if (!condition.formula)
      throw new Undecided(`${what} doesn't parse: ${condition.error}`);
    const formula = stateFormula(condition.formula);
    if (!formula.tree)
      throw new Undecided(`${what} is no state formula: ${formula.reason}`);
    return formula.tree;
  };
  const verdict = (
    requirement: Requirement,
    links: readonly Operationalisation[],
  ): CompletenessVerdict => {
    const undecided = (reason: string): CompletenessVerdict => ({
      requirement: requirement.id,
      status: 'undecided',
      reason,
    });
    const spec = requirement.formalSpec;
    if (!spec) return undecided('it has no formal definition');
    if (!spec.formula)
      return undecided(`its formal definition doesn't parse: ${spec.error}`);
    const pattern = immediateAchieve(spec.formula);
    if (!pattern)
      return undecided(
        'its formal definition is not of the form C ⇒ ○T (FSE’02’s Immediate Achieve), the one pattern decided',
      );
    try {
      const c = read(
        { text: spec.text, formula: pattern.current, error: null },
        'its condition C',
        TRUE,
      );
      const t = read(
        { text: spec.text, formula: pattern.target, error: null },
        'its target T',
        TRUE,
      );
      const targetVariables = new Set(variablesOf(pattern.target));
      const C = printLtl(pattern.current);
      const T = printLtl(pattern.target);
      const forOp = (op: Operation) =>
        links.find((link) => link.operation === op.id);
      const problems: GoalDiagnostic[] = [];
      const problem = (elementId: string, message: string, key?: string) =>
        problems.push({
          elementId,
          ...(key !== undefined && { key }),
          severity: 'error',
          code: INCOMPLETE,
          message,
        });
      /** what a refutation found with opaque atoms leaves undecided */
      const unsure: string[] = [];
      // the trigger: who establishes T, obliged by a ReqTrig for G
      const triggers: AssertionTree[] = [];
      for (const op of model.operations) {
        const link = forOp(op);
        const post = and(
          read(op.domPost, `${op.name}'s DomPost`, TRUE),
          read(link?.ReqPost ?? null, `${op.name}'s ReqPost`, TRUE),
        );
        if (!implies(post, t).holds || !link?.ReqTrig) continue;
        triggers.push(
          and(
            read(link.ReqTrig, `${op.name}'s ReqTrig`, TRUE),
            read(op.domPre, `${op.name}'s DomPre`, TRUE),
          ),
        );
      }
      if (!triggers.length)
        problem(
          requirement.id,
          `No operation establishing ${T} has a ReqTrig for ${requirement.name}: when ${C} holds and ${T} doesn't, nothing must make ${T} hold next (FSE’02 Fig. 1)`,
        );
      else {
        const trigger = implies(and(c, not(t)), or(...triggers));
        if (!trigger.holds && trigger.opaque.length)
          unsure.push(`whether its ReqTrig conditions cover ${C}`);
        else if (!trigger.holds)
          problem(
            requirement.id,
            `Its ReqTrig conditions don't cover ${C}: in the state ${stateText(trigger.counterexample)}, ${C} holds, ${T} doesn't, and no ReqTrig for ${requirement.name} obliges an operation establishing ${T}`,
          );
      }
      // the precondition: who may falsify T, permitted only where C doesn't hold
      for (const op of model.operations) {
        if (
          !op.domPost?.formula ||
          !variablesOf(op.domPost.formula).some((v) => targetVariables.has(v))
        )
          continue;
        const post = read(op.domPost, `${op.name}'s DomPost`, FALSE);
        if (implies(post, t).holds) continue;
        const link = forOp(op);
        const allowed = satisfiable(
          and(
            c,
            t,
            read(op.domPre, `${op.name}'s DomPre`, TRUE),
            read(link?.ReqPre ?? null, `${op.name}'s ReqPre`, TRUE),
          ),
        );
        if (allowed.satisfiable && allowed.opaque.length)
          unsure.push(
            `whether ${op.name} may make ${T} false where ${C} holds`,
          );
        else if (allowed.satisfiable)
          problem(
            link?.id ?? op.id,
            `${op.name} may make ${T} false where ${C} holds (${stateText(allowed.model)}): it needs a ReqPre for ${requirement.name} that excludes ${C}`,
            link ? 'ReqPre' : undefined,
          );
      }
      if (problems.length)
        return {
          requirement: requirement.id,
          status: 'incomplete',
          pattern: 'Immediate Achieve',
          problems,
        };
      if (unsure.length)
        return undecided(
          `${unsure.join('; ')}: it depends on comparisons, whose values the solver doesn't know to exclude each other`,
        );
      return {
        requirement: requirement.id,
        status: 'complete',
        pattern: 'Immediate Achieve',
      };
    } catch (error) {
      if (error instanceof Undecided) return undecided(error.message);
      throw error;
    }
  };
  return model.requirements.flatMap((requirement) => {
    const links = model.operationalisations.filter(
      (link) => link.requirement === requirement.id,
    );
    return links.length ? [verdict(requirement, links)] : [];
  });
};

/** The Problems of a model's incomplete operationalisations. */
export const operationalisationProblems = (
  model: OperationModel,
): GoalDiagnostic[] =>
  operationalisationCompleteness(model).flatMap((verdict) =>
    verdict.status === 'incomplete' ? verdict.problems : [],
  );
