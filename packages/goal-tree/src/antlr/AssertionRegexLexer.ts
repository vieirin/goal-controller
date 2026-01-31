// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
  ATN,
  ATNDeserializer,
  CharStream,
  DecisionState,
  DFA,
  Lexer,
  LexerATNSimulator,
  RuleContext,
  PredictionContextCache,
  Token,
} from 'antlr4';
export default class AssertionRegexLexer extends Lexer {
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
  public static readonly EOF = Token.EOF;

  public static readonly channelNames: string[] = [
    'DEFAULT_TOKEN_CHANNEL',
    'HIDDEN',
  ];
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
  public static readonly modeNames: string[] = ['DEFAULT_MODE'];

  public static readonly ruleNames: string[] = [
    'T__0',
    'T__1',
    'T__2',
    'T__3',
    'T__4',
    'T__5',
    'T__6',
    'T__7',
    'T__8',
    'T__9',
    'T__10',
    'BOOLEAN',
    'ID',
    'INT',
    'WS',
  ];

  constructor(input: CharStream) {
    super(input);
    this._interp = new LexerATNSimulator(
      this,
      AssertionRegexLexer._ATN,
      AssertionRegexLexer.DecisionsToDFA,
      new PredictionContextCache(),
    );
  }

  public get grammarFileName(): string {
    return 'AssertionRegex.g4';
  }

  public get literalNames(): (string | null)[] {
    return AssertionRegexLexer.literalNames;
  }
  public get symbolicNames(): (string | null)[] {
    return AssertionRegexLexer.symbolicNames;
  }
  public get ruleNames(): string[] {
    return AssertionRegexLexer.ruleNames;
  }

  public get serializedATN(): number[] {
    return AssertionRegexLexer._serializedATN;
  }

  public get channelNames(): string[] {
    return AssertionRegexLexer.channelNames;
  }

  public get modeNames(): string[] {
    return AssertionRegexLexer.modeNames;
  }

  public static readonly _serializedATN: number[] = [
    4, 0, 15, 88, 6, -1, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4,
    7, 4, 2, 5, 7, 5, 2, 6, 7, 6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7,
    10, 2, 11, 7, 11, 2, 12, 7, 12, 2, 13, 7, 13, 2, 14, 7, 14, 1, 0, 1, 0, 1,
    1, 1, 1, 1, 2, 1, 2, 1, 3, 1, 3, 1, 4, 1, 4, 1, 5, 1, 5, 1, 6, 1, 6, 1, 6,
    1, 7, 1, 7, 1, 8, 1, 8, 1, 8, 1, 9, 1, 9, 1, 10, 1, 10, 1, 10, 1, 11, 1, 11,
    1, 11, 1, 11, 1, 11, 1, 11, 1, 11, 1, 11, 1, 11, 3, 11, 66, 8, 11, 1, 12, 1,
    12, 5, 12, 70, 8, 12, 10, 12, 12, 12, 73, 9, 12, 1, 13, 1, 13, 5, 13, 77, 8,
    13, 10, 13, 12, 13, 80, 9, 13, 1, 14, 4, 14, 83, 8, 14, 11, 14, 12, 14, 84,
    1, 14, 1, 14, 0, 0, 15, 1, 1, 3, 2, 5, 3, 7, 4, 9, 5, 11, 6, 13, 7, 15, 8,
    17, 9, 19, 10, 21, 11, 23, 12, 25, 13, 27, 14, 29, 15, 1, 0, 5, 3, 0, 65,
    90, 95, 95, 97, 122, 4, 0, 48, 57, 65, 90, 95, 95, 97, 122, 1, 0, 49, 57, 1,
    0, 48, 57, 3, 0, 9, 10, 13, 13, 32, 32, 91, 0, 1, 1, 0, 0, 0, 0, 3, 1, 0, 0,
    0, 0, 5, 1, 0, 0, 0, 0, 7, 1, 0, 0, 0, 0, 9, 1, 0, 0, 0, 0, 11, 1, 0, 0, 0,
    0, 13, 1, 0, 0, 0, 0, 15, 1, 0, 0, 0, 0, 17, 1, 0, 0, 0, 0, 19, 1, 0, 0, 0,
    0, 21, 1, 0, 0, 0, 0, 23, 1, 0, 0, 0, 0, 25, 1, 0, 0, 0, 0, 27, 1, 0, 0, 0,
    0, 29, 1, 0, 0, 0, 1, 31, 1, 0, 0, 0, 3, 33, 1, 0, 0, 0, 5, 35, 1, 0, 0, 0,
    7, 37, 1, 0, 0, 0, 9, 39, 1, 0, 0, 0, 11, 41, 1, 0, 0, 0, 13, 43, 1, 0, 0,
    0, 15, 46, 1, 0, 0, 0, 17, 48, 1, 0, 0, 0, 19, 51, 1, 0, 0, 0, 21, 53, 1, 0,
    0, 0, 23, 65, 1, 0, 0, 0, 25, 67, 1, 0, 0, 0, 27, 74, 1, 0, 0, 0, 29, 82, 1,
    0, 0, 0, 31, 32, 5, 38, 0, 0, 32, 2, 1, 0, 0, 0, 33, 34, 5, 124, 0, 0, 34,
    4, 1, 0, 0, 0, 35, 36, 5, 33, 0, 0, 36, 6, 1, 0, 0, 0, 37, 38, 5, 40, 0, 0,
    38, 8, 1, 0, 0, 0, 39, 40, 5, 41, 0, 0, 40, 10, 1, 0, 0, 0, 41, 42, 5, 61,
    0, 0, 42, 12, 1, 0, 0, 0, 43, 44, 5, 33, 0, 0, 44, 45, 5, 61, 0, 0, 45, 14,
    1, 0, 0, 0, 46, 47, 5, 60, 0, 0, 47, 16, 1, 0, 0, 0, 48, 49, 5, 60, 0, 0,
    49, 50, 5, 61, 0, 0, 50, 18, 1, 0, 0, 0, 51, 52, 5, 62, 0, 0, 52, 20, 1, 0,
    0, 0, 53, 54, 5, 62, 0, 0, 54, 55, 5, 61, 0, 0, 55, 22, 1, 0, 0, 0, 56, 57,
    5, 116, 0, 0, 57, 58, 5, 114, 0, 0, 58, 59, 5, 117, 0, 0, 59, 66, 5, 101, 0,
    0, 60, 61, 5, 102, 0, 0, 61, 62, 5, 97, 0, 0, 62, 63, 5, 108, 0, 0, 63, 64,
    5, 115, 0, 0, 64, 66, 5, 101, 0, 0, 65, 56, 1, 0, 0, 0, 65, 60, 1, 0, 0, 0,
    66, 24, 1, 0, 0, 0, 67, 71, 7, 0, 0, 0, 68, 70, 7, 1, 0, 0, 69, 68, 1, 0, 0,
    0, 70, 73, 1, 0, 0, 0, 71, 69, 1, 0, 0, 0, 71, 72, 1, 0, 0, 0, 72, 26, 1, 0,
    0, 0, 73, 71, 1, 0, 0, 0, 74, 78, 7, 2, 0, 0, 75, 77, 7, 3, 0, 0, 76, 75, 1,
    0, 0, 0, 77, 80, 1, 0, 0, 0, 78, 76, 1, 0, 0, 0, 78, 79, 1, 0, 0, 0, 79, 28,
    1, 0, 0, 0, 80, 78, 1, 0, 0, 0, 81, 83, 7, 4, 0, 0, 82, 81, 1, 0, 0, 0, 83,
    84, 1, 0, 0, 0, 84, 82, 1, 0, 0, 0, 84, 85, 1, 0, 0, 0, 85, 86, 1, 0, 0, 0,
    86, 87, 6, 14, 0, 0, 87, 30, 1, 0, 0, 0, 5, 0, 65, 71, 78, 84, 1, 6, 0, 0,
  ];

  private static __ATN: ATN;
  public static get _ATN(): ATN {
    if (!AssertionRegexLexer.__ATN) {
      AssertionRegexLexer.__ATN = new ATNDeserializer().deserialize(
        AssertionRegexLexer._serializedATN,
      );
    }

    return AssertionRegexLexer.__ATN;
  }

  static DecisionsToDFA = AssertionRegexLexer._ATN.decisionToState.map(
    (ds: DecisionState, index: number) => new DFA(ds, index),
  );
}
