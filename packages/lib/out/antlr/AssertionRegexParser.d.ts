import { ATN, DFA, FailedPredicateException, Parser, RuleContext, ParserRuleContext, TerminalNode, TokenStream } from 'antlr4';
import AssertionRegexListener from './AssertionRegexListener.js';
export default class AssertionRegexParser extends Parser {
    static readonly T__0 = 1;
    static readonly T__1 = 2;
    static readonly T__2 = 3;
    static readonly T__3 = 4;
    static readonly T__4 = 5;
    static readonly T__5 = 6;
    static readonly T__6 = 7;
    static readonly T__7 = 8;
    static readonly T__8 = 9;
    static readonly T__9 = 10;
    static readonly T__10 = 11;
    static readonly BOOLEAN = 12;
    static readonly ID = 13;
    static readonly INT = 14;
    static readonly WS = 15;
    static readonly EOF: number;
    static readonly RULE_assertion = 0;
    static readonly RULE_expr = 1;
    static readonly RULE_comparator = 2;
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
    assertion(): AssertionContext;
    expr(): ExprContext;
    expr(_p: number): ExprContext;
    comparator(): ComparatorContext;
    sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean;
    private expr_sempred;
    static readonly _serializedATN: number[];
    private static __ATN;
    static get _ATN(): ATN;
    static DecisionsToDFA: DFA[];
}
export declare class AssertionContext extends ParserRuleContext {
    constructor(parser?: AssertionRegexParser, parent?: ParserRuleContext, invokingState?: number);
    get ruleIndex(): number;
    copyFrom(ctx: AssertionContext): void;
}
export declare class BlankContext extends AssertionContext {
    constructor(parser: AssertionRegexParser, ctx: AssertionContext);
    EOF(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class PrintExprContext extends AssertionContext {
    constructor(parser: AssertionRegexParser, ctx: AssertionContext);
    expr(): ExprContext;
    EOF(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class ExprContext extends ParserRuleContext {
    constructor(parser?: AssertionRegexParser, parent?: ParserRuleContext, invokingState?: number);
    get ruleIndex(): number;
    copyFrom(ctx: ExprContext): void;
}
export declare class IdentifierContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    ID(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class NotExprContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    expr(): ExprContext;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class BooleanContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    BOOLEAN(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class AssignmentContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    ID(): TerminalNode;
    BOOLEAN(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class IntComparisonContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    ID(): TerminalNode;
    comparator(): ComparatorContext;
    INT(): TerminalNode;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class OrExprContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class ParenExprContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    expr(): ExprContext;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class AndExprContext extends ExprContext {
    constructor(parser: AssertionRegexParser, ctx: ExprContext);
    expr_list(): ExprContext[];
    expr(i: number): ExprContext;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
export declare class ComparatorContext extends ParserRuleContext {
    constructor(parser?: AssertionRegexParser, parent?: ParserRuleContext, invokingState?: number);
    get ruleIndex(): number;
    enterRule(listener: AssertionRegexListener): void;
    exitRule(listener: AssertionRegexListener): void;
}
//# sourceMappingURL=AssertionRegexParser.d.ts.map