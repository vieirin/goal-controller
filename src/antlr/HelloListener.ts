// Generated from grammar/Hello.g4 by ANTLR 4.13.0

import {ParseTreeListener} from "antlr4";


import { RContext } from "./HelloParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `HelloParser`.
 */
export default class HelloListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by `HelloParser.r`.
	 * @param ctx the parse tree
	 */
	enterR?: (ctx: RContext) => void;
	/**
	 * Exit a parse tree produced by `HelloParser.r`.
	 * @param ctx the parse tree
	 */
	exitR?: (ctx: RContext) => void;
}
