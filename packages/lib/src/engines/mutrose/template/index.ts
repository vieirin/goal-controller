/**
 * What MutRoSe's decomposer makes of a goal model before it reads the world:
 * the model's validity (`gm/gm.cpp` check_gm_validity, and the task
 * parameters' binding of `atmanager/at_manager.cpp`), then its runtime
 * annotation over the abstract tasks, printed as the decomposer's `-v` does
 * (`utils/annotmanagerutils.cpp` recursive_rt_annot_build).
 *
 * Children are visited as the decomposer visits them, by their diagram x.
 * One difference, because a browser has no world knowledge: forAll goals are
 * not expanded into one instance per item (each is printed once). The
 * scoping rules are `../scope.ts`'s, which the editors' checks run too.
 */
import { notationRefs, type RtTree } from '@goal-controller/goal-language';
import {
  depthFirst,
  forAllProblem,
  inDiagramOrder,
  queryProblem,
  scopeIssues,
} from '../scope';
import { singleFileOutput, type EngineOutput } from '../../output';
import type { MutroseGoalNode, MutroseGoalTree, MutroseTask } from '../mapper';

type Child = MutroseGoalNode | MutroseTask;

const childrenOf = (goal: MutroseGoalNode): Child[] => [
  ...(goal.children ?? []),
  ...(goal.tasks ?? []),
];

/**
 * A goal's children as the decomposer orders them: by diagram x; in a tree
 * without positions, the annotation's order, then those it doesn't name.
 */
const ordered = (goal: MutroseGoalNode): readonly Child[] => {
  const children = childrenOf(goal);
  const named = notationRefs(goal.properties.engine.annotation).flatMap(
    (id) => {
      const child = children.find((c) => c.id === id);
      return child ? [child] : [];
    },
  );
  return inDiagramOrder(
    [...named, ...children.filter((c) => !named.includes(c))],
    (child) => child.x,
  );
};

/** A tree's root goals (one per actor). */
const rootsOf = (tree: MutroseGoalTree): MutroseGoalNode[] =>
  tree.filter(
    (node): node is MutroseGoalNode =>
      node.type === 'goal' && !node.properties.isQuality,
  );

/**
 * check_gm_validity, and each task's Params bound: the first problem, with
 * the decomposer's message, as it would stop at it.
 */
export const mutroseProblem = (tree: MutroseGoalTree): string | null => {
  const order = depthFirst<Child>(
    rootsOf(tree),
    (node) => (node.type === 'goal' ? ordered(node) : []),
    (node) => node.x,
  );
  const issues = scopeIssues(
    order.map((node) =>
      node.type === 'task'
        ? {
            id: node.id,
            kind: 'task',
            controls: [],
            monitors: [],
            params: node.properties.engine.params,
          }
        : {
            id: node.id,
            kind: 'goal',
            controls: node.properties.engine.controls,
            monitors: node.properties.engine.monitors,
            params: [],
          },
    ),
  );
  for (const node of order) {
    // its Params, or its Monitors then its Controls, as the decomposer reads them
    const scope = issues.find((issue) => issue.id === node.id);
    if (scope) return scope.message;
    if (node.type === 'task') continue;
    const goal = node.properties.engine;
    const forAll = goal.achieveCondition?.forAll;
    const problem =
      goal.goalType === 'Achieve' && forAll
        ? forAllProblem(node.id, forAll, goal.monitors, goal.controls)
        : goal.goalType === 'Query' && goal.queriedProperty
          ? queryProblem(node.id, goal.queriedProperty, goal.controls)
          : null;
    if (problem) return problem;
  }
  return null;
};

/** The operators the decomposer reads between operands (FALLBACK is a call). */
const OPERATORS = new Set([';', '#']);

/**
 * A goal's runtime annotation, its goals expanded: tasks by id, a goal
 * without an annotation its children in parallel (one child: that child).
 * A goal that isn't a Group or isn't Divisible is non-cooperative (`NC(...)`)
 * in every operator of its annotation.
 */
const annotationOf = (goal: MutroseGoalNode): string => {
  const children = childrenOf(goal);
  const { annotation, group, divisible } = goal.properties.engine;
  const nonCooperative = !group || !divisible;
  const operand = (id: string): string => {
    const child = children.find((c) => c.id === id);
    return child?.type === 'goal' ? annotationOf(child) : id;
  };
  const operator = (op: string, operands: string[]): string =>
    nonCooperative ? `NC(${operands.join(op)})` : `(${operands.join(op)})`;
  // a chain of one operator is one node (`(a;b;c)`, as the decomposer's parser builds it)
  const chain = (tree: RtTree | null, op: string): (RtTree | null)[] =>
    tree?.kind === 'binary' && tree.operator === op
      ? [...chain(tree.left, op), ...chain(tree.right, op)]
      : [tree];
  const print = (tree: RtTree | null): string => {
    switch (tree?.kind) {
      case 'ref':
        return operand(tree.id);
      case 'group':
        return print(tree.expr);
      case 'binary':
        return OPERATORS.has(tree.operator)
          ? operator(tree.operator, chain(tree, tree.operator).map(print))
          : `${print(tree.left)}${tree.operator}${print(tree.right)}`;
      case 'call': {
        const call = `${tree.name}(${tree.args.map(print).join(',')})`;
        return nonCooperative ? `NC(${call})` : call;
      }
      default:
        return '';
    }
  };
  if (annotation) return print(annotation);
  if (children.length > 1)
    return operator(
      '#',
      inDiagramOrder(children, (child) => child.x).map((child) =>
        operand(child.id),
      ),
    );
  // one child: a means-end; none: the goal itself
  return children.length === 1 ? operand(children[0]!.id) : goal.id;
};

/**
 * The goal model's runtime annotation, as the decomposer prints it with
 * `-v` (one line per root goal), after checking the model as it does.
 * A problem throws, with the decomposer's message.
 */
export const mutroseRuntimeAnnotation = (tree: MutroseGoalTree): string => {
  const problem = mutroseProblem(tree);
  if (problem) throw new Error(problem);
  return rootsOf(tree)
    .map((root) => `${annotationOf(root)}\n`)
    .join('');
};

/** The runtime annotation as an engine output: one primary file, `<model>.rannot`. */
export const mutroseOutput = (
  tree: MutroseGoalTree,
  { modelName }: { modelName: string },
): EngineOutput =>
  singleFileOutput({
    id: 'annotation',
    modelName,
    extension: 'rannot',
    language: 'rannot',
    text: mutroseRuntimeAnnotation(tree),
  });
