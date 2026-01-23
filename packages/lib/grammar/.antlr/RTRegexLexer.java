// Generated from /Users/vieira.neto/vieirin/goal-controller/grammar/RTRegex.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.Lexer;
import org.antlr.v4.runtime.CharStream;
import org.antlr.v4.runtime.Token;
import org.antlr.v4.runtime.TokenStream;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.atn.*;
import org.antlr.v4.runtime.dfa.DFA;
import org.antlr.v4.runtime.misc.*;

@SuppressWarnings({"all", "warnings", "unchecked", "unused", "cast", "CheckReturnValue", "this-escape"})
public class RTRegexLexer extends Lexer {
	static { RuntimeMetaData.checkVersion("4.13.1", RuntimeMetaData.VERSION); }

	protected static final DFA[] _decisionToDFA;
	protected static final PredictionContextCache _sharedContextCache =
		new PredictionContextCache();
	public static final int
		T__0=1, T__1=2, T__2=3, T__3=4, T__4=5, T__5=6, T__6=7, T__7=8, T__8=9, 
		DIGIT_SUBID=10, FLOAT=11, SEQ=12, INT=13, TASK=14, GOAL=15, SKIPP=16, 
		X=17, NEWLINE=18, WORD=19, SUBID=20, WS=21;
	public static String[] channelNames = {
		"DEFAULT_TOKEN_CHANNEL", "HIDDEN"
	};

	public static String[] modeNames = {
		"DEFAULT_MODE"
	};

	private static String[] makeRuleNames() {
		return new String[] {
			"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8", 
			"DIGIT_SUBID", "FLOAT", "SEQ", "INT", "TASK", "GOAL", "SKIPP", "X", "NEWLINE", 
			"WORD", "SUBID", "WS", "DIGIT"
		};
	}
	public static final String[] ruleNames = makeRuleNames();

	private static String[] makeLiteralNames() {
		return new String[] {
			null, "'R'", "','", "'['", "']'", "':'", "'@'", "'|'", "'->'", "'+'", 
			null, null, "';'", "'#'", "'T'", "'G'", "'skip'", "'X'"
		};
	}
	private static final String[] _LITERAL_NAMES = makeLiteralNames();
	private static String[] makeSymbolicNames() {
		return new String[] {
			null, null, null, null, null, null, null, null, null, null, "DIGIT_SUBID", 
			"FLOAT", "SEQ", "INT", "TASK", "GOAL", "SKIPP", "X", "NEWLINE", "WORD", 
			"SUBID", "WS"
		};
	}
	private static final String[] _SYMBOLIC_NAMES = makeSymbolicNames();
	public static final Vocabulary VOCABULARY = new VocabularyImpl(_LITERAL_NAMES, _SYMBOLIC_NAMES);

	/**
	 * @deprecated Use {@link #VOCABULARY} instead.
	 */
	@Deprecated
	public static final String[] tokenNames;
	static {
		tokenNames = new String[_SYMBOLIC_NAMES.length];
		for (int i = 0; i < tokenNames.length; i++) {
			tokenNames[i] = VOCABULARY.getLiteralName(i);
			if (tokenNames[i] == null) {
				tokenNames[i] = VOCABULARY.getSymbolicName(i);
			}

			if (tokenNames[i] == null) {
				tokenNames[i] = "<INVALID>";
			}
		}
	}

	@Override
	@Deprecated
	public String[] getTokenNames() {
		return tokenNames;
	}

	@Override

	public Vocabulary getVocabulary() {
		return VOCABULARY;
	}


	public RTRegexLexer(CharStream input) {
		super(input);
		_interp = new LexerATNSimulator(this,_ATN,_decisionToDFA,_sharedContextCache);
	}

	@Override
	public String getGrammarFileName() { return "RTRegex.g4"; }

	@Override
	public String[] getRuleNames() { return ruleNames; }

	@Override
	public String getSerializedATN() { return _serializedATN; }

	@Override
	public String[] getChannelNames() { return channelNames; }

	@Override
	public String[] getModeNames() { return modeNames; }

	@Override
	public ATN getATN() { return _ATN; }

	public static final String _serializedATN =
		"\u0004\u0000\u0015u\u0006\uffff\uffff\u0002\u0000\u0007\u0000\u0002\u0001"+
		"\u0007\u0001\u0002\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0002\u0004"+
		"\u0007\u0004\u0002\u0005\u0007\u0005\u0002\u0006\u0007\u0006\u0002\u0007"+
		"\u0007\u0007\u0002\b\u0007\b\u0002\t\u0007\t\u0002\n\u0007\n\u0002\u000b"+
		"\u0007\u000b\u0002\f\u0007\f\u0002\r\u0007\r\u0002\u000e\u0007\u000e\u0002"+
		"\u000f\u0007\u000f\u0002\u0010\u0007\u0010\u0002\u0011\u0007\u0011\u0002"+
		"\u0012\u0007\u0012\u0002\u0013\u0007\u0013\u0002\u0014\u0007\u0014\u0002"+
		"\u0015\u0007\u0015\u0001\u0000\u0001\u0000\u0001\u0001\u0001\u0001\u0001"+
		"\u0002\u0001\u0002\u0001\u0003\u0001\u0003\u0001\u0004\u0001\u0004\u0001"+
		"\u0005\u0001\u0005\u0001\u0006\u0001\u0006\u0001\u0007\u0001\u0007\u0001"+
		"\u0007\u0001\b\u0001\b\u0001\t\u0001\t\u0001\t\u0001\n\u0004\nE\b\n\u000b"+
		"\n\f\nF\u0001\n\u0003\nJ\b\n\u0001\n\u0005\nM\b\n\n\n\f\nP\t\n\u0001\u000b"+
		"\u0001\u000b\u0001\f\u0001\f\u0001\r\u0001\r\u0001\u000e\u0001\u000e\u0001"+
		"\u000f\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u000f\u0001\u0010\u0001"+
		"\u0010\u0001\u0011\u0004\u0011b\b\u0011\u000b\u0011\f\u0011c\u0001\u0012"+
		"\u0004\u0012g\b\u0012\u000b\u0012\f\u0012h\u0001\u0013\u0001\u0013\u0001"+
		"\u0014\u0004\u0014n\b\u0014\u000b\u0014\f\u0014o\u0001\u0014\u0001\u0014"+
		"\u0001\u0015\u0001\u0015\u0000\u0000\u0016\u0001\u0001\u0003\u0002\u0005"+
		"\u0003\u0007\u0004\t\u0005\u000b\u0006\r\u0007\u000f\b\u0011\t\u0013\n"+
		"\u0015\u000b\u0017\f\u0019\r\u001b\u000e\u001d\u000f\u001f\u0010!\u0011"+
		"#\u0012%\u0013\'\u0014)\u0015+\u0000\u0001\u0000\u0005\u0002\u0000\n\n"+
		"\r\r\u0005\u0000  \'\'--AZaz\u0001\u0000az\u0001\u0000\t\t\u0001\u0000"+
		"09y\u0000\u0001\u0001\u0000\u0000\u0000\u0000\u0003\u0001\u0000\u0000"+
		"\u0000\u0000\u0005\u0001\u0000\u0000\u0000\u0000\u0007\u0001\u0000\u0000"+
		"\u0000\u0000\t\u0001\u0000\u0000\u0000\u0000\u000b\u0001\u0000\u0000\u0000"+
		"\u0000\r\u0001\u0000\u0000\u0000\u0000\u000f\u0001\u0000\u0000\u0000\u0000"+
		"\u0011\u0001\u0000\u0000\u0000\u0000\u0013\u0001\u0000\u0000\u0000\u0000"+
		"\u0015\u0001\u0000\u0000\u0000\u0000\u0017\u0001\u0000\u0000\u0000\u0000"+
		"\u0019\u0001\u0000\u0000\u0000\u0000\u001b\u0001\u0000\u0000\u0000\u0000"+
		"\u001d\u0001\u0000\u0000\u0000\u0000\u001f\u0001\u0000\u0000\u0000\u0000"+
		"!\u0001\u0000\u0000\u0000\u0000#\u0001\u0000\u0000\u0000\u0000%\u0001"+
		"\u0000\u0000\u0000\u0000\'\u0001\u0000\u0000\u0000\u0000)\u0001\u0000"+
		"\u0000\u0000\u0001-\u0001\u0000\u0000\u0000\u0003/\u0001\u0000\u0000\u0000"+
		"\u00051\u0001\u0000\u0000\u0000\u00073\u0001\u0000\u0000\u0000\t5\u0001"+
		"\u0000\u0000\u0000\u000b7\u0001\u0000\u0000\u0000\r9\u0001\u0000\u0000"+
		"\u0000\u000f;\u0001\u0000\u0000\u0000\u0011>\u0001\u0000\u0000\u0000\u0013"+
		"@\u0001\u0000\u0000\u0000\u0015D\u0001\u0000\u0000\u0000\u0017Q\u0001"+
		"\u0000\u0000\u0000\u0019S\u0001\u0000\u0000\u0000\u001bU\u0001\u0000\u0000"+
		"\u0000\u001dW\u0001\u0000\u0000\u0000\u001fY\u0001\u0000\u0000\u0000!"+
		"^\u0001\u0000\u0000\u0000#a\u0001\u0000\u0000\u0000%f\u0001\u0000\u0000"+
		"\u0000\'j\u0001\u0000\u0000\u0000)m\u0001\u0000\u0000\u0000+s\u0001\u0000"+
		"\u0000\u0000-.\u0005R\u0000\u0000.\u0002\u0001\u0000\u0000\u0000/0\u0005"+
		",\u0000\u00000\u0004\u0001\u0000\u0000\u000012\u0005[\u0000\u00002\u0006"+
		"\u0001\u0000\u0000\u000034\u0005]\u0000\u00004\b\u0001\u0000\u0000\u0000"+
		"56\u0005:\u0000\u00006\n\u0001\u0000\u0000\u000078\u0005@\u0000\u0000"+
		"8\f\u0001\u0000\u0000\u00009:\u0005|\u0000\u0000:\u000e\u0001\u0000\u0000"+
		"\u0000;<\u0005-\u0000\u0000<=\u0005>\u0000\u0000=\u0010\u0001\u0000\u0000"+
		"\u0000>?\u0005+\u0000\u0000?\u0012\u0001\u0000\u0000\u0000@A\u0003+\u0015"+
		"\u0000AB\u0003\'\u0013\u0000B\u0014\u0001\u0000\u0000\u0000CE\u0003+\u0015"+
		"\u0000DC\u0001\u0000\u0000\u0000EF\u0001\u0000\u0000\u0000FD\u0001\u0000"+
		"\u0000\u0000FG\u0001\u0000\u0000\u0000GI\u0001\u0000\u0000\u0000HJ\u0005"+
		".\u0000\u0000IH\u0001\u0000\u0000\u0000IJ\u0001\u0000\u0000\u0000JN\u0001"+
		"\u0000\u0000\u0000KM\u0003+\u0015\u0000LK\u0001\u0000\u0000\u0000MP\u0001"+
		"\u0000\u0000\u0000NL\u0001\u0000\u0000\u0000NO\u0001\u0000\u0000\u0000"+
		"O\u0016\u0001\u0000\u0000\u0000PN\u0001\u0000\u0000\u0000QR\u0005;\u0000"+
		"\u0000R\u0018\u0001\u0000\u0000\u0000ST\u0005#\u0000\u0000T\u001a\u0001"+
		"\u0000\u0000\u0000UV\u0005T\u0000\u0000V\u001c\u0001\u0000\u0000\u0000"+
		"WX\u0005G\u0000\u0000X\u001e\u0001\u0000\u0000\u0000YZ\u0005s\u0000\u0000"+
		"Z[\u0005k\u0000\u0000[\\\u0005i\u0000\u0000\\]\u0005p\u0000\u0000] \u0001"+
		"\u0000\u0000\u0000^_\u0005X\u0000\u0000_\"\u0001\u0000\u0000\u0000`b\u0007"+
		"\u0000\u0000\u0000a`\u0001\u0000\u0000\u0000bc\u0001\u0000\u0000\u0000"+
		"ca\u0001\u0000\u0000\u0000cd\u0001\u0000\u0000\u0000d$\u0001\u0000\u0000"+
		"\u0000eg\u0007\u0001\u0000\u0000fe\u0001\u0000\u0000\u0000gh\u0001\u0000"+
		"\u0000\u0000hf\u0001\u0000\u0000\u0000hi\u0001\u0000\u0000\u0000i&\u0001"+
		"\u0000\u0000\u0000jk\u0007\u0002\u0000\u0000k(\u0001\u0000\u0000\u0000"+
		"ln\u0007\u0003\u0000\u0000ml\u0001\u0000\u0000\u0000no\u0001\u0000\u0000"+
		"\u0000om\u0001\u0000\u0000\u0000op\u0001\u0000\u0000\u0000pq\u0001\u0000"+
		"\u0000\u0000qr\u0006\u0014\u0000\u0000r*\u0001\u0000\u0000\u0000st\u0007"+
		"\u0004\u0000\u0000t,\u0001\u0000\u0000\u0000\u0007\u0000FINcho\u0001\u0006"+
		"\u0000\u0000";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}