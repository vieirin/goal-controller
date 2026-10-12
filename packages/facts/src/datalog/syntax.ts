/**
 * The rules' language: Datalog with stratified negation and comparisons, as
 * text (a dialect could ship it as data). A statement ends with `.`; `%`
 * comments to the end of the line. A name may be dotted (`hddl.task`): a
 * provider's relations and kinds are namespaced by its id.
 *
 *   resolves(R, S) :- refers(R, K, N), global(K), defines(S, K, N).
 *   unresolved(R) :- refers(R, _, _), !resolves(R, _).
 *   global(gmTask).
 *
 * A variable starts with an upper-case letter or `_` (each `_` is its own);
 * a constant is a lower-case word, a quoted string or a number. `!p(…)` (or
 * `not p(…)`) negates; `X != Y`, `X < Y`, … compare.
 */

export type Value = string | number;
export type Tuple = readonly Value[];

export type Term = { var: string } | { const: Value };

export type Atom = { relation: string; terms: Term[] };

export type Comparison = '=' | '!=' | '<' | '<=' | '>' | '>=';

export type Literal =
  | { kind: 'atom'; atom: Atom; negated: boolean }
  | { kind: 'compare'; op: Comparison; left: Term; right: Term };

export type Rule = { head: Atom; body: Literal[]; text: string };

export class DatalogSyntaxError extends Error {}

const TOKEN =
  /\s+|%[^\n]*|:-|!=|<=|>=|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*|[(),.!=<>]/y;

type Token = { text: string; at: number };

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match)
      throw new DatalogSyntaxError(
        `Unexpected ${JSON.stringify(source[at])} at ${at}`,
      );
    if (!/^\s|^%/.test(match[0])) tokens.push({ text: match[0], at });
  }
  return tokens;
};

const isVariable = (word: string) => /^[A-Z_]/.test(word);

/** The rules (and facts: rules without a body) of a program's text. */
export const parseRules = (source: string): Rule[] => {
  const tokens = tokenize(source);
  let i = 0;
  let anonymous = 0;
  const peek = () => tokens[i]?.text;
  const next = () => {
    const token = tokens[i++];
    if (!token) throw new DatalogSyntaxError('Unexpected end of the rules');
    return token;
  };
  const expect = (text: string) => {
    const token = next();
    if (token.text !== text)
      throw new DatalogSyntaxError(
        `Expected ${text} at ${token.at}, found ${token.text}`,
      );
  };
  const term = (): Term => {
    const { text, at } = next();
    if (/^['"]/.test(text))
      return { const: text.slice(1, -1).replace(/\\(.)/g, '$1') };
    if (/^-?\d/.test(text)) return { const: Number(text) };
    if (/^[A-Za-z_]/.test(text))
      return isVariable(text)
        ? { var: text === '_' ? `_${anonymous++}` : text }
        : { const: text };
    throw new DatalogSyntaxError(`Expected a term at ${at}, found ${text}`);
  };
  const atom = (): Atom => {
    const { text: relation, at } = next();
    if (!/^[a-z]/.test(relation))
      throw new DatalogSyntaxError(`Expected a relation at ${at}`);
    expect('(');
    const terms: Term[] = [];
    if (peek() !== ')')
      for (;;) {
        terms.push(term());
        if (peek() !== ',') break;
        next();
      }
    expect(')');
    return { relation, terms };
  };
  const literal = (): Literal => {
    if (peek() === '!' || peek() === 'not') {
      next();
      return { kind: 'atom', atom: atom(), negated: true };
    }
    // `p(` is an atom; anything else starts a comparison
    if (/^[a-z]/.test(peek() ?? '') && tokens[i + 1]?.text === '(')
      return { kind: 'atom', atom: atom(), negated: false };
    const left = term();
    const op = next().text;
    if (!['=', '!=', '<', '<=', '>', '>='].includes(op))
      throw new DatalogSyntaxError(`Expected a comparison, found ${op}`);
    return { kind: 'compare', op: op as Comparison, left, right: term() };
  };

  const rules: Rule[] = [];
  while (i < tokens.length) {
    const from = tokens[i]!.at;
    const head = atom();
    const body: Literal[] = [];
    if (peek() === ':-') {
      next();
      for (;;) {
        body.push(literal());
        if (peek() !== ',') break;
        next();
      }
    }
    expect('.');
    const to = tokens[i - 1]!.at + 1;
    rules.push({ head, body, text: source.slice(from, to) });
  }
  return rules;
};

const varsOf = (terms: readonly Term[]) =>
  terms.flatMap((t) => ('var' in t ? [t.var] : []));

/** A rule is safe when every variable of its head, negations and comparisons is bound by a positive atom. */
export const checkSafety = (rule: Rule): void => {
  const bound = new Set(
    rule.body.flatMap((l) =>
      l.kind === 'atom' && !l.negated ? varsOf(l.atom.terms) : [],
    ),
  );
  // `X = c` binds X too
  for (const l of rule.body)
    if (l.kind === 'compare' && l.op === '=') {
      if ('var' in l.left && !('var' in l.right)) bound.add(l.left.var);
      if ('var' in l.right && !('var' in l.left)) bound.add(l.right.var);
    }
  const needed = [
    ...varsOf(rule.head.terms),
    ...rule.body.flatMap((l) =>
      l.kind === 'compare'
        ? varsOf([l.left, l.right])
        : l.negated
          ? varsOf(l.atom.terms).filter((v) => !v.startsWith('_'))
          : [],
    ),
  ];
  const unbound = needed.find((v) => !bound.has(v));
  if (unbound)
    throw new DatalogSyntaxError(
      `Unsafe rule (${unbound} is not bound by a positive atom): ${rule.text}`,
    );
};
