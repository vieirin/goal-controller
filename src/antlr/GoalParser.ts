// Generated from grammar/Goal.g4 by ANTLR 4.13.0
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
	ATN,
	ATNDeserializer, DecisionState, DFA, FailedPredicateException,
	RecognitionException, NoViableAltException, BailErrorStrategy,
	Parser, ParserATNSimulator,
	RuleContext, ParserRuleContext, PredictionMode, PredictionContextCache,
	TerminalNode, RuleNode,
	Token, TokenStream,
	Interval, IntervalSet
} from 'antlr4';
import GoalListener from "./GoalListener.js";
// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class GoalParser extends Parser {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly T__6 = 7;
	public static readonly T__7 = 8;
	public static readonly T__8 = 9;
	public static readonly T__9 = 10;
	public static readonly T__10 = 11;
	public static readonly T__11 = 12;
	public static readonly T__12 = 13;
	public static readonly BOOLEAN = 14;
	public static readonly GOAL = 15;
	public static readonly GOALNAME = 16;
	public static readonly NUMBER = 17;
	public static readonly ID = 18;
	public static readonly FLOAT = 19;
	public static readonly SEQ = 20;
	public static readonly INT = 21;
	public static readonly TASK_TKN = 22;
	public static readonly GOAL_TKN = 23;
	public static readonly SKIPP = 24;
	public static readonly X = 25;
	public static readonly NEWLINE = 26;
	public static readonly WS = 27;
	public static readonly UUID_V4 = 28;
	public static readonly EOF = Token.EOF;
	public static readonly RULE_rt = 0;
	public static readonly RULE_expr = 1;
	public static readonly RULE_iStarType = 2;
	public static readonly literalNames: (string | null)[] = [ null, "'id'", 
                                                            "':'", "'text'", 
                                                            "'type'", "'istar.'", 
                                                            "'x'", "'y'", 
                                                            "'customProperties'", 
                                                            "'selected'", 
                                                            "','", "'Task'", 
                                                            "'Goal'", "'Actor'", 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            "';'", "'#'", 
                                                            "'T'", "'G'", 
                                                            "'skip'", "'X'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             "BOOLEAN", 
                                                             "GOAL", "GOALNAME", 
                                                             "NUMBER", "ID", 
                                                             "FLOAT", "SEQ", 
                                                             "INT", "TASK_TKN", 
                                                             "GOAL_TKN", 
                                                             "SKIPP", "X", 
                                                             "NEWLINE", 
                                                             "WS", "UUID_V4" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"rt", "expr", "iStarType",
	];
	public get grammarFileName(): string { return "Goal.g4"; }
	public get literalNames(): (string | null)[] { return GoalParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return GoalParser.symbolicNames; }
	public get ruleNames(): string[] { return GoalParser.ruleNames; }
	public get serializedATN(): number[] { return GoalParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(this, GoalParser._ATN, GoalParser.DecisionsToDFA, new PredictionContextCache());
	}
	// @RuleVersion(0)
	public rt(): RtContext {
		let localctx: RtContext = new RtContext(this, this._ctx, this.state);
		this.enterRule(localctx, 0, GoalParser.RULE_rt);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 6;
			this.expr();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public expr(): ExprContext {
		let localctx: ExprContext = new ExprContext(this, this._ctx, this.state);
		this.enterRule(localctx, 2, GoalParser.RULE_expr);
		try {
			this.state = 41;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 8;
				this.match(GoalParser.T__0);
				this.state = 9;
				this.match(GoalParser.T__1);
				this.state = 10;
				this.match(GoalParser.UUID_V4);
				this.state = 11;
				this.expr();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 12;
				this.match(GoalParser.T__2);
				this.state = 13;
				this.match(GoalParser.T__1);
				this.state = 14;
				this.match(GoalParser.GOAL);
				this.state = 15;
				this.expr();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 16;
				this.match(GoalParser.T__3);
				this.state = 17;
				this.match(GoalParser.T__1);
				this.state = 18;
				this.match(GoalParser.T__4);
				this.state = 19;
				this.iStarType();
				this.state = 20;
				this.expr();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 22;
				this.match(GoalParser.T__5);
				this.state = 23;
				this.match(GoalParser.T__1);
				this.state = 24;
				this.match(GoalParser.NUMBER);
				this.state = 25;
				this.expr();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 26;
				this.match(GoalParser.T__6);
				this.state = 27;
				this.match(GoalParser.T__1);
				this.state = 28;
				this.match(GoalParser.NUMBER);
				this.state = 29;
				this.expr();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 30;
				this.match(GoalParser.T__7);
				this.state = 31;
				this.match(GoalParser.T__1);
				this.state = 32;
				this.expr();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 33;
				this.match(GoalParser.T__8);
				this.state = 34;
				this.match(GoalParser.T__1);
				this.state = 35;
				this.match(GoalParser.BOOLEAN);
				this.state = 36;
				this.expr();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 37;
				this.match(GoalParser.T__9);
				this.state = 38;
				this.expr();
				}
				break;
			case -1:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 39;
				this.match(GoalParser.EOF);
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 40;
				this.match(GoalParser.SKIPP);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public iStarType(): IStarTypeContext {
		let localctx: IStarTypeContext = new IStarTypeContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, GoalParser.RULE_iStarType);
		try {
			this.state = 47;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case -1:
			case 1:
			case 3:
			case 4:
			case 6:
			case 7:
			case 8:
			case 9:
			case 10:
			case 24:
				this.enterOuterAlt(localctx, 1);
				// tslint:disable-next-line:no-empty
				{
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 44;
				this.match(GoalParser.T__10);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 45;
				this.match(GoalParser.T__11);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 46;
				this.match(GoalParser.T__12);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public static readonly _serializedATN: number[] = [4,1,28,50,2,0,7,0,2,
	1,7,1,2,2,7,2,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,3,1,42,8,1,1,2,1,2,1,2,1,2,3,2,48,8,2,1,2,0,0,3,0,2,4,0,0,58,
	0,6,1,0,0,0,2,41,1,0,0,0,4,47,1,0,0,0,6,7,3,2,1,0,7,1,1,0,0,0,8,9,5,1,0,
	0,9,10,5,2,0,0,10,11,5,28,0,0,11,42,3,2,1,0,12,13,5,3,0,0,13,14,5,2,0,0,
	14,15,5,15,0,0,15,42,3,2,1,0,16,17,5,4,0,0,17,18,5,2,0,0,18,19,5,5,0,0,
	19,20,3,4,2,0,20,21,3,2,1,0,21,42,1,0,0,0,22,23,5,6,0,0,23,24,5,2,0,0,24,
	25,5,17,0,0,25,42,3,2,1,0,26,27,5,7,0,0,27,28,5,2,0,0,28,29,5,17,0,0,29,
	42,3,2,1,0,30,31,5,8,0,0,31,32,5,2,0,0,32,42,3,2,1,0,33,34,5,9,0,0,34,35,
	5,2,0,0,35,36,5,14,0,0,36,42,3,2,1,0,37,38,5,10,0,0,38,42,3,2,1,0,39,42,
	5,0,0,1,40,42,5,24,0,0,41,8,1,0,0,0,41,12,1,0,0,0,41,16,1,0,0,0,41,22,1,
	0,0,0,41,26,1,0,0,0,41,30,1,0,0,0,41,33,1,0,0,0,41,37,1,0,0,0,41,39,1,0,
	0,0,41,40,1,0,0,0,42,3,1,0,0,0,43,48,1,0,0,0,44,48,5,11,0,0,45,48,5,12,
	0,0,46,48,5,13,0,0,47,43,1,0,0,0,47,44,1,0,0,0,47,45,1,0,0,0,47,46,1,0,
	0,0,48,5,1,0,0,0,2,41,47];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!GoalParser.__ATN) {
			GoalParser.__ATN = new ATNDeserializer().deserialize(GoalParser._serializedATN);
		}

		return GoalParser.__ATN;
	}


	static DecisionsToDFA = GoalParser._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );

}

export class RtContext extends ParserRuleContext {
	constructor(parser?: GoalParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
    public get ruleIndex(): number {
    	return GoalParser.RULE_rt;
	}
	public enterRule(listener: GoalListener): void {
	    if(listener.enterRt) {
	 		listener.enterRt(this);
		}
	}
	public exitRule(listener: GoalListener): void {
	    if(listener.exitRt) {
	 		listener.exitRt(this);
		}
	}
}


export class ExprContext extends ParserRuleContext {
	constructor(parser?: GoalParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public UUID_V4(): TerminalNode {
		return this.getToken(GoalParser.UUID_V4, 0);
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public GOAL(): TerminalNode {
		return this.getToken(GoalParser.GOAL, 0);
	}
	public iStarType(): IStarTypeContext {
		return this.getTypedRuleContext(IStarTypeContext, 0) as IStarTypeContext;
	}
	public NUMBER(): TerminalNode {
		return this.getToken(GoalParser.NUMBER, 0);
	}
	public BOOLEAN(): TerminalNode {
		return this.getToken(GoalParser.BOOLEAN, 0);
	}
	public EOF(): TerminalNode {
		return this.getToken(GoalParser.EOF, 0);
	}
	public SKIPP(): TerminalNode {
		return this.getToken(GoalParser.SKIPP, 0);
	}
    public get ruleIndex(): number {
    	return GoalParser.RULE_expr;
	}
	public enterRule(listener: GoalListener): void {
	    if(listener.enterExpr) {
	 		listener.enterExpr(this);
		}
	}
	public exitRule(listener: GoalListener): void {
	    if(listener.exitExpr) {
	 		listener.exitExpr(this);
		}
	}
}


export class IStarTypeContext extends ParserRuleContext {
	constructor(parser?: GoalParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return GoalParser.RULE_iStarType;
	}
	public enterRule(listener: GoalListener): void {
	    if(listener.enterIStarType) {
	 		listener.enterIStarType(this);
		}
	}
	public exitRule(listener: GoalListener): void {
	    if(listener.exitIStarType) {
	 		listener.exitIStarType(this);
		}
	}
}
