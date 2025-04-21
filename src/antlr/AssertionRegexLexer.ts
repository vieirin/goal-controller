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
	public static readonly ID = 5;
	public static readonly WS = 6;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "'&'", 
                                                            "'|'", "'('", 
                                                            "')'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, "ID", 
                                                             "WS" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "ID", "WS",
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

	public static readonly _serializedATN: number[] = [4,0,6,35,6,-1,2,0,7,
	0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,1,0,1,0,1,1,1,1,1,2,1,2,1,3,1,
	3,1,4,1,4,5,4,24,8,4,10,4,12,4,27,9,4,1,5,4,5,30,8,5,11,5,12,5,31,1,5,1,
	5,0,0,6,1,1,3,2,5,3,7,4,9,5,11,6,1,0,3,3,0,65,90,95,95,97,122,4,0,48,57,
	65,90,95,95,97,122,3,0,9,10,13,13,32,32,36,0,1,1,0,0,0,0,3,1,0,0,0,0,5,
	1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,0,0,0,1,13,1,0,0,0,3,15,1,0,0,0,
	5,17,1,0,0,0,7,19,1,0,0,0,9,21,1,0,0,0,11,29,1,0,0,0,13,14,5,38,0,0,14,
	2,1,0,0,0,15,16,5,124,0,0,16,4,1,0,0,0,17,18,5,40,0,0,18,6,1,0,0,0,19,20,
	5,41,0,0,20,8,1,0,0,0,21,25,7,0,0,0,22,24,7,1,0,0,23,22,1,0,0,0,24,27,1,
	0,0,0,25,23,1,0,0,0,25,26,1,0,0,0,26,10,1,0,0,0,27,25,1,0,0,0,28,30,7,2,
	0,0,29,28,1,0,0,0,30,31,1,0,0,0,31,29,1,0,0,0,31,32,1,0,0,0,32,33,1,0,0,
	0,33,34,6,5,0,0,34,12,1,0,0,0,3,0,25,31,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!AssertionRegexLexer.__ATN) {
			AssertionRegexLexer.__ATN = new ATNDeserializer().deserialize(AssertionRegexLexer._serializedATN);
		}

		return AssertionRegexLexer.__ATN;
	}


	static DecisionsToDFA = AssertionRegexLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}