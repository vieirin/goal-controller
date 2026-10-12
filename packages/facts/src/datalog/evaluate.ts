/**
 * A small Datalog evaluator: rules stratified by their negations (a negated
 * relation is complete before a rule reads it), each stratum to its fixpoint
 * semi-naively (a recursive rule joins at least one tuple new in the last
 * round). Relations are sets of tuples with hash indexes built on demand for
 * the columns a join binds.
 */
import {
  checkSafety,
  DatalogSyntaxError,
  parseRules,
  type Atom,
  type Comparison,
  type Literal,
  type Rule,
  type Term,
  type Tuple,
  type Value,
} from './syntax';

const keyOf = (values: readonly Value[]): string =>
  values.map((v) => (typeof v === 'number' ? `#${v}` : v)).join('\u0001');

/** A set of tuples, indexed by the columns joins look them up by. */
export class Relation {
  readonly tuples: Tuple[] = [];
  private readonly keys = new Set<string>();
  private readonly indexes = new Map<string, Map<string, Tuple[]>>();

  get size(): number {
    return this.tuples.length;
  }

  has(tuple: Tuple): boolean {
    return this.keys.has(keyOf(tuple));
  }

  /** Adds a tuple; false when it was there. */
  add(tuple: Tuple): boolean {
    const key = keyOf(tuple);
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.tuples.push(tuple);
    for (const [columns, index] of this.indexes) {
      const at = keyOf(columns.split(',').map((c) => tuple[Number(c)]!));
      const bucket = index.get(at);
      if (bucket) bucket.push(tuple);
      else index.set(at, [tuple]);
    }
    return true;
  }

  /** The tuples whose `columns` hold `values` (all of them without columns). */
  lookup(
    columns: readonly number[],
    values: readonly Value[],
  ): readonly Tuple[] {
    if (!columns.length) return this.tuples;
    const name = columns.join(',');
    let index = this.indexes.get(name);
    if (!index) {
      index = new Map();
      for (const tuple of this.tuples) {
        const at = keyOf(columns.map((c) => tuple[c]!));
        const bucket = index.get(at);
        if (bucket) bucket.push(tuple);
        else index.set(at, [tuple]);
      }
      this.indexes.set(name, index);
    }
    return index.get(keyOf(values)) ?? [];
  }
}

/** Relations by name: the facts given and what the rules derived. */
export class Database {
  private readonly relations = new Map<string, Relation>();

  relation(name: string): Relation {
    let relation = this.relations.get(name);
    if (!relation) {
      relation = new Relation();
      this.relations.set(name, relation);
    }
    return relation;
  }

  /** The tuples of a relation matching a pattern (undefined: any value). */
  query(
    name: string,
    pattern: readonly (Value | undefined)[] = [],
  ): readonly Tuple[] {
    const columns: number[] = [];
    const values: Value[] = [];
    pattern.forEach((value, column) => {
      if (value !== undefined) {
        columns.push(column);
        values.push(value);
      }
    });
    return this.relations.get(name)?.lookup(columns, values) ?? [];
  }

  /** Every tuple, by relation (for tests and measurements). */
  get counts(): Record<string, number> {
    return Object.fromEntries(
      [...this.relations].map(([name, relation]) => [name, relation.size]),
    );
  }
}

/** A term against a rule's slots: a constant, or the slot of a variable. */
type Slot = { const: Value } | { slot: number };

type CompiledAtom = { relation: string; slots: Slot[] };
type Step =
  | { kind: 'scan'; atom: CompiledAtom; position: number }
  | { kind: 'not'; atom: CompiledAtom }
  | { kind: 'compare'; op: Comparison; left: Slot; right: Slot };

type CompiledRule = {
  rule: Rule;
  head: CompiledAtom;
  /** positive atoms, by body position */
  positives: CompiledAtom[];
  negatives: CompiledAtom[];
  compares: { op: Comparison; left: Slot; right: Slot }[];
  slots: number;
};

const compileRule = (rule: Rule): CompiledRule => {
  checkSafety(rule);
  const slots = new Map<string, number>();
  const slotOf = (term: Term): Slot =>
    'const' in term
      ? term
      : {
          slot:
            slots.get(term.var) ??
            (slots.set(term.var, slots.size), slots.size - 1),
        };
  const compileAtom = (atom: Atom): CompiledAtom => ({
    relation: atom.relation,
    slots: atom.terms.map(slotOf),
  });
  const positives: CompiledAtom[] = [];
  const negatives: CompiledAtom[] = [];
  const compares: CompiledRule['compares'] = [];
  for (const literal of rule.body)
    if (literal.kind === 'atom')
      (literal.negated ? negatives : positives).push(compileAtom(literal.atom));
  for (const literal of rule.body)
    if (literal.kind === 'compare')
      compares.push({
        op: literal.op,
        left: slotOf(literal.left),
        right: slotOf(literal.right),
      });
  return {
    rule,
    head: compileAtom(rule.head),
    positives,
    negatives,
    compares,
    slots: slots.size,
  };
};

const compare = (op: Comparison, a: Value, b: Value): boolean => {
  switch (op) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
  }
};

/**
 * The order a rule's body is joined in: the `first` positive atom (a delta)
 * first, then greedily the atom with the most bound slots; a negation or a
 * comparison as soon as its slots are bound (an `X = c` binds X).
 */
const plan = (rule: CompiledRule, first: number | null): Step[] => {
  const bound = new Set<number>();
  const steps: Step[] = [];
  const isBound = (slot: Slot) => 'const' in slot || bound.has(slot.slot);
  const bind = (slots: readonly Slot[]) =>
    slots.forEach((s) => 'slot' in s && bound.add(s.slot));
  let negatives = [...rule.negatives];
  let compares = [...rule.compares];
  const settle = () => {
    let moved = true;
    while (moved) {
      moved = false;
      for (const c of compares) {
        const ready =
          (isBound(c.left) && isBound(c.right)) ||
          (c.op === '=' && (isBound(c.left) || isBound(c.right)));
        if (!ready) continue;
        steps.push({ kind: 'compare', ...c });
        bind([c.left, c.right]);
        compares = compares.filter((x) => x !== c);
        moved = true;
      }
    }
    for (const n of negatives)
      if (
        n.slots.every(isBound) ||
        n.slots.every((s) => isBound(s) || isAnonymous(s))
      ) {
        steps.push({ kind: 'not', atom: n });
      }
    negatives = negatives.filter(
      (n) => !steps.some((s) => s.kind === 'not' && s.atom === n),
    );
  };
  // a negation's `_` is a wildcard: a slot no positive atom binds
  const positiveSlots = new Set(
    rule.positives.flatMap((a) =>
      a.slots.flatMap((s) => ('slot' in s ? [s.slot] : [])),
    ),
  );
  const isAnonymous = (slot: Slot) =>
    'slot' in slot && !positiveSlots.has(slot.slot);
  const remaining = rule.positives.map((atom, position) => ({
    atom,
    position,
  }));
  settle();
  while (remaining.length) {
    let pick = 0;
    if (first !== null && steps.every((s) => s.kind !== 'scan'))
      pick = remaining.findIndex((r) => r.position === first);
    else {
      let best = -1;
      remaining.forEach((r, i) => {
        const score = r.atom.slots.filter(isBound).length;
        if (score > best) {
          best = score;
          pick = i;
        }
      });
    }
    const [{ atom, position }] = remaining.splice(pick, 1) as [
      (typeof remaining)[number],
    ];
    steps.push({ kind: 'scan', atom, position });
    bind(atom.slots);
    settle();
  }
  if (negatives.length || compares.length)
    throw new DatalogSyntaxError(`Cannot order the rule: ${rule.rule.text}`);
  return steps;
};

/** Runs a planned rule; `source` gives the relation an atom reads (a delta for the first). */
const run = (
  rule: CompiledRule,
  steps: readonly Step[],
  source: (atom: CompiledAtom, position: number) => Relation,
  read: (name: string) => Relation,
  emit: (tuple: Tuple) => void,
): void => {
  const env: (Value | undefined)[] = Array.from({ length: rule.slots });
  const valueOf = (slot: Slot) =>
    'const' in slot ? slot.const : env[slot.slot];
  const step = (i: number): void => {
    const current = steps[i];
    if (!current) {
      emit(rule.head.slots.map((s) => valueOf(s)!));
      return;
    }
    switch (current.kind) {
      case 'compare': {
        const left = valueOf(current.left);
        const right = valueOf(current.right);
        if (current.op === '=' && left === undefined) {
          env[(current.left as { slot: number }).slot] = right;
          step(i + 1);
          env[(current.left as { slot: number }).slot] = undefined;
          return;
        }
        if (current.op === '=' && right === undefined) {
          env[(current.right as { slot: number }).slot] = left;
          step(i + 1);
          env[(current.right as { slot: number }).slot] = undefined;
          return;
        }
        if (compare(current.op, left!, right!)) step(i + 1);
        return;
      }
      case 'not': {
        const columns: number[] = [];
        const values: Value[] = [];
        current.atom.slots.forEach((s, c) => {
          const v = valueOf(s);
          if (v !== undefined) {
            columns.push(c);
            values.push(v);
          }
        });
        if (!read(current.atom.relation).lookup(columns, values).length)
          step(i + 1);
        return;
      }
      case 'scan': {
        const { atom } = current;
        const columns: number[] = [];
        const values: Value[] = [];
        const free: number[] = [];
        atom.slots.forEach((s, c) => {
          const v = valueOf(s);
          if (v !== undefined) {
            columns.push(c);
            values.push(v);
          } else free.push(c);
        });
        const matches = source(atom, current.position).lookup(columns, values);
        for (const tuple of matches) {
          // a variable repeated in the atom (`p(X, X)`) binds once
          let ok = true;
          const set: number[] = [];
          for (const c of free) {
            const slot = (atom.slots[c] as { slot: number }).slot;
            const value = tuple[c]!;
            if (env[slot] === undefined) {
              env[slot] = value;
              set.push(slot);
            } else if (env[slot] !== value) {
              ok = false;
              break;
            }
          }
          if (ok) step(i + 1);
          for (const slot of set) env[slot] = undefined;
        }
        return;
      }
    }
  };
  step(0);
};

/** The strata: strongly connected relations, in dependency order; a negation never inside one. */
const stratify = (rules: readonly CompiledRule[]): CompiledRule[][] => {
  const heads = new Set(rules.map((r) => r.head.relation));
  const edges = new Map<string, { to: string; negative: boolean }[]>();
  for (const r of rules) {
    const list = edges.get(r.head.relation) ?? [];
    for (const a of r.positives)
      if (heads.has(a.relation)) list.push({ to: a.relation, negative: false });
    for (const a of r.negatives)
      if (heads.has(a.relation)) list.push({ to: a.relation, negative: true });
    edges.set(r.head.relation, list);
  }
  // Tarjan: components come out dependencies first
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (v: string) => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const { to } of edges.get(v) ?? []) {
      if (!index.has(to)) {
        visit(to);
        low.set(v, Math.min(low.get(v)!, low.get(to)!));
      } else if (onStack.has(to))
        low.set(v, Math.min(low.get(v)!, index.get(to)!));
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      components.push(component);
    }
  };
  for (const head of heads) if (!index.has(head)) visit(head);
  return components.map((component) => {
    const members = new Set(component);
    for (const v of component)
      for (const { to, negative } of edges.get(v) ?? [])
        if (negative && members.has(to))
          throw new DatalogSyntaxError(
            `Not stratifiable: ${v} depends on !${to} recursively`,
          );
    return rules.filter((r) => members.has(r.head.relation));
  });
};

/** Rules compiled and stratified once; run on any facts. */
export class Program {
  readonly rules: readonly Rule[];
  private readonly strata: CompiledRule[][];

  constructor(source: string) {
    this.rules = parseRules(source);
    this.strata = stratify(this.rules.map(compileRule));
  }

  /** The relations the rules derive. */
  get derived(): string[] {
    return [...new Set(this.rules.map((r) => r.head.relation))];
  }

  /** Every relation a rule's body reads that no rule derives: the program's inputs. */
  get inputs(): string[] {
    const derived = new Set(this.derived);
    return [
      ...new Set(
        this.rules.flatMap((r) =>
          r.body.flatMap((l: Literal) =>
            l.kind === 'atom' && !derived.has(l.atom.relation)
              ? [l.atom.relation]
              : [],
          ),
        ),
      ),
    ];
  }

  /** The facts' fixpoint under the rules. */
  run(facts: Iterable<readonly [string, Tuple]>): Database {
    const db = new Database();
    for (const [relation, tuple] of facts) db.relation(relation).add(tuple);
    for (const stratum of this.strata) this.runStratum(db, stratum);
    return db;
  }

  private runStratum(db: Database, rules: readonly CompiledRule[]): void {
    const members = new Set(rules.map((r) => r.head.relation));
    const read = (name: string) => db.relation(name);
    // the first round: every rule on the whole relations
    let delta = new Map<string, Relation>();
    const collect =
      (next: Map<string, Relation>, relation: string) => (tuple: Tuple) => {
        if (db.relation(relation).add(tuple)) {
          let d = next.get(relation);
          if (!d) next.set(relation, (d = new Relation()));
          d.add(tuple);
        }
      };
    for (const rule of rules)
      run(
        rule,
        plan(rule, null),
        (a) => read(a.relation),
        read,
        collect(delta, rule.head.relation),
      );
    const recursive = rules
      .map((rule) => ({
        rule,
        positions: rule.positives.flatMap((a, i) =>
          members.has(a.relation) ? [i] : [],
        ),
      }))
      .filter((r) => r.positions.length);
    const plans = new Map(
      recursive.flatMap(({ rule, positions }) =>
        positions.map(
          (p) => [`${rules.indexOf(rule)}:${p}`, plan(rule, p)] as const,
        ),
      ),
    );
    while (delta.size) {
      const next = new Map<string, Relation>();
      for (const { rule, positions } of recursive)
        for (const p of positions) {
          const d = delta.get(rule.positives[p]!.relation);
          if (!d) continue;
          run(
            rule,
            plans.get(`${rules.indexOf(rule)}:${p}`)!,
            (a, position) => (position === p ? d : read(a.relation)),
            read,
            collect(next, rule.head.relation),
          );
        }
      delta = next;
    }
  }
}
