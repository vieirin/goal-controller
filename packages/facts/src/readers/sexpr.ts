/**
 * S-expressions with locations (HDDL): atoms as written, lists with their
 * offsets, `;` comments skipped. Unbalanced text is closed where it ends.
 * (lib's HDDL parser has the same reader, lower-casing its atoms and kept
 * private; the migration shares one.)
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

export const readExprs = (text: string): Expr[] => {
  const stack: List[] = [{ list: [], from: 0, to: text.length }];
  const TOKEN = /\s+|;[^\n]*|\(|\)|[^\s();]+/gy;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const [token] = match;
    const from = match.index;
    if (/^\s|^;/.test(token)) continue;
    if (token === '(') stack.push({ list: [], from, to: from });
    else if (token === ')') {
      if (stack.length === 1) continue;
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
    open.to = text.length;
    stack[stack.length - 1]!.list.push(open);
  }
  return stack[0]!.list;
};
