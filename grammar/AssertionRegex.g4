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
	| ID comparator INT	# intComparison
	| ID				# identifier
	| BOOLEAN			# boolean;

comparator: '=' | '!=' | '<' | '<=' | '>' | '>=';

BOOLEAN: 'true' | 'false';
ID: [a-zA-Z_][a-zA-Z0-9_]*;
INT: [1-9][0-9]*;
WS: [ \t\r\n]+ -> skip;