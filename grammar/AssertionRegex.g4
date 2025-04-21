grammar AssertionRegex;

@rulecatch {
   catch (RecognitionException e) {
    throw e;
   }
}

assertion: expr EOF # printExpr | EOF # blank;

expr:
	expr '&' expr	# andExpr
	| expr '|' expr	# orExpr
	| '(' expr ')'	# parenExpr
	| ID			# identifier;

ID: [a-zA-Z_][a-zA-Z0-9_]*;
WS: [ \t\r\n]+ -> skip;