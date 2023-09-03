// Generated from grammar/RTRegex.g4 by ANTLR 4.13.0

import {ParseTreeListener} from "antlr4";


import { PrintExprContext } from "./RTRegexParser";
import { BlankContext } from "./RTRegexParser";
import { GDMContext } from "./RTRegexParser";
import { GIdContext } from "./RTRegexParser";
import { GTryContext } from "./RTRegexParser";
import { GSkipContext } from "./RTRegexParser";
import { NameOnlyContext } from "./RTRegexParser";
import { NotationStartContext } from "./RTRegexParser";
import { GTimeContext } from "./RTRegexParser";
import { GRetryContext } from "./RTRegexParser";
import { GIdContinuedContext } from "./RTRegexParser";
import { GArgsContext } from "./RTRegexParser";
import { GDecisionMakingContext } from "./RTRegexParser";
import { NameContinuedContext } from "./RTRegexParser";
import { IdContext } from "./RTRegexParser";
import { WordContext } from "./RTRegexParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `RTRegexParser`.
 */
export default class RTRegexListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `printExpr`
	 * labeled alternative in `RTRegexParser.rt`.
	 * @param ctx the parse tree
	 */
	enterPrintExpr?: (ctx: PrintExprContext) => void;
	/**
	 * Exit a parse tree produced by the `printExpr`
	 * labeled alternative in `RTRegexParser.rt`.
	 * @param ctx the parse tree
	 */
	exitPrintExpr?: (ctx: PrintExprContext) => void;
	/**
	 * Enter a parse tree produced by the `blank`
	 * labeled alternative in `RTRegexParser.rt`.
	 * @param ctx the parse tree
	 */
	enterBlank?: (ctx: BlankContext) => void;
	/**
	 * Exit a parse tree produced by the `blank`
	 * labeled alternative in `RTRegexParser.rt`.
	 * @param ctx the parse tree
	 */
	exitBlank?: (ctx: BlankContext) => void;
	/**
	 * Enter a parse tree produced by the `gDM`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGDM?: (ctx: GDMContext) => void;
	/**
	 * Exit a parse tree produced by the `gDM`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGDM?: (ctx: GDMContext) => void;
	/**
	 * Enter a parse tree produced by the `gId`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGId?: (ctx: GIdContext) => void;
	/**
	 * Exit a parse tree produced by the `gId`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGId?: (ctx: GIdContext) => void;
	/**
	 * Enter a parse tree produced by the `gTry`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGTry?: (ctx: GTryContext) => void;
	/**
	 * Exit a parse tree produced by the `gTry`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGTry?: (ctx: GTryContext) => void;
	/**
	 * Enter a parse tree produced by the `gSkip`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGSkip?: (ctx: GSkipContext) => void;
	/**
	 * Exit a parse tree produced by the `gSkip`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGSkip?: (ctx: GSkipContext) => void;
	/**
	 * Enter a parse tree produced by the `nameOnly`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterNameOnly?: (ctx: NameOnlyContext) => void;
	/**
	 * Exit a parse tree produced by the `nameOnly`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitNameOnly?: (ctx: NameOnlyContext) => void;
	/**
	 * Enter a parse tree produced by the `notationStart`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterNotationStart?: (ctx: NotationStartContext) => void;
	/**
	 * Exit a parse tree produced by the `notationStart`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitNotationStart?: (ctx: NotationStartContext) => void;
	/**
	 * Enter a parse tree produced by the `gTime`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGTime?: (ctx: GTimeContext) => void;
	/**
	 * Exit a parse tree produced by the `gTime`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGTime?: (ctx: GTimeContext) => void;
	/**
	 * Enter a parse tree produced by the `gRetry`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGRetry?: (ctx: GRetryContext) => void;
	/**
	 * Exit a parse tree produced by the `gRetry`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGRetry?: (ctx: GRetryContext) => void;
	/**
	 * Enter a parse tree produced by the `gIdContinued`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGIdContinued?: (ctx: GIdContinuedContext) => void;
	/**
	 * Exit a parse tree produced by the `gIdContinued`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGIdContinued?: (ctx: GIdContinuedContext) => void;
	/**
	 * Enter a parse tree produced by the `gArgs`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGArgs?: (ctx: GArgsContext) => void;
	/**
	 * Exit a parse tree produced by the `gArgs`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGArgs?: (ctx: GArgsContext) => void;
	/**
	 * Enter a parse tree produced by the `gDecisionMaking`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterGDecisionMaking?: (ctx: GDecisionMakingContext) => void;
	/**
	 * Exit a parse tree produced by the `gDecisionMaking`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitGDecisionMaking?: (ctx: GDecisionMakingContext) => void;
	/**
	 * Enter a parse tree produced by the `nameContinued`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	enterNameContinued?: (ctx: NameContinuedContext) => void;
	/**
	 * Exit a parse tree produced by the `nameContinued`
	 * labeled alternative in `RTRegexParser.expr`.
	 * @param ctx the parse tree
	 */
	exitNameContinued?: (ctx: NameContinuedContext) => void;
	/**
	 * Enter a parse tree produced by `RTRegexParser.id`.
	 * @param ctx the parse tree
	 */
	enterId?: (ctx: IdContext) => void;
	/**
	 * Exit a parse tree produced by `RTRegexParser.id`.
	 * @param ctx the parse tree
	 */
	exitId?: (ctx: IdContext) => void;
	/**
	 * Enter a parse tree produced by `RTRegexParser.word`.
	 * @param ctx the parse tree
	 */
	enterWord?: (ctx: WordContext) => void;
	/**
	 * Exit a parse tree produced by `RTRegexParser.word`.
	 * @param ctx the parse tree
	 */
	exitWord?: (ctx: WordContext) => void;
}

