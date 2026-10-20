/**
 * Reduced ordered binary decision diagrams (goal-controller#190): a Boolean
 * formula over independent events as a canonical graph, and the
 * probability it holds given each event's (Bryant 1986; RE'15 §VI.B). An
 * event shared by two branches is one variable, so dependent branches are
 * counted once. Variables are ordered by creation. Generic: no engine's.
 */

/** A node: `0` and `1` are the terminals; any other is an index in its manager. */
export type BddNode = number;

export const FALSE: BddNode = 0;
export const TRUE: BddNode = 1;

/** A manager: its variables, its nodes (unique), and the operations on them. */
export class Bdd {
  /** each node's variable, low (variable false) and high (true) child; the terminals' unused */
  private readonly variable: number[] = [-1, -1];
  private readonly low: BddNode[] = [0, 1];
  private readonly high: BddNode[] = [0, 1];
  private readonly unique = new Map<string, BddNode>();
  private readonly memo = new Map<string, BddNode>();
  private count = 0;

  /** A new variable's node (it holds: high). */
  newVariable(): BddNode {
    return this.node(this.count++, FALSE, TRUE);
  }

  /** The variables made so far. */
  get variables(): number {
    return this.count;
  }

  /** The nodes, terminals included. */
  get size(): number {
    return this.variable.length;
  }

  private node(variable: number, low: BddNode, high: BddNode): BddNode {
    if (low === high) return low;
    const key = `${variable}:${low}:${high}`;
    const found = this.unique.get(key);
    if (found !== undefined) return found;
    const id = this.variable.length;
    this.variable.push(variable);
    this.low.push(low);
    this.high.push(high);
    this.unique.set(key, id);
    return id;
  }

  private top(node: BddNode): number {
    return node <= TRUE ? Infinity : this.variable[node]!;
  }

  private apply(op: 'and' | 'or', a: BddNode, b: BddNode): BddNode {
    if (op === 'and') {
      if (a === FALSE || b === FALSE) return FALSE;
      if (a === TRUE) return b;
      if (b === TRUE) return a;
    } else {
      if (a === TRUE || b === TRUE) return TRUE;
      if (a === FALSE) return b;
      if (b === FALSE) return a;
    }
    if (a === b) return a;
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${op}:${x}:${y}`;
    const found = this.memo.get(key);
    if (found !== undefined) return found;
    const v = Math.min(this.top(x), this.top(y));
    const [xl, xh] = this.top(x) === v ? [this.low[x]!, this.high[x]!] : [x, x];
    const [yl, yh] = this.top(y) === v ? [this.low[y]!, this.high[y]!] : [y, y];
    const result = this.node(v, this.apply(op, xl, yl), this.apply(op, xh, yh));
    this.memo.set(key, result);
    return result;
  }

  and(...nodes: readonly BddNode[]): BddNode {
    return nodes.reduce((a, b) => this.apply('and', a, b), TRUE);
  }

  or(...nodes: readonly BddNode[]): BddNode {
    return nodes.reduce((a, b) => this.apply('or', a, b), FALSE);
  }

  not(node: BddNode): BddNode {
    const key = `not:${node}`;
    if (node <= TRUE) return node === TRUE ? FALSE : TRUE;
    const found = this.memo.get(key);
    if (found !== undefined) return found;
    const result = this.node(
      this.variable[node]!,
      this.not(this.low[node]!),
      this.not(this.high[node]!),
    );
    this.memo.set(key, result);
    return result;
  }

  /** if `condition` then `then` else `otherwise` */
  ite(condition: BddNode, then: BddNode, otherwise: BddNode): BddNode {
    return this.or(
      this.and(condition, then),
      this.and(this.not(condition), otherwise),
    );
  }

  /**
   * The probability the formula holds, each variable independently true
   * with its probability (by index): at a node, P = (1 − p)·P(low) +
   * p·P(high) (RE'15 §VI.B, Fig. 6). `cache` keeps the nodes' values for one
   * assignment; give a fresh one per assignment.
   */
  probability(
    node: BddNode,
    p: ArrayLike<number>,
    cache: Map<BddNode, number> = new Map(),
  ): number {
    if (node === FALSE) return 0;
    if (node === TRUE) return 1;
    const found = cache.get(node);
    if (found !== undefined) return found;
    const q = p[this.variable[node]!]!;
    const value =
      (1 - q) * this.probability(this.low[node]!, p, cache) +
      q * this.probability(this.high[node]!, p, cache);
    cache.set(node, value);
    return value;
  }

  /** The decision nodes a formula's graph has (terminals not counted). */
  nodeCount(node: BddNode): number {
    const seen = new Set<BddNode>();
    const walk = (n: BddNode) => {
      if (n <= TRUE || seen.has(n)) return;
      seen.add(n);
      walk(this.low[n]!);
      walk(this.high[n]!);
    };
    walk(node);
    return seen.size;
  }

  /** The variables a formula depends on. */
  support(node: BddNode, into: Set<number> = new Set()): Set<number> {
    const seen = new Set<BddNode>();
    const walk = (n: BddNode) => {
      if (n <= TRUE || seen.has(n)) return;
      seen.add(n);
      into.add(this.variable[n]!);
      walk(this.low[n]!);
      walk(this.high[n]!);
    };
    walk(node);
    return into;
  }
}
