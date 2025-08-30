import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import AssertionRegex from '../antlr/AssertionRegexLexer';
import AssertionRegexListener from '../antlr/AssertionRegexListener';
import AssertionRegexParser, {
  AssignmentContext,
  IdentifierContext,
} from '../antlr/AssertionRegexParser';

export const getAssertionVariables = ({
  assertionSentence,
}: {
  assertionSentence: string;
}): Array<{
  name: string;
  value: boolean | null;
}> => {
  if (!assertionSentence) {
    return [];
  }

  const chars = new CharStream(assertionSentence);
  const lexer = new AssertionRegex(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new AssertionRegexParser(tokens);
  const tree = parser.assertion();

  const variables: Array<{ name: string; value: boolean | null }> = [];

  class AssertionTreeWalker extends AssertionRegexListener {
    exitAssignment = (ctx: AssignmentContext) => {
      const name = ctx.ID().getText();
      const value = ctx.BOOLEAN().getText() === 'true';
      variables.push({ name, value });
    };

    exitIdentifier = (ctx: IdentifierContext) => {
      const name = ctx.ID().getText();
      // If it's just a variable without assignment, value is null
      if (!variables.some((v) => v.name === name)) {
        variables.push({ name, value: null });
      }
    };
  }

  const walker = new AssertionTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);

  return variables;
};
