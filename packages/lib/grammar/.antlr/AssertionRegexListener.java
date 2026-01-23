// Generated from /Users/vieira.neto/vieirin/goal-controller/grammar/AssertionRegex.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link AssertionRegexParser}.
 */
public interface AssertionRegexListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the {@code printExpr}
	 * labeled alternative in {@link AssertionRegexParser#assertion}.
	 * @param ctx the parse tree
	 */
	void enterPrintExpr(AssertionRegexParser.PrintExprContext ctx);
	/**
	 * Exit a parse tree produced by the {@code printExpr}
	 * labeled alternative in {@link AssertionRegexParser#assertion}.
	 * @param ctx the parse tree
	 */
	void exitPrintExpr(AssertionRegexParser.PrintExprContext ctx);
	/**
	 * Enter a parse tree produced by the {@code blank}
	 * labeled alternative in {@link AssertionRegexParser#assertion}.
	 * @param ctx the parse tree
	 */
	void enterBlank(AssertionRegexParser.BlankContext ctx);
	/**
	 * Exit a parse tree produced by the {@code blank}
	 * labeled alternative in {@link AssertionRegexParser#assertion}.
	 * @param ctx the parse tree
	 */
	void exitBlank(AssertionRegexParser.BlankContext ctx);
	/**
	 * Enter a parse tree produced by the {@code identifier}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterIdentifier(AssertionRegexParser.IdentifierContext ctx);
	/**
	 * Exit a parse tree produced by the {@code identifier}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitIdentifier(AssertionRegexParser.IdentifierContext ctx);
	/**
	 * Enter a parse tree produced by the {@code notExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterNotExpr(AssertionRegexParser.NotExprContext ctx);
	/**
	 * Exit a parse tree produced by the {@code notExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitNotExpr(AssertionRegexParser.NotExprContext ctx);
	/**
	 * Enter a parse tree produced by the {@code boolean}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterBoolean(AssertionRegexParser.BooleanContext ctx);
	/**
	 * Exit a parse tree produced by the {@code boolean}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitBoolean(AssertionRegexParser.BooleanContext ctx);
	/**
	 * Enter a parse tree produced by the {@code assignment}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterAssignment(AssertionRegexParser.AssignmentContext ctx);
	/**
	 * Exit a parse tree produced by the {@code assignment}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitAssignment(AssertionRegexParser.AssignmentContext ctx);
	/**
	 * Enter a parse tree produced by the {@code orExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterOrExpr(AssertionRegexParser.OrExprContext ctx);
	/**
	 * Exit a parse tree produced by the {@code orExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitOrExpr(AssertionRegexParser.OrExprContext ctx);
	/**
	 * Enter a parse tree produced by the {@code parenExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterParenExpr(AssertionRegexParser.ParenExprContext ctx);
	/**
	 * Exit a parse tree produced by the {@code parenExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitParenExpr(AssertionRegexParser.ParenExprContext ctx);
	/**
	 * Enter a parse tree produced by the {@code andExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterAndExpr(AssertionRegexParser.AndExprContext ctx);
	/**
	 * Exit a parse tree produced by the {@code andExpr}
	 * labeled alternative in {@link AssertionRegexParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitAndExpr(AssertionRegexParser.AndExprContext ctx);
}