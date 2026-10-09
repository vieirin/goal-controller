/**
 * The variables an Edge assertion names (AssertionRegex.g4's listener, kept):
 * in the order they are written, `x = true` sets a value (each time), and a
 * name or an integer comparison adds a name once, without one.
 */
import type { AssertionTree } from '@goal-controller/goal-language';

export type AssertionVariable = { name: string; value: boolean | null };

export const assertionVariables = (
  tree: AssertionTree | null,
): AssertionVariable[] => {
  const variables: AssertionVariable[] = [];
  const named = (name: string) => {
    if (!variables.some((v) => v.name === name))
      variables.push({ name, value: null });
  };
  const walk = (node: AssertionTree | null): void => {
    switch (node?.kind) {
      case 'and':
      case 'or':
        walk(node.left);
        walk(node.right);
        return;
      case 'not':
      case 'paren':
        walk(node.expr);
        return;
      case 'assign':
        variables.push({ name: node.variable, value: node.value });
        return;
      case 'compare':
      case 'var':
        named(node.variable);
        return;
      default:
        return;
    }
  };
  walk(tree);
  return variables;
};
