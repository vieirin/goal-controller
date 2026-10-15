/**
 * HDDL's s-expressions, with where each atom and list is: what MutRoSe's
 * HDDL domain parser (./hddl.ts) and a definition pool's HDDL provider
 * read. MutRoSe's own (goal-controller#143: engine code in its engine's
 * folder). HDDL reads names in any case: an atom is lowercased, its range
 * is as written.
 */

/** An atom, lowercased (HDDL reads names in any case); its range is the text as written. */
export type Atom = { atom: string; from: number; to: number };
export type List = { list: Expr[]; from: number; to: number };
export type Expr = Atom | List;

export const isList = (expr: Expr | undefined): expr is List =>
  expr !== undefined && 'list' in expr;
export const atomOf = (expr: Expr | undefined): string | undefined =>
  expr && 'atom' in expr ? expr.atom : undefined;

/** The s-expressions of a text (`;` comments to the end of the line), and what is unbalanced. */
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
        atom: token.toLowerCase(),
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
