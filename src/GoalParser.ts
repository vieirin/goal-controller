import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import RTRegex from './antlr/RTRegexLexer';
import RTRegexListener from './antlr/RTRegexListener';
import RTRegexParser, {
  GDecisionMakingContext,
  GIdContext,
  GIdContinuedContext,
  GInterleavedContext,
  GSequenceContext,
  WordContext,
} from './antlr/RTRegexParser';
import { GoalExecutionDetail } from './ObjectiveTree/types';

export const getGoalDetail = ({
  goalText,
}: {
  goalText: string;
}): {
  id: string;
  goalName: string | null;
  executionDetail: GoalExecutionDetail | null;
} => {
  const chars = new CharStream(goalText); // replace this with a FileStream as required
  const lexer = new RTRegex(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new RTRegexParser(tokens);
  const tree = parser.rt();
  let id: string = '';
  let goalName: string | null = null;

  let decisionMaking: string[] = [];
  let interleaved: string[] = [];
  let sequence: string[] = [];
  class RTNotationTreeWalker extends RTRegexListener {
    exitGId = (ctx: GIdContext) => {
      id = `${ctx._t.text}${ctx.id().getText()}`;
    };
    exitGIdContinued = (ctx: GIdContinuedContext) => {
      id = `${ctx._t.text}${ctx.id().getText()}`;
    };
    exitWord = (ctx: WordContext) => {
      goalName = ctx.WORD().getText();
    };
    exitGDecisionMaking = (ctx: GDecisionMakingContext) => {
      decisionMaking = ctx.expr().getText().split(',');
    };
    exitGInterleaved = (ctx: GInterleavedContext) => {
      interleaved = ctx.expr_list().map((e) => e.getText());
    };
    exitGSequence = (ctx: GSequenceContext) => {
      sequence = ctx.expr_list().map((e) => e.getText());
    };
  }

  const walker = new RTNotationTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);
  const goalSanitizedName = goalName ?? '';

  if (sequence.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'sequence', sequence },
    };
  }

  if (interleaved.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: {
        type: 'interleaved',
        interleaved,
      },
    };
  }

  if (decisionMaking.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: {
        type: 'decisionMaking',
        dm: decisionMaking,
      },
    };
  }
  return { id, goalName: goalSanitizedName.trim(), executionDetail: null };
};
