/**
 * What MutRoSe's decomposer makes of a goal model before it reads the world:
 * the model's validity (`gm/gm.cpp` check_gm_validity, and the task
 * parameters' binding of `atmanager/at_manager.cpp`), then its runtime
 * annotation over the abstract tasks, printed as the decomposer's `-v` does
 * (`utils/annotmanagerutils.cpp` recursive_rt_annot_build).
 *
 * Two differences, both because a browser has no world knowledge: forAll
 * goals are not expanded into one instance per item (each is printed once),
 * and children are visited in the runtime annotation's order, then the
 * model's (the decomposer sorts a goal's children by their x coordinate).
 */
import { notationRefs, type RtTree } from '@goal-controller/goal-language';
import type { MutroseGoalNode, MutroseGoalTree, MutroseTask } from '../mapper';

type Child = MutroseGoalNode | MutroseTask;

const childrenOf = (goal: MutroseGoalNode): Child[] => [
  ...(goal.children ?? []),
  ...(goal.tasks ?? []),
];

/** A goal's children in the annotation's order, then those it doesn't name. */
const visitOrder = (goal: MutroseGoalNode): Child[] => {
  const children = childrenOf(goal);
  const named = notationRefs(goal.properties.engine.annotation).flatMap(
    (id) => {
      const child = children.find((c) => c.id === id);
      return child ? [child] : [];
    },
  );
  return [...named, ...children.filter((c) => !named.includes(c))];
};

/** Every node, depth first from the roots (the decomposer's `get_dfs_gm_nodes`). */
const depthFirst = (roots: MutroseGoalNode[]): Child[] => {
  const nodes: Child[] = [];
  const visit = (node: Child) => {
    nodes.push(node);
    if (node.type === 'goal') visitOrder(node).forEach(visit);
  };
  roots.forEach(visit);
  return nodes;
};

/** `Sequence(Room)` is a collection of `Room`s: the base type a query compares. */
const baseType = (type: string) =>
  /^Sequence\((.*)\)$/i.exec(type)?.[1] ?? type;

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
  const declared = new Map<string, string>();
  for (const node of depthFirst(rootsOf(tree))) {
    if (node.type === 'task') {
      const missing = node.properties.engine.params.find(
        (param) => !declared.has(param),
      );
      if (missing)
        return `Could not find value for parameter [${missing}] for task [${node.id}]`;
      continue;
    }
    const goal = node.properties.engine;
    // the decomposer reports the last undeclared one it meets
    const undeclared = [...goal.monitors]
      .reverse()
      .find((v) => !declared.has(v.name));
    if (undeclared)
      return `Undeclared variable [${undeclared.name}] of type [${undeclared.type}] in goal ${node.id}`;
    for (const v of goal.controls) {
      if (declared.has(v.name))
        return `Redeclaration of variable [${v.name}] in goal ${node.id}`;
      declared.set(v.name, v.type);
    }
    const forAll = goal.achieveCondition?.forAll;
    if (goal.goalType === 'Achieve' && forAll) {
      // the decomposer's messages name the lists the other way round
      if (!goal.monitors.some((v) => v.name === forAll.iterated))
        return `Did not find iterated variable ${forAll.iterated} in ${node.id}'s controlled variables list`;
      if (!goal.controls.some((v) => v.name === forAll.iteration))
        return `Did not find iteration variable ${forAll.iteration} in ${node.id}'s monitored variables list`;
    }
    const query = goal.queriedProperty;
    if (goal.goalType === 'Query' && query) {
      const [first] = goal.controls;
      if (!first)
        return `No controlled variable was declared for Query goal [${node.id}]`;
      if (query.type !== baseType(first.type))
        return `Query variable [${query.variable}] type + [${query.type}] is different than the base type of the first controlled variable [${first.name}] ([${baseType(first.type)}])`;
    }
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
      children.map((child) => operand(child.id)),
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
