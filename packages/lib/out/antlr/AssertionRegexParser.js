"use strict";
// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparatorContext = exports.AndExprContext = exports.ParenExprContext = exports.OrExprContext = exports.IntComparisonContext = exports.AssignmentContext = exports.BooleanContext = exports.NotExprContext = exports.IdentifierContext = exports.ExprContext = exports.PrintExprContext = exports.BlankContext = exports.AssertionContext = void 0;
const antlr4_1 = require("antlr4");
class AssertionRegexParser extends antlr4_1.Parser {
    static T__0 = 1;
    static T__1 = 2;
    static T__2 = 3;
    static T__3 = 4;
    static T__4 = 5;
    static T__5 = 6;
    static T__6 = 7;
    static T__7 = 8;
    static T__8 = 9;
    static T__9 = 10;
    static T__10 = 11;
    static BOOLEAN = 12;
    static ID = 13;
    static INT = 14;
    static WS = 15;
    static EOF = antlr4_1.Token.EOF;
    static RULE_assertion = 0;
    static RULE_expr = 1;
    static RULE_comparator = 2;
    static literalNames = [
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
    static symbolicNames = [
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
    static ruleNames = [
        'assertion',
        'expr',
        'comparator',
    ];
    get grammarFileName() {
        return 'AssertionRegex.g4';
    }
    get literalNames() {
        return AssertionRegexParser.literalNames;
    }
    get symbolicNames() {
        return AssertionRegexParser.symbolicNames;
    }
    get ruleNames() {
        return AssertionRegexParser.ruleNames;
    }
    get serializedATN() {
        return AssertionRegexParser._serializedATN;
    }
    createFailedPredicateException(predicate, message) {
        return new antlr4_1.FailedPredicateException(this, predicate, message);
    }
    constructor(input) {
        super(input);
        this._interp = new antlr4_1.ParserATNSimulator(this, AssertionRegexParser._ATN, AssertionRegexParser.DecisionsToDFA, new antlr4_1.PredictionContextCache());
    }
    // @RuleVersion(0)
    assertion() {
        let localctx = new AssertionContext(this, this._ctx, this.state);
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
        this.enterRecursionRule(localctx, 2, AssertionRegexParser.RULE_expr, _p);
        try {
            let _alt;
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
                while (_alt !== 2 && _alt !== antlr4_1.ATN.INVALID_ALT_NUMBER) {
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
                                        localctx = new AndExprContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, AssertionRegexParser.RULE_expr);
                                        this.state = 30;
                                        if (!this.precpred(this._ctx, 8)) {
                                            throw this.createFailedPredicateException('this.precpred(this._ctx, 8)');
                                        }
                                        this.state = 31;
                                        this.match(AssertionRegexParser.T__0);
                                        this.state = 32;
                                        this.expr(9);
                                    }
                                    break;
                                case 2:
                                    {
                                        localctx = new OrExprContext(this, new ExprContext(this, _parentctx, _parentState));
                                        this.pushNewRecursionContext(localctx, _startState, AssertionRegexParser.RULE_expr);
                                        this.state = 33;
                                        if (!this.precpred(this._ctx, 7)) {
                                            throw this.createFailedPredicateException('this.precpred(this._ctx, 7)');
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
    comparator() {
        let localctx = new ComparatorContext(this, this._ctx, this.state);
        this.enterRule(localctx, 4, AssertionRegexParser.RULE_comparator);
        let _la;
        try {
            this.enterOuterAlt(localctx, 1);
            {
                this.state = 41;
                _la = this._input.LA(1);
                if (!((_la & ~0x1f) === 0 && ((1 << _la) & 4032) !== 0)) {
                    this._errHandler.recoverInline(this);
                }
                else {
                    this._errHandler.reportMatch(this);
                    this.consume();
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
                return this.precpred(this._ctx, 8);
            case 1:
                return this.precpred(this._ctx, 7);
        }
        return true;
    }
    static _serializedATN = [
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
    static __ATN;
    static get _ATN() {
        if (!AssertionRegexParser.__ATN) {
            AssertionRegexParser.__ATN = new antlr4_1.ATNDeserializer().deserialize(AssertionRegexParser._serializedATN);
        }
        return AssertionRegexParser.__ATN;
    }
    static DecisionsToDFA = AssertionRegexParser._ATN.decisionToState.map((ds, index) => new antlr4_1.DFA(ds, index));
}
exports.default = AssertionRegexParser;
class AssertionContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    get ruleIndex() {
        return AssertionRegexParser.RULE_assertion;
    }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.AssertionContext = AssertionContext;
class BlankContext extends AssertionContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    EOF() {
        return this.getToken(AssertionRegexParser.EOF, 0);
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
class PrintExprContext extends AssertionContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    EOF() {
        return this.getToken(AssertionRegexParser.EOF, 0);
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
        return AssertionRegexParser.RULE_expr;
    }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.ExprContext = ExprContext;
class IdentifierContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    ID() {
        return this.getToken(AssertionRegexParser.ID, 0);
    }
    enterRule(listener) {
        if (listener.enterIdentifier) {
            listener.enterIdentifier(this);
        }
    }
    exitRule(listener) {
        if (listener.exitIdentifier) {
            listener.exitIdentifier(this);
        }
    }
}
exports.IdentifierContext = IdentifierContext;
class NotExprContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    enterRule(listener) {
        if (listener.enterNotExpr) {
            listener.enterNotExpr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitNotExpr) {
            listener.exitNotExpr(this);
        }
    }
}
exports.NotExprContext = NotExprContext;
class BooleanContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    BOOLEAN() {
        return this.getToken(AssertionRegexParser.BOOLEAN, 0);
    }
    enterRule(listener) {
        if (listener.enterBoolean) {
            listener.enterBoolean(this);
        }
    }
    exitRule(listener) {
        if (listener.exitBoolean) {
            listener.exitBoolean(this);
        }
    }
}
exports.BooleanContext = BooleanContext;
class AssignmentContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    ID() {
        return this.getToken(AssertionRegexParser.ID, 0);
    }
    BOOLEAN() {
        return this.getToken(AssertionRegexParser.BOOLEAN, 0);
    }
    enterRule(listener) {
        if (listener.enterAssignment) {
            listener.enterAssignment(this);
        }
    }
    exitRule(listener) {
        if (listener.exitAssignment) {
            listener.exitAssignment(this);
        }
    }
}
exports.AssignmentContext = AssignmentContext;
class IntComparisonContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    ID() {
        return this.getToken(AssertionRegexParser.ID, 0);
    }
    comparator() {
        return this.getTypedRuleContext(ComparatorContext, 0);
    }
    INT() {
        return this.getToken(AssertionRegexParser.INT, 0);
    }
    enterRule(listener) {
        if (listener.enterIntComparison) {
            listener.enterIntComparison(this);
        }
    }
    exitRule(listener) {
        if (listener.exitIntComparison) {
            listener.exitIntComparison(this);
        }
    }
}
exports.IntComparisonContext = IntComparisonContext;
class OrExprContext extends ExprContext {
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
        if (listener.enterOrExpr) {
            listener.enterOrExpr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitOrExpr) {
            listener.exitOrExpr(this);
        }
    }
}
exports.OrExprContext = OrExprContext;
class ParenExprContext extends ExprContext {
    constructor(parser, ctx) {
        super(parser, ctx.parentCtx, ctx.invokingState);
        super.copyFrom(ctx);
    }
    expr() {
        return this.getTypedRuleContext(ExprContext, 0);
    }
    enterRule(listener) {
        if (listener.enterParenExpr) {
            listener.enterParenExpr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitParenExpr) {
            listener.exitParenExpr(this);
        }
    }
}
exports.ParenExprContext = ParenExprContext;
class AndExprContext extends ExprContext {
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
        if (listener.enterAndExpr) {
            listener.enterAndExpr(this);
        }
    }
    exitRule(listener) {
        if (listener.exitAndExpr) {
            listener.exitAndExpr(this);
        }
    }
}
exports.AndExprContext = AndExprContext;
class ComparatorContext extends antlr4_1.ParserRuleContext {
    constructor(parser, parent, invokingState) {
        super(parent, invokingState);
        this.parser = parser;
    }
    get ruleIndex() {
        return AssertionRegexParser.RULE_comparator;
    }
    enterRule(listener) {
        if (listener.enterComparator) {
            listener.enterComparator(this);
        }
    }
    exitRule(listener) {
        if (listener.exitComparator) {
            listener.exitComparator(this);
        }
    }
}
exports.ComparatorContext = ComparatorContext;
//# sourceMappingURL=AssertionRegexParser.js.map