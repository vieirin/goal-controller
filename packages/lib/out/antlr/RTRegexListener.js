"use strict";
// Generated from grammar/RTRegex.g4 by ANTLR 4.13.2
Object.defineProperty(exports, "__esModule", { value: true });
const antlr4_1 = require("antlr4");
/**
 * This interface defines a complete listener for a parse tree produced by
 * `RTRegexParser`.
 */
class RTRegexListener extends antlr4_1.ParseTreeListener {
    /**
     * Enter a parse tree produced by the `printExpr`
     * labeled alternative in `RTRegexParser.rt`.
     * @param ctx the parse tree
     */
    enterPrintExpr;
    /**
     * Exit a parse tree produced by the `printExpr`
     * labeled alternative in `RTRegexParser.rt`.
     * @param ctx the parse tree
     */
    exitPrintExpr;
    /**
     * Enter a parse tree produced by the `blank`
     * labeled alternative in `RTRegexParser.rt`.
     * @param ctx the parse tree
     */
    enterBlank;
    /**
     * Exit a parse tree produced by the `blank`
     * labeled alternative in `RTRegexParser.rt`.
     * @param ctx the parse tree
     */
    exitBlank;
    /**
     * Enter a parse tree produced by the `gId`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGId;
    /**
     * Exit a parse tree produced by the `gId`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGId;
    /**
     * Enter a parse tree produced by the `nameOnly`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterNameOnly;
    /**
     * Exit a parse tree produced by the `nameOnly`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitNameOnly;
    /**
     * Enter a parse tree produced by the `gInterleaved`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGInterleaved;
    /**
     * Exit a parse tree produced by the `gInterleaved`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGInterleaved;
    /**
     * Enter a parse tree produced by the `gChoice`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGChoice;
    /**
     * Exit a parse tree produced by the `gChoice`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGChoice;
    /**
     * Enter a parse tree produced by the `gArgs`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGArgs;
    /**
     * Exit a parse tree produced by the `gArgs`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGArgs;
    /**
     * Enter a parse tree produced by the `nameContinued`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterNameContinued;
    /**
     * Exit a parse tree produced by the `nameContinued`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitNameContinued;
    /**
     * Enter a parse tree produced by the `gAlternative`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGAlternative;
    /**
     * Exit a parse tree produced by the `gAlternative`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGAlternative;
    /**
     * Enter a parse tree produced by the `gDegradation`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGDegradation;
    /**
     * Exit a parse tree produced by the `gDegradation`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGDegradation;
    /**
     * Enter a parse tree produced by the `gSkip`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGSkip;
    /**
     * Exit a parse tree produced by the `gSkip`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGSkip;
    /**
     * Enter a parse tree produced by the `notationStart`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterNotationStart;
    /**
     * Exit a parse tree produced by the `notationStart`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitNotationStart;
    /**
     * Enter a parse tree produced by the `gRetry`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGRetry;
    /**
     * Exit a parse tree produced by the `gRetry`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGRetry;
    /**
     * Enter a parse tree produced by the `gSequence`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGSequence;
    /**
     * Exit a parse tree produced by the `gSequence`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGSequence;
    /**
     * Enter a parse tree produced by the `gIdContinued`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    enterGIdContinued;
    /**
     * Exit a parse tree produced by the `gIdContinued`
     * labeled alternative in `RTRegexParser.expr`.
     * @param ctx the parse tree
     */
    exitGIdContinued;
    /**
     * Enter a parse tree produced by `RTRegexParser.id`.
     * @param ctx the parse tree
     */
    enterId;
    /**
     * Exit a parse tree produced by `RTRegexParser.id`.
     * @param ctx the parse tree
     */
    exitId;
    /**
     * Enter a parse tree produced by `RTRegexParser.word`.
     * @param ctx the parse tree
     */
    enterWord;
    /**
     * Exit a parse tree produced by `RTRegexParser.word`.
     * @param ctx the parse tree
     */
    exitWord;
}
exports.default = RTRegexListener;
//# sourceMappingURL=RTRegexListener.js.map