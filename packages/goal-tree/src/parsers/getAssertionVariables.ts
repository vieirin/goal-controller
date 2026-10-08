import { parseAssertion, type RtAssertion } from '@goal-controller/rt-language';
import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import AssertionRegex from '../antlr/AssertionRegexLexer';
import AssertionRegexListener from '../antlr/AssertionRegexListener';
import AssertionRegexParser, {
  type AssignmentContext,
  type IdentifierContext,
  type IntComparisonContext,
} from '../antlr/AssertionRegexParser';
import type { RTGrammar } from './goalNameParser';

export type AssertionVariable = {
  name: string;
  value: boolean | null;
};

/**
 * Adds a variable as the assertion is read left to right: every `x = true|false`
 * counts, a bare or compared identifier only once (and only if not seen yet).
 */
const addVariable = (
  variables: AssertionVariable[],
  name: string,
  value: boolean | null,
): void => {
  if (value !== null || !variables.some((v) => v.name === name)) {
    variables.push({ name, value });
  }
};

const antlrAssertionVariables = (
  assertionSentence: string,
  onSyntaxError?: (message: string) => void,
): AssertionVariable[] => {
  const chars = new CharStream(assertionSentence);
  const lexer = new AssertionRegex(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new AssertionRegexParser(tokens);
  if (onSyntaxError) {
    const listener = {
      syntaxError: (
        _r: unknown,
        _s: unknown,
        line: number,
        column: number,
        msg: string,
      ) => onSyntaxError(`${line}:${column} ${msg}`),
      reportAmbiguity: () => undefined,
      reportAttemptingFullContext: () => undefined,
      reportContextSensitivity: () => undefined,
    };
    lexer.removeErrorListeners();
    parser.removeErrorListeners();
    // antlr4's ErrorListener is a class with these four methods
    lexer.addErrorListener(listener as never);
    parser.addErrorListener(listener as never);
  }
  const tree = parser.assertion();

  const variables: AssertionVariable[] = [];

  class AssertionTreeWalker extends AssertionRegexListener {
    exitAssignment = (ctx: AssignmentContext) => {
      addVariable(
        variables,
        ctx.ID().getText(),
        ctx.BOOLEAN().getText() === 'true',
      );
    };

    exitIdentifier = (ctx: IdentifierContext) => {
      addVariable(variables, ctx.ID().getText(), null);
    };

    exitIntComparison = (ctx: IntComparisonContext) => {
      // the compared value is in the INT token, not a boolean assignment
      addVariable(variables, ctx.ID().getText(), null);
    };
  }

  const walker = new AssertionTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);

  return variables;
};

/** The same walk over the Langium AST of @goal-controller/rt-language. */
const langiumAssertionVariables = (
  assertionSentence: string,
  onSyntaxError?: (message: string) => void,
): AssertionVariable[] => {
  const { expr, errors } = parseAssertion(assertionSentence);
  for (const error of errors) {
    if (onSyntaxError) onSyntaxError(error);
    // like ANTLR's default ConsoleErrorListener
    else console.error(`line ${error}`);
  }
  const variables: AssertionVariable[] = [];
  const walk = (node: RtAssertion | null): void => {
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
        addVariable(variables, node.variable, node.value);
        return;
      case 'compare':
      case 'var':
        addVariable(variables, node.variable, null);
        return;
      default:
        return;
    }
  };
  walk(expr);
  return variables;
};

/**
 * The variables an `assertion`/`maintain` condition reads, in reading order, with
 * the boolean they are set to (`x = true`) or null. `edgeLangium` reads it with the
 * Langium grammar; every other grammar with AssertionRegex.g4.
 */
export const getAssertionVariables = ({
  assertionSentence,
  grammar,
  onSyntaxError,
}: {
  assertionSentence: string;
  grammar?: RTGrammar;
  /** receives syntax errors instead of the console */
  onSyntaxError?: (message: string) => void;
}): AssertionVariable[] => {
  if (!assertionSentence) {
    return [];
  }
  return grammar === 'edgeLangium'
    ? langiumAssertionVariables(assertionSentence, onSyntaxError)
    : antlrAssertionVariables(assertionSentence, onSyntaxError);
};
