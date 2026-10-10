/**
 * GODA's parametric formulas as numbers: a formula file read and evaluated,
 * the values `eval_formula.sh` gives its parameters, and two formulas
 * compared at those values and at seeded random points (goal-controller#32,
 * #34 D3). The engine's tests and the stress-test harness (#35) share it.
 */

/** A formula file's expression: its lines without `//` comments, joined. */
export const formulaText = (file: string): string =>
  file
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .join('')
    .trim();

type Step = { value: number } | { variable: string } | { op: string };

export type CompiledFormula = {
  /** postfix */
  program: readonly Step[];
  /** its variables, sorted */
  variables: readonly string[];
};

const TOKEN =
  /\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|(.))/gy;
const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '^': 4,
  neg: 3,
};
const RIGHT = new Set(['^', 'neg']);

/**
 * A formula (`+ - * / ^`, unary minus, parentheses, numbers, variables)
 * compiled to postfix, without recursion (the references nest deeply).
 * Throws on a malformed formula.
 */
export const compileFormula = (source: string): CompiledFormula => {
  const text = formulaText(source);
  if (!text) throw new Error('empty formula');
  const output: Step[] = [];
  const operators: string[] = [];
  const variables = new Set<string>();
  // whether the next token starts an operand (so a '-' is unary)
  let operand = true;
  TOKEN.lastIndex = 0;
  const popWhile = (test: (top: string) => boolean) => {
    while (operators.length && test(operators[operators.length - 1]!))
      output.push({ op: operators.pop()! });
  };
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (!match) throw new Error(`unexpected input at ${at}`);
    const [, name, number, symbol] = match;
    if (name !== undefined || number !== undefined) {
      if (!operand)
        throw new Error(`missing operator before ${match[0].trim()} at ${at}`);
      if (name !== undefined) {
        variables.add(name);
        output.push({ variable: name });
      } else output.push({ value: Number(number) });
      operand = false;
    } else if (symbol === undefined) {
      break; // trailing blanks
    } else if (symbol === '(') {
      if (!operand) throw new Error(`missing operator before ( at ${at}`);
      operators.push('(');
    } else if (symbol === ')') {
      if (operand) throw new Error(`missing operand before ) at ${at}`);
      popWhile((top) => top !== '(');
      if (operators.pop() !== '(') throw new Error(`unbalanced ) at ${at}`);
    } else if (symbol in PRECEDENCE) {
      let op = symbol;
      if (operand) {
        if (symbol === '+') continue; // unary plus
        if (symbol !== '-')
          throw new Error(`missing operand before ${symbol} at ${at}`);
        op = 'neg';
      }
      popWhile(
        (top) =>
          top !== '(' &&
          (PRECEDENCE[top]! > PRECEDENCE[op]! ||
            (PRECEDENCE[top] === PRECEDENCE[op] && !RIGHT.has(op))),
      );
      operators.push(op);
      operand = true;
    } else throw new Error(`unexpected ${JSON.stringify(symbol)} at ${at}`);
  }
  if (operand) throw new Error('missing operand at the end');
  while (operators.length) {
    const op = operators.pop()!;
    if (op === '(') throw new Error('unbalanced (');
    output.push({ op });
  }
  return { program: output, variables: [...variables].sort() };
};

/** A compiled formula's value; every variable must have one. */
export const evaluate = (
  { program }: CompiledFormula,
  values: Readonly<Record<string, number>>,
): number => {
  const stack: number[] = [];
  for (const step of program) {
    if ('value' in step) stack.push(step.value);
    else if ('variable' in step) {
      const value = values[step.variable];
      if (value === undefined) throw new Error(`no value for ${step.variable}`);
      stack.push(value);
    } else if (step.op === 'neg') stack.push(-stack.pop()!);
    else {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(
        step.op === '+'
          ? a + b
          : step.op === '-'
            ? a - b
            : step.op === '*'
              ? a * b
              : step.op === '/'
                ? a / b
                : a ** b,
      );
    }
  }
  return stack[0]!;
};

/** The values `eval_formula.sh` gives its variables (`NAME="0.99";`). */
export const evalFormulaValues = (script: string): Record<string, number> => {
  const values: Record<string, number> = {};
  for (const [, name, value] of script.matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"\s*;?\s*$/gm,
  ))
    values[name!] = Number(value);
  return values;
};

/** A seeded PRNG (mulberry32): the same points on every run. */
export const random = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const SEED = 35;
export const TOLERANCE = 1e-9;

/** Agree within 1e-9, relative to the larger value once it exceeds 1. */
export const close = (a: number, b: number, tolerance = TOLERANCE): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

export type FormulaComparison =
  | { equal: false; error: string }
  | {
      equal: boolean;
      variables: {
        count: number;
        onlyOurs: string[];
        onlyReference: string[];
      };
      /** how many points were evaluated */
      points: number;
      /** the eval_formula.sh point, when the script doesn't give every variable a value */
      evalPoint?: { skipped: true; missing: string[] };
      tolerance: number;
      mismatches: {
        count: number;
        sample: {
          point: string;
          ours: number;
          reference: number;
          difference: number;
        }[];
      };
    };

/**
 * Ours against the reference: the same variables, and the same value at the
 * eval_formula.sh point (left out, and said so, when the script doesn't give
 * every variable a value) and at `points` seeded random points in [0,1].
 */
export const compareFormulas = (
  ours: string,
  reference: string,
  {
    evalValues = {},
    points = 100,
    seed = SEED,
    tolerance = TOLERANCE,
  }: {
    evalValues?: Readonly<Record<string, number>>;
    points?: number;
    seed?: number;
    tolerance?: number;
  } = {},
): FormulaComparison => {
  let a: CompiledFormula;
  let b: CompiledFormula;
  try {
    a = compileFormula(ours);
  } catch (error) {
    return { equal: false, error: `ours: ${(error as Error).message}` };
  }
  try {
    b = compileFormula(reference);
  } catch (error) {
    return { equal: false, error: `reference: ${(error as Error).message}` };
  }
  const onlyOurs = a.variables.filter((v) => !b.variables.includes(v));
  const onlyReference = b.variables.filter((v) => !a.variables.includes(v));
  const variables = [...new Set([...a.variables, ...b.variables])].sort();
  const next = random(seed);
  const samples = [
    { point: 'eval_formula.sh', values: evalValues },
    ...Array.from({ length: points }, (_, i) => ({
      point: `random ${i + 1}`,
      values: Object.fromEntries(variables.map((v) => [v, next()])),
    })),
  ];
  const mismatches: {
    point: string;
    ours: number;
    reference: number;
    difference: number;
  }[] = [];
  let evaluated = 0;
  // the reference's own script may not give every parameter a value (BSN's):
  // that point is left out and said so, the random points still compare
  let evalPointMissing: string[] = [];
  for (const { point, values } of samples) {
    const missing = variables.filter((v) => values[v] === undefined);
    if (missing.length) {
      evalPointMissing = missing;
      continue;
    }
    const x = evaluate(a, values);
    const y = evaluate(b, values);
    evaluated += 1;
    if (!close(x, y, tolerance))
      mismatches.push({ point, ours: x, reference: y, difference: x - y });
  }
  return {
    equal:
      mismatches.length === 0 &&
      onlyOurs.length === 0 &&
      onlyReference.length === 0,
    variables: { count: variables.length, onlyOurs, onlyReference },
    points: evaluated,
    ...(evalPointMissing.length > 0 && {
      evalPoint: { skipped: true as const, missing: evalPointMissing },
    }),
    tolerance,
    mismatches: { count: mismatches.length, sample: mismatches.slice(0, 5) },
  };
};
