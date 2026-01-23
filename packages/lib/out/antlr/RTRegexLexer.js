"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Generated from grammar/RTRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
const antlr4_1 = require("antlr4");
class RTRegexLexer extends antlr4_1.Lexer {
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
    static channelNames = ["DEFAULT_TOKEN_CHANNEL", "HIDDEN"];
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
    static modeNames = ["DEFAULT_MODE",];
    static ruleNames = [
        "T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8",
        "DIGIT_SUBID", "FLOAT", "SEQ", "INT", "TASK", "GOAL", "SKIPP", "X", "NEWLINE",
        "WORD", "SUBID", "WS", "DIGIT",
    ];
    constructor(input) {
        super(input);
        this._interp = new antlr4_1.LexerATNSimulator(this, RTRegexLexer._ATN, RTRegexLexer.DecisionsToDFA, new antlr4_1.PredictionContextCache());
    }
    get grammarFileName() { return "RTRegex.g4"; }
    get literalNames() { return RTRegexLexer.literalNames; }
    get symbolicNames() { return RTRegexLexer.symbolicNames; }
    get ruleNames() { return RTRegexLexer.ruleNames; }
    get serializedATN() { return RTRegexLexer._serializedATN; }
    get channelNames() { return RTRegexLexer.channelNames; }
    get modeNames() { return RTRegexLexer.modeNames; }
    static _serializedATN = [4, 0, 21, 117, 6, -1, 2, 0,
        7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 4, 2, 5, 7, 5, 2, 6, 7, 6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9,
        7, 9, 2, 10, 7, 10, 2, 11, 7, 11, 2, 12, 7, 12, 2, 13, 7, 13, 2, 14, 7, 14, 2, 15, 7, 15, 2, 16, 7,
        16, 2, 17, 7, 17, 2, 18, 7, 18, 2, 19, 7, 19, 2, 20, 7, 20, 2, 21, 7, 21, 1, 0, 1, 0, 1, 1, 1, 1, 1,
        2, 1, 2, 1, 3, 1, 3, 1, 4, 1, 4, 1, 5, 1, 5, 1, 6, 1, 6, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 9, 1, 9, 1, 9, 1,
        10, 4, 10, 69, 8, 10, 11, 10, 12, 10, 70, 1, 10, 3, 10, 74, 8, 10, 1, 10, 5, 10, 77, 8, 10, 10, 10,
        12, 10, 80, 9, 10, 1, 11, 1, 11, 1, 12, 1, 12, 1, 13, 1, 13, 1, 14, 1, 14, 1, 15, 1, 15, 1, 15, 1,
        15, 1, 15, 1, 16, 1, 16, 1, 17, 4, 17, 98, 8, 17, 11, 17, 12, 17, 99, 1, 18, 4, 18, 103, 8, 18, 11,
        18, 12, 18, 104, 1, 19, 1, 19, 1, 20, 4, 20, 110, 8, 20, 11, 20, 12, 20, 111, 1, 20, 1, 20, 1, 21,
        1, 21, 0, 0, 22, 1, 1, 3, 2, 5, 3, 7, 4, 9, 5, 11, 6, 13, 7, 15, 8, 17, 9, 19, 10, 21, 11, 23, 12, 25,
        13, 27, 14, 29, 15, 31, 16, 33, 17, 35, 18, 37, 19, 39, 20, 41, 21, 43, 0, 1, 0, 5, 2, 0, 10, 10,
        13, 13, 5, 0, 32, 32, 39, 39, 45, 45, 65, 90, 97, 122, 1, 0, 97, 122, 1, 0, 9, 9, 1, 0, 48, 57, 121,
        0, 1, 1, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 5, 1, 0, 0, 0, 0, 7, 1, 0, 0, 0, 0, 9, 1, 0, 0, 0, 0, 11, 1, 0, 0,
        0, 0, 13, 1, 0, 0, 0, 0, 15, 1, 0, 0, 0, 0, 17, 1, 0, 0, 0, 0, 19, 1, 0, 0, 0, 0, 21, 1, 0, 0, 0, 0, 23,
        1, 0, 0, 0, 0, 25, 1, 0, 0, 0, 0, 27, 1, 0, 0, 0, 0, 29, 1, 0, 0, 0, 0, 31, 1, 0, 0, 0, 0, 33, 1, 0, 0,
        0, 0, 35, 1, 0, 0, 0, 0, 37, 1, 0, 0, 0, 0, 39, 1, 0, 0, 0, 0, 41, 1, 0, 0, 0, 1, 45, 1, 0, 0, 0, 3, 47,
        1, 0, 0, 0, 5, 49, 1, 0, 0, 0, 7, 51, 1, 0, 0, 0, 9, 53, 1, 0, 0, 0, 11, 55, 1, 0, 0, 0, 13, 57, 1, 0,
        0, 0, 15, 59, 1, 0, 0, 0, 17, 62, 1, 0, 0, 0, 19, 64, 1, 0, 0, 0, 21, 68, 1, 0, 0, 0, 23, 81, 1, 0, 0,
        0, 25, 83, 1, 0, 0, 0, 27, 85, 1, 0, 0, 0, 29, 87, 1, 0, 0, 0, 31, 89, 1, 0, 0, 0, 33, 94, 1, 0, 0, 0,
        35, 97, 1, 0, 0, 0, 37, 102, 1, 0, 0, 0, 39, 106, 1, 0, 0, 0, 41, 109, 1, 0, 0, 0, 43, 115, 1, 0, 0,
        0, 45, 46, 5, 82, 0, 0, 46, 2, 1, 0, 0, 0, 47, 48, 5, 44, 0, 0, 48, 4, 1, 0, 0, 0, 49, 50, 5, 91, 0,
        0, 50, 6, 1, 0, 0, 0, 51, 52, 5, 93, 0, 0, 52, 8, 1, 0, 0, 0, 53, 54, 5, 58, 0, 0, 54, 10, 1, 0, 0, 0,
        55, 56, 5, 64, 0, 0, 56, 12, 1, 0, 0, 0, 57, 58, 5, 124, 0, 0, 58, 14, 1, 0, 0, 0, 59, 60, 5, 45, 0,
        0, 60, 61, 5, 62, 0, 0, 61, 16, 1, 0, 0, 0, 62, 63, 5, 43, 0, 0, 63, 18, 1, 0, 0, 0, 64, 65, 3, 43,
        21, 0, 65, 66, 3, 39, 19, 0, 66, 20, 1, 0, 0, 0, 67, 69, 3, 43, 21, 0, 68, 67, 1, 0, 0, 0, 69, 70,
        1, 0, 0, 0, 70, 68, 1, 0, 0, 0, 70, 71, 1, 0, 0, 0, 71, 73, 1, 0, 0, 0, 72, 74, 5, 46, 0, 0, 73, 72,
        1, 0, 0, 0, 73, 74, 1, 0, 0, 0, 74, 78, 1, 0, 0, 0, 75, 77, 3, 43, 21, 0, 76, 75, 1, 0, 0, 0, 77, 80,
        1, 0, 0, 0, 78, 76, 1, 0, 0, 0, 78, 79, 1, 0, 0, 0, 79, 22, 1, 0, 0, 0, 80, 78, 1, 0, 0, 0, 81, 82, 5,
        59, 0, 0, 82, 24, 1, 0, 0, 0, 83, 84, 5, 35, 0, 0, 84, 26, 1, 0, 0, 0, 85, 86, 5, 84, 0, 0, 86, 28,
        1, 0, 0, 0, 87, 88, 5, 71, 0, 0, 88, 30, 1, 0, 0, 0, 89, 90, 5, 115, 0, 0, 90, 91, 5, 107, 0, 0, 91,
        92, 5, 105, 0, 0, 92, 93, 5, 112, 0, 0, 93, 32, 1, 0, 0, 0, 94, 95, 5, 88, 0, 0, 95, 34, 1, 0, 0, 0,
        96, 98, 7, 0, 0, 0, 97, 96, 1, 0, 0, 0, 98, 99, 1, 0, 0, 0, 99, 97, 1, 0, 0, 0, 99, 100, 1, 0, 0, 0,
        100, 36, 1, 0, 0, 0, 101, 103, 7, 1, 0, 0, 102, 101, 1, 0, 0, 0, 103, 104, 1, 0, 0, 0, 104, 102,
        1, 0, 0, 0, 104, 105, 1, 0, 0, 0, 105, 38, 1, 0, 0, 0, 106, 107, 7, 2, 0, 0, 107, 40, 1, 0, 0, 0, 108,
        110, 7, 3, 0, 0, 109, 108, 1, 0, 0, 0, 110, 111, 1, 0, 0, 0, 111, 109, 1, 0, 0, 0, 111, 112, 1, 0,
        0, 0, 112, 113, 1, 0, 0, 0, 113, 114, 6, 20, 0, 0, 114, 42, 1, 0, 0, 0, 115, 116, 7, 4, 0, 0, 116,
        44, 1, 0, 0, 0, 7, 0, 70, 73, 78, 99, 104, 111, 1, 6, 0, 0];
    static __ATN;
    static get _ATN() {
        if (!RTRegexLexer.__ATN) {
            RTRegexLexer.__ATN = new antlr4_1.ATNDeserializer().deserialize(RTRegexLexer._serializedATN);
        }
        return RTRegexLexer.__ATN;
    }
    static DecisionsToDFA = RTRegexLexer._ATN.decisionToState.map((ds, index) => new antlr4_1.DFA(ds, index));
}
exports.default = RTRegexLexer;
//# sourceMappingURL=RTRegexLexer.js.map