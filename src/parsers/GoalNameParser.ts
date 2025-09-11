import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import { Dictionary } from 'lodash';
import RTRegex from '../antlr/RTRegexLexer';
import RTRegexListener from '../antlr/RTRegexListener';
import RTRegexParser, {
  GIdContext,
  GIdContinuedContext,
  GRetryContext,
  GSequenceContext,
  WordContext,
  type GAlternativeContext,
  type GChoiceContext,
  type GDegradationContext,
  type GInterleavedContext,
} from '../antlr/RTRegexParser';
import { GoalExecutionDetail } from '../ObjectiveTree/types';

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

  let alternative: string[] = [];
  let degradationList: string[] = [];
  let interleaved: string[] = [];
  let sequence: string[] = [];
  let retry: Dictionary<number> = {};
  let choice: boolean = false;
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
    exitGAlternative = (ctx: GAlternativeContext) => {
      alternative = ctx
        .expr_list()
        .map((e) => {
          // in this case goal is the first child and the rest is some other expression
          if (e.getChildCount() !== 2) {
            return e.getChild(0).getText();
          }
          return e.getText();
        })
        .filter(Boolean);
    };
    exitGDegradation = (ctx: GDegradationContext) => {
      degradationList = ctx
        .expr_list()
        .map((e) => {
          // in this case goal is the first child and the rest is some other expression
          if (e.getChildCount() !== 2) {
            return e.getChild(0).getText();
          }
          return e.getText();
        })
        .filter(Boolean);
    };
    exitGInterleaved = (ctx: GInterleavedContext) => {
      interleaved = ctx
        .expr_list()
        .map((e) => e.getText())
        .filter(Boolean);
    };
    exitGSequence = (ctx: GSequenceContext) => {
      sequence = ctx
        .expr_list()
        .map((e) => {
          // in this case goal is the first child and the rest is some other expression
          if (e.getChildCount() !== 2) {
            return e.getChild(0).getText();
          }
          return e.getText();
        })
        .filter(Boolean);
    };
    exitGRetry = (ctx: GRetryContext) => {
      const goalToRetry = ctx.expr().getText();
      const amountOfRetries = ctx.FLOAT().getText();
      retry = { ...retry, [goalToRetry]: parseInt(amountOfRetries) };
    };
    exitGChoice = (ctx: GChoiceContext) => {
      choice = ctx._op.text === '+';
    };
  }

  const walker = new RTNotationTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);
  const goalSanitizedName = goalName ?? '';

  if (degradationList.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: {
        type: 'degradation',
        degradationList,
        retryMap: retry,
      },
    };
  }

  if (sequence.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'sequence', sequence, retryMap: retry },
    };
  }

  if (alternative.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: {
        type: 'alternative',
        alternative,
        retryMap: retry,
      },
    };
  }
  if (interleaved.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'interleaved', interleaved, retryMap: retry },
    };
  }

  if (choice) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'choice', retryMap: retry },
    };
  }

  return { id, goalName: goalSanitizedName.trim(), executionDetail: null };
};
