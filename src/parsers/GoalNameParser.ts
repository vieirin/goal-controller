import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import { Dictionary } from 'lodash';
import RTRegex from '../antlr/RTRegexLexer';
import RTRegexListener from '../antlr/RTRegexListener';
import RTRegexParser, {
  GIdContinuedContext,
  GRetryContext,
  GSequenceContext,
  WordContext,
  type GAlternativeContext,
  type GChoiceContext,
  type GDegradationContext,
  type GInterleavedContext,
} from '../antlr/RTRegexParser';
import { GoalExecutionDetail } from '../GoalTree/types';

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
    exitGIdContinued = (ctx: GIdContinuedContext) => {
      if (id) return;
      id = `${ctx._t.text}${ctx.id().getText()}`;
      return id;
    };
    exitWord = (ctx: WordContext) => {
      goalName = ctx.WORD().getText();
    };
    exitGAlternative = (ctx: GAlternativeContext) => {
      const extractGoalIds = (expr: any): string[] => {
        if (expr.getChildCount() === 1) {
          // Simple goal like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 2) {
          // Goal with ID, like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 3) {
          // Binary operation like G1|G2
          const left = extractGoalIds(expr.getChild(0));
          const right = extractGoalIds(expr.getChild(2));
          return [...left, ...right];
        }
        return [];
      };

      alternative = ctx
        .expr_list()
        .flatMap((e) => extractGoalIds(e))
        .filter(Boolean);
    };
    exitGDegradation = (ctx: GDegradationContext) => {
      const extractGoalIds = (expr: any): string[] => {
        if (expr.getChildCount() === 1) {
          // Simple goal like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 2) {
          // Goal with ID, like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 3) {
          // Binary operation like G1->G2
          const left = extractGoalIds(expr.getChild(0));
          const right = extractGoalIds(expr.getChild(2));
          return [...left, ...right];
        }
        return [];
      };

      degradationList = ctx
        .expr_list()
        .flatMap((e) => extractGoalIds(e))
        .filter(Boolean);
    };
    exitGInterleaved = (ctx: GInterleavedContext) => {
      const extractGoalIds = (expr: any): string[] => {
        if (expr.getChildCount() === 1) {
          // Simple goal like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 2) {
          // Goal with ID, like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 3) {
          // Binary operation like G1#G2
          const left = extractGoalIds(expr.getChild(0));
          const right = extractGoalIds(expr.getChild(2));
          return [...left, ...right];
        }
        return [];
      };

      interleaved = ctx
        .expr_list()
        .flatMap((e) => extractGoalIds(e))
        .filter(Boolean);
    };
    exitGSequence = (ctx: GSequenceContext) => {
      const extractGoalIds = (expr: any): string[] => {
        if (expr.getChildCount() === 1) {
          // Simple goal like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 2) {
          // Goal with ID, like G1
          return [expr.getText()];
        } else if (expr.getChildCount() === 3) {
          // Binary operation like G1;G2
          const left = extractGoalIds(expr.getChild(0));
          const right = extractGoalIds(expr.getChild(2));
          return [...left, ...right];
        }
        return [];
      };

      sequence = ctx
        .expr_list()
        .flatMap((e) => extractGoalIds(e))
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
