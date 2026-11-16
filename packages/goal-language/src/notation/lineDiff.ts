/**
 * A line-level diff (Myers' O(ND) algorithm, goal-controller#518): which
 * lines of an edited text are lines of the text it was edited from,
 * unchanged, and the runs of changed lines between them (hunks). What the
 * Notation document's edits are read from (`notationEdits`).
 */

/** A run of changed lines between two unchanged ones: the old lines it removes, the new lines it adds (indices, in order). */
export type Hunk = { removed: number[]; added: number[] };

export type LineDiff = {
  /** for each new line, the old line it is (unchanged), or -1 */
  matched: Int32Array;
  /** for each old line, the new line it is (unchanged), or -1 */
  kept: Int32Array;
  hunks: Hunk[];
  /** for each new line, the index of the hunk that adds it, or -1 */
  hunkOf: Int32Array;
};

/** The pairs of equal lines of a longest common subsequence of `a` and `b` (Myers), as [a index, b index], in order. */
const commonLines = (
  a: readonly string[],
  b: readonly string[],
): [number, number][] => {
  // the common head and tail are matched as they are
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < start; i++) pairs.push([i, i]);
  const n = endA - start;
  const m = endB - start;
  const middle: [number, number][] = [];
  if (n > 0 && m > 0) {
    const max = n + m;
    const offset = max + 1;
    const v = new Int32Array(2 * max + 3);
    // after each d, v[k] for k from -d - 1 to d + 1 (at k + d + 1): to walk back
    const trace: Int32Array[] = [];
    let found = -1;
    for (let d = 0; d <= max && found < 0; d++) {
      for (let k = -d; k <= d; k += 2) {
        let x =
          k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)
            ? v[offset + k + 1]!
            : v[offset + k - 1]! + 1;
        let y = x - k;
        while (x < n && y < m && a[start + x] === b[start + y]) {
          x++;
          y++;
        }
        v[offset + k] = x;
        if (x >= n && y >= m) {
          found = d;
          break;
        }
      }
      trace.push(v.slice(offset - d - 1, offset + d + 2));
    }
    // walk back from (n, m), each d's snake from where the d - 1's ended
    let x = n;
    let y = m;
    for (let d = found; d > 0; d--) {
      const k = x - y;
      const before = trace[d - 1]!;
      const at = (kk: number) => before[kk + d]!;
      const prevK =
        k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
      const prevX = at(prevK);
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        middle.push([start + x - 1, start + y - 1]);
        x--;
        y--;
      }
      x = prevX;
      y = prevY;
    }
    while (x > 0 && y > 0) {
      middle.push([start + x - 1, start + y - 1]);
      x--;
      y--;
    }
    middle.reverse();
  }
  pairs.push(...middle);
  for (let i = 0; i < a.length - endA; i++) pairs.push([endA + i, endB + i]);
  return pairs;
};

/** The diff of two texts' lines: the unchanged lines, and the hunks between them. */
export const lineDiff = (
  before: readonly string[],
  after: readonly string[],
): LineDiff => {
  const matched = new Int32Array(after.length).fill(-1);
  const kept = new Int32Array(before.length).fill(-1);
  const hunkOf = new Int32Array(after.length).fill(-1);
  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  const close = (toI: number, toJ: number) => {
    if (i === toI && j === toJ) return;
    const hunk: Hunk = { removed: [], added: [] };
    for (; i < toI; i++) hunk.removed.push(i);
    for (; j < toJ; j++) {
      hunk.added.push(j);
      hunkOf[j] = hunks.length;
    }
    hunks.push(hunk);
  };
  for (const [a, b] of commonLines(before, after)) {
    close(a, b);
    matched[b] = a;
    kept[a] = b;
    i = a + 1;
    j = b + 1;
  }
  close(before.length, after.length);
  return { matched, kept, hunks, hunkOf };
};
