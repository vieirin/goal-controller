/**
 * What MutRoSe's decomposer checks across a goal model (`gm/gm.cpp`
 * check_gm_validity, and the tasks' parameters in `atmanager/at_manager.cpp`),
 * written once over what it reads of each element. The named checks run it
 * on the raw properties an editor has (each field gets its own message); the
 * template on the typed tree (the first problem stops it, as the decomposer).
 */
import type { ForAll, MutroseVar, Select } from './checks';

/** What the walk reads of an element. */
export type ScopeElement = {
  id: string;
  kind: 'goal' | 'task';
  controls: readonly MutroseVar[];
  monitors: readonly MutroseVar[];
  params: readonly string[];
};

/** A problem of one of an element's properties. */
export type ScopeIssue = {
  id: string;
  key: 'Monitors' | 'Controls' | 'Params';
  message: string;
};

/**
 * Siblings as the decomposer orders them: by their diagram x, left to right
 * (`gm.hpp`), when every one has a position; else in the order given (a
 * stable sort keeps ties).
 */
export const inDiagramOrder = <T>(
  elements: readonly T[],
  xOf: (element: T) => number | undefined,
): readonly T[] =>
  elements.every((element) => xOf(element) !== undefined)
    ? [...elements].sort((a, b) => xOf(a)! - xOf(b)!)
    : elements;

/**
 * Elements depth first from the roots, each one's children in diagram order
 * (the decomposer's `get_dfs_gm_nodes`).
 */
export const depthFirst = <T>(
  roots: readonly T[],
  childrenOf: (element: T) => readonly T[],
  xOf: (element: T) => number | undefined,
): T[] => {
  const byX = (elements: readonly T[]) => inDiagramOrder(elements, xOf);
  const visited: T[] = [];
  const visit = (element: T) => {
    visited.push(element);
    byX(childrenOf(element)).forEach(visit);
  };
  byX(roots).forEach(visit);
  return visited;
};

/**
 * Every scoping problem, in the walk's order: a Monitors variable no earlier
 * goal's Controls declared (the last one, as the decomposer reports it), a
 * variable declared again, a task's Params not bound. Each element's own
 * declarations count after its Monitors, as the decomposer reads them.
 */
export const scopeIssues = (order: readonly ScopeElement[]): ScopeIssue[] => {
  const declared = new Set<string>();
  const issues: ScopeIssue[] = [];
  for (const element of order) {
    if (element.kind === 'task') {
      const unbound = element.params.find((param) => !declared.has(param));
      if (unbound)
        issues.push({
          id: element.id,
          key: 'Params',
          message: `Could not find value for parameter [${unbound}] for task [${element.id}]`,
        });
      continue;
    }
    const undeclared = [...element.monitors]
      .reverse()
      .find((v) => !declared.has(v.name));
    if (undeclared)
      issues.push({
        id: element.id,
        key: 'Monitors',
        message: `Undeclared variable [${undeclared.name}] of type [${undeclared.type}] in goal ${element.id}`,
      });
    const again = element.controls.find((v) => declared.has(v.name));
    if (again)
      issues.push({
        id: element.id,
        key: 'Controls',
        message: `Redeclaration of variable [${again.name}] in goal ${element.id}`,
      });
    for (const v of element.controls) declared.add(v.name);
  }
  return issues;
};

/** An Achieve goal's forAll against its lists (the decomposer's messages name them the other way round). */
export const forAllProblem = (
  id: string,
  forAll: ForAll,
  monitors: readonly MutroseVar[],
  controls: readonly MutroseVar[],
): string | null =>
  !monitors.some((v) => v.name === forAll.iterated)
    ? `Did not find iterated variable ${forAll.iterated} in ${id}'s controlled variables list`
    : !controls.some((v) => v.name === forAll.iteration)
      ? `Did not find iteration variable ${forAll.iteration} in ${id}'s monitored variables list`
      : null;

/** `Sequence(Room)` is a collection of `Room`s: the base type a query compares. */
const baseType = (type: string) =>
  /^Sequence\((.*)\)$/i.exec(type)?.[1] ?? type;

/** A Query goal's select against its first controlled variable. */
export const queryProblem = (
  id: string,
  query: Select,
  controls: readonly MutroseVar[],
): string | null => {
  const [first] = controls;
  if (!first)
    return `No controlled variable was declared for Query goal [${id}]`;
  return query.type !== baseType(first.type)
    ? `Query variable [${query.variable}] type + [${query.type}] is different than the base type of the first controlled variable [${first.name}] ([${baseType(first.type)}])`
    : null;
};
