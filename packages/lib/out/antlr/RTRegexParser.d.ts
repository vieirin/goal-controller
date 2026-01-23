import { ATN, DFA, FailedPredicateException, Parser, RuleContext, ParserRuleContext, TerminalNode, Token, TokenStream } from 'antlr4';
import RTRegexListener from "./RTRegexListener.js";
export default class RTRegexParser extends Parser {
    static readonly T__0 = 1;
    static readonly T__1 = 2;
    static readonly T__2 = 3;
    static readonly T__3 = 4;
    static readonly T__4 = 5;
    static readonly T__5 = 6;
    static readonly T__6 = 7;
    static readonly T__7 = 8;
    static readonly T__8 = 9;
    static readonly DIGIT_SUBID = 10;
    static readonly FLOAT = 11;
    static readonly SEQ = 12;
    static readonly INT = 13;
    static readonly TASK = 14;
    static readonly GOAL = 15;
    static readonly SKIPP = 16;
    static readonly X = 17;
    static readonly NEWLINE = 18;
    static readonly WORD = 19;
    static readonly SUBID = 20;
    static readonly WS = 21;
    static readonly EOF: number;
    static readonly RULE_rt = 0;
    static readonly RULE_expr = 1;
    static readonly RULE_id = 2;
    static readonly RULE_word = 3;
    static readonly literalNames: (string | null)[];
    static readonly symbolicNames: (string | null)[];
    static readonly ruleNames: string[];
    get grammarFileName(): string;
    get literalNames(): (string | null)[];
    get symbolicNames(): (string | null)[];
    get ruleNames(): string[];
    get serializedATN(): number[];
    protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException;
    constructor(input: TokenStream);
    rt(): RtContext;
    expr(): ExprContext;
    expr(_p: number): ExprContext;
    id(): IdContext;
    word(): WordContext;
    sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean;
    private expr_sempred;
    static readonly _serializedATN: number[];
    private static __ATN;
    static get _ATN(): ATN;
    static DecisionsToDFA: DFA[];
}
export declare class RtContext extends ParserRuleContext {
    constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number);
    get ruleIndex(): number;
    copyFrom(ctx: RtContext): void;
}
export declare class BlankContext extends RtContext {
    constructor(parser: RTRegexParser, ctx: RtContext);
    EOF(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class PrintExprContext extends RtContext {
    constructor(parser: RTRegexParser, ctx: RtContext);
    expr(): ExprContext;
    EOF(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class ExprContext extends ParserRuleContext {
    constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number);
    get ruleIndex(): number;
    copyFrom(ctx: ExprContext): void;
}
export declare class GIdContext extends ExprContext {
    _t: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    id(): IdContext;
    GOAL(): TerminalNode;
    TASK(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class NameOnlyContext extends ExprContext {
    constructor(parser: RTRegexParser, ctx: ExprContext);
    word(): WordContext;
    EOF(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GInterleavedContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    INT(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GChoiceContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GArgsContext extends ExprContext {
    _t: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    id(): IdContext;
    expr(): ExprContext;
    GOAL(): TerminalNode;
    TASK(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class NameContinuedContext extends ExprContext {
    constructor(parser: RTRegexParser, ctx: ExprContext);
    word(): WordContext;
    expr(): ExprContext;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GAlternativeContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GDegradationContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GSkipContext extends ExprContext {
    constructor(parser: RTRegexParser, ctx: ExprContext);
    SKIPP(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class NotationStartContext extends ExprContext {
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr(): ExprContext;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GRetryContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr(): ExprContext;
    FLOAT(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GSequenceContext extends ExprContext {
    _op: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    SEQ(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class GIdContinuedContext extends ExprContext {
    _t: Token;
    constructor(parser: RTRegexParser, ctx: ExprContext);
    id(): IdContext;
    expr(): ExprContext;
    GOAL(): TerminalNode;
    TASK(): TerminalNode;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class IdContext extends ParserRuleContext {
    constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number);
    FLOAT(): TerminalNode;
    X(): TerminalNode;
    DIGIT_SUBID(): TerminalNode;
    get ruleIndex(): number;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
export declare class WordContext extends ParserRuleContext {
    constructor(parser?: RTRegexParser, parent?: ParserRuleContext, invokingState?: number);
    WORD(): TerminalNode;
    get ruleIndex(): number;
    enterRule(listener: RTRegexListener): void;
    exitRule(listener: RTRegexListener): void;
}
//# sourceMappingURL=RTRegexParser.d.ts.map