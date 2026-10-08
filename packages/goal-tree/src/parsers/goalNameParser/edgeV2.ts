import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import type { Dictionary } from 'lodash';
import RTRegex from '../../antlr/edgeV2/RTRegexLexer';
import RTRegexListener from '../../antlr/edgeV2/RTRegexListener';
import type {
  ExprContext,
  GAlternativeContext,
  GAnyOrderContext,
  GChoiceContext,
  GDegradationContext,
  GIdContinuedContext,
  GInterleavedContext,
  GRetryContext,
  GSequenceContext,
  WordContext,
} from '../../antlr/edgeV2/RTRegexParser';
import RTRegexParser from '../../antlr/edgeV2/RTRegexParser';
import type { GoalExecutionDetail } from '../../types/';
import { toExecutionDetail } from './executionDetail';

export const getGoalDetail = ({
  goalText,
  onSyntaxError,
}: {
  goalText: string;
  /** receives syntax errors instead of the console (lenient callers report them) */
  onSyntaxError?: (message: string) => void;
}): {
  id: string;
  goalName: string;
  executionDetail: GoalExecutionDetail | null;
} => {
  const chars = new CharStream(goalText); // replace this with a FileStream as required
  const lexer = new RTRegex(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new RTRegexParser(tokens);
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
  const tree = parser.rt();
  let id: string = '';
  let goalName: string | null = null;

  let alternative: string[] = [];
  let degradationList: string[] = [];
  let interleaved: string[] = [];
  let sequence: string[] = [];
  let anyOrder: string[] = [];
  let retry: Dictionary<number> = {};
  let choice: string[] = [];
  class RTNotationTreeWalker extends RTRegexListener {
    extractGoalIds = (expr: ExprContext): string[] => {
      if (expr.getChildCount() === 1) {
        // Simple goal like G1
        return [expr.getText()];
      } else if (expr.getChildCount() === 2) {
        // Goal with ID, like G1
        return [expr.getText()];
      } else if (expr.getChildCount() === 3) {
        // Binary operation (e.g., G1|G2, G1?G2, G1+G2, G1->G2, G1#G2, G1;G2)
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

    exitGAnyOrder = (ctx: GAnyOrderContext) => {
      anyOrder = ctx
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
      choice = ctx
        .expr_list()
        .flatMap((e) => this.extractGoalIds(e))
        .filter(Boolean);
    };
  }

  const walker = new RTNotationTreeWalker();
  ParseTreeWalker.DEFAULT.walk(walker, tree);

  return {
    id,
    goalName: (goalName ?? '').trim(),
    executionDetail: toExecutionDetail({
      alternative,
      degradationList,
      interleaved,
      sequence,
      anyOrder,
      retry,
      choice,
    }),
  };
};
