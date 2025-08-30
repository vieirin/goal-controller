// Generated from grammar/AssertionRegex.g4 by ANTLR 4.13.2
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
export default class AssertionRegexLexer extends Lexer {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly BOOLEAN = 7;
	public static readonly ID = 8;
	public static readonly WS = 9;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "'&'", 
                                                            "'|'", "'!'", 
                                                            "'('", "')'", 
                                                            "'='" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, "BOOLEAN", 
                                                             "ID", "WS" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "BOOLEAN", "ID", "WS",
	];


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, AssertionRegexLexer._ATN, AssertionRegexLexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "AssertionRegex.g4"; }

	public get literalNames(): (string | null)[] { return AssertionRegexLexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return AssertionRegexLexer.symbolicNames; }
	public get ruleNames(): string[] { return AssertionRegexLexer.ruleNames; }

	public get serializedATN(): number[] { return AssertionRegexLexer._serializedATN; }

	public get channelNames(): string[] { return AssertionRegexLexer.channelNames; }

	public get modeNames(): string[] { return AssertionRegexLexer.modeNames; }

	public static readonly _serializedATN: number[] = [4,0,9,56,6,-1,2,0,7,
	0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,1,0,1,
	0,1,1,1,1,1,2,1,2,1,3,1,3,1,4,1,4,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,
	6,1,6,3,6,41,8,6,1,7,1,7,5,7,45,8,7,10,7,12,7,48,9,7,1,8,4,8,51,8,8,11,
	8,12,8,52,1,8,1,8,0,0,9,1,1,3,2,5,3,7,4,9,5,11,6,13,7,15,8,17,9,1,0,3,3,
	0,65,90,95,95,97,122,4,0,48,57,65,90,95,95,97,122,3,0,9,10,13,13,32,32,
	58,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,0,
	0,0,0,13,1,0,0,0,0,15,1,0,0,0,0,17,1,0,0,0,1,19,1,0,0,0,3,21,1,0,0,0,5,
	23,1,0,0,0,7,25,1,0,0,0,9,27,1,0,0,0,11,29,1,0,0,0,13,40,1,0,0,0,15,42,
	1,0,0,0,17,50,1,0,0,0,19,20,5,38,0,0,20,2,1,0,0,0,21,22,5,124,0,0,22,4,
	1,0,0,0,23,24,5,33,0,0,24,6,1,0,0,0,25,26,5,40,0,0,26,8,1,0,0,0,27,28,5,
	41,0,0,28,10,1,0,0,0,29,30,5,61,0,0,30,12,1,0,0,0,31,32,5,116,0,0,32,33,
	5,114,0,0,33,34,5,117,0,0,34,41,5,101,0,0,35,36,5,102,0,0,36,37,5,97,0,
	0,37,38,5,108,0,0,38,39,5,115,0,0,39,41,5,101,0,0,40,31,1,0,0,0,40,35,1,
	0,0,0,41,14,1,0,0,0,42,46,7,0,0,0,43,45,7,1,0,0,44,43,1,0,0,0,45,48,1,0,
	0,0,46,44,1,0,0,0,46,47,1,0,0,0,47,16,1,0,0,0,48,46,1,0,0,0,49,51,7,2,0,
	0,50,49,1,0,0,0,51,52,1,0,0,0,52,50,1,0,0,0,52,53,1,0,0,0,53,54,1,0,0,0,
	54,55,6,8,0,0,55,18,1,0,0,0,4,0,40,46,52,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!AssertionRegexLexer.__ATN) {
			AssertionRegexLexer.__ATN = new ATNDeserializer().deserialize(AssertionRegexLexer._serializedATN);
		}

		return AssertionRegexLexer.__ATN;
	}


	static DecisionsToDFA = AssertionRegexLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}