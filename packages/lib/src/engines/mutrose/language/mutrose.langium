// MutRoSe's language: the values of a MutRoSe goal model's properties, each
// read on its own (an element's field), as MutRoSe's decomposer and
// lsp-mutrose read them.
//
// - Tokens are made by MutroseLexer (./lexer.ts), which has a token set for
//   each start (the terminals below only declare the vocabulary).
// - OclExpression and OclVariables are OCL, typed (lsp-mutrose's OCL.g4):
//   what a value refers to, with ranges. Spaces between tokens are hidden.
// - ForAllShape, SelectShape, Names, RobotNumber and CreationCondition are
//   the shapes the decomposer accepts (`utils/gm_utils.cpp`, `gm_utils.hpp`):
//   it reads them with regexes, so where a regex forbids a space, or takes any
//   text, the lexer does too, and the checks report what the decomposer would.
grammar MutRoSe

// Langium builds only the rules its entry rule reaches: this one reaches the
// rules read on their own. MutroseLexer never makes a REACH token.
entry Reach:
    REACH expression=OclExpression REACH variables=OclVariables
    REACH names=Names REACH robotNumber=RobotNumber
    REACH creation=CreationCondition REACH forAll=ForAllShape
    REACH select=SelectShape REACH type=VariableType;

// ---------------------------------------------------------------------------
// OCL (lsp-mutrose's OCL.g4)
// ---------------------------------------------------------------------------

// a query (`world_db->select(r:Room | r.dirty)`) or a condition
// (`rooms->forAll(r | r.clean)`, `not current_room.occupied`); empty is valid
OclExpression:
    {infer OclExpression} expr=OclExpr?;

// OCL.g4's boolExpr and boolTerm: `&&` binds tighter than `||`
OclExpr:
    OclBinary;

infix OclBinary on OclUnary:
    '&&' | 'and' > '||' | 'or';

// OCL.g4's NOT boolFactor: it negates a whole comparison (`!r.x = 0`)
OclUnary infers OclExpr:
    {infer OclNot} operator=('!' | 'not') expr=OclUnary
    | OclComparison;

// OCL.g4's predicate
OclComparison infers OclExpr:
    OclPrimary ({infer OclCompare.left=current} operator=OclComparator right=OclPrimary)?;

OclComparator returns string:
    '=' | '<>' | '!=' | '<' | '<=' | '>' | '>=' | 'in';

OclPrimary infers OclExpr:
    {infer OclParen} '(' expr=OclExpr ')'
    | {infer OclLiteral} value=(STRING | INTEGER | NUMBER | 'true' | 'false' | 'True' | 'False')
    | OclNavigation;

// a path, and the collection operations called on it
// (`current_room.objects->select(o:Object | !o.is_picked)`); a body may be
// empty (`rooms->forAll(r | )`)
OclNavigation infers OclExpr:
    OclPath ({infer OclCall.source=current} '->' operation=OclOperation
    '(' variable=IDENT (':' type=OclType)? '|' body=OclExpr? ')')*;

OclOperation returns string:
    'select' | 'forAll' | 'exists' | 'collect' | 'reject';

// `a.b.c`: a variable, then its attributes
OclPath:
    head=IDENT ('.' attributes+=IDENT)*;

OclType:
    name=IDENT;

// `current : Room, rooms : Sequence(Room), other` (Controls, Monitors), as
// `parse_vars` reads it: an item's name is its first word before a colon, its
// type the first word after it (`Sequence(Room)` one word), and the rest of
// the item is IGNORED, so an item may have no name. Every item after the first
// is a NextVariable, from its comma: an empty item has no OclVariable, but
// its comma keeps its place.
OclVariables:
    first=OclVariable? next+=NextVariable*;

NextVariable:
    ',' item=OclVariable?;

OclVariable:
    IGNORED* (name=NAME IGNORED*)? (':' IGNORED* (type=VariableType IGNORED*)?)?;

// `Room`, `Sequence(Room)`: a type, and the class of its items
VariableType:
    name=TYPE_WORD ('(' element=NAME ')')?;

// ---------------------------------------------------------------------------
// The decomposer's shapes
// ---------------------------------------------------------------------------

// Params, Location: names, comma-separated, as NextVariable keeps its place;
// an item is one name (`name`) or anything else (`others`: `room hall`,
// `1room`)
Names:
    first=NameItem? next+=NextName*;

NextName:
    ',' item=NameItem?;

NameItem:
    (name=NAME | others+=OTHER) others+=(NAME | OTHER)*;

// `parse_robot_number`: `N` or `[lo,hi]`, no spaces anywhere
RobotNumber:
    {infer RobotNumber} (count=INTEGER | '[' lower=INTEGER ',' upper=INTEGER ']')?;

// `assertion condition "expr"`, `assertion trigger "Event"`: the words in any
// case, spaces required between them
CreationCondition:
    SPACE? ASSERTION SPACE kind=(CONDITION | TRIGGER) SPACE value=STRING SPACE?;

// `forall_regex_exp`: `coll->forAll(it | condition)`, no space but before the
// pipe; the condition is any text on one line
ForAllShape:
    iterated=PATH '->' 'forAll' '(' iteration=PATH SPACE? '|' condition=BODY? ')';

// `select_regex_exp`: `source->select(v:Type | condition)`; the type has two
// characters at least, the condition is any text on one line
SelectShape:
    source=PATH '->' 'select' '(' variable=PATH ':' type=PATH SPACE? '|' SPACE?
    condition=BODY? ')';

// ---------------------------------------------------------------------------
// The vocabulary (MutroseLexer makes the tokens)
// ---------------------------------------------------------------------------

// a creation condition's words, in any case
terminal ASSERTION: /assertion/i;
terminal CONDITION: /condition/i;
terminal TRIGGER: /trigger/i;
// OCL's
terminal IDENT: /[A-Za-z_][A-Za-z0-9_]*/;
terminal STRING: /"[^"]*"/;
terminal NUMBER: /-?[0-9]+\.[0-9]+/;
terminal INTEGER: /-?[0-9]+/;
// a variable's name, a name in a list
terminal NAME: /[A-Za-z][A-Za-z0-9_]*/;
terminal TYPE_WORD: /[A-Za-z0-9]+/;
// a shape's path (`[a-zA-Z][\w.]*`) and its condition (the rest of the line)
terminal PATH: /[a-zA-Z][\w.]*/;
terminal BODY: /[^\r\n]+/;
// spaces a shape requires or allows
terminal SPACE: /\s+/;
// what `parse_vars` ignores in an item
terminal IGNORED: /[^,]+/;
// what a shape does not allow where it is
terminal OTHER: /[^\s,]+/;
terminal REACH: /\u0000reach\u0000/;

// spaces between OCL's tokens, and between names
hidden terminal SKIPPED: /[\s\S]+/;
