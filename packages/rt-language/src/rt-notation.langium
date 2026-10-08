// RT notation: one `NodeLine` per goal/task/resource, e.g. `G1: Name [G2;G3@2->T4]`,
// optionally followed by property lines (`maintain battery > 20`) indented under it.
// - The goal expression language reproduces packages/lib/grammar/edgeV2/RTRegex.g4,
//   the assertion language packages/lib/grammar/AssertionRegex.g4 (same tokens, same
//   precedence).
// - Tokenization is done by RtLexer (src/lexer.ts): it applies ANTLR's longest-match
//   rule and switches token sets per line kind (RT text, an assertion, a dependsOn
//   list, a raw value, a resource declaration). The terminal patterns below only
//   declare the token vocabulary.
grammar RtNotation

entry Document:
    lines+=Line*;

Line:
    NodeLine | PropertyLine;

NodeLine:
    name=NodeId ':' label=WORD ('[' notation=Expr ']')? ('{' resource=ResourceDecl '}')?;

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

// ---------------------------------------------------------------------------
// Resources: `R1: Battery {int 0..100 = 80}`, `R2: Alarm {bool = false}`
// (round-trips to the type, lowerBound, upperBound and initialValue properties;
// the values are checked by the engine's own resource checks)
// ---------------------------------------------------------------------------

ResourceDecl:
    type=DECL_WORD (lowerBound=DeclNumber '..' upperBound=DeclNumber)? ('=' initialValue=DeclValue)?;

DeclNumber returns string:
    DECL_NUM;

DeclValue returns string:
    DECL_NUM | DECL_WORD;

// ---------------------------------------------------------------------------
// Properties, one per line under their element. Each value rule is also an entry
// for parsing one value on its own (the inspector's fields, the engine).
// ---------------------------------------------------------------------------

PropertyLine:
    {infer ConditionProperty} key=('maintain' | 'assertion') value=AssertionValue
    | {infer DependsOnProperty} key='dependsOn' value=DependsOnValue
    | {infer RawProperty} key=('variables' | 'utility' | 'cost' | 'maxRetries' | 'type' | 'root') value=RawValue;

AssertionValue:
    {infer AssertionValue} expr=AssertExpr?;

// ids by name: checked against the model (they may name elements this document
// does not show)
DependsOnValue:
    {infer DependsOnValue} (ids+=DependsOnId (',' ids+=DependsOnId)*)?;

DependsOnId:
    name=NodeId;

RawValue:
    {infer RawValue} text=VALUE?;

// AssertionRegex.g4: '&' binds tighter than '|'; '!' negates everything after it
AssertExpr:
    AssertBinary;

infix AssertBinary on AssertUnary:
    '&' > '|';

AssertUnary infers AssertExpr:
    {infer AssertNot} '!' expr=AssertExpr
    | AssertPrimary;

// identifiers by name: a resource of the model or a workbench variable
AssertPrimary infers AssertExpr:
    {infer AssertParen} '(' expr=AssertExpr ')'
    | {infer AssertAssign} variable=A_ID '=' value=AssertBool
    | {infer AssertCompare} variable=A_ID op=Comparator value=A_INT
    | {infer AssertVar} variable=A_ID
    | {infer AssertConst} value=AssertBool;

Comparator returns string:
    '=' | '!=' | '<' | '<=' | '>' | '>=';

AssertBool returns string:
    'true' | 'false';

terminal DIGIT_SUBID: /[0-9][a-z]/;
terminal FLOAT: /[0-9]+\.?[0-9]*/;
terminal WORD: /[A-Za-z\- ']+/;
terminal A_ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
// AssertionRegex.g4's INT: no zero (`x > 0` does not parse there either)
terminal A_INT: /[1-9][0-9]*/;
terminal DECL_NUM: /-?[0-9]+/;
terminal DECL_WORD: /[A-Za-z_][A-Za-z0-9_]*/;
terminal VALUE: /[^\r\n]+/;

hidden terminal WS: /[ \t]+/;
// a line break plus the next line's indentation (indentation is presentation only)
hidden terminal LINEBREAK: /[\r\n]+[ \t]*/;
