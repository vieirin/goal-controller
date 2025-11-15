import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import type { Dictionary } from 'lodash';
import RTRegex from '../antlr/RTRegexLexer';
import RTRegexListener from '../antlr/RTRegexListener';
import type {
  ExprContext,
  GAlternativeContext,
  GChoiceContext,
  GDegradationContext,
  GIdContinuedContext,
  GInterleavedContext,
  GRetryContext,
  GSequenceContext,
  WordContext,
} from '../antlr/RTRegexParser';
import RTRegexParser from '../antlr/RTRegexParser';
import type { GoalExecutionDetail } from '../GoalTree/types';

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
    extractGoalIds = (expr: ExprContext): string[] => {
      if (expr.getChildCount() === 1) {
        // Simple goal like G1
        return [expr.getText()];
      } else if (expr.getChildCount() === 2) {
        // Goal with ID, like G1
        return [expr.getText()];
      } else if (expr.getChildCount() === 3) {
        // Binary operation (e.g., G1|G2, G1->G2, G1#G2, G1;G2)
        const left = this.extractGoalIds(expr.getChild(0) as ExprContext);
        const right = this.extractGoalIds(expr.getChild(2) as ExprContext);
        return [...left, ...right];
      }
      return [];
    };

    exitGIdContinued = (ctx: GIdContinuedContext) => {
      if (id) return;
      id = `${ctx._t.text}${ctx.id().getText()}`;
      return id;
    };

    exitWord = (ctx: WordContext) => {
      goalName = ctx.WORD().getText();
    };

    exitGAlternative = (ctx: GAlternativeContext) => {
      alternative = ctx
        .expr_list()
        .flatMap((e) => this.extractGoalIds(e))
        .filter(Boolean);
    };

    exitGDegradation = (ctx: GDegradationContext) => {
      degradationList = ctx
        .expr_list()
        .flatMap((e) => this.extractGoalIds(e))
        .filter(Boolean);
    };

    exitGInterleaved = (ctx: GInterleavedContext) => {
      interleaved = ctx
        .expr_list()
        .flatMap((e) => this.extractGoalIds(e))
        .filter(Boolean);
    };

    exitGSequence = (ctx: GSequenceContext) => {
      sequence = ctx
        .expr_list()
        .flatMap((e) => this.extractGoalIds(e))
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
    const executionDetail: any = {
      type: 'degradation',
      degradationList,
    };

    // Only include retryMap if it's not empty
    if (Object.keys(retry).length > 0) {
      executionDetail.retryMap = retry;
    }

    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail,
    };
  }

  if (sequence.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'sequence', sequence },
    };
  }

  if (alternative.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: {
        type: 'alternative',
        alternative,
      },
    };
  }
  if (interleaved.length > 0) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'interleaved', interleaved },
    };
  }

  if (choice) {
    return {
      id,
      goalName: goalSanitizedName.trim(),
      executionDetail: { type: 'choice' },
    };
  }

  return { id, goalName: goalSanitizedName.trim(), executionDetail: null };
};
