/**
 * How the workbench merges what its producers say of the model (the file,
 * its own checks, the engine, the language services): the composition rule
 * of goal-controller#24. A union, one problem per element, property and
 * message (one said without a property is the same as one said with it,
 * when the element and the message are), the most severe first.
 */
import type { Problem } from './types';

const ORDER = { error: 0, warning: 1, info: 2 } as const;

export const mergeProblems = (
  ...lists: readonly (readonly Problem[])[]
): Problem[] => {
  const all = lists.flat();
  const about = (problem: Problem) =>
    `${problem.elementId ?? ''}\u0000${problem.message}`;
  // what is said of an element's property too
  const withKey = new Set(
    all.filter((problem) => problem.key !== undefined).map(about),
  );
  const merged = new Map<string, Problem>();
  for (const problem of all) {
    if (
      problem.key === undefined &&
      problem.elementId !== undefined &&
      withKey.has(about(problem))
    )
      continue;
    const id = `${about(problem)}\u0000${problem.key ?? ''}`;
    const known = merged.get(id);
    merged.set(
      id,
      known ? { ...known, severity: worst(known, problem) } : problem,
    );
  }
  return [...merged.values()].sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  );
};

const worst = (a: Problem, b: Problem) =>
  ORDER[a.severity] <= ORDER[b.severity] ? a.severity : b.severity;

/**
 * Problems grouped as the Problems panel shows them: by element (the model's
 * own first), then by who said it, in the order they come.
 */
export const problemGroups = (
  problems: readonly Problem[],
): {
  elementId: string | undefined;
  sources: { source: string; problems: Problem[] }[];
}[] => {
  const groups = new Map<
    string,
    {
      elementId: string | undefined;
      sources: Map<string, Problem[]>;
    }
  >();
  const model = problems.filter((p) => p.elementId === undefined);
  for (const problem of [
    ...model,
    ...problems.filter((p) => p.elementId !== undefined),
  ]) {
    const id = problem.elementId ?? '';
    const group = groups.get(id) ?? {
      elementId: problem.elementId,
      sources: new Map<string, Problem[]>(),
    };
    groups.set(id, group);
    group.sources.set(problem.source, [
      ...(group.sources.get(problem.source) ?? []),
      problem,
    ]);
  }
  return [...groups.values()].map(({ elementId, sources }) => ({
    elementId,
    sources: [...sources].map(([source, list]) => ({ source, problems: list })),
  }));
};
