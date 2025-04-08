// Generated from grammar/RTRegex.g4 by ANTLR 4.13.2
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
import RTRegexListener from "./RTRegexListener.js";
// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class RTRegexParser extends Parser {
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
	public static readonly DIGIT_SUBID = 13;
	public static readonly FLOAT = 14;
	public static readonly SEQ = 15;
	public static readonly INT = 16;
	public static readonly TASK = 17;
	public static readonly GOAL = 18;
	public static readonly SKIPP = 19;
	public static readonly X = 20;
	public static readonly NEWLINE = 21;
	public static readonly WORD = 22;
	public static readonly SUBID = 23;
	public static readonly WS = 24;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_rt = 0;
	public static readonly RULE_expr = 1;
	public static readonly RULE_id = 2;
	public static readonly RULE_word = 3;
	public static readonly literalNames: (string | null)[] = [ null, "'M'", 
                                                            "'R'", "','", 
                                                            "'['", "']'", 
                                                            "'DM('", "')'", 
                                                            "':'", "'@'", 
                                                            "'|'", "'try('", 
                                                            "'?'", null, 
                                                            null, "';'", 
                                                            "'#'", "'T'", 
                                                            "'G'", "'skip'", 
                                                            "'X'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, "DIGIT_SUBID", 
                                                             "FLOAT", "SEQ", 
                                                             "INT", "TASK", 
                                                             "GOAL", "SKIPP", 
                                                             "X", "NEWLINE", 
                                                             "WORD", "SUBID", 
                                                             "WS" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"rt", "expr", "id", "word",
	];
	public get grammarFileName(): string { return "RTRegex.g4"; }
	public get literalNames(): (string | null)[] { return RTRegexParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return RTRegexParser.symbolicNames; }
	public get ruleNames(): string[] { return RTRegexParser.ruleNames; }
	public get serializedATN(): number[] { return RTRegexParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(this, RTRegexParser._ATN, RTRegexParser.DecisionsToDFA, new PredictionContextCache());
	}
	// @RuleVersion(0)
	public rt(): RtContext {
		let localctx: RtContext = new RtContext(this, this._ctx, this.state);
		this.enterRule(localctx, 0, RTRegexParser.RULE_rt);
		try {
			this.state = 12;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 1:
			case 2:
			case 4:
			case 6:
			case 8:
			case 11:
			case 17:
			case 18:
			case 19:
				localctx = new PrintExprContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 8;
				this.expr(0);
				this.state = 9;
				this.match(RTRegexParser.EOF);
				}
				break;
			case -1:
				localctx = new BlankContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 11;
				this.match(RTRegexParser.EOF);
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

	public expr(): ExprContext;
	public expr(_p: number): ExprContext;
	// @RuleVersion(0)
	public expr(_p?: number): ExprContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let localctx: ExprContext = new ExprContext(this, this._ctx, _parentState);
		let _prevctx: ExprContext = localctx;
		let _startState: number = 2;
		this.enterRecursionRule(localctx, 2, RTRegexParser.RULE_expr, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 51;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				{
				localctx = new GIdContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 15;
				(localctx as GIdContext)._t = this._input.LT(1);
				_la = this._input.LA(1);
				if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 393222) !== 0))) {
				    (localctx as GIdContext)._t = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 16;
				this.id();
				}
				break;
			case 2:
				{
				localctx = new GIdContinuedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 17;
				(localctx as GIdContinuedContext)._t = this._input.LT(1);
				_la = this._input.LA(1);
				if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 393222) !== 0))) {
				    (localctx as GIdContinuedContext)._t = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 18;
				this.id();
				this.state = 19;
				this.expr(13);
				}
				break;
			case 3:
				{
				localctx = new GArgsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 21;
				(localctx as GArgsContext)._t = this._input.LT(1);
				_la = this._input.LA(1);
				if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 393222) !== 0))) {
				    (localctx as GArgsContext)._t = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 22;
				this.id();
				this.state = 23;
				this.match(RTRegexParser.T__2);
				this.state = 24;
				this.expr(12);
				}
				break;
			case 4:
				{
				localctx = new NotationStartContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 26;
				this.match(RTRegexParser.T__3);
				this.state = 27;
				this.expr(0);
				this.state = 28;
				this.match(RTRegexParser.T__4);
				}
				break;
			case 5:
				{
				localctx = new GDecisionMakingContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 30;
				this.match(RTRegexParser.T__5);
				this.state = 31;
				this.expr(0);
				this.state = 32;
				this.match(RTRegexParser.T__6);
				}
				break;
			case 6:
				{
				localctx = new NameContinuedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 34;
				this.match(RTRegexParser.T__7);
				this.state = 35;
				this.word();
				this.state = 36;
				this.expr(9);
				}
				break;
			case 7:
				{
				localctx = new NameOnlyContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 38;
				this.match(RTRegexParser.T__7);
				this.state = 39;
				this.word();
				this.state = 40;
				this.match(RTRegexParser.EOF);
				}
				break;
			case 8:
				{
				localctx = new GTryContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 42;
				this.match(RTRegexParser.T__10);
				this.state = 43;
				this.expr(0);
				this.state = 44;
				this.match(RTRegexParser.T__6);
				this.state = 45;
				this.match(RTRegexParser.T__11);
				this.state = 46;
				this.expr(0);
				this.state = 47;
				this.match(RTRegexParser.T__7);
				this.state = 48;
				this.expr(3);
				}
				break;
			case 9:
				{
				localctx = new GSkipContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 50;
				this.match(RTRegexParser.SKIPP);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 70;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 68;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 2, this._ctx) ) {
					case 1:
						{
						localctx = new GDMContext(this, new ExprContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
						this.state = 53;
						if (!(this.precpred(this._ctx, 7))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 7)");
						}
						this.state = 54;
						(localctx as GDMContext)._op = this.match(RTRegexParser.T__2);
						this.state = 55;
						this.expr(8);
						}
						break;
					case 2:
						{
						localctx = new GInterleavedContext(this, new ExprContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
						this.state = 56;
						if (!(this.precpred(this._ctx, 5))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
						}
						this.state = 57;
						(localctx as GInterleavedContext)._op = this.match(RTRegexParser.T__9);
						this.state = 58;
						this.expr(6);
						}
						break;
					case 3:
						{
						localctx = new GSequenceContext(this, new ExprContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
						this.state = 59;
						if (!(this.precpred(this._ctx, 4))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
						}
						this.state = 60;
						(localctx as GSequenceContext)._op = this.match(RTRegexParser.SEQ);
						this.state = 61;
						this.expr(5);
						}
						break;
					case 4:
						{
						localctx = new GTimeContext(this, new ExprContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
						this.state = 62;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 63;
						(localctx as GTimeContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===15 || _la===16)) {
						    (localctx as GTimeContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 64;
						this.expr(3);
						}
						break;
					case 5:
						{
						localctx = new GRetryContext(this, new ExprContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
						this.state = 65;
						if (!(this.precpred(this._ctx, 6))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 6)");
						}
						this.state = 66;
						(localctx as GRetryContext)._op = this.match(RTRegexParser.T__8);
						this.state = 67;
						this.match(RTRegexParser.FLOAT);
						}
						break;
					}
					}
				}
				this.state = 72;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
			}
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
			this.unrollRecursionContexts(_parentctx);
		}
		return localctx;
	}
	// @RuleVersion(0)
	public id(): IdContext {
		let localctx: IdContext = new IdContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, RTRegexParser.RULE_id);
		try {
			this.state = 78;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 4, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 73;
				this.match(RTRegexParser.FLOAT);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 74;
				this.match(RTRegexParser.FLOAT);
				this.state = 75;
				this.match(RTRegexParser.X);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 76;
				this.match(RTRegexParser.X);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 77;
				this.match(RTRegexParser.DIGIT_SUBID);
				}
				break;
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
	public word(): WordContext {
		let localctx: WordContext = new WordContext(this, this._ctx, this.state);
		this.enterRule(localctx, 6, RTRegexParser.RULE_word);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 80;
			this.match(RTRegexParser.WORD);
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

	public sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 1:
			return this.expr_sempred(localctx as ExprContext, predIndex);
		}
		return true;
	}
	private expr_sempred(localctx: ExprContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 7);
		case 1:
			return this.precpred(this._ctx, 5);
		case 2:
			return this.precpred(this._ctx, 4);
		case 3:
			return this.precpred(this._ctx, 2);
		case 4:
			return this.precpred(this._ctx, 6);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,24,83,2,0,7,0,2,
	1,7,1,2,2,7,2,2,3,7,3,1,0,1,0,1,0,1,0,3,0,13,8,0,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,52,8,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,69,8,1,10,1,12,
	1,72,9,1,1,2,1,2,1,2,1,2,1,2,3,2,79,8,2,1,3,1,3,1,3,0,1,2,4,0,2,4,6,0,2,
	2,0,1,2,17,18,1,0,15,16,95,0,12,1,0,0,0,2,51,1,0,0,0,4,78,1,0,0,0,6,80,
	1,0,0,0,8,9,3,2,1,0,9,10,5,0,0,1,10,13,1,0,0,0,11,13,5,0,0,1,12,8,1,0,0,
	0,12,11,1,0,0,0,13,1,1,0,0,0,14,15,6,1,-1,0,15,16,7,0,0,0,16,52,3,4,2,0,
	17,18,7,0,0,0,18,19,3,4,2,0,19,20,3,2,1,13,20,52,1,0,0,0,21,22,7,0,0,0,
	22,23,3,4,2,0,23,24,5,3,0,0,24,25,3,2,1,12,25,52,1,0,0,0,26,27,5,4,0,0,
	27,28,3,2,1,0,28,29,5,5,0,0,29,52,1,0,0,0,30,31,5,6,0,0,31,32,3,2,1,0,32,
	33,5,7,0,0,33,52,1,0,0,0,34,35,5,8,0,0,35,36,3,6,3,0,36,37,3,2,1,9,37,52,
	1,0,0,0,38,39,5,8,0,0,39,40,3,6,3,0,40,41,5,0,0,1,41,52,1,0,0,0,42,43,5,
	11,0,0,43,44,3,2,1,0,44,45,5,7,0,0,45,46,5,12,0,0,46,47,3,2,1,0,47,48,5,
	8,0,0,48,49,3,2,1,3,49,52,1,0,0,0,50,52,5,19,0,0,51,14,1,0,0,0,51,17,1,
	0,0,0,51,21,1,0,0,0,51,26,1,0,0,0,51,30,1,0,0,0,51,34,1,0,0,0,51,38,1,0,
	0,0,51,42,1,0,0,0,51,50,1,0,0,0,52,70,1,0,0,0,53,54,10,7,0,0,54,55,5,3,
	0,0,55,69,3,2,1,8,56,57,10,5,0,0,57,58,5,10,0,0,58,69,3,2,1,6,59,60,10,
	4,0,0,60,61,5,15,0,0,61,69,3,2,1,5,62,63,10,2,0,0,63,64,7,1,0,0,64,69,3,
	2,1,3,65,66,10,6,0,0,66,67,5,9,0,0,67,69,5,14,0,0,68,53,1,0,0,0,68,56,1,
	0,0,0,68,59,1,0,0,0,68,62,1,0,0,0,68,65,1,0,0,0,69,72,1,0,0,0,70,68,1,0,
	0,0,70,71,1,0,0,0,71,3,1,0,0,0,72,70,1,0,0,0,73,79,5,14,0,0,74,75,5,14,
	0,0,75,79,5,20,0,0,76,79,5,20,0,0,77,79,5,13,0,0,78,73,1,0,0,0,78,74,1,
	0,0,0,78,76,1,0,0,0,78,77,1,0,0,0,79,5,1,0,0,0,80,81,5,22,0,0,81,7,1,0,
	0,0,5,12,51,68,70,78];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!RTRegexParser.__ATN) {
			RTRegexParser.__ATN = new ATNDeserializer().deserialize(RTRegexParser._serializedATN);
		}

		return RTRegexParser.__ATN;
	}


	static DecisionsToDFA = RTRegexParser._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );

}

export class RtContext extends ParserRuleContext {
	constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return RTRegexParser.RULE_rt;
	}
	public override copyFrom(ctx: RtContext): void {
		super.copyFrom(ctx);
	}
}
export class BlankContext extends RtContext {
	constructor(parser: RTRegexParser, ctx: RtContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public EOF(): TerminalNode {
		return this.getToken(RTRegexParser.EOF, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterBlank) {
	 		listener.enterBlank(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitBlank) {
	 		listener.exitBlank(this);
		}
	}
}
export class PrintExprContext extends RtContext {
	constructor(parser: RTRegexParser, ctx: RtContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public EOF(): TerminalNode {
		return this.getToken(RTRegexParser.EOF, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterPrintExpr) {
	 		listener.enterPrintExpr(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitPrintExpr) {
	 		listener.exitPrintExpr(this);
		}
	}
}


export class ExprContext extends ParserRuleContext {
	constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return RTRegexParser.RULE_expr;
	}
	public override copyFrom(ctx: ExprContext): void {
		super.copyFrom(ctx);
	}
}
export class GIdContext extends ExprContext {
	public _t!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public id(): IdContext {
		return this.getTypedRuleContext(IdContext, 0) as IdContext;
	}
	public GOAL(): TerminalNode {
		return this.getToken(RTRegexParser.GOAL, 0);
	}
	public TASK(): TerminalNode {
		return this.getToken(RTRegexParser.TASK, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGId) {
	 		listener.enterGId(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGId) {
	 		listener.exitGId(this);
		}
	}
}
export class GTryContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr_list(): ExprContext[] {
		return this.getTypedRuleContexts(ExprContext) as ExprContext[];
	}
	public expr(i: number): ExprContext {
		return this.getTypedRuleContext(ExprContext, i) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGTry) {
	 		listener.enterGTry(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGTry) {
	 		listener.exitGTry(this);
		}
	}
}
export class NameOnlyContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public word(): WordContext {
		return this.getTypedRuleContext(WordContext, 0) as WordContext;
	}
	public EOF(): TerminalNode {
		return this.getToken(RTRegexParser.EOF, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterNameOnly) {
	 		listener.enterNameOnly(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitNameOnly) {
	 		listener.exitNameOnly(this);
		}
	}
}
export class GInterleavedContext extends ExprContext {
	public _op!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr_list(): ExprContext[] {
		return this.getTypedRuleContexts(ExprContext) as ExprContext[];
	}
	public expr(i: number): ExprContext {
		return this.getTypedRuleContext(ExprContext, i) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGInterleaved) {
	 		listener.enterGInterleaved(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGInterleaved) {
	 		listener.exitGInterleaved(this);
		}
	}
}
export class GTimeContext extends ExprContext {
	public _op!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr_list(): ExprContext[] {
		return this.getTypedRuleContexts(ExprContext) as ExprContext[];
	}
	public expr(i: number): ExprContext {
		return this.getTypedRuleContext(ExprContext, i) as ExprContext;
	}
	public SEQ(): TerminalNode {
		return this.getToken(RTRegexParser.SEQ, 0);
	}
	public INT(): TerminalNode {
		return this.getToken(RTRegexParser.INT, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGTime) {
	 		listener.enterGTime(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGTime) {
	 		listener.exitGTime(this);
		}
	}
}
export class GArgsContext extends ExprContext {
	public _t!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public id(): IdContext {
		return this.getTypedRuleContext(IdContext, 0) as IdContext;
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public GOAL(): TerminalNode {
		return this.getToken(RTRegexParser.GOAL, 0);
	}
	public TASK(): TerminalNode {
		return this.getToken(RTRegexParser.TASK, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGArgs) {
	 		listener.enterGArgs(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGArgs) {
	 		listener.exitGArgs(this);
		}
	}
}
export class NameContinuedContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public word(): WordContext {
		return this.getTypedRuleContext(WordContext, 0) as WordContext;
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterNameContinued) {
	 		listener.enterNameContinued(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitNameContinued) {
	 		listener.exitNameContinued(this);
		}
	}
}
export class GDMContext extends ExprContext {
	public _op!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr_list(): ExprContext[] {
		return this.getTypedRuleContexts(ExprContext) as ExprContext[];
	}
	public expr(i: number): ExprContext {
		return this.getTypedRuleContext(ExprContext, i) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGDM) {
	 		listener.enterGDM(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGDM) {
	 		listener.exitGDM(this);
		}
	}
}
export class GSkipContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public SKIPP(): TerminalNode {
		return this.getToken(RTRegexParser.SKIPP, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGSkip) {
	 		listener.enterGSkip(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGSkip) {
	 		listener.exitGSkip(this);
		}
	}
}
export class NotationStartContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterNotationStart) {
	 		listener.enterNotationStart(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitNotationStart) {
	 		listener.exitNotationStart(this);
		}
	}
}
export class GRetryContext extends ExprContext {
	public _op!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public FLOAT(): TerminalNode {
		return this.getToken(RTRegexParser.FLOAT, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGRetry) {
	 		listener.enterGRetry(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGRetry) {
	 		listener.exitGRetry(this);
		}
	}
}
export class GSequenceContext extends ExprContext {
	public _op!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr_list(): ExprContext[] {
		return this.getTypedRuleContexts(ExprContext) as ExprContext[];
	}
	public expr(i: number): ExprContext {
		return this.getTypedRuleContext(ExprContext, i) as ExprContext;
	}
	public SEQ(): TerminalNode {
		return this.getToken(RTRegexParser.SEQ, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGSequence) {
	 		listener.enterGSequence(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGSequence) {
	 		listener.exitGSequence(this);
		}
	}
}
export class GIdContinuedContext extends ExprContext {
	public _t!: Token;
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public id(): IdContext {
		return this.getTypedRuleContext(IdContext, 0) as IdContext;
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public GOAL(): TerminalNode {
		return this.getToken(RTRegexParser.GOAL, 0);
	}
	public TASK(): TerminalNode {
		return this.getToken(RTRegexParser.TASK, 0);
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGIdContinued) {
	 		listener.enterGIdContinued(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGIdContinued) {
	 		listener.exitGIdContinued(this);
		}
	}
}
export class GDecisionMakingContext extends ExprContext {
	constructor(parser: RTRegexParser, ctx: ExprContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expr(): ExprContext {
		return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterGDecisionMaking) {
	 		listener.enterGDecisionMaking(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitGDecisionMaking) {
	 		listener.exitGDecisionMaking(this);
		}
	}
}


export class IdContext extends ParserRuleContext {
	constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public FLOAT(): TerminalNode {
		return this.getToken(RTRegexParser.FLOAT, 0);
	}
	public X(): TerminalNode {
		return this.getToken(RTRegexParser.X, 0);
	}
	public DIGIT_SUBID(): TerminalNode {
		return this.getToken(RTRegexParser.DIGIT_SUBID, 0);
	}
    public get ruleIndex(): number {
    	return RTRegexParser.RULE_id;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterId) {
	 		listener.enterId(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitId) {
	 		listener.exitId(this);
		}
	}
}


export class WordContext extends ParserRuleContext {
	constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public WORD(): TerminalNode {
		return this.getToken(RTRegexParser.WORD, 0);
	}
    public get ruleIndex(): number {
    	return RTRegexParser.RULE_word;
	}
	public enterRule(listener: RTRegexListener): void {
	    if(listener.enterWord) {
	 		listener.enterWord(this);
		}
	}
	public exitRule(listener: RTRegexListener): void {
	    if(listener.exitWord) {
	 		listener.exitWord(this);
		}
	}
}
