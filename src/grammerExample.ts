import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import RTRegex from './antlr/RTRegexLexer';
import RTRegexParser, {
  ExprContext,
  GDecisionMakingContext,
  GIdContext,
  GIdContinuedContext,
  IdContext,
  RtContext,
  WordContext,
} from './antlr/RTRegexParser';
import RTRegexListener from './antlr/RTRegexListener';

export const getGoalDetail = ({
  goalText,
}: {
  goalText: string;
}): {
  id: string;
  goalName: string | null;
  decisionMaking: { decision: string[] } | null;
} => {
  const chars = new CharStream(goalText); // replace this with a FileStream as required
  const lexer = new RTRegex(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new RTRegexParser(tokens);
  const tree = parser.rt();
  let id: string = '';
  let goalName: string | null = null;
  let decisionMaking: { decision: string[] } | null = null;

  class MyTreeWalker extends RTRegexListener {
    exitGId = (ctx: GIdContext) => {
      id = ctx.id().getText();
    };
    exitGIdContinued = (ctx: GIdContinuedContext) => {
      id = ctx.id().getText();
    };
    exitWord = (ctx: WordContext) => {
      goalName = ctx.WORD().getText();
    };
    exitGDecisionMaking = (ctx: GDecisionMakingContext) => {
      decisionMaking = { decision: ctx.expr().getText().split(',') };
    };
  }

  const walker = new MyTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);

  return { id, goalName, decisionMaking };
};
