/**
 * Internal utility functions
 */

/**
 * Extract the root ID from a goal ID (e.g., "G1a" -> "G1")
 */
export function goalRootId(id: string): string {
  return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
}

/**
 * Generate cartesian product of arrays
 */
export function* cartesianProduct<T>(...arrays: T[][]): Generator<T[]> {
  if (arrays.length === 0) {
    yield [];
    return;
  }

  const [first, ...rest] = arrays;
  if (!first) {
    yield [];
    return;
  }
  for (const item of first) {
    if (rest.length === 0) {
      yield [item];
    } else {
      for (const subProduct of cartesianProduct(...rest)) {
        yield [item, ...subProduct];
      }
    }
  }
}
