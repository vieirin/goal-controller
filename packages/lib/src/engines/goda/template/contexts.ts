/**
 * A context condition (`creationProperty`, CtxRegex.g4) as GODA's writers
 * print it: PrismWriter through `CtxParser` (`ctx = 1 & ctx = 2`, for its
 * comments), PARAMProducer through `clearCtxList` (as written, its prefix
 * dropped: `ctx=1`).
 */
import {
  parseCondition,
  type AssertionTree,
} from '@goal-controller/goal-language';

/**
 * `CtxFormulaParserVisitor`'s text of a condition: a comparison as
 * `var op value`, `&` and `|` between their sides. A parenthesised condition
 * has no visitor of its own, so ANTLR's default gives its last child's
 * result, the `)`'s: `null`, as upstream writes it.
 */
const visit = (tree: AssertionTree | null): string => {
  switch (tree?.kind) {
    case 'compare':
      return `${tree.variable} ${tree.operator} ${tree.value}`;
    case 'assign':
      // CtxRegex.g4's `expr '!=' value`, a boolean value
      return `${tree.variable} ${tree.negated ? '!=' : '='} ${tree.value}`;
    case 'var':
      return tree.variable;
    case 'and':
      return `${visit(tree.left)} & ${visit(tree.right)}`;
    case 'or':
      return `${visit(tree.left)} | ${visit(tree.right)}`;
    case 'paren':
      return 'null';
    default:
      // `!` and a lone `true`/`false`: CtxRegex.g4 has neither
      throw new Error(
        `GODA: a context condition has no ${tree ? `\`${tree.kind}\`` : 'condition'} (CtxRegex.g4)`,
      );
  }
};

/** `PrismWriter.getContextsInfo`: an element's conditions, each as CtxParser prints it, joined with ` & `. */
export const contextsInfo = (conditions: readonly string[]): string =>
  conditions
    .map((condition) => {
      const { value, errors } = parseCondition(condition);
      // CtxRegex.g4 reads a condition only after its prefix
      if (errors.length || !value.prefix || !value.tree)
        throw new Error(
          `GODA: ${JSON.stringify(condition)} is not a context condition`,
        );
      return visit(value.tree);
    })
    .join(' & ');

/** `PARAMProducer.clearCtxList`: a condition without its prefix, as written. */
export const clearCondition = (condition: string): string =>
  // the language reads spaces between the prefix's words (`assertion  trigger`);
  // upstream's split took one, and failed on more
  condition.replace(/^assertion[ \t]+(?:condition|trigger)\s*/, '');
