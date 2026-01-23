// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
  ATN,
  ATNDeserializer,
  DecisionState,
  DFA,
  FailedPredicateException,
  RecognitionException,
  NoViableAltException,
  BailErrorStrategy,
  Parser,
  ParserATNSimulator,
  RuleContext,
  ParserRuleContext,
  PredictionMode,
  PredictionContextCache,
  TerminalNode,
  RuleNode,
  Token,
  TokenStream,
  Interval,
  IntervalSet,
} from 'antlr4';
import AssertionRegexListener from './AssertionRegexListener.js';
// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class AssertionRegexParser extends Parser {
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
  public static readonly BOOLEAN = 12;
  public static readonly ID = 13;
  public static readonly INT = 14;
  public static readonly WS = 15;
  public static override readonly EOF = Token.EOF;
  public static readonly RULE_assertion = 0;
  public static readonly RULE_expr = 1;
  public static readonly RULE_comparator = 2;
  public static readonly literalNames: (string | null)[] = [
    null,
    "'&'",
    "'|'",
    "'!'",
    "'('",
    "')'",
    "'='",
    "'!='",
    "'<'",
    "'<='",
    "'>'",
    "'>='",
  ];
  public static readonly symbolicNames: (string | null)[] = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'BOOLEAN',
    'ID',
    'INT',
    'WS',
  ];
  // tslint:disable:no-trailing-whitespace
  public static readonly ruleNames: string[] = [
    'assertion',
    'expr',
    'comparator',
  ];
  public get grammarFileName(): string {
    return 'AssertionRegex.g4';
  }
  public get literalNames(): (string | null)[] {
    return AssertionRegexParser.literalNames;
  }
  public get symbolicNames(): (string | null)[] {
    return AssertionRegexParser.symbolicNames;
  }
  public get ruleNames(): string[] {
    return AssertionRegexParser.ruleNames;
  }
  public get serializedATN(): number[] {
    return AssertionRegexParser._serializedATN;
  }

  protected createFailedPredicateException(
    predicate?: string,
    message?: string,
  ): FailedPredicateException {
    return new FailedPredicateException(this, predicate, message);
  }

  constructor(input: TokenStream) {
    super(input);
    this._interp = new ParserATNSimulator(
      this,
      AssertionRegexParser._ATN,
      AssertionRegexParser.DecisionsToDFA,
      new PredictionContextCache(),
    );
  }
  // @RuleVersion(0)
  public assertion(): AssertionContext {
    let localctx: AssertionContext = new AssertionContext(
      this,
      this._ctx,
      this.state,
    );
    this.enterRule(localctx, 0, AssertionRegexParser.RULE_assertion);
    try {
      this.state = 10;
      this._errHandler.sync(this);
      switch (this._input.LA(1)) {
        case 3:
        case 4:
        case 12:
        case 13:
          localctx = new PrintExprContext(this, localctx);
          this.enterOuterAlt(localctx, 1);
          {
            this.state = 6;
            this.expr(0);
            this.state = 7;
            this.match(AssertionRegexParser.EOF);
          }
          break;
        case -1:
          localctx = new BlankContext(this, localctx);
          this.enterOuterAlt(localctx, 2);
          {
            this.state = 9;
            this.match(AssertionRegexParser.EOF);
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
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
    this.enterRecursionRule(localctx, 2, AssertionRegexParser.RULE_expr, _p);
    try {
      let _alt: number;
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 28;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 1, this._ctx)) {
          case 1:
            {
              localctx = new NotExprContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;

              this.state = 13;
              this.match(AssertionRegexParser.T__2);
              this.state = 14;
              this.expr(6);
            }
            break;
          case 2:
            {
              localctx = new ParenExprContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;
              this.state = 15;
              this.match(AssertionRegexParser.T__3);
              this.state = 16;
              this.expr(0);
              this.state = 17;
              this.match(AssertionRegexParser.T__4);
            }
            break;
          case 3:
            {
              localctx = new AssignmentContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;
              this.state = 19;
              this.match(AssertionRegexParser.ID);
              this.state = 20;
              this.match(AssertionRegexParser.T__5);
              this.state = 21;
              this.match(AssertionRegexParser.BOOLEAN);
            }
            break;
          case 4:
            {
              localctx = new IntComparisonContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;
              this.state = 22;
              this.match(AssertionRegexParser.ID);
              this.state = 23;
              this.comparator();
              this.state = 24;
              this.match(AssertionRegexParser.INT);
            }
            break;
          case 5:
            {
              localctx = new IdentifierContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;
              this.state = 26;
              this.match(AssertionRegexParser.ID);
            }
            break;
          case 6:
            {
              localctx = new BooleanContext(this, localctx);
              this._ctx = localctx;
              _prevctx = localctx;
              this.state = 27;
              this.match(AssertionRegexParser.BOOLEAN);
            }
            break;
        }
        this._ctx.stop = this._input.LT(-1);
        this.state = 38;
        this._errHandler.sync(this);
        _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
        while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
          if (_alt === 1) {
            if (this._parseListeners != null) {
              this.triggerExitRuleEvent();
            }
            _prevctx = localctx;
            {
              this.state = 36;
              this._errHandler.sync(this);
              switch (this._interp.adaptivePredict(this._input, 2, this._ctx)) {
                case 1:
                  {
                    localctx = new AndExprContext(
                      this,
                      new ExprContext(this, _parentctx, _parentState),
                    );
                    this.pushNewRecursionContext(
                      localctx,
                      _startState,
                      AssertionRegexParser.RULE_expr,
                    );
                    this.state = 30;
                    if (!this.precpred(this._ctx, 8)) {
                      throw this.createFailedPredicateException(
                        'this.precpred(this._ctx, 8)',
                      );
                    }
                    this.state = 31;
                    this.match(AssertionRegexParser.T__0);
                    this.state = 32;
                    this.expr(9);
                  }
                  break;
                case 2:
                  {
                    localctx = new OrExprContext(
                      this,
                      new ExprContext(this, _parentctx, _parentState),
                    );
                    this.pushNewRecursionContext(
                      localctx,
                      _startState,
                      AssertionRegexParser.RULE_expr,
                    );
                    this.state = 33;
                    if (!this.precpred(this._ctx, 7)) {
                      throw this.createFailedPredicateException(
                        'this.precpred(this._ctx, 7)',
                      );
                    }
                    this.state = 34;
                    this.match(AssertionRegexParser.T__1);
                    this.state = 35;
                    this.expr(8);
                  }
                  break;
              }
            }
          }
          this.state = 40;
          this._errHandler.sync(this);
          _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.unrollRecursionContexts(_parentctx);
    }
    return localctx;
  }
  // @RuleVersion(0)
  public comparator(): ComparatorContext {
    let localctx: ComparatorContext = new ComparatorContext(
      this,
      this._ctx,
      this.state,
    );
    this.enterRule(localctx, 4, AssertionRegexParser.RULE_comparator);
    let _la: number;
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 41;
        _la = this._input.LA(1);
        if (!((_la & ~0x1f) === 0 && ((1 << _la) & 4032) !== 0)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  public sempred(
    localctx: RuleContext,
    ruleIndex: number,
    predIndex: number,
  ): boolean {
    switch (ruleIndex) {
      case 1:
        return this.expr_sempred(localctx as ExprContext, predIndex);
    }
    return true;
  }
  private expr_sempred(localctx: ExprContext, predIndex: number): boolean {
    switch (predIndex) {
      case 0:
        return this.precpred(this._ctx, 8);
      case 1:
        return this.precpred(this._ctx, 7);
    }
    return true;
  }

  public static readonly _serializedATN: number[] = [
    4, 1, 15, 44, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 1, 0, 1, 0, 1, 0, 1, 0, 3,
    0, 11, 8, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 29, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 5, 1, 37, 8, 1, 10, 1, 12, 1, 40, 9, 1, 1, 2, 1, 2, 1, 2, 0, 1, 2,
    3, 0, 2, 4, 0, 1, 1, 0, 6, 11, 48, 0, 10, 1, 0, 0, 0, 2, 28, 1, 0, 0, 0, 4,
    41, 1, 0, 0, 0, 6, 7, 3, 2, 1, 0, 7, 8, 5, 0, 0, 1, 8, 11, 1, 0, 0, 0, 9,
    11, 5, 0, 0, 1, 10, 6, 1, 0, 0, 0, 10, 9, 1, 0, 0, 0, 11, 1, 1, 0, 0, 0, 12,
    13, 6, 1, -1, 0, 13, 14, 5, 3, 0, 0, 14, 29, 3, 2, 1, 6, 15, 16, 5, 4, 0, 0,
    16, 17, 3, 2, 1, 0, 17, 18, 5, 5, 0, 0, 18, 29, 1, 0, 0, 0, 19, 20, 5, 13,
    0, 0, 20, 21, 5, 6, 0, 0, 21, 29, 5, 12, 0, 0, 22, 23, 5, 13, 0, 0, 23, 24,
    3, 4, 2, 0, 24, 25, 5, 14, 0, 0, 25, 29, 1, 0, 0, 0, 26, 29, 5, 13, 0, 0,
    27, 29, 5, 12, 0, 0, 28, 12, 1, 0, 0, 0, 28, 15, 1, 0, 0, 0, 28, 19, 1, 0,
    0, 0, 28, 22, 1, 0, 0, 0, 28, 26, 1, 0, 0, 0, 28, 27, 1, 0, 0, 0, 29, 38, 1,
    0, 0, 0, 30, 31, 10, 8, 0, 0, 31, 32, 5, 1, 0, 0, 32, 37, 3, 2, 1, 9, 33,
    34, 10, 7, 0, 0, 34, 35, 5, 2, 0, 0, 35, 37, 3, 2, 1, 8, 36, 30, 1, 0, 0, 0,
    36, 33, 1, 0, 0, 0, 37, 40, 1, 0, 0, 0, 38, 36, 1, 0, 0, 0, 38, 39, 1, 0, 0,
    0, 39, 3, 1, 0, 0, 0, 40, 38, 1, 0, 0, 0, 41, 42, 7, 0, 0, 0, 42, 5, 1, 0,
    0, 0, 4, 10, 28, 36, 38,
  ];

  private static __ATN: ATN;
  public static get _ATN(): ATN {
    if (!AssertionRegexParser.__ATN) {
      AssertionRegexParser.__ATN = new ATNDeserializer().deserialize(
        AssertionRegexParser._serializedATN,
      );
    }

    return AssertionRegexParser.__ATN;
  }

  static DecisionsToDFA = AssertionRegexParser._ATN.decisionToState.map(
    (ds: DecisionState, index: number) => new DFA(ds, index),
  );
}

export class AssertionContext extends ParserRuleContext {
  constructor(
    parser?: AssertionRegexParser,
    parent?: ParserRuleContext,
    invokingState?: number,
  ) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public get ruleIndex(): number {
    return AssertionRegexParser.RULE_assertion;
  }
  public override copyFrom(ctx: AssertionContext): void {
    super.copyFrom(ctx);
  }
}
export class BlankContext extends AssertionContext {
  constructor(parser: AssertionRegexParser, ctx: AssertionContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public EOF(): TerminalNode {
    return this.getToken(AssertionRegexParser.EOF, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterBlank) {
      listener.enterBlank(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitBlank) {
      listener.exitBlank(this);
    }
  }
}
export class PrintExprContext extends AssertionContext {
  constructor(parser: AssertionRegexParser, ctx: AssertionContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public expr(): ExprContext {
    return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
  }
  public EOF(): TerminalNode {
    return this.getToken(AssertionRegexParser.EOF, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterPrintExpr) {
      listener.enterPrintExpr(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitPrintExpr) {
      listener.exitPrintExpr(this);
    }
  }
}

export class ExprContext extends ParserRuleContext {
  constructor(
    parser?: AssertionRegexParser,
    parent?: ParserRuleContext,
    invokingState?: number,
  ) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public get ruleIndex(): number {
    return AssertionRegexParser.RULE_expr;
  }
  public override copyFrom(ctx: ExprContext): void {
    super.copyFrom(ctx);
  }
}
export class IdentifierContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public ID(): TerminalNode {
    return this.getToken(AssertionRegexParser.ID, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterIdentifier) {
      listener.enterIdentifier(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitIdentifier) {
      listener.exitIdentifier(this);
    }
  }
}
export class NotExprContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public expr(): ExprContext {
    return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterNotExpr) {
      listener.enterNotExpr(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitNotExpr) {
      listener.exitNotExpr(this);
    }
  }
}
export class BooleanContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public BOOLEAN(): TerminalNode {
    return this.getToken(AssertionRegexParser.BOOLEAN, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterBoolean) {
      listener.enterBoolean(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitBoolean) {
      listener.exitBoolean(this);
    }
  }
}
export class AssignmentContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public ID(): TerminalNode {
    return this.getToken(AssertionRegexParser.ID, 0);
  }
  public BOOLEAN(): TerminalNode {
    return this.getToken(AssertionRegexParser.BOOLEAN, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterAssignment) {
      listener.enterAssignment(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitAssignment) {
      listener.exitAssignment(this);
    }
  }
}
export class IntComparisonContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public ID(): TerminalNode {
    return this.getToken(AssertionRegexParser.ID, 0);
  }
  public comparator(): ComparatorContext {
    return this.getTypedRuleContext(ComparatorContext, 0) as ComparatorContext;
  }
  public INT(): TerminalNode {
    return this.getToken(AssertionRegexParser.INT, 0);
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterIntComparison) {
      listener.enterIntComparison(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitIntComparison) {
      listener.exitIntComparison(this);
    }
  }
}
export class OrExprContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public expr_list(): ExprContext[] {
    return this.getTypedRuleContexts(ExprContext) as ExprContext[];
  }
  public expr(i: number): ExprContext {
    return this.getTypedRuleContext(ExprContext, i) as ExprContext;
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterOrExpr) {
      listener.enterOrExpr(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitOrExpr) {
      listener.exitOrExpr(this);
    }
  }
}
export class ParenExprContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public expr(): ExprContext {
    return this.getTypedRuleContext(ExprContext, 0) as ExprContext;
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterParenExpr) {
      listener.enterParenExpr(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitParenExpr) {
      listener.exitParenExpr(this);
    }
  }
}
export class AndExprContext extends ExprContext {
  constructor(parser: AssertionRegexParser, ctx: ExprContext) {
    super(parser, ctx.parentCtx, ctx.invokingState);
    super.copyFrom(ctx);
  }
  public expr_list(): ExprContext[] {
    return this.getTypedRuleContexts(ExprContext) as ExprContext[];
  }
  public expr(i: number): ExprContext {
    return this.getTypedRuleContext(ExprContext, i) as ExprContext;
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterAndExpr) {
      listener.enterAndExpr(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitAndExpr) {
      listener.exitAndExpr(this);
    }
  }
}

export class ComparatorContext extends ParserRuleContext {
  constructor(
    parser?: AssertionRegexParser,
    parent?: ParserRuleContext,
    invokingState?: number,
  ) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public get ruleIndex(): number {
    return AssertionRegexParser.RULE_comparator;
  }
  public enterRule(listener: AssertionRegexListener): void {
    if (listener.enterComparator) {
      listener.enterComparator(this);
    }
  }
  public exitRule(listener: AssertionRegexListener): void {
    if (listener.exitComparator) {
      listener.exitComparator(this);
    }
  }
}
