/**
 * What is wrong with a Tropos4AS model as a whole, for the lifecycle: its
 * errors stop a run. The named checks' rules (./checks) are said here too,
 * word for word; what crosses goals is said only here:
 *
 * - a creation condition on a goal that refines another (a warning: AAMAS
 *   2009 fn. 1, "creation conditions should be allowed only for root
 *   goals"; the lifecycle doesn't read it);
 * - a maintain-goal under an achieve- or perform-goal (a warning, §4.4:
 *   "decomposition of achieve- and perform-goals to maintain-goals is not
 *   allowed", #134 D4: it never returns to its parent);
 * - an inhibition or sequence cycle, or one across actors (errors);
 * - a maintain-goal without its maintain condition, an error without its
 *   condition (errors).
 *
 * A condition is the dialect's reading (goal-controller#187): one written
 * with an error is unset, the dialect's value check reports it.
 */
import { tropos4asCheckRegistry } from './checks';
import { TROPOS4AS_KINDS } from './vocabulary';
import {
  goalTypeOf,
  type Tropos4asElement,
  type Tropos4asModel,
  type Tropos4asProblem,
} from './model';

export const tropos4asProblems = (
  model: Tropos4asModel,
): Tropos4asProblem[] => {
  const problems: Tropos4asProblem[] = [...model.problems];
  const say = (
    severity: Tropos4asProblem['severity'],
    element: Tropos4asElement | undefined,
    message: string,
  ) =>
    problems.push({
      severity,
      message,
      ...(element && { element: element.pistarId }),
    });
  const context = (element: Tropos4asElement) => ({
    self: element.label,
    kindOf: () => undefined,
  });

  for (const goal of model.ofKind('goal')) {
    for (const name of [
      'tropos4as.goal.perform',
      'tropos4as.goal.target',
    ] as const) {
      const message = tropos4asCheckRegistry[name](
        { props: goal.values, raw: goal.properties, kind: 'istar.Goal' },
        context(goal),
      );
      if (message) say('error', goal, `${goal.label}: ${message}`);
    }
    const type = goalTypeOf(goal);
    if (type === 'maintain' && !goal.values.maintain)
      say(
        'error',
        goal,
        `${goal.label} is a maintain-goal without its maintain condition (M(m, d), AAMAS 2009 §4.3.3)`,
      );
    const parent = model.parentOf(goal);
    if (parent && goal.values.creation)
      say(
        'warning',
        goal,
        `${goal.label} refines ${parent.label}: a creation condition is for root goals (AAMAS 2009 fn. 1), and the lifecycle doesn't read it`,
      );
    if (
      parent &&
      type === 'maintain' &&
      parent.kind === 'goal' &&
      goalTypeOf(parent) !== 'maintain'
    )
      say(
        'warning',
        goal,
        `${goal.label} is a maintain-goal under the ${goalTypeOf(parent)}-goal ${parent.label}: it is suspended, never dropped, so ${parent.label} never hears from it (AAMAS 2009 §4.4)`,
      );
  }

  for (const error of model.ofKind('error')) {
    if (!error.values.condition)
      say(
        'error',
        error,
        `${error.label} has no condition: an error is adopted when its condition holds (#134 D7)`,
      );
  }

  for (const artifact of model.ofKind('artifact')) {
    const message = tropos4asCheckRegistry['tropos4as.artifact.attributes'](
      {
        props: artifact.values,
        raw: artifact.properties,
        kind: TROPOS4AS_KINDS.artifact,
      },
      context(artifact),
    );
    if (message) say('error', artifact, `${artifact.label}: ${message}`);
  }

  // inhibition and sequence: within an actor, and without a cycle
  for (const link of model.relationLinks) {
    if (link.source === link.target)
      say(
        'error',
        link.source,
        `${link.source.label} ${link.kind === 'inhibits' ? 'inhibits' : 'comes before'} itself`,
      );
    else if (link.source.actor !== link.target.actor)
      say(
        'error',
        link.source,
        `${link.source.label} and ${link.target.label} are in different actors: a ${link.kind} link joins goals of one actor`,
      );
  }
  for (const kind of ['inhibits', 'sequence'] as const) {
    const edges = model.relationLinks.filter((l) => l.kind === kind);
    const next = (goal: Tropos4asElement) =>
      edges.filter((l) => l.source === goal).map((l) => l.target);
    const reported = new Set<Tropos4asElement>();
    for (const start of new Set(edges.map((l) => l.source))) {
      // a path back to start, by depth-first search
      const path: Tropos4asElement[] = [];
      const seen = new Set<Tropos4asElement>();
      const walk = (goal: Tropos4asElement): boolean => {
        for (const target of next(goal)) {
          if (target === start) return true;
          if (seen.has(target)) continue;
          seen.add(target);
          path.push(target);
          if (walk(target)) return true;
          path.pop();
        }
        return false;
      };
      if (
        next(start).some((t) => t !== start) &&
        walk(start) &&
        !reported.has(start)
      ) {
        for (const goal of [start, ...path]) reported.add(goal);
        say(
          'error',
          start,
          `${kind === 'inhibits' ? 'Inhibition' : 'Sequence'} cycle: ${[start, ...path, start].map((g) => g.label).join(' → ')}`,
        );
      }
    }
  }
  return problems;
};
