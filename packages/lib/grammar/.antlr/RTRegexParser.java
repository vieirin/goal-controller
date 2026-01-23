// Generated from /Users/vieira.neto/vieirin/goal-controller/grammar/RTRegex.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.atn.*;
import org.antlr.v4.runtime.dfa.DFA;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.misc.*;
import org.antlr.v4.runtime.tree.*;
import java.util.List;
import java.util.Iterator;
import java.util.ArrayList;

@SuppressWarnings({"all", "warnings", "unchecked", "unused", "cast", "CheckReturnValue"})
public class RTRegexParser extends Parser {
	static { RuntimeMetaData.checkVersion("4.13.1", RuntimeMetaData.VERSION); }

	protected static final DFA[] _decisionToDFA;
	protected static final PredictionContextCache _sharedContextCache =
		new PredictionContextCache();
	public static final int
		T__0=1, T__1=2, T__2=3, T__3=4, T__4=5, T__5=6, T__6=7, T__7=8, T__8=9, 
		DIGIT_SUBID=10, FLOAT=11, SEQ=12, INT=13, TASK=14, GOAL=15, SKIPP=16, 
		X=17, NEWLINE=18, WORD=19, SUBID=20, WS=21;
	public static final int
		RULE_rt = 0, RULE_expr = 1, RULE_id = 2, RULE_word = 3;
	private static String[] makeRuleNames() {
		return new String[] {
			"rt", "expr", "id", "word"
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

	@Override
	public String getGrammarFileName() { return "RTRegex.g4"; }

	@Override
	public String[] getRuleNames() { return ruleNames; }

	@Override
	public String getSerializedATN() { return _serializedATN; }

	@Override
	public ATN getATN() { return _ATN; }

	public RTRegexParser(TokenStream input) {
		super(input);
		_interp = new ParserATNSimulator(this,_ATN,_decisionToDFA,_sharedContextCache);
	}

	@SuppressWarnings("CheckReturnValue")
	public static class RtContext extends ParserRuleContext {
		public RtContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_rt; }
	 
		public RtContext() { }
		public void copyFrom(RtContext ctx) {
			super.copyFrom(ctx);
		}
	}
	@SuppressWarnings("CheckReturnValue")
	public static class BlankContext extends RtContext {
		public TerminalNode EOF() { return getToken(RTRegexParser.EOF, 0); }
		public BlankContext(RtContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class PrintExprContext extends RtContext {
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public TerminalNode EOF() { return getToken(RTRegexParser.EOF, 0); }
		public PrintExprContext(RtContext ctx) { copyFrom(ctx); }
	}

	public final RtContext rt() throws RecognitionException {
		RtContext _localctx = new RtContext(_ctx, getState());
		enterRule(_localctx, 0, RULE_rt);
		try {
			setState(12);
			_errHandler.sync(this);
			switch (_input.LA(1)) {
			case T__0:
			case T__2:
			case T__4:
			case T__8:
			case TASK:
			case GOAL:
			case SKIPP:
				_localctx = new PrintExprContext(_localctx);
				enterOuterAlt(_localctx, 1);
				{
				setState(8);
				expr(0);
				setState(9);
				match(EOF);
				}
				break;
			case EOF:
				_localctx = new BlankContext(_localctx);
				enterOuterAlt(_localctx, 2);
				{
				setState(11);
				match(EOF);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class ExprContext extends ParserRuleContext {
		public ExprContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_expr; }
	 
		public ExprContext() { }
		public void copyFrom(ExprContext ctx) {
			super.copyFrom(ctx);
		}
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GIdContext extends ExprContext {
		public Token t;
		public IdContext id() {
			return getRuleContext(IdContext.class,0);
		}
		public TerminalNode GOAL() { return getToken(RTRegexParser.GOAL, 0); }
		public TerminalNode TASK() { return getToken(RTRegexParser.TASK, 0); }
		public GIdContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class NameOnlyContext extends ExprContext {
		public WordContext word() {
			return getRuleContext(WordContext.class,0);
		}
		public TerminalNode EOF() { return getToken(RTRegexParser.EOF, 0); }
		public NameOnlyContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GInterleavedContext extends ExprContext {
		public Token op;
		public List<ExprContext> expr() {
			return getRuleContexts(ExprContext.class);
		}
		public ExprContext expr(int i) {
			return getRuleContext(ExprContext.class,i);
		}
		public TerminalNode INT() { return getToken(RTRegexParser.INT, 0); }
		public GInterleavedContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GChoiceContext extends ExprContext {
		public Token op;
		public GChoiceContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GArgsContext extends ExprContext {
		public Token t;
		public IdContext id() {
			return getRuleContext(IdContext.class,0);
		}
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public TerminalNode GOAL() { return getToken(RTRegexParser.GOAL, 0); }
		public TerminalNode TASK() { return getToken(RTRegexParser.TASK, 0); }
		public GArgsContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class NameContinuedContext extends ExprContext {
		public WordContext word() {
			return getRuleContext(WordContext.class,0);
		}
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public NameContinuedContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GAlternativeContext extends ExprContext {
		public Token op;
		public List<ExprContext> expr() {
			return getRuleContexts(ExprContext.class);
		}
		public ExprContext expr(int i) {
			return getRuleContext(ExprContext.class,i);
		}
		public GAlternativeContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GDegradationContext extends ExprContext {
		public Token op;
		public List<ExprContext> expr() {
			return getRuleContexts(ExprContext.class);
		}
		public ExprContext expr(int i) {
			return getRuleContext(ExprContext.class,i);
		}
		public GDegradationContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GSkipContext extends ExprContext {
		public TerminalNode SKIPP() { return getToken(RTRegexParser.SKIPP, 0); }
		public GSkipContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class NotationStartContext extends ExprContext {
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public NotationStartContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GRetryContext extends ExprContext {
		public Token op;
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public TerminalNode FLOAT() { return getToken(RTRegexParser.FLOAT, 0); }
		public GRetryContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GSequenceContext extends ExprContext {
		public Token op;
		public List<ExprContext> expr() {
			return getRuleContexts(ExprContext.class);
		}
		public ExprContext expr(int i) {
			return getRuleContext(ExprContext.class,i);
		}
		public TerminalNode SEQ() { return getToken(RTRegexParser.SEQ, 0); }
		public GSequenceContext(ExprContext ctx) { copyFrom(ctx); }
	}
	@SuppressWarnings("CheckReturnValue")
	public static class GIdContinuedContext extends ExprContext {
		public Token t;
		public IdContext id() {
			return getRuleContext(IdContext.class,0);
		}
		public ExprContext expr() {
			return getRuleContext(ExprContext.class,0);
		}
		public TerminalNode GOAL() { return getToken(RTRegexParser.GOAL, 0); }
		public TerminalNode TASK() { return getToken(RTRegexParser.TASK, 0); }
		public GIdContinuedContext(ExprContext ctx) { copyFrom(ctx); }
	}

	public final ExprContext expr() throws RecognitionException {
		return expr(0);
	}

	private ExprContext expr(int _p) throws RecognitionException {
		ParserRuleContext _parentctx = _ctx;
		int _parentState = getState();
		ExprContext _localctx = new ExprContext(_ctx, _parentState);
		ExprContext _prevctx = _localctx;
		int _startState = 2;
		enterRecursionRule(_localctx, 2, RULE_expr, _p);
		int _la;
		try {
			int _alt;
			enterOuterAlt(_localctx, 1);
			{
			setState(40);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,1,_ctx) ) {
			case 1:
				{
				_localctx = new GIdContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;

				setState(15);
				((GIdContext)_localctx).t = _input.LT(1);
				_la = _input.LA(1);
				if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 49154L) != 0)) ) {
					((GIdContext)_localctx).t = (Token)_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(16);
				id();
				}
				break;
			case 2:
				{
				_localctx = new GIdContinuedContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(17);
				((GIdContinuedContext)_localctx).t = _input.LT(1);
				_la = _input.LA(1);
				if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 49154L) != 0)) ) {
					((GIdContinuedContext)_localctx).t = (Token)_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(18);
				id();
				setState(19);
				expr(12);
				}
				break;
			case 3:
				{
				_localctx = new GArgsContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(21);
				((GArgsContext)_localctx).t = _input.LT(1);
				_la = _input.LA(1);
				if ( !((((_la) & ~0x3f) == 0 && ((1L << _la) & 49154L) != 0)) ) {
					((GArgsContext)_localctx).t = (Token)_errHandler.recoverInline(this);
				}
				else {
					if ( _input.LA(1)==Token.EOF ) matchedEOF = true;
					_errHandler.reportMatch(this);
					consume();
				}
				setState(22);
				id();
				setState(23);
				match(T__1);
				setState(24);
				expr(11);
				}
				break;
			case 4:
				{
				_localctx = new NotationStartContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(26);
				match(T__2);
				setState(27);
				expr(0);
				setState(28);
				match(T__3);
				}
				break;
			case 5:
				{
				_localctx = new NameContinuedContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(30);
				match(T__4);
				setState(31);
				word();
				setState(32);
				expr(9);
				}
				break;
			case 6:
				{
				_localctx = new NameOnlyContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(34);
				match(T__4);
				setState(35);
				word();
				setState(36);
				match(EOF);
				}
				break;
			case 7:
				{
				_localctx = new GChoiceContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(38);
				((GChoiceContext)_localctx).op = match(T__8);
				}
				break;
			case 8:
				{
				_localctx = new GSkipContext(_localctx);
				_ctx = _localctx;
				_prevctx = _localctx;
				setState(39);
				match(SKIPP);
				}
				break;
			}
			_ctx.stop = _input.LT(-1);
			setState(59);
			_errHandler.sync(this);
			_alt = getInterpreter().adaptivePredict(_input,3,_ctx);
			while ( _alt!=2 && _alt!=org.antlr.v4.runtime.atn.ATN.INVALID_ALT_NUMBER ) {
				if ( _alt==1 ) {
					if ( _parseListeners!=null ) triggerExitRuleEvent();
					_prevctx = _localctx;
					{
					setState(57);
					_errHandler.sync(this);
					switch ( getInterpreter().adaptivePredict(_input,2,_ctx) ) {
					case 1:
						{
						_localctx = new GAlternativeContext(new ExprContext(_parentctx, _parentState));
						pushNewRecursionContext(_localctx, _startState, RULE_expr);
						setState(42);
						if (!(precpred(_ctx, 6))) throw new FailedPredicateException(this, "precpred(_ctx, 6)");
						setState(43);
						((GAlternativeContext)_localctx).op = match(T__6);
						setState(44);
						expr(7);
						}
						break;
					case 2:
						{
						_localctx = new GInterleavedContext(new ExprContext(_parentctx, _parentState));
						pushNewRecursionContext(_localctx, _startState, RULE_expr);
						setState(45);
						if (!(precpred(_ctx, 5))) throw new FailedPredicateException(this, "precpred(_ctx, 5)");
						setState(46);
						((GInterleavedContext)_localctx).op = match(INT);
						setState(47);
						expr(6);
						}
						break;
					case 3:
						{
						_localctx = new GSequenceContext(new ExprContext(_parentctx, _parentState));
						pushNewRecursionContext(_localctx, _startState, RULE_expr);
						setState(48);
						if (!(precpred(_ctx, 4))) throw new FailedPredicateException(this, "precpred(_ctx, 4)");
						setState(49);
						((GSequenceContext)_localctx).op = match(SEQ);
						setState(50);
						expr(5);
						}
						break;
					case 4:
						{
						_localctx = new GDegradationContext(new ExprContext(_parentctx, _parentState));
						pushNewRecursionContext(_localctx, _startState, RULE_expr);
						setState(51);
						if (!(precpred(_ctx, 3))) throw new FailedPredicateException(this, "precpred(_ctx, 3)");
						setState(52);
						((GDegradationContext)_localctx).op = match(T__7);
						setState(53);
						expr(4);
						}
						break;
					case 5:
						{
						_localctx = new GRetryContext(new ExprContext(_parentctx, _parentState));
						pushNewRecursionContext(_localctx, _startState, RULE_expr);
						setState(54);
						if (!(precpred(_ctx, 7))) throw new FailedPredicateException(this, "precpred(_ctx, 7)");
						setState(55);
						((GRetryContext)_localctx).op = match(T__5);
						setState(56);
						match(FLOAT);
						}
						break;
					}
					} 
				}
				setState(61);
				_errHandler.sync(this);
				_alt = getInterpreter().adaptivePredict(_input,3,_ctx);
			}
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			unrollRecursionContexts(_parentctx);
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class IdContext extends ParserRuleContext {
		public TerminalNode FLOAT() { return getToken(RTRegexParser.FLOAT, 0); }
		public TerminalNode X() { return getToken(RTRegexParser.X, 0); }
		public TerminalNode DIGIT_SUBID() { return getToken(RTRegexParser.DIGIT_SUBID, 0); }
		public IdContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_id; }
	}

	public final IdContext id() throws RecognitionException {
		IdContext _localctx = new IdContext(_ctx, getState());
		enterRule(_localctx, 4, RULE_id);
		try {
			setState(67);
			_errHandler.sync(this);
			switch ( getInterpreter().adaptivePredict(_input,4,_ctx) ) {
			case 1:
				enterOuterAlt(_localctx, 1);
				{
				setState(62);
				match(FLOAT);
				}
				break;
			case 2:
				enterOuterAlt(_localctx, 2);
				{
				setState(63);
				match(FLOAT);
				setState(64);
				match(X);
				}
				break;
			case 3:
				enterOuterAlt(_localctx, 3);
				{
				setState(65);
				match(X);
				}
				break;
			case 4:
				enterOuterAlt(_localctx, 4);
				{
				setState(66);
				match(DIGIT_SUBID);
				}
				break;
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	@SuppressWarnings("CheckReturnValue")
	public static class WordContext extends ParserRuleContext {
		public TerminalNode WORD() { return getToken(RTRegexParser.WORD, 0); }
		public WordContext(ParserRuleContext parent, int invokingState) {
			super(parent, invokingState);
		}
		@Override public int getRuleIndex() { return RULE_word; }
	}

	public final WordContext word() throws RecognitionException {
		WordContext _localctx = new WordContext(_ctx, getState());
		enterRule(_localctx, 6, RULE_word);
		try {
			enterOuterAlt(_localctx, 1);
			{
			setState(69);
			match(WORD);
			}
		}
		catch (RecognitionException re) {
			_localctx.exception = re;
			_errHandler.reportError(this, re);
			_errHandler.recover(this, re);
		}
		finally {
			exitRule();
		}
		return _localctx;
	}

	public boolean sempred(RuleContext _localctx, int ruleIndex, int predIndex) {
		switch (ruleIndex) {
		case 1:
			return expr_sempred((ExprContext)_localctx, predIndex);
		}
		return true;
	}
	private boolean expr_sempred(ExprContext _localctx, int predIndex) {
		switch (predIndex) {
		case 0:
			return precpred(_ctx, 6);
		case 1:
			return precpred(_ctx, 5);
		case 2:
			return precpred(_ctx, 4);
		case 3:
			return precpred(_ctx, 3);
		case 4:
			return precpred(_ctx, 7);
		}
		return true;
	}

	public static final String _serializedATN =
		"\u0004\u0001\u0015H\u0002\u0000\u0007\u0000\u0002\u0001\u0007\u0001\u0002"+
		"\u0002\u0007\u0002\u0002\u0003\u0007\u0003\u0001\u0000\u0001\u0000\u0001"+
		"\u0000\u0001\u0000\u0003\u0000\r\b\u0000\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0003"+
		"\u0001)\b\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001"+
		"\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0005\u0001:\b"+
		"\u0001\n\u0001\f\u0001=\t\u0001\u0001\u0002\u0001\u0002\u0001\u0002\u0001"+
		"\u0002\u0001\u0002\u0003\u0002D\b\u0002\u0001\u0003\u0001\u0003\u0001"+
		"\u0003\u0000\u0001\u0002\u0004\u0000\u0002\u0004\u0006\u0000\u0001\u0002"+
		"\u0000\u0001\u0001\u000e\u000fS\u0000\f\u0001\u0000\u0000\u0000\u0002"+
		"(\u0001\u0000\u0000\u0000\u0004C\u0001\u0000\u0000\u0000\u0006E\u0001"+
		"\u0000\u0000\u0000\b\t\u0003\u0002\u0001\u0000\t\n\u0005\u0000\u0000\u0001"+
		"\n\r\u0001\u0000\u0000\u0000\u000b\r\u0005\u0000\u0000\u0001\f\b\u0001"+
		"\u0000\u0000\u0000\f\u000b\u0001\u0000\u0000\u0000\r\u0001\u0001\u0000"+
		"\u0000\u0000\u000e\u000f\u0006\u0001\uffff\uffff\u0000\u000f\u0010\u0007"+
		"\u0000\u0000\u0000\u0010)\u0003\u0004\u0002\u0000\u0011\u0012\u0007\u0000"+
		"\u0000\u0000\u0012\u0013\u0003\u0004\u0002\u0000\u0013\u0014\u0003\u0002"+
		"\u0001\f\u0014)\u0001\u0000\u0000\u0000\u0015\u0016\u0007\u0000\u0000"+
		"\u0000\u0016\u0017\u0003\u0004\u0002\u0000\u0017\u0018\u0005\u0002\u0000"+
		"\u0000\u0018\u0019\u0003\u0002\u0001\u000b\u0019)\u0001\u0000\u0000\u0000"+
		"\u001a\u001b\u0005\u0003\u0000\u0000\u001b\u001c\u0003\u0002\u0001\u0000"+
		"\u001c\u001d\u0005\u0004\u0000\u0000\u001d)\u0001\u0000\u0000\u0000\u001e"+
		"\u001f\u0005\u0005\u0000\u0000\u001f \u0003\u0006\u0003\u0000 !\u0003"+
		"\u0002\u0001\t!)\u0001\u0000\u0000\u0000\"#\u0005\u0005\u0000\u0000#$"+
		"\u0003\u0006\u0003\u0000$%\u0005\u0000\u0000\u0001%)\u0001\u0000\u0000"+
		"\u0000&)\u0005\t\u0000\u0000\')\u0005\u0010\u0000\u0000(\u000e\u0001\u0000"+
		"\u0000\u0000(\u0011\u0001\u0000\u0000\u0000(\u0015\u0001\u0000\u0000\u0000"+
		"(\u001a\u0001\u0000\u0000\u0000(\u001e\u0001\u0000\u0000\u0000(\"\u0001"+
		"\u0000\u0000\u0000(&\u0001\u0000\u0000\u0000(\'\u0001\u0000\u0000\u0000"+
		");\u0001\u0000\u0000\u0000*+\n\u0006\u0000\u0000+,\u0005\u0007\u0000\u0000"+
		",:\u0003\u0002\u0001\u0007-.\n\u0005\u0000\u0000./\u0005\r\u0000\u0000"+
		"/:\u0003\u0002\u0001\u000601\n\u0004\u0000\u000012\u0005\f\u0000\u0000"+
		"2:\u0003\u0002\u0001\u000534\n\u0003\u0000\u000045\u0005\b\u0000\u0000"+
		"5:\u0003\u0002\u0001\u000467\n\u0007\u0000\u000078\u0005\u0006\u0000\u0000"+
		"8:\u0005\u000b\u0000\u00009*\u0001\u0000\u0000\u00009-\u0001\u0000\u0000"+
		"\u000090\u0001\u0000\u0000\u000093\u0001\u0000\u0000\u000096\u0001\u0000"+
		"\u0000\u0000:=\u0001\u0000\u0000\u0000;9\u0001\u0000\u0000\u0000;<\u0001"+
		"\u0000\u0000\u0000<\u0003\u0001\u0000\u0000\u0000=;\u0001\u0000\u0000"+
		"\u0000>D\u0005\u000b\u0000\u0000?@\u0005\u000b\u0000\u0000@D\u0005\u0011"+
		"\u0000\u0000AD\u0005\u0011\u0000\u0000BD\u0005\n\u0000\u0000C>\u0001\u0000"+
		"\u0000\u0000C?\u0001\u0000\u0000\u0000CA\u0001\u0000\u0000\u0000CB\u0001"+
		"\u0000\u0000\u0000D\u0005\u0001\u0000\u0000\u0000EF\u0005\u0013\u0000"+
		"\u0000F\u0007\u0001\u0000\u0000\u0000\u0005\f(9;C";
	public static final ATN _ATN =
		new ATNDeserializer().deserialize(_serializedATN.toCharArray());
	static {
		_decisionToDFA = new DFA[_ATN.getNumberOfDecisions()];
		for (int i = 0; i < _ATN.getNumberOfDecisions(); i++) {
			_decisionToDFA[i] = new DFA(_ATN.getDecisionState(i), i);
		}
	}
}