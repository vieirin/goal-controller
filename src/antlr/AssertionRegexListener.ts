// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2

import {ParseTreeListener} from "antlr4";


import { PrintExprContext } from "./AssertionRegexParser.js";
import { BlankContext } from "./AssertionRegexParser.js";
import { IdentifierContext } from "./AssertionRegexParser.js";
import { OrExprContext } from "./AssertionRegexParser.js";
import { ParenExprContext } from "./AssertionRegexParser.js";
import { AndExprContext } from "./AssertionRegexParser.js";


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
}

