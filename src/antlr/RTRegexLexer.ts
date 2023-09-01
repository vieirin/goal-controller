// Generated from grammar/RTRegex.g4 by ANTLR 4.13.0
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
	public static readonly FLOAT = 10;
	public static readonly SEQ = 11;
	public static readonly INT = 12;
	public static readonly TASK = 13;
	public static readonly GOAL = 14;
	public static readonly SKIPP = 15;
	public static readonly X = 16;
	public static readonly NEWLINE = 17;
	public static readonly WORD = 18;
	public static readonly WS = 19;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "','", 
                                                            "'['", "']'", 
                                                            "'DM('", "')'", 
                                                            "':'", "'@'", 
                                                            "'try('", "'?'", 
                                                            null, "';'", 
                                                            "'#'", "'T'", 
                                                            "'G'", "'skip'", 
                                                            "'X'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             "FLOAT", "SEQ", 
                                                             "INT", "TASK", 
                                                             "GOAL", "SKIPP", 
                                                             "X", "NEWLINE", 
                                                             "WORD", "WS" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8", 
		"FLOAT", "SEQ", "INT", "TASK", "GOAL", "SKIPP", "X", "NEWLINE", "WORD", 
		"WS", "DIGIT",
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

	public static readonly _serializedATN: number[] = [4,0,19,112,6,-1,2,0,
	7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,
	7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,
	16,2,17,7,17,2,18,7,18,2,19,7,19,1,0,1,0,1,1,1,1,1,2,1,2,1,3,1,3,1,3,1,
	3,1,4,1,4,1,5,1,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,4,9,66,8,9,11,
	9,12,9,67,1,9,3,9,71,8,9,1,9,5,9,74,8,9,10,9,12,9,77,9,9,1,10,1,10,1,11,
	1,11,1,12,1,12,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,15,1,15,1,16,4,16,95,
	8,16,11,16,12,16,96,1,17,4,17,100,8,17,11,17,12,17,101,1,18,4,18,105,8,
	18,11,18,12,18,106,1,18,1,18,1,19,1,19,0,0,20,1,1,3,2,5,3,7,4,9,5,11,6,
	13,7,15,8,17,9,19,10,21,11,23,12,25,13,27,14,29,15,31,16,33,17,35,18,37,
	19,39,0,1,0,4,2,0,10,10,13,13,3,0,45,45,65,90,97,122,1,0,9,9,1,0,48,57,
	116,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,
	0,0,0,0,13,1,0,0,0,0,15,1,0,0,0,0,17,1,0,0,0,0,19,1,0,0,0,0,21,1,0,0,0,
	0,23,1,0,0,0,0,25,1,0,0,0,0,27,1,0,0,0,0,29,1,0,0,0,0,31,1,0,0,0,0,33,1,
	0,0,0,0,35,1,0,0,0,0,37,1,0,0,0,1,41,1,0,0,0,3,43,1,0,0,0,5,45,1,0,0,0,
	7,47,1,0,0,0,9,51,1,0,0,0,11,53,1,0,0,0,13,55,1,0,0,0,15,57,1,0,0,0,17,
	62,1,0,0,0,19,65,1,0,0,0,21,78,1,0,0,0,23,80,1,0,0,0,25,82,1,0,0,0,27,84,
	1,0,0,0,29,86,1,0,0,0,31,91,1,0,0,0,33,94,1,0,0,0,35,99,1,0,0,0,37,104,
	1,0,0,0,39,110,1,0,0,0,41,42,5,44,0,0,42,2,1,0,0,0,43,44,5,91,0,0,44,4,
	1,0,0,0,45,46,5,93,0,0,46,6,1,0,0,0,47,48,5,68,0,0,48,49,5,77,0,0,49,50,
	5,40,0,0,50,8,1,0,0,0,51,52,5,41,0,0,52,10,1,0,0,0,53,54,5,58,0,0,54,12,
	1,0,0,0,55,56,5,64,0,0,56,14,1,0,0,0,57,58,5,116,0,0,58,59,5,114,0,0,59,
	60,5,121,0,0,60,61,5,40,0,0,61,16,1,0,0,0,62,63,5,63,0,0,63,18,1,0,0,0,
	64,66,3,39,19,0,65,64,1,0,0,0,66,67,1,0,0,0,67,65,1,0,0,0,67,68,1,0,0,0,
	68,70,1,0,0,0,69,71,5,46,0,0,70,69,1,0,0,0,70,71,1,0,0,0,71,75,1,0,0,0,
	72,74,3,39,19,0,73,72,1,0,0,0,74,77,1,0,0,0,75,73,1,0,0,0,75,76,1,0,0,0,
	76,20,1,0,0,0,77,75,1,0,0,0,78,79,5,59,0,0,79,22,1,0,0,0,80,81,5,35,0,0,
	81,24,1,0,0,0,82,83,5,84,0,0,83,26,1,0,0,0,84,85,5,71,0,0,85,28,1,0,0,0,
	86,87,5,115,0,0,87,88,5,107,0,0,88,89,5,105,0,0,89,90,5,112,0,0,90,30,1,
	0,0,0,91,92,5,88,0,0,92,32,1,0,0,0,93,95,7,0,0,0,94,93,1,0,0,0,95,96,1,
	0,0,0,96,94,1,0,0,0,96,97,1,0,0,0,97,34,1,0,0,0,98,100,7,1,0,0,99,98,1,
	0,0,0,100,101,1,0,0,0,101,99,1,0,0,0,101,102,1,0,0,0,102,36,1,0,0,0,103,
	105,7,2,0,0,104,103,1,0,0,0,105,106,1,0,0,0,106,104,1,0,0,0,106,107,1,0,
	0,0,107,108,1,0,0,0,108,109,6,18,0,0,109,38,1,0,0,0,110,111,7,3,0,0,111,
	40,1,0,0,0,7,0,67,70,75,96,101,106,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!RTRegexLexer.__ATN) {
			RTRegexLexer.__ATN = new ATNDeserializer().deserialize(RTRegexLexer._serializedATN);
		}

		return RTRegexLexer.__ATN;
	}


	static DecisionsToDFA = RTRegexLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}