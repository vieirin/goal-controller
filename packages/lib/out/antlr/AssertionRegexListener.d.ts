import { ParseTreeListener } from 'antlr4';
import { PrintExprContext } from './AssertionRegexParser.js';
import { BlankContext } from './AssertionRegexParser.js';
import { IdentifierContext } from './AssertionRegexParser.js';
import { NotExprContext } from './AssertionRegexParser.js';
import { BooleanContext } from './AssertionRegexParser.js';
import { AssignmentContext } from './AssertionRegexParser.js';
import { IntComparisonContext } from './AssertionRegexParser.js';
import { OrExprContext } from './AssertionRegexParser.js';
import { ParenExprContext } from './AssertionRegexParser.js';
import { AndExprContext } from './AssertionRegexParser.js';
import { ComparatorContext } from './AssertionRegexParser.js';
/**
 * This interface defines a complete listener for a parse tree produced by
 * `AssertionRegexParser`.
 */
export default class AssertionRegexListener extends ParseTreeListener {
    /**
     * Enter a parse tree produced by the `printExpr`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    enterPrintExpr?: (ctx: PrintExprContext) => void;
    /**
     * Exit a parse tree produced by the `printExpr`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    exitPrintExpr?: (ctx: PrintExprContext) => void;
    /**
     * Enter a parse tree produced by the `blank`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    enterBlank?: (ctx: BlankContext) => void;
    /**
     * Exit a parse tree produced by the `blank`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    exitBlank?: (ctx: BlankContext) => void;
    /**
     * Enter a parse tree produced by the `identifier`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterIdentifier?: (ctx: IdentifierContext) => void;
    /**
     * Exit a parse tree produced by the `identifier`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitIdentifier?: (ctx: IdentifierContext) => void;
    /**
     * Enter a parse tree produced by the `notExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterNotExpr?: (ctx: NotExprContext) => void;
    /**
     * Exit a parse tree produced by the `notExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitNotExpr?: (ctx: NotExprContext) => void;
    /**
     * Enter a parse tree produced by the `boolean`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterBoolean?: (ctx: BooleanContext) => void;
    /**
     * Exit a parse tree produced by the `boolean`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitBoolean?: (ctx: BooleanContext) => void;
    /**
     * Enter a parse tree produced by the `assignment`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterAssignment?: (ctx: AssignmentContext) => void;
    /**
     * Exit a parse tree produced by the `assignment`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitAssignment?: (ctx: AssignmentContext) => void;
    /**
     * Enter a parse tree produced by the `intComparison`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterIntComparison?: (ctx: IntComparisonContext) => void;
    /**
     * Exit a parse tree produced by the `intComparison`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitIntComparison?: (ctx: IntComparisonContext) => void;
    /**
     * Enter a parse tree produced by the `orExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterOrExpr?: (ctx: OrExprContext) => void;
    /**
     * Exit a parse tree produced by the `orExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitOrExpr?: (ctx: OrExprContext) => void;
    /**
     * Enter a parse tree produced by the `parenExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterParenExpr?: (ctx: ParenExprContext) => void;
    /**
     * Exit a parse tree produced by the `parenExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitParenExpr?: (ctx: ParenExprContext) => void;
    /**
     * Enter a parse tree produced by the `andExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterAndExpr?: (ctx: AndExprContext) => void;
    /**
     * Exit a parse tree produced by the `andExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitAndExpr?: (ctx: AndExprContext) => void;
    /**
     * Enter a parse tree produced by `AssertionRegexParser.comparator`.
     * @param ctx the parse tree
     */
    enterComparator?: (ctx: ComparatorContext) => void;
    /**
     * Exit a parse tree produced by `AssertionRegexParser.comparator`.
     * @param ctx the parse tree
     */
    exitComparator?: (ctx: ComparatorContext) => void;
}
//# sourceMappingURL=AssertionRegexListener.d.ts.map