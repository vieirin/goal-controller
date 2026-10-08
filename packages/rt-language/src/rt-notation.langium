// RT notation: one `NodeLine` per goal/task, e.g. `G1: Name [G2;G3@2->T4]`.
// The expression language reproduces packages/lib/grammar/edgeV2/RTRegex.g4
// (same tokens, same precedence). Tokenization is done by RtLexer (src/lexer.ts),
// which applies ANTLR's longest-match rule: the terminal patterns below only
// declare the token vocabulary.
grammar RtNotation

entry Document:
    lines+=NodeLine*;

NodeLine:
    name=NodeId ':' label=WORD ('[' notation=Expr ']')?;

NodeId returns string:
    ('G' | 'T' | 'R') (FLOAT 'X'? | 'X' | DIGIT_SUBID);

Expr:
    BinaryExpr;

// precedence from tightest to loosest, all left-associative like ANTLR's
// left-recursive alternatives
infix BinaryExpr on RetryExpr:
    '|' > '?' > '+' > '#' > ';' > '->';

RetryExpr infers Expr:
    Primary ({infer RetryExpr.expr=current} '@' times=FLOAT)*;

Primary infers Expr:
    {infer Bracket} '[' expr=Expr ']'
    | {infer Skip} 'skip'
    | {infer Ref} ref=[NodeLine:NodeId];

terminal DIGIT_SUBID: /[0-9][a-z]/;
terminal FLOAT: /[0-9]+\.?[0-9]*/;
terminal WORD: /[A-Za-z\- ']+/;

hidden terminal WS: /\t+/;
// a line break plus the next line's indentation (indentation is presentation only)
hidden terminal LINEBREAK: /[\r\n]+[ \t]*/;
