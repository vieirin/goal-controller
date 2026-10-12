/**
 * S-expressions with their offsets (HDDL): atoms as written, lists with
 * where they start and end, `;` comments skipped, and what is unbalanced
 * (an unclosed list closes where the text ends). The HDDL parser
 * (hddl.ts) and its fact reader (../rules/hddl.ts) read with it.
 */

export type Atom = { atom: string; from: number; to: number };
export type List = { list: Expr[]; from: number; to: number };
export type Expr = Atom | List;

export const isList = (expr: Expr | undefined): expr is List =>
  expr !== undefined && 'list' in expr;
export const isAtom = (expr: Expr | undefined): expr is Atom =>
  expr !== undefined && 'atom' in expr;
/** An atom's text, lower-cased (HDDL's names are case-insensitive). */
export const word = (expr: Expr | undefined): string | undefined =>
  isAtom(expr) ? expr.atom.toLowerCase() : undefined;

/** The s-expressions of a text, and what is unbalanced. */
export const readExprs = (
  text: string,
): {
  exprs: Expr[];
  problems: { message: string; from: number; to: number }[];
} => {
  const problems: { message: string; from: number; to: number }[] = [];
  const stack: List[] = [{ list: [], from: 0, to: text.length }];
  const TOKEN = /\s+|;[^\n]*|\(|\)|[^\s();]+/gy;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const [token] = match;
    const from = match.index;
    if (/^\s|^;/.test(token)) continue;
    if (token === '(') stack.push({ list: [], from, to: from });
    else if (token === ')') {
      if (stack.length === 1) {
        problems.push({ message: 'Unbalanced )', from, to: from + 1 });
        continue;
      }
      const done = stack.pop()!;
      done.to = from + 1;
      stack[stack.length - 1]!.list.push(done);
    } else
      stack[stack.length - 1]!.list.push({
        atom: token,
        from,
        to: from + token.length,
      });
  }
  while (stack.length > 1) {
    const open = stack.pop()!;
    problems.push({
      message: 'Unclosed (',
      from: open.from,
      to: open.from + 1,
    });
    open.to = text.length;
    stack[stack.length - 1]!.list.push(open);
  }
  return { exprs: stack[0]!.list, problems };
};
