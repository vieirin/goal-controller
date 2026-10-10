/**
 * Ids scoped by their goal (a definition's `idScope: 'ancestorGoal'`, GODA's
 * `G3_T1_1`): the key an element is known by when its id repeats under
 * another goal, and how a Notation document's lines find their element's
 * key, by the goal line above them.
 */
import type { AnyDialect } from '@goal-controller/dialect';

/** The key of an element whose id repeats: `G3/T1.1` (its nearest goal's id, and its own). */
export const scopedKey = (goal: string, id: string): string => `${goal}/${id}`;

/**
 * The kind whose id prefix an id starts with: the longest that matches and
 * is followed by what an id's number starts with (a digit or `X`), so a
 * prefix another one starts with (`A`, `AT`) never takes the other's ids.
 */
export const kindOfId = (
  definition: Pick<AnyDialect, 'elements'>,
  id: string,
): string | undefined =>
  Object.entries(definition.elements)
    .filter(
      ([, element]) =>
        element?.prefix &&
        id.startsWith(element.prefix) &&
        /^[0-9X]/.test(id.slice(element.prefix.length)),
    )
    .sort(([, a], [, b]) => b!.prefix!.length - a!.prefix!.length)[0]?.[0];

/**
 * Reads a document's element lines in order and says which goal each is
 * under (the nearest goal line above, by indentation), and the key a line's
 * id names: its scoped key when the elements have one, else the id itself.
 */
export const lineScope = (
  definition: Pick<AnyDialect, 'elements' | 'idScope'>,
) => {
  const goals: { indent: number; id: string }[] = [];
  const scoped = definition.idScope === 'ancestorGoal';
  return {
    /** an element line, at its indentation: the goal it is under (none outside a scoped dialect) */
    enter(indent: number, id: string): string | null {
      while (goals.length && goals.at(-1)!.indent >= indent) goals.pop();
      const isGoal = kindOfId(definition, id) === 'goal';
      const goal = scoped && !isGoal ? (goals.at(-1)?.id ?? null) : null;
      if (isGoal) goals.push({ indent, id });
      return goal;
    },
    /** the key of the line just entered: `goal/id` when `has` it, else the id */
    keyOf(
      goal: string | null,
      id: string,
      has: (key: string) => boolean,
    ): string {
      return goal !== null && has(scopedKey(goal, id))
        ? scopedKey(goal, id)
        : id;
    },
  };
};
