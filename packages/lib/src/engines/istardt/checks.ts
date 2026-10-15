/**
 * iStar-DT's checks. The named ones are the properties' (the editors run
 * them); `istardtProblems` checks the model as a whole, as the writer needs
 * it: the effects, conditions, predicates and variables are extension kinds
 * no property check sees (#117 D7), so what crosses them is said here, and
 * the writer stops on its errors.
 */
import { readAssertion, readExpression } from '@goal-controller/goal-language';
import type {
  AssertionReading,
  ExpressionTree,
} from '@goal-controller/goal-language';
import { checks } from '../checks';
import {
  pairItems,
  type IstardtElement,
  type IstardtModel,
  type IstardtProblem,
} from './model';
import type { IstardtKind } from './vocabulary';

/** How far an effect group's probabilities may be from 1. */
export const PROBABILITY_TOLERANCE = 1e-9;

/** `a goal`, `an effect` */
const a = (kind: string) => `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;

const number = (text: string | undefined) =>
  text?.trim() ? Number(text) : undefined;

export const istardtCheckRegistry = checks({
  /** one root goal: the episode's (ER 2024 §3.2) */
  'istardt.goal.root': (raw, context) => {
    if (raw.root?.trim() !== 'true' || !context.elements) return null;
    const others = Object.entries(context.elements).filter(
      ([id, element]) =>
        id !== context.self &&
        element.kind === 'goal' &&
        element.properties.root?.trim() === 'true',
    );
    return others.length
      ? `One goal is the root: ${others.map(([id]) => id).join(', ')} is too`
      : null;
  },
  /** a continuous export's range */
  'istardt.export.bounds': (raw) => {
    const min = number(raw.exportMin);
    const max = number(raw.exportMax);
    return min !== undefined && max !== undefined && !(min < max)
      ? `An export's minimum is below its maximum: ${min} is not below ${max}`
      : null;
  },
});

/** The names of iStar-DT's checks: what a property's `check` may be. */
export type IstardtCheckName = keyof typeof istardtCheckRegistry;

/** The kinds a quality's formula may read (the BNF's numeric atoms). */
const QUALITY_READS: readonly IstardtKind[] = [
  'quality',
  'predicate',
  'variable',
  'condition',
  'goal',
  'task',
  'effect',
];
/** The kinds a condition's formula may read (its atoms; its comparisons' values too). */
const CONDITION_READS: readonly IstardtKind[] = [
  'predicate',
  'goal',
  'task',
  'effect',
  'condition',
  'quality',
  'variable',
];

const expressionNames = (tree: ExpressionTree): string[] => {
  switch (tree.kind) {
    case 'var':
      return [tree.name];
    case 'ref':
      return [tree.id];
    case 'call':
      return tree.args.flatMap(expressionNames);
    case 'binary':
      return [...expressionNames(tree.left), ...expressionNames(tree.right)];
    case 'unary':
      return expressionNames(tree.expr);
    case 'number':
      return [];
  }
};

const assertionNames = (tree: AssertionReading | null): string[] => {
  if (!tree) return [];
  switch (tree.kind) {
    case 'and':
    case 'or':
      return [...assertionNames(tree.left), ...assertionNames(tree.right)];
    case 'not':
    case 'paren':
      return assertionNames(tree.expr);
    case 'var':
    case 'assign':
      return [tree.variable];
    case 'call':
      return tree.args.flatMap(expressionNames);
    case 'comparison':
      return [...expressionNames(tree.left), ...expressionNames(tree.right)];
    case 'bool':
      return [];
  }
};

/** What is wrong with the model as a whole, for the writer: its errors stop it. */
export const istardtProblems = (model: IstardtModel): IstardtProblem[] => {
  const problems: IstardtProblem[] = [...model.problems];
  const say = (
    severity: IstardtProblem['severity'],
    element: { pistarId: string } | undefined,
    message: string,
  ) =>
    problems.push({
      severity,
      message,
      ...(element && { element: element.pistarId }),
    });
  const label = (element: IstardtElement) =>
    element.id ? `${element.id} (${element.identifier})` : element.identifier;
  const resolve = (name: string) =>
    model.byIdentifier.get(name) ??
    model.elements.find((element) => element.id === name);
  const names = (
    owner: IstardtElement,
    what: string,
    named: readonly string[],
    kinds: readonly IstardtKind[],
  ) => {
    for (const name of named) {
      const element = resolve(name);
      if (!element)
        say(
          'error',
          owner,
          `${label(owner)}'s ${what} names ${name}, which is no element`,
        );
      else if (!kinds.includes(element.kind))
        say(
          'error',
          owner,
          `${label(owner)}'s ${what} names ${name}, ${a(element.kind)}: it reads ${kinds.join(', ')}`,
        );
    }
  };

  // one root goal, one root quality (the reward)
  for (const kind of ['goal', 'quality'] as const) {
    const roots = model
      .ofKind(kind)
      .filter((e) => e.properties.root?.trim() === 'true');
    if (roots.length !== 1)
      say(
        'error',
        roots[1],
        roots.length
          ? `iStar-DT has one root ${kind}: ${roots.map(label).join(', ')} are roots`
          : `iStar-DT needs a root ${kind}: set root to true on one ${kind}${kind === 'quality' ? ' (the reward)' : ''}`,
      );
  }

  // effects: each of one task; each task's probabilities sum to 1
  for (const effect of model.ofKind('effect')) {
    const tasks = model
      .ofKind('task')
      .filter((task) => model.effectsOf(task).includes(effect));
    if (tasks.length !== 1)
      say(
        'error',
        effect,
        tasks.length
          ? `${label(effect)} is an effect of ${tasks.length} tasks: an effect belongs to one task`
          : `${label(effect)} is no task's effect: link a task to it`,
      );
    const written = model.probabilityOf(effect);
    const probability = number(written);
    if (
      tasks.length &&
      (probability === undefined || !(probability >= 0 && probability <= 1))
    )
      say(
        'error',
        effect,
        `${label(effect)}'s probability (on its effect group link) is a number in 0..1, not ${written ?? 'unset'}`,
      );
    names(
      effect,
      'set',
      pairItems(effect.properties.set).map(([name]) => name),
      ['variable'],
    );
    for (const [name, value] of pairItems(effect.properties.set))
      if (!value || !Number.isFinite(Number(value)))
        say(
          'error',
          effect,
          `${label(effect)} sets ${name} to a number, not ${value || 'nothing'}`,
        );
  }
  // effect groups: each of one task, one per task
  for (const group of model.effectGroups)
    if (group.tasks.length !== 1)
      say(
        'error',
        { pistarId: group.id },
        group.tasks.length
          ? `an effect group is linked from ${group.tasks.map(label).join(', ')}: a group is one task's`
          : 'an effect group no task links to: link its task to it',
      );
  for (const task of model.ofKind('task')) {
    const groups = model.effectGroups.filter((g) => g.tasks.includes(task));
    if (groups.length > 1)
      say(
        'error',
        task,
        `${label(task)} has ${groups.length} effect groups: a task has one`,
      );
    const effects = model.effectsOf(task);
    if (!effects.length) {
      say(
        'error',
        task,
        `${label(task)} has no effects: link it to one or more`,
      );
      continue;
    }
    const sum = effects.reduce(
      (total, e) => total + (number(model.probabilityOf(e)) ?? 0),
      0,
    );
    if (Math.abs(sum - 1) > PROBABILITY_TOLERANCE)
      say(
        'error',
        task,
        `${label(task)}'s effects' probabilities sum to ${sum}, not 1`,
      );
    if (
      !effects.some(
        (e) =>
          e.properties.satisfying?.trim() !== 'false' &&
          model.turnsTrue(e).length,
      )
    )
      say(
        'error',
        task,
        `${label(task)} has no satisfying effect that turns a predicate true: nothing says it is satisfied`,
      );
  }

  // a quality is its formula or its utility links' weighted sum, not both;
  // an effect weighs on it by the one predicate it turns true
  for (const quality of model.ofKind('quality')) {
    const utilities = model.utilities(quality);
    if (utilities.length && quality.properties.formula?.trim())
      say(
        'error',
        quality,
        `${label(quality)} has a formula and utility links: give it one or the other`,
      );
    if (!utilities.length && !quality.properties.formula?.trim())
      say(
        'error',
        quality,
        `${label(quality)} has no formula and no utility links`,
      );
    for (const { source } of utilities)
      if (source.kind === 'effect' && model.turnsTrue(source).length !== 1)
        say(
          'error',
          source,
          `${label(source)}'s utility link to ${label(quality)}: an effect weighs on a quality by the one predicate it turns true (it turns ${model.turnsTrue(source).length})`,
        );
  }

  // formulas name elements of the kinds they read
  for (const quality of model.ofKind('quality')) {
    const text = quality.properties.formula?.trim();
    if (!text) continue;
    const tree = readExpression(text);
    if (!tree)
      say(
        'error',
        quality,
        `${label(quality)}'s formula is not an expression: ${text}`,
      );
    else names(quality, 'formula', expressionNames(tree), QUALITY_READS);
  }
  for (const condition of model.ofKind('condition')) {
    const text = condition.properties.formula?.trim();
    if (!text) {
      say('error', condition, `${label(condition)} has no formula`);
      continue;
    }
    const tree = readAssertion(text);
    if (!tree)
      say(
        'error',
        condition,
        `${label(condition)}'s formula is not a condition: ${text}`,
      );
    else names(condition, 'formula', assertionNames(tree), CONDITION_READS);
  }

  // the sets
  const actor = model.actor ? { pistarId: model.actor } : undefined;
  const setNames = (
    what: string,
    named: readonly string[],
    kinds: readonly IstardtKind[],
  ) => {
    for (const name of named) {
      const element = resolve(name);
      if (!element)
        say('error', actor, `the ${what} names ${name}, which is no element`);
      else if (!kinds.includes(element.kind))
        say(
          'error',
          element,
          `the ${what} has ${kinds.join(', ')}: ${name} is ${a(element.kind)}`,
        );
    }
  };
  setNames('cross-run set', model.crossRun, [
    'predicate',
    'condition',
    'variable',
    'quality',
  ]);
  setNames('exported set', model.exported, [
    'goal',
    'task',
    'predicate',
    'variable',
    'quality',
    'condition',
  ]);
  setNames(
    'initializations',
    model.initializations.map(([name]) => name),
    ['predicate', 'condition', 'variable', 'quality'],
  );
  for (const name of model.exported) {
    const element = resolve(name);
    if (element?.kind === 'condition')
      say(
        'warning',
        element,
        `${label(element)} is exported, but DT-Golog exports goals, tasks and predicates (discrete), qualities and variables (continuous): the writer leaves it out, as dtx2dtg`,
      );
    if (
      element &&
      (element.kind === 'quality' || element.kind === 'variable')
    ) {
      const min = number(element.properties.exportMin);
      const max = number(element.properties.exportMax);
      if (min === undefined || max === undefined)
        say(
          'warning',
          element,
          `${label(element)} is exported continuous without exportMin and exportMax: written as 0.0..0.0`,
        );
      else if (!(min < max))
        say(
          'error',
          element,
          `${label(element)}'s export range is empty: ${min} is not below ${max}`,
        );
    }
  }

  // an npr between OR siblings: they already exclude each other
  for (const goal of model.ofKind('goal')) {
    const { relation, children } = model.refinement(goal);
    if (relation !== 'OR') continue;
    for (const child of children)
      for (const source of model.npr(child))
        if (children.includes(source))
          say(
            'info',
            child,
            `${label(child)}'s npr from ${label(source)} says nothing more: OR siblings already exclude each other`,
          );
  }
  return problems;
};
