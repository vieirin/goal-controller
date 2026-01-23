"use strict";
// Generated from grammar/RTRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordContext = exports.IdContext = exports.GIdContinuedContext = exports.GSequenceContext = exports.GRetryContext = exports.NotationStartContext = exports.GSkipContext = exports.GDegradationContext = exports.GAlternativeContext = exports.NameContinuedContext = exports.GArgsContext = exports.GChoiceContext = exports.GInterleavedContext = exports.NameOnlyContext = exports.GIdContext = exports.ExprContext = exports.PrintExprContext = exports.BlankContext = exports.RtContext = void 0;
const antlr4_1 = require("antlr4");
class RTRegexParser extends antlr4_1.Parser {
    static T__0 = 1;
    static T__1 = 2;
    static T__2 = 3;
    static T__3 = 4;
    static T__4 = 5;
    static T__5 = 6;
    static T__6 = 7;
    static T__7 = 8;
    static T__8 = 9;
    static DIGIT_SUBID = 10;
    static FLOAT = 11;
    static SEQ = 12;
    static INT = 13;
    static TASK = 14;
    static GOAL = 15;
    static SKIPP = 16;
    static X = 17;
    static NEWLINE = 18;
    static WORD = 19;
    static SUBID = 20;
    static WS = 21;
    static EOF = antlr4_1.Token.EOF;
    static RULE_rt = 0;
    static RULE_expr = 1;
    static RULE_id = 2;
    static RULE_word = 3;
    static literalNames = [null, "'R'",
        "','", "'['",
        "']'", "':'",
        "'@'", "'|'",
        "'->'", "'+'",
        null, null,
        "';'", "'#'",
        "'T'", "'G'",
        "'skip'", "'X'"];
    static symbolicNames = [null, null,
        null, null,
        null, null,
        null, null,
        null, null,
        "DIGIT_SUBID",
        "FLOAT", "SEQ",
        "INT", "TASK",
        "GOAL", "SKIPP",
        "X", "NEWLINE",
        "WORD", "SUBID",
        "WS"];
    // tslint:disable:no-trailing-whitespace
    static ruleNames = [
        "rt", "expr", "id", "word",
    ];
    get grammarFileName() { return "RTRegex.g4"; }
    get literalNames() { return RTRegexParser.literalNames; }
    get symbolicNames() { return RTRegexParser.symbolicNames; }
    get ruleNames() { return RTRegexParser.ruleNames; }
    get serializedATN() { return RTRegexParser._serializedATN; }
    createFailedPredicateException(predicate, message) {
        return new antlr4_1.FailedPredicateException(this, predicate, message);
    }
    constructor(input) {
        super(input);
        this._interp = new antlr4_1.ParserATNSimulator(this, RTRegexParser._ATN, RTRegexParser.DecisionsToDFA, new antlr4_1.PredictionContextCache());
    }
    // @RuleVersion(0)
    rt() {
        let localctx = new RtContext(this, this._ctx, this.state);
        this.enterRule(localctx, 0, RTRegexParser.RULE_rt);
        try {
            this.state = 12;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case 1:
                case 3:
                case 5:
                case 9:
                case 14:
                case 15:
                case 16:
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
                    throw new antlr4_1.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr4_1.RecognitionException) {
                localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localctx;
    }
    // @RuleVersion(0)
    expr(_p) {
        if (_p === undefined) {
            _p = 0;
        }
        let _parentctx = this._ctx;
        let _parentState = this.state;
        let localctx = new ExprContext(this, this._ctx, _parentState);
        let _prevctx = localctx;
        let _startState = 2;
        this.enterRecursionRule(localctx, 2, RTRegexParser.RULE_expr, _p);
        let _la;
        try {
            let _alt;
            this.enterOuterAlt(localctx, 1);
            {
                this.state = 40;
                this._errHandler.sync(this);
                switch (this._interp.adaptivePredict(this._input, 1, this._ctx)) {
                    case 1:
                        {
                            localctx = new GIdContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 15;
                            localctx._t = this._input.LT(1);
                            _la = this._input.LA(1);
                            if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & 49154) !== 0))) {
                                localctx._t = this._errHandler.recoverInline(this);
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
                            localctx._t = this._input.LT(1);
                            _la = this._input.LA(1);
                            if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & 49154) !== 0))) {
                                localctx._t = this._errHandler.recoverInline(this);
                            }
                            else {
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 18;
                            this.id();
                            this.state = 19;
                            this.expr(12);
                        }
                        break;
                    case 3:
                        {
                            localctx = new GArgsContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 21;
                            localctx._t = this._input.LT(1);
                            _la = this._input.LA(1);
                            if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & 49154) !== 0))) {
                                localctx._t = this._errHandler.recoverInline(this);
                            }
                            else {
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 22;
                            this.id();
                            this.state = 23;
                            this.match(RTRegexParser.T__1);
                            this.state = 24;
                            this.expr(11);
                        }
                        break;
                    case 4:
                        {
                            localctx = new NotationStartContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 26;
                            this.match(RTRegexParser.T__2);
                            this.state = 27;
                            this.expr(0);
                            this.state = 28;
                            this.match(RTRegexParser.T__3);
                        }
                        break;
                    case 5:
                        {
                            localctx = new NameContinuedContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 30;
                            this.match(RTRegexParser.T__4);
                            this.state = 31;
                            this.word();
                            this.state = 32;
                            this.expr(9);
                        }
                        break;
                    case 6:
                        {
                            localctx = new NameOnlyContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 34;
                            this.match(RTRegexParser.T__4);
                            this.state = 35;
                            this.word();
                            this.state = 36;
                            this.match(RTRegexParser.EOF);
                        }
                        break;
                    case 7:
                        {
                            localctx = new GChoiceContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 38;
                            localctx._op = this.match(RTRegexParser.T__8);
                        }
                        break;
                    case 8:
                        {
                            localctx = new GSkipContext(this, localctx);
                            this._ctx = localctx;
                            _prevctx = localctx;
                            this.state = 39;
                            this.match(RTRegexParser.SKIPP);
                        }
                        break;
                }
                this._ctx.stop = this._input.LT(-1);
                this.state = 59;
                this._errHandler.sync(this);
                _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
                while (_alt !== 2 && _alt !== antlr4_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        if (this._parseListeners != null) {
                            this.triggerExitRuleEvent();
                        }
                        _prevctx = localctx;
                        {
                            this.state = 57;
                            this._errHandler.sync(this);
                            switch (this._interp.adaptivePredict(this._input, 2, this._ctx)) {
                                case 1:
                                    {
                                        localctx = new GAlternativeContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
                                        this.state = 42;
                                        if (!(this.precpred(this._ctx, 6))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 6)");
                                        }
                                        this.state = 43;
                                        localctx._op = this.match(RTRegexParser.T__6);
                                        this.state = 44;
                                        this.expr(7);
                                    }
                                    break;
                                case 2:
                                    {
                                        localctx = new GInterleavedContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
                                        this.state = 45;
                                        if (!(this.precpred(this._ctx, 5))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
                                        }
                                        this.state = 46;
                                        localctx._op = this.match(RTRegexParser.INT);
                                        this.state = 47;
                                        this.expr(6);
                                    }
                                    break;
                                case 3:
                                    {
                                        localctx = new GSequenceContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
                                        this.state = 48;
                                        if (!(this.precpred(this._ctx, 4))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
                                        }
                                        this.state = 49;
                                        localctx._op = this.match(RTRegexParser.SEQ);
                                        this.state = 50;
                                        this.expr(5);
                                    }
                                    break;
                                case 4:
                                    {
                                        localctx = new GDegradationContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
                                        this.state = 51;
                                        if (!(this.precpred(this._ctx, 3))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 3)");
                                        }
                                        this.state = 52;
                                        localctx._op = this.match(RTRegexParser.T__7);
                                        this.state = 53;
                                        this.expr(4);
                                    }
                                    break;
                                case 5:
                                    {
                                        localctx = new GRetryContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, RTRegexParser.RULE_expr);
                                        this.state = 54;
                                        if (!(this.precpred(this._ctx, 7))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 7)");
                                        }
                                        this.state = 55;
                                        localctx._op = this.match(RTRegexParser.T__5);
                                        this.state = 56;
                                        this.match(RTRegexParser.FLOAT);
                                    }
                                    break;
                            }
                        }
                    }
                    this.state = 61;
                    this._errHandler.sync(this);
                    _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
                }
            }
        }
        catch (re) {
            if (re instanceof antlr4_1.RecognitionException) {
                localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(_parentctx);
        }
        return localctx;
    }
    // @RuleVersion(0)
    id() {
        let localctx = new IdContext(this, this._ctx, this.state);
        this.enterRule(localctx, 4, RTRegexParser.RULE_id);
        try {
            this.state = 67;
            this._errHandler.sync(this);
            switch (this._interp.adaptivePredict(this._input, 4, this._ctx)) {
                case 1:
                    this.enterOuterAlt(localctx, 1);
                    {
                        this.state = 62;
                        this.match(RTRegexParser.FLOAT);
                    }
                    break;
                case 2:
                    this.enterOuterAlt(localctx, 2);
                    {
                        this.state = 63;
                        this.match(RTRegexParser.FLOAT);
                        this.state = 64;
                        this.match(RTRegexParser.X);
                    }
                    break;
                case 3:
                    this.enterOuterAlt(localctx, 3);
                    {
                        this.state = 65;
                        this.match(RTRegexParser.X);
                    }
                    break;
                case 4:
                    this.enterOuterAlt(localctx, 4);
                    {
                        this.state = 66;
                        this.match(RTRegexParser.DIGIT_SUBID);
                    }
                    break;
            }
        }
        catch (re) {
            if (re instanceof antlr4_1.RecognitionException) {
                localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localctx;
    }
    // @RuleVersion(0)
    word() {
        let localctx = new WordContext(this, this._ctx, this.state);
        this.enterRule(localctx, 6, RTRegexParser.RULE_word);
        try {
            this.enterOuterAlt(localctx, 1);
            {
                this.state = 69;
                this.match(RTRegexParser.WORD);
            }
        }
        catch (re) {
            if (re instanceof antlr4_1.RecognitionException) {
                localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localctx;
    }
    sempred(localctx, ruleIndex, predIndex) {
        switch (ruleIndex) {
            case 1:
                return this.expr_sempred(localctx, predIndex);
        }
        return true;
    }
    expr_sempred(localctx, predIndex) {
        switch (predIndex) {
            case 0:
                return this.precpred(this._ctx, 6);
            case 1:
                return this.precpred(this._ctx, 5);
            case 2:
                return this.precpred(this._ctx, 4);
            case 3:
                return this.precpred(this._ctx, 3);
            case 4:
                return this.precpred(this._ctx, 7);
        }
        return true;
    }
    static _serializedATN = [4, 1, 21, 72, 2, 0, 7, 0, 2,
        1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 1, 0, 1, 0, 1, 0, 1, 0, 3, 0, 13, 8, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 3, 1, 41, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 5, 1, 58, 8, 1, 10, 1, 12, 1, 61, 9, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 3, 2, 68, 8, 2, 1,
        3, 1, 3, 1, 3, 0, 1, 2, 4, 0, 2, 4, 6, 0, 1, 2, 0, 1, 1, 14, 15, 83, 0, 12, 1, 0, 0, 0, 2, 40, 1, 0, 0,
        0, 4, 67, 1, 0, 0, 0, 6, 69, 1, 0, 0, 0, 8, 9, 3, 2, 1, 0, 9, 10, 5, 0, 0, 1, 10, 13, 1, 0, 0, 0, 11, 13,
        5, 0, 0, 1, 12, 8, 1, 0, 0, 0, 12, 11, 1, 0, 0, 0, 13, 1, 1, 0, 0, 0, 14, 15, 6, 1, -1, 0, 15, 16, 7,
        0, 0, 0, 16, 41, 3, 4, 2, 0, 17, 18, 7, 0, 0, 0, 18, 19, 3, 4, 2, 0, 19, 20, 3, 2, 1, 12, 20, 41, 1,
        0, 0, 0, 21, 22, 7, 0, 0, 0, 22, 23, 3, 4, 2, 0, 23, 24, 5, 2, 0, 0, 24, 25, 3, 2, 1, 11, 25, 41, 1,
        0, 0, 0, 26, 27, 5, 3, 0, 0, 27, 28, 3, 2, 1, 0, 28, 29, 5, 4, 0, 0, 29, 41, 1, 0, 0, 0, 30, 31, 5, 5,
        0, 0, 31, 32, 3, 6, 3, 0, 32, 33, 3, 2, 1, 9, 33, 41, 1, 0, 0, 0, 34, 35, 5, 5, 0, 0, 35, 36, 3, 6, 3,
        0, 36, 37, 5, 0, 0, 1, 37, 41, 1, 0, 0, 0, 38, 41, 5, 9, 0, 0, 39, 41, 5, 16, 0, 0, 40, 14, 1, 0, 0,
        0, 40, 17, 1, 0, 0, 0, 40, 21, 1, 0, 0, 0, 40, 26, 1, 0, 0, 0, 40, 30, 1, 0, 0, 0, 40, 34, 1, 0, 0, 0,
        40, 38, 1, 0, 0, 0, 40, 39, 1, 0, 0, 0, 41, 59, 1, 0, 0, 0, 42, 43, 10, 6, 0, 0, 43, 44, 5, 7, 0, 0,
        44, 58, 3, 2, 1, 7, 45, 46, 10, 5, 0, 0, 46, 47, 5, 13, 0, 0, 47, 58, 3, 2, 1, 6, 48, 49, 10, 4, 0,
        0, 49, 50, 5, 12, 0, 0, 50, 58, 3, 2, 1, 5, 51, 52, 10, 3, 0, 0, 52, 53, 5, 8, 0, 0, 53, 58, 3, 2, 1,
        4, 54, 55, 10, 7, 0, 0, 55, 56, 5, 6, 0, 0, 56, 58, 5, 11, 0, 0, 57, 42, 1, 0, 0, 0, 57, 45, 1, 0, 0,
        0, 57, 48, 1, 0, 0, 0, 57, 51, 1, 0, 0, 0, 57, 54, 1, 0, 0, 0, 58, 61, 1, 0, 0, 0, 59, 57, 1, 0, 0, 0,
        59, 60, 1, 0, 0, 0, 60, 3, 1, 0, 0, 0, 61, 59, 1, 0, 0, 0, 62, 68, 5, 11, 0, 0, 63, 64, 5, 11, 0, 0,
        64, 68, 5, 17, 0, 0, 65, 68, 5, 17, 0, 0, 66, 68, 5, 10, 0, 0, 67, 62, 1, 0, 0, 0, 67, 63, 1, 0, 0,
        0, 67, 65, 1, 0, 0, 0, 67, 66, 1, 0, 0, 0, 68, 5, 1, 0, 0, 0, 69, 70, 5, 19, 0, 0, 70, 7, 1, 0, 0, 0,
        5, 12, 40, 57, 59, 67];
    static __ATN;
    static get _ATN() {
        if (!RTRegexParser.__ATN) {
            RTRegexParser.__ATN = new antlr4_1.ATNDeserializer().deserialize(RTRegexParser._serializedATN);
        }
        return RTRegexParser.__ATN;
    }
    static DecisionsToDFA = RTRegexParser._ATN.decisionToState.map((ds, index) => new antlr4_1.DFA(ds, index));
}
exports.default = RTRegexParser;
class RtContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    get ruleIndex() {
        return RTRegexParser.RULE_rt;
    }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.RtContext = RtContext;
class BlankContext extends RtContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    EOF() {
        return this.getToken(RTRegexParser.EOF, 0);
    }
    enterRule(listener) {
        if (listener.enterBlank) {
            listener.enterBlank(this);
        }
    }
    exitRule(listener) {
        if (listener.exitBlank) {
            listener.exitBlank(this);
        }
    }
}
exports.BlankContext = BlankContext;
class PrintExprContext extends RtContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    EOF() {
        return this.getToken(RTRegexParser.EOF, 0);
    }
    enterRule(listener) {
        if (listener.enterPrintExpr) {
            listener.enterPrintExpr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitPrintExpr) {
            listener.exitPrintExpr(this);
        }
    }
}
exports.PrintExprContext = PrintExprContext;
class ExprContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    get ruleIndex() {
        return RTRegexParser.RULE_expr;
    }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.ExprContext = ExprContext;
class GIdContext extends ExprContext {
    _t;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    id() {
        return this.getTypedRuleContext(IdContext, 0);
    }
    GOAL() {
        return this.getToken(RTRegexParser.GOAL, 0);
    }
    TASK() {
        return this.getToken(RTRegexParser.TASK, 0);
    }
    enterRule(listener) {
        if (listener.enterGId) {
            listener.enterGId(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGId) {
            listener.exitGId(this);
        }
    }
}
exports.GIdContext = GIdContext;
class NameOnlyContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    word() {
        return this.getTypedRuleContext(WordContext, 0);
    }
    EOF() {
        return this.getToken(RTRegexParser.EOF, 0);
    }
    enterRule(listener) {
        if (listener.enterNameOnly) {
            listener.enterNameOnly(this);
        }
    }
    exitRule(listener) {
        if (listener.exitNameOnly) {
            listener.exitNameOnly(this);
        }
    }
}
exports.NameOnlyContext = NameOnlyContext;
class GInterleavedContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr_list() {
        return this.getTypedRuleContexts(ExprContext);
    }
    expr(i) {
        return this.getTypedRuleContext(ExprContext, i);
    }
    INT() {
        return this.getToken(RTRegexParser.INT, 0);
    }
    enterRule(listener) {
        if (listener.enterGInterleaved) {
            listener.enterGInterleaved(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGInterleaved) {
            listener.exitGInterleaved(this);
        }
    }
}
exports.GInterleavedContext = GInterleavedContext;
class GChoiceContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    enterRule(listener) {
        if (listener.enterGChoice) {
            listener.enterGChoice(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGChoice) {
            listener.exitGChoice(this);
        }
    }
}
exports.GChoiceContext = GChoiceContext;
class GArgsContext extends ExprContext {
    _t;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    id() {
        return this.getTypedRuleContext(IdContext, 0);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    GOAL() {
        return this.getToken(RTRegexParser.GOAL, 0);
    }
    TASK() {
        return this.getToken(RTRegexParser.TASK, 0);
    }
    enterRule(listener) {
        if (listener.enterGArgs) {
            listener.enterGArgs(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGArgs) {
            listener.exitGArgs(this);
        }
    }
}
exports.GArgsContext = GArgsContext;
class NameContinuedContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    word() {
        return this.getTypedRuleContext(WordContext, 0);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    enterRule(listener) {
        if (listener.enterNameContinued) {
            listener.enterNameContinued(this);
        }
    }
    exitRule(listener) {
        if (listener.exitNameContinued) {
            listener.exitNameContinued(this);
        }
    }
}
exports.NameContinuedContext = NameContinuedContext;
class GAlternativeContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr_list() {
        return this.getTypedRuleContexts(ExprContext);
    }
    expr(i) {
        return this.getTypedRuleContext(ExprContext, i);
    }
    enterRule(listener) {
        if (listener.enterGAlternative) {
            listener.enterGAlternative(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGAlternative) {
            listener.exitGAlternative(this);
        }
    }
}
exports.GAlternativeContext = GAlternativeContext;
class GDegradationContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr_list() {
        return this.getTypedRuleContexts(ExprContext);
    }
    expr(i) {
        return this.getTypedRuleContext(ExprContext, i);
    }
    enterRule(listener) {
        if (listener.enterGDegradation) {
            listener.enterGDegradation(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGDegradation) {
            listener.exitGDegradation(this);
        }
    }
}
exports.GDegradationContext = GDegradationContext;
class GSkipContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    SKIPP() {
        return this.getToken(RTRegexParser.SKIPP, 0);
    }
    enterRule(listener) {
        if (listener.enterGSkip) {
            listener.enterGSkip(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGSkip) {
            listener.exitGSkip(this);
        }
    }
}
exports.GSkipContext = GSkipContext;
class NotationStartContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    enterRule(listener) {
        if (listener.enterNotationStart) {
            listener.enterNotationStart(this);
        }
    }
    exitRule(listener) {
        if (listener.exitNotationStart) {
            listener.exitNotationStart(this);
        }
    }
}
exports.NotationStartContext = NotationStartContext;
class GRetryContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    FLOAT() {
        return this.getToken(RTRegexParser.FLOAT, 0);
    }
    enterRule(listener) {
        if (listener.enterGRetry) {
            listener.enterGRetry(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGRetry) {
            listener.exitGRetry(this);
        }
    }
}
exports.GRetryContext = GRetryContext;
class GSequenceContext extends ExprContext {
    _op;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr_list() {
        return this.getTypedRuleContexts(ExprContext);
    }
    expr(i) {
        return this.getTypedRuleContext(ExprContext, i);
    }
    SEQ() {
        return this.getToken(RTRegexParser.SEQ, 0);
    }
    enterRule(listener) {
        if (listener.enterGSequence) {
            listener.enterGSequence(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGSequence) {
            listener.exitGSequence(this);
        }
    }
}
exports.GSequenceContext = GSequenceContext;
class GIdContinuedContext extends ExprContext {
    _t;
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    id() {
        return this.getTypedRuleContext(IdContext, 0);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    GOAL() {
        return this.getToken(RTRegexParser.GOAL, 0);
    }
    TASK() {
        return this.getToken(RTRegexParser.TASK, 0);
    }
    enterRule(listener) {
        if (listener.enterGIdContinued) {
            listener.enterGIdContinued(this);
        }
    }
    exitRule(listener) {
        if (listener.exitGIdContinued) {
            listener.exitGIdContinued(this);
        }
    }
}
exports.GIdContinuedContext = GIdContinuedContext;
class IdContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    FLOAT() {
        return this.getToken(RTRegexParser.FLOAT, 0);
    }
    X() {
        return this.getToken(RTRegexParser.X, 0);
    }
    DIGIT_SUBID() {
        return this.getToken(RTRegexParser.DIGIT_SUBID, 0);
    }
    get ruleIndex() {
        return RTRegexParser.RULE_id;
    }
    enterRule(listener) {
        if (listener.enterId) {
            listener.enterId(this);
        }
    }
    exitRule(listener) {
        if (listener.exitId) {
            listener.exitId(this);
        }
    }
}
exports.IdContext = IdContext;
class WordContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    WORD() {
        return this.getToken(RTRegexParser.WORD, 0);
    }
    get ruleIndex() {
        return RTRegexParser.RULE_word;
    }
    enterRule(listener) {
        if (listener.enterWord) {
            listener.enterWord(this);
        }
    }
    exitRule(listener) {
        if (listener.exitWord) {
            listener.exitWord(this);
        }
    }
}
exports.WordContext = WordContext;
//# sourceMappingURL=RTRegexParser.js.map