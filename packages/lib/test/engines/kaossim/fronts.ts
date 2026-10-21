/**
 * A Pareto front as a multiset of design ids (goal-controller#193, rv377):
 * each id with how many times it is on the front, sorted, so that comparing
 * two fronts fails on a member dropped or duplicated, not only on one
 * missing.
 */
import type { Scored } from '../../../src/engines/kaossim';

export const frontMultiset = (
  front: readonly Scored[],
): [id: string, count: number][] => {
  const counts = new Map<string, number>();
  for (const scored of front) {
    const id = scored.run.design.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
};
