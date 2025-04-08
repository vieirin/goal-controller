grammar RTRegex;

@rulecatch {
   catch (RecognitionException e) {
    throw e;
   }
}

rt: expr EOF # printExpr | EOF # blank;

expr:
	t = ('G' | 'T' | 'M' | 'R') id				# gId
	| t = ('G' | 'T' | 'M' | 'R') id expr		# gIdContinued
	| t = ('G' | 'T' | 'M' | 'R') id ',' expr	# gArgs
	| '[' expr ']'								# notationStart
	| 'DM(' expr ')'							# gDecisionMaking
	| ':' word expr								# nameContinued
	| ':' word EOF								# nameOnly
	| expr op = ',' expr						# gDM
	| expr op = '@' FLOAT						# gRetry
	| expr op = '|' expr						# gInterleaved
	| expr op = ';' expr						# gSequence
	| 'try(' expr ')' '?' expr ':' expr			# gTry
	| expr op = (';' | '#') expr				# gTime
	| SKIPP										# gSkip;

id: FLOAT | FLOAT X | X | DIGIT_SUBID;
DIGIT_SUBID: DIGIT SUBID;
FLOAT: DIGIT+ '.'? DIGIT*;
SEQ: ';';
INT: '#';
TASK: 'T';
GOAL: 'G';
SKIPP: 'skip';
X: 'X';
NEWLINE: [\r\n]+;
word: WORD;
WORD: [A-Za-z- ']+;
SUBID: [a-z];
WS: [\t]+ -> skip;
fragment DIGIT: [0-9];