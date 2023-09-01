grammar Goal;

@rulecatch {
   catch (RecognitionException e) {
    throw e;
   }
}

rt: expr;

expr:
	'id' ':' UUID_V4 expr
	| 'text' ':' GOAL expr
	| 'type' ':' 'istar.' iStarType expr
	| 'x' ':' NUMBER expr
	| 'y' ':' NUMBER expr
	| 'customProperties' ':' expr
	| 'selected' ':' BOOLEAN expr
	| ',' expr
	| EOF
	| SKIPP;

BOOLEAN: 'true' | 'false';

iStarType: | 'Task' | 'Goal' | 'Actor';

GOAL: 'G' ID ':' GOALNAME;

GOALNAME: [a-zA-Z]+;

NUMBER: DIGIT+;

ID: FLOAT | FLOAT X | X;

FLOAT: DIGIT+ '.'? DIGIT*;
SEQ: ';';
INT: '#';
TASK_TKN: 'T';
GOAL_TKN: 'G';
SKIPP: 'skip';
X: 'X';
NEWLINE: [\r\n]+;
WS: [{}"]+ -> skip;

fragment DIGIT: [0-9];

UUID_V4:
	HEX_8 '-' HEX_4 '-' '4' HEX_3 '-' [89abAB] HEX_3 '-' HEX_8 HEX_4;

fragment HEX_8: HEX HEX HEX HEX HEX HEX HEX HEX;
fragment HEX_4: HEX HEX HEX HEX;
fragment HEX_3: HEX HEX HEX;
fragment HEX: [0-9a-fA-F];