import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import Goal from './antlr/GoalLexer';
import GoalParser, { ExprContext, IStarTypeContext, RtContext } from './antlr/GoalParser';
import GoalListener from './antlr/GoalListener';

export const getGoalTokens = (input: string) => {
    const chars = new CharStream(input); // replace this with a FileStream as required
    const lexer = new Goal(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new GoalParser(tokens);
    const tree = parser.rt();
    let id = ""
    let type = ""

    class MyTreeWalker extends GoalListener {
        enterExpr = (ctx: ExprContext) => {
        }
        exitRt = (ctx: RtContext) => {
            console.log(ctx.getText())
            console.log(ctx.expr().UUID_V4().getText())
            console.log(ctx.expr().iStarType()?.getText())
        }
    }

    const walker = new MyTreeWalker();
    ParseTreeWalker.DEFAULT.walk(walker, tree);
}
