import { ATN, CharStream, DFA, Lexer } from 'antlr4';
export default class AssertionRegexLexer extends Lexer {
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
    static readonly channelNames: string[];
    static readonly literalNames: (string | null)[];
    static readonly symbolicNames: (string | null)[];
    static readonly modeNames: string[];
    static readonly ruleNames: string[];
    constructor(input: CharStream);
    get grammarFileName(): string;
    get literalNames(): (string | null)[];
    get symbolicNames(): (string | null)[];
    get ruleNames(): string[];
    get serializedATN(): number[];
    get channelNames(): string[];
    get modeNames(): string[];
    static readonly _serializedATN: number[];
    private static __ATN;
    static get _ATN(): ATN;
    static DecisionsToDFA: DFA[];
}
//# sourceMappingURL=AssertionRegexLexer.d.ts.map