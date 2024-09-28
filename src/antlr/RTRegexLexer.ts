// Generated from grammar/RTRegex.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
	ATN,
	ATNDeserializer,
	CharStream,
	DecisionState, DFA,
	Lexer,
	LexerATNSimulator,
	RuleContext,
	PredictionContextCache,
	Token
} from "antlr4";
export default class RTRegexLexer extends Lexer {
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
	public static readonly DIGIT_SUBID = 12;
	public static readonly FLOAT = 13;
	public static readonly SEQ = 14;
	public static readonly INT = 15;
	public static readonly TASK = 16;
	public static readonly GOAL = 17;
	public static readonly SKIPP = 18;
	public static readonly X = 19;
	public static readonly NEWLINE = 20;
	public static readonly WORD = 21;
	public static readonly SUBID = 22;
	public static readonly WS = 23;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "'M'", 
                                                            "'R'", "','", 
                                                            "'['", "']'", 
                                                            "'DM('", "')'", 
                                                            "':'", "'@'", 
                                                            "'try('", "'?'", 
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
                                                             "DIGIT_SUBID", 
                                                             "FLOAT", "SEQ", 
                                                             "INT", "TASK", 
                                                             "GOAL", "SKIPP", 
                                                             "X", "NEWLINE", 
                                                             "WORD", "SUBID", 
                                                             "WS" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8", 
		"T__9", "T__10", "DIGIT_SUBID", "FLOAT", "SEQ", "INT", "TASK", "GOAL", 
		"SKIPP", "X", "NEWLINE", "WORD", "SUBID", "WS", "DIGIT",
	];


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, RTRegexLexer._ATN, RTRegexLexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "RTRegex.g4"; }

	public get literalNames(): (string | null)[] { return RTRegexLexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return RTRegexLexer.symbolicNames; }
	public get ruleNames(): string[] { return RTRegexLexer.ruleNames; }

	public get serializedATN(): number[] { return RTRegexLexer._serializedATN; }

	public get channelNames(): string[] { return RTRegexLexer.channelNames; }

	public get modeNames(): string[] { return RTRegexLexer.modeNames; }

	public static readonly _serializedATN: number[] = [4,0,23,129,6,-1,2,0,
	7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,
	7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,
	16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,
	1,0,1,0,1,1,1,1,1,2,1,2,1,3,1,3,1,4,1,4,1,5,1,5,1,5,1,5,1,6,1,6,1,7,1,7,
	1,8,1,8,1,9,1,9,1,9,1,9,1,9,1,10,1,10,1,11,1,11,1,11,1,12,4,12,81,8,12,
	11,12,12,12,82,1,12,3,12,86,8,12,1,12,5,12,89,8,12,10,12,12,12,92,9,12,
	1,13,1,13,1,14,1,14,1,15,1,15,1,16,1,16,1,17,1,17,1,17,1,17,1,17,1,18,1,
	18,1,19,4,19,110,8,19,11,19,12,19,111,1,20,4,20,115,8,20,11,20,12,20,116,
	1,21,1,21,1,22,4,22,122,8,22,11,22,12,22,123,1,22,1,22,1,23,1,23,0,0,24,
	1,1,3,2,5,3,7,4,9,5,11,6,13,7,15,8,17,9,19,10,21,11,23,12,25,13,27,14,29,
	15,31,16,33,17,35,18,37,19,39,20,41,21,43,22,45,23,47,0,1,0,5,2,0,10,10,
	13,13,4,0,32,32,45,45,65,90,97,122,1,0,97,122,1,0,9,9,1,0,48,57,133,0,1,
	1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,0,0,0,0,
	13,1,0,0,0,0,15,1,0,0,0,0,17,1,0,0,0,0,19,1,0,0,0,0,21,1,0,0,0,0,23,1,0,
	0,0,0,25,1,0,0,0,0,27,1,0,0,0,0,29,1,0,0,0,0,31,1,0,0,0,0,33,1,0,0,0,0,
	35,1,0,0,0,0,37,1,0,0,0,0,39,1,0,0,0,0,41,1,0,0,0,0,43,1,0,0,0,0,45,1,0,
	0,0,1,49,1,0,0,0,3,51,1,0,0,0,5,53,1,0,0,0,7,55,1,0,0,0,9,57,1,0,0,0,11,
	59,1,0,0,0,13,63,1,0,0,0,15,65,1,0,0,0,17,67,1,0,0,0,19,69,1,0,0,0,21,74,
	1,0,0,0,23,76,1,0,0,0,25,80,1,0,0,0,27,93,1,0,0,0,29,95,1,0,0,0,31,97,1,
	0,0,0,33,99,1,0,0,0,35,101,1,0,0,0,37,106,1,0,0,0,39,109,1,0,0,0,41,114,
	1,0,0,0,43,118,1,0,0,0,45,121,1,0,0,0,47,127,1,0,0,0,49,50,5,77,0,0,50,
	2,1,0,0,0,51,52,5,82,0,0,52,4,1,0,0,0,53,54,5,44,0,0,54,6,1,0,0,0,55,56,
	5,91,0,0,56,8,1,0,0,0,57,58,5,93,0,0,58,10,1,0,0,0,59,60,5,68,0,0,60,61,
	5,77,0,0,61,62,5,40,0,0,62,12,1,0,0,0,63,64,5,41,0,0,64,14,1,0,0,0,65,66,
	5,58,0,0,66,16,1,0,0,0,67,68,5,64,0,0,68,18,1,0,0,0,69,70,5,116,0,0,70,
	71,5,114,0,0,71,72,5,121,0,0,72,73,5,40,0,0,73,20,1,0,0,0,74,75,5,63,0,
	0,75,22,1,0,0,0,76,77,3,47,23,0,77,78,3,43,21,0,78,24,1,0,0,0,79,81,3,47,
	23,0,80,79,1,0,0,0,81,82,1,0,0,0,82,80,1,0,0,0,82,83,1,0,0,0,83,85,1,0,
	0,0,84,86,5,46,0,0,85,84,1,0,0,0,85,86,1,0,0,0,86,90,1,0,0,0,87,89,3,47,
	23,0,88,87,1,0,0,0,89,92,1,0,0,0,90,88,1,0,0,0,90,91,1,0,0,0,91,26,1,0,
	0,0,92,90,1,0,0,0,93,94,5,59,0,0,94,28,1,0,0,0,95,96,5,35,0,0,96,30,1,0,
	0,0,97,98,5,84,0,0,98,32,1,0,0,0,99,100,5,71,0,0,100,34,1,0,0,0,101,102,
	5,115,0,0,102,103,5,107,0,0,103,104,5,105,0,0,104,105,5,112,0,0,105,36,
	1,0,0,0,106,107,5,88,0,0,107,38,1,0,0,0,108,110,7,0,0,0,109,108,1,0,0,0,
	110,111,1,0,0,0,111,109,1,0,0,0,111,112,1,0,0,0,112,40,1,0,0,0,113,115,
	7,1,0,0,114,113,1,0,0,0,115,116,1,0,0,0,116,114,1,0,0,0,116,117,1,0,0,0,
	117,42,1,0,0,0,118,119,7,2,0,0,119,44,1,0,0,0,120,122,7,3,0,0,121,120,1,
	0,0,0,122,123,1,0,0,0,123,121,1,0,0,0,123,124,1,0,0,0,124,125,1,0,0,0,125,
	126,6,22,0,0,126,46,1,0,0,0,127,128,7,4,0,0,128,48,1,0,0,0,7,0,82,85,90,
	111,116,123,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!RTRegexLexer.__ATN) {
			RTRegexLexer.__ATN = new ATNDeserializer().deserialize(RTRegexLexer._serializedATN);
		}

		return RTRegexLexer.__ATN;
	}


	static DecisionsToDFA = RTRegexLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}