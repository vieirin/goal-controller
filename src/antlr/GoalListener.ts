// Generated from grammar/Goal.g4 by ANTLR 4.13.0

import {ParseTreeListener} from "antlr4";


import { RtContext } from "./GoalParser";
import { ExprContext } from "./GoalParser";
import { IStarTypeContext } from "./GoalParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `GoalParser`.
 */
export default class GoalListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by `GoalParser.rt`.
	 * @param ctx the parse tree
	 */
	enterRt?: (ctx: RtContext) => void;
	/**
	 * Exit a parse tree produced by `GoalParser.rt`.
	 * @param ctx the parse tree
	 */
	exitRt?: (ctx: RtContext) => void;
	/**
	 * Enter a parse tree produced by `GoalParser.expr`.
	 * @param ctx the parse tree
	 */
	enterExpr?: (ctx: ExprContext) => void;
	/**
	 * Exit a parse tree produced by `GoalParser.expr`.
	 * @param ctx the parse tree
	 */
	exitExpr?: (ctx: ExprContext) => void;
	/**
	 * Enter a parse tree produced by `GoalParser.iStarType`.
	 * @param ctx the parse tree
	 */
	enterIStarType?: (ctx: IStarTypeContext) => void;
	/**
	 * Exit a parse tree produced by `GoalParser.iStarType`.
	 * @param ctx the parse tree
	 */
	exitIStarType?: (ctx: IStarTypeContext) => void;
}

