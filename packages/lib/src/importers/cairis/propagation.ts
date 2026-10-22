/**
 * CAIRIS's own obstacle propagation, as its stored procedure
 * `obstacleProbability` computes it (cairis/sql/procs.sql:21245-21305,
 * cairis-platform/cairis `44cc57d`), over a CAIRIS document: the reference
 * the cross-check of kaosprop's RE'12 rules is checked against
 * (goal-controller#192), reproduced exactly, its defect included, so that the
 * numbers CAIRIS gives in Docker (scripts/kaos-stress/cairis-oracle.sh) are
 * explained by its rule and nothing else.
 *
 * For an obstacle in an environment, over that environment's
 * obstacle-to-obstacle associations only (a vulnerability or a domain
 * property refining an obstacle is not read):
 *
 * - no `and` and no `or` child: its own probability (0 when the file gives
 *   none, as CAIRIS's import defaults it, `GoalsContentHandler.py:156`);
 * - otherwise `and + or`, raised to its own probability when that is higher,
 *   where `or` is the plain sum of the `or` children's (no clamp at 1) and
 *   `and` the product of the `and` children's **starting from 0**: the
 *   procedure declares `andProb float default 0` and never sets it to 1, so
 *   any `and` refinement contributes 0. RE'12 multiplies from 1, and combines
 *   alternatives as a noisy-or (kaosprop).
 */
import type { CairisDocument } from './document';

/** Each obstacle situated in the environment, by name, with its probability under CAIRIS's rule. */
export const cairisObstacleProbabilities = (
  document: CairisDocument,
  environment: string,
): Map<string, number> => {
  const own = new Map<string, number>();
  for (const obstacle of document.obstacles)
    for (const here of obstacle.environments)
      if (here.environment === environment)
        own.set(obstacle.name, Number(here.probability?.value ?? 0) || 0);
  // the obstacles CAIRIS makes of use case exceptions: 0.0 (addUseCaseStepException)
  for (const e of document.exceptions)
    if (e.environment === environment && !own.has(e.name)) own.set(e.name, 0);
  const children = (name: string, refType: 'and' | 'or') =>
    document.associations
      .filter(
        (a) =>
          a.environment === environment &&
          a.refType === refType &&
          a.goal.dim === 'obstacle' &&
          a.subgoal.dim === 'obstacle' &&
          a.goal.name === name,
      )
      .map((a) => a.subgoal.name);
  const memo = new Map<string, number>();
  const probability = (name: string, path: ReadonlySet<string>): number => {
    const known = memo.get(name);
    if (known !== undefined) return known;
    const self = own.get(name) ?? 0;
    // a cycle: CAIRIS recurses until MySQL's limit; here the obstacle's own
    if (path.has(name)) return self;
    const inner = new Set([...path, name]);
    const ands = children(name, 'and');
    const ors = children(name, 'or');
    let value = self;
    if (ands.length || ors.length) {
      let and = 0; // `declare andProb float default 0`, never set to 1
      for (const child of ands) and *= probability(child, inner);
      let or = 0;
      for (const child of ors) or += probability(child, inner);
      value = Math.max(and + or, self);
    }
    memo.set(name, value);
    return value;
  };
  return new Map(
    [...own.keys()].map((name) => [name, probability(name, new Set())]),
  );
};
