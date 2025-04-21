grammar AssertionRegex;

@rulecatch {
   catch (RecognitionException e) {
    throw e;
   }
}

assertion: expr EOF # printExpr | EOF # blank;

expr:
	expr '&' expr		# andExpr
	| expr '|' expr		# orExpr
	| '!' expr			# notExpr
	| '(' expr ')'		# parenExpr
	| ID '=' BOOLEAN	# assignment
	| ID				# identifier
	| BOOLEAN			# boolean;

ID: [a-zA-Z_][a-zA-Z0-9_]*;
BOOLEAN: 'true' | 'false';
WS: [ \t\r\n]+ -> skip;