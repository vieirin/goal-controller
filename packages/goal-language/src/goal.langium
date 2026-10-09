// The goal language: one grammar every dialect is written in. A dialect does not
// change it; it enables some of its operators (src/catalog.ts) and says which
// value type each property has, and the validator (src/validator.ts) reports
// what a dialect does not allow.
//
// - A document is lines: element lines (`G1: Name [G2;G3]`, with annotations
//   before and a declaration after) and property lines under them
//   (`maintain battery > 20`). A dialect without ids writes PlainDocument.
// - Tokens are made by GoalLexer (src/lexer.ts), which switches token sets by
//   where it is in a line and reads with ANTLR's longest-match rule (the
//   terminals below only declare the vocabulary). Element lines with ids read as
//   packages/lib/grammar/*/RTRegex.g4 did.
// - Each value type has a rule reading one value on its own (an inspector
//   field): AssertionValue, IntValue, ... AnnotatedName.
grammar Goal

entry Document:
    (NL | lines+=Line | reach+=Reach)*;

Line:
    ElementLine | PropertyLine;

PlainDocument:
    (NL | lines+=AnnotatedName)*;

// `<<action>> {type = duty} T1: Name [T2;T3] {int 0..100 = 80}`
ElementLine:
    annotations+=Annotation* name=ElementId ':' label=WORD
    ('[' notation=RtExpr ']')? declaration=Declaration?;

// a modelling dialect's line: `<<goal-based>> {Id = A1} Name`, or with an id,
// `<<goal-based>> G1: Name` (an id names its element; without one, a line is
// its element's by position). ElementLine stays its own rule: there the id is
// required, and the name is RTRegex.g4's WORD.
AnnotatedName:
    annotations+=Annotation* (name=ElementId ':')? label=PLAIN_NAME
    ('[' notation=RtExpr ']')? declaration=Declaration?;

ElementId returns string:
    ('G' | 'T' | 'R' | 'AT') (FLOAT 'X'? | 'X' | DIGIT_SUBID);

Annotation:
    {infer Stereotype} '<<' stereotype=TEXT '>>'
    | {infer Tag} '{' tag=TEXT ('=' tagValue=TEXT)? '}';

// a resource's: `{int 0..100 = 80}`, `{bool = false}`
Declaration:
    '{' type=IDENT (lowerBound=INTEGER '..' upperBound=INTEGER)?
    ('=' initialValue=(INTEGER | IDENT))? '}';

PropertyLine:
    key=KEY value=VALUE?;

// ---------------------------------------------------------------------------
// The RT notation: the catalog's operators, with a fixed precedence (tightest
// first). Every binary operator is left-associative, as ANTLR's left-recursive
// alternatives were.
// ---------------------------------------------------------------------------

// `,` binds loosest of all; it is written apart from the other binary
// operators so that a call's arguments, read just below it, are separated by
// commas that are not it (left-associative, as an infix rule would be)
RtExpr:
    RtBinary ({infer RtComma.left=current} operator=',' right=RtBinary)*;

infix RtBinary on RtPrefix:
    '^' > '|' > '?' > '+' > '&' > '#' > '~' > ';' > '->';

RtPrefix infers RtExpr:
    {infer RtNot} operator='!' expr=RtPrefix
    | RtPostfix;

RtPostfix infers RtExpr:
    RtPrimary ({infer RtArgument.expr=current} operator='@' argument=FLOAT)*;

RtPrimary infers RtExpr:
    {infer RtGroup} open='[' expr=RtExpr ']'
    | {infer RtGroup} open='(' expr=RtExpr ')'
    | {infer RtCall} function='FALLBACK' '(' args+=RtBinary (',' args+=RtBinary)* ')'
    | {infer RtSkip} keyword='skip'
    | {infer RtStandalone} symbol=('+' | '*' | '?' | '#')
    | {infer RtRef} ref=[ElementLine:ElementId];

// ---------------------------------------------------------------------------
// Predefined value types, one rule each (an inspector field reads one alone)
// ---------------------------------------------------------------------------

AssertionValue:
    {infer AssertionValue} expr=AssertExpr?;

// '&' binds tighter than '|'; '!' negates everything after it
AssertExpr:
    AssertBinary;

infix AssertBinary on AssertUnary:
    '&' > '|';

AssertUnary infers AssertExpr:
    {infer AssertNot} '!' expr=AssertExpr
    | AssertPrimary;

AssertPrimary infers AssertExpr:
    {infer AssertParen} '(' expr=AssertExpr ')'
    | {infer AssertAssign} variable=A_ID '=' value=AssertBool
    | {infer AssertCompare} variable=A_ID operator=Comparator value=A_INT
    | {infer AssertVar} variable=A_ID
    | {infer AssertConst} value=AssertBool;

Comparator returns string:
    '=' | '!=' | '<' | '<=' | '>' | '>=';

AssertBool returns string:
    'true' | 'false';

IntValue:
    {infer IntValue} value=INTEGER?;

NumberValue:
    {infer NumberValue} value=(INTEGER | NUMBER)?;

BoolValue:
    {infer BoolValue} value=AssertBool?;

TextValue:
    {infer TextValue} value=VALUE?;

EnumValue:
    {infer EnumValue} value=VALUE?;

RefListValue:
    {infer RefListValue} (ids+=ElementId (',' ids+=ElementId)*)?;

PairListValue:
    {infer PairListValue} (pairs+=Pair (',' pairs+=Pair)*)?;

// OCL as MutRoSe's goal models write it (`world_db->select(r:Room | r.dirty)`,
// `rooms->forAll(r | r.clean)`, `current : Room, rooms : Sequence(Room)`): read
// as its tokens, leniently; an engine's checks read its structure
OclValue:
    {infer OclValue} parts+=OclPart*;

OclPart returns string:
    IDENT | STRING | INTEGER | NUMBER | OclKeyword
    | '->' | '.' | ',' | ':' | '|' | '(' | ')' | '[' | ']'
    | '=' | '<>' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '!';

OclKeyword returns string:
    'select' | 'forAll' | 'exists' | 'collect' | 'reject' | 'in' | 'not'
    | 'and' | 'or' | 'assertion' | 'condition' | 'trigger'
    | 'true' | 'false' | 'True' | 'False';

Pair:
    name=IDENT ':' value=PAIR_VALUE;

// Langium builds only the rules its entry rule reaches: this one reaches the
// rules read on their own. GoalLexer never makes a REACH token, so a document
// never has one.
Reach:
    REACH plain=PlainDocument REACH assertion=AssertionValue REACH int=IntValue
    REACH number=NumberValue REACH bool=BoolValue REACH text=TextValue
    REACH enum=EnumValue REACH refList=RefListValue REACH pairList=PairListValue
    REACH ocl=OclValue;

// ---------------------------------------------------------------------------
// The vocabulary (GoalLexer makes the tokens)
// ---------------------------------------------------------------------------

// element lines, as RTRegex.g4's lexer read them
terminal DIGIT_SUBID: /[0-9][a-z]/;
terminal FLOAT: /[0-9]+\.?[0-9]*/;
terminal WORD: /[A-Za-z\- ']+/;
// a name on a line without an id: anything up to its notation or declaration
terminal PLAIN_NAME: /[^\s\[\]{}<](?:[^\r\n\[\]{}]*[^\s\[\]{}])?/;
// an annotation's text
terminal TEXT: /[^\s<>{}=](?:[^\r\n<>{}=]*[^\s<>{}=])?/;
// a declaration's words, a pair's name
terminal IDENT: /[A-Za-z_][A-Za-z0-9_]*/;
terminal KEY: /[A-Za-z][A-Za-z0-9_]*/;
// a property line's value, or a text/enum value: the rest of the line, trimmed
terminal VALUE: /[^\s](?:[^\r\n]*[^\s])?/;
// the assertion language
terminal A_ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal A_INT: /[0-9]+/;
terminal INTEGER: /-?[0-9]+/;
terminal NUMBER: /-?[0-9]+\.[0-9]+/;
terminal PAIR_VALUE: /[^\s,:](?:[^\r\n,:]*[^\s,:])?/;
// an OCL string literal
terminal STRING: /"[^"\r\n]*"/;
terminal REACH: /\u0000reach\u0000/;
// a line break, in a document
terminal NL: /[\r\n]+/;

hidden terminal WS: /[ \t]+/;
