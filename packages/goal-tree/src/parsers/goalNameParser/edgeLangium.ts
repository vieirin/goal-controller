import {
  exprText,
  parseNodeText,
  type RtExpr,
} from '@goal-controller/rt-language';
import type { GoalDetail } from '.';
import {
  emptyNotationLists,
  toExecutionDetail,
  type NotationLists,
} from './executionDetail';

/**
 * The goal ids an expression contributes to its operator's list, like the edgeV2
 * listener's `extractGoalIds`: ids and `skip` count, a retry counts its goal,
 * and a bracketed group counts nothing (its children are ANTLR terminals).
 */
const goalIds = (expr: RtExpr | null): string[] => {
  switch (expr?.kind) {
    case 'ref':
      return [expr.id];
    case 'skip':
      return ['skip'];
    case 'retry':
      return goalIds(expr.expr);
    case 'binary':
      return [...goalIds(expr.left), ...goalIds(expr.right)];
    default:
      return [];
  }
};

const LIST_OF = {
  '|': 'alternative',
  '->': 'degradationList',
  '#': 'interleaved',
  ';': 'sequence',
  '+': 'anyOrder',
  '?': 'choice',
} as const;

/**
 * Walks the notation in the order ANTLR's ParseTreeWalker exits it (children
 * left to right, then the node), so a later operator of the same kind
 * overwrites its list exactly as edgeV2's listener does.
 */
const walk = (expr: RtExpr | null, lists: NotationLists): void => {
  switch (expr?.kind) {
    case 'bracket':
      walk(expr.expr, lists);
      return;
    case 'retry':
      walk(expr.expr, lists);
      lists.retry = {
        ...lists.retry,
        [exprText(expr.expr)]: parseInt(expr.times),
      };
      return;
    case 'binary':
      walk(expr.left, lists);
      walk(expr.right, lists);
      lists[LIST_OF[expr.op]] = [
        ...goalIds(expr.left),
        ...goalIds(expr.right),
      ].filter(Boolean);
      return;
    default:
      return;
  }
};

/**
 * edgeV2 semantics with the Langium front end of @goal-controller/rt-language
 * (the grammar the notation editor uses).
 */
export const getGoalDetail = ({
  goalText,
  onSyntaxError,
}: {
  goalText: string;
  /** receives syntax errors instead of the console (lenient callers report them) */
  onSyntaxError?: (message: string) => void;
}): GoalDetail => {
  const parsed = parseNodeText(goalText);
  for (const error of parsed.errors) {
    if (onSyntaxError) onSyntaxError(error);
    // like ANTLR's default ConsoleErrorListener
    else console.error(`line ${error}`);
  }
  const lists = emptyNotationLists();
  walk(parsed.notation, lists);
  return {
    id: parsed.id,
    goalName: parsed.name.trim(),
    executionDetail: toExecutionDetail(lists),
  };
};
