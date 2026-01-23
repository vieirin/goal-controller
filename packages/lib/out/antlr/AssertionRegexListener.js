"use strict";
// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2
Object.defineProperty(exports, "__esModule", { value: true });
const antlr4_1 = require("antlr4");
/**
 * This interface defines a complete listener for a parse tree produced by
 * `AssertionRegexParser`.
 */
class AssertionRegexListener extends antlr4_1.ParseTreeListener {
    /**
     * Enter a parse tree produced by the `printExpr`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    enterPrintExpr;
    /**
     * Exit a parse tree produced by the `printExpr`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    exitPrintExpr;
    /**
     * Enter a parse tree produced by the `blank`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    enterBlank;
    /**
     * Exit a parse tree produced by the `blank`
     * labeled alternative in `AssertionRegexParser.assertion`.
     * @param ctx the parse tree
     */
    exitBlank;
    /**
     * Enter a parse tree produced by the `identifier`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterIdentifier;
    /**
     * Exit a parse tree produced by the `identifier`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitIdentifier;
    /**
     * Enter a parse tree produced by the `notExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterNotExpr;
    /**
     * Exit a parse tree produced by the `notExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitNotExpr;
    /**
     * Enter a parse tree produced by the `boolean`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterBoolean;
    /**
     * Exit a parse tree produced by the `boolean`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitBoolean;
    /**
     * Enter a parse tree produced by the `assignment`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterAssignment;
    /**
     * Exit a parse tree produced by the `assignment`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitAssignment;
    /**
     * Enter a parse tree produced by the `intComparison`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterIntComparison;
    /**
     * Exit a parse tree produced by the `intComparison`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitIntComparison;
    /**
     * Enter a parse tree produced by the `orExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterOrExpr;
    /**
     * Exit a parse tree produced by the `orExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitOrExpr;
    /**
     * Enter a parse tree produced by the `parenExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterParenExpr;
    /**
     * Exit a parse tree produced by the `parenExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitParenExpr;
    /**
     * Enter a parse tree produced by the `andExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterAndExpr;
    /**
     * Exit a parse tree produced by the `andExpr`
     * labeled alternative in `AssertionRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitAndExpr;
    /**
     * Enter a parse tree produced by `AssertionRegexParser.comparator`.
     * @param ctx the parse tree
     */
    enterComparator;
    /**
     * Exit a parse tree produced by `AssertionRegexParser.comparator`.
     * @param ctx the parse tree
     */
    exitComparator;
}
exports.default = AssertionRegexListener;
//# sourceMappingURL=AssertionRegexListener.js.map