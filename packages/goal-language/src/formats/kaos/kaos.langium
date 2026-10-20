// KAOSTools' textual KAOS (ancailliau/KAOSTools, Parsing/Parsers/
// GoalModelParser.peg, MIT), as goal-controller#181 reads it: the PEG's
// structure, and the older forms ADS's corpus (ancailliau/ADS, MIT) is
// written in.
//
// - A file is declarations (`declare goal [ g ] … end`, `override …`),
//   model attributes (`@title "…"`) and imports, in any order.
// - A declaration names what it declares with any word (`goal`, `expert`):
//   the reader places what it knows and keeps the others as written. Its
//   identifier is in brackets, or (the older syntax) an `id` attribute, or
//   none (anonymous, inside `refinedby`).
// - An attribute is a name, its parameters (`[case]`; `resolvedby`'s older
//   `(mitigation[g])`), and a list of values, each an atom decorated or not
//   (`a [.8]`, `a : b`, `a = b`): a formula, a string, a number, a name, a
//   tuple (`(20%, 20%, 40%)`), or an anonymous declaration.
// - A top-level declaration's `end` may be missing (ADS's simple.kaos has
//   one): it ends where the next item starts, and the reader says so. A
//   nested one's is required.
// - Formulas follow the PEG's rules; they are datatype rules, the reader
//   takes a formula's text from the CST.
grammar Kaos

entry KaosFile:
    items+=Item*;

Item:
    Declaration | ModelAttribute | Import;

ModelAttribute:
    name=MODEL_ATTRIBUTE value=STRING;

Import:
    'import' file=STRING;

Declaration:
    keyword=('declare' | 'override') kind=ID ('[' id=ID ']')?
    attributes+=Attribute* closed?='end'?;

NestedDeclaration infers Declaration:
    keyword=('declare' | 'override') kind=ID ('[' id=ID ']')?
    attributes+=Attribute* closed?='end';

// the older `resolvedby(mitigation[g]) r` besides the PEG's `resolvedby [mitigation:g] r`
Attribute:
    (name=('resolvedby' | 'resolvedBy')
        (('[' params+=Value (',' params+=Value)* ']')
            | (parenthesised?='(' params+=Value (',' params+=Value)* ')'))?
    | name=ID ('[' params+=Value (',' params+=Value)* ']')?)
    values+=Value (',' values+=Value)*;

Value:
    atom=Atom
    (('[' bracket+=Value (',' bracket+=Value)* ']') | (op=(':' | '=') right=Atom))?;

Atom:
    FormulaAtom | StringAtom | NumberAtom | NameAtom | StarAtom | TupleAtom | DeclarationAtom;

FormulaAtom:
    formula=Formula;

StringAtom:
    value=STRING;

NumberAtom:
    value=NUMBER;

NameAtom:
    value=(ID | 'true' | 'false');

StarAtom:
    value='*';

TupleAtom:
    '(' items+=Value (',' items+=Value)* ')';

DeclarationAtom:
    declaration=NestedDeclaration;

// ---------------------------------------------------------------------------
// Formulas (the PEG's Formula … TimeConstraint), as text
// ---------------------------------------------------------------------------

Formula returns string:
    Quantified | StrongBinary;

Quantified returns string:
    ('forall' | 'exists') ID ':' ID (',' ID ':' ID)* DOT Formula;

StrongBinary returns string:
    'when' Binary 'then' Formula | Binary;

Binary returns string:
    'if' TemporalBinary 'then' Formula | TemporalBinary ('iff' Formula)?;

TemporalBinary returns string:
    And (('until' EventuallyBound? Formula) | ('release' Formula) | (GloballyBound? 'unless' Formula))?;

And returns string:
    Or ('and' Formula)?;

Or returns string:
    Unary ('or' Formula)?;

Unary returns string:
    'not' Unary
    | 'next' Unary
    | ('sooner-or-later' | 'eventually') EventuallyBound? Unary
    | ('always' | 'globally') GloballyBound? Unary
    | FormulaAtomic;

FormulaAtomic returns string:
    RelationReference | Comparison | AttributeReference | PredicateReference | '(' Formula ')';

RelationReference returns string:
    '(' ID (',' ID)* ')' 'in' ID;

Comparison returns string:
    ComparisonMember Comparator ComparisonMember;

Comparator returns string:
    '==' | '!=' | '>=' | '<=' | '>' | '<';

ComparisonMember returns string:
    AttributeReference | PredicateReference | ID | STRING | NUMBER | 'true' | 'false';

AttributeReference returns string:
    ID DOT ID;

PredicateReference returns string:
    ID '(' (ID (',' ID)*)? ')';

EventuallyBound returns string:
    ',' (('strictly'? ('before' | 'after')) | 'in') TimeConstraint ',';

GloballyBound returns string:
    ',' 'for' ('strictly'? ('more' | 'less') 'than')? TimeConstraint ',';

// a number and its unit (`2 minutes`, `30 s`), one or more
TimeConstraint returns string:
    (NUMBER ID)+;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

hidden terminal WS: /[\s﻿]+/;
hidden terminal COMMENT: /#[^\r\n]*/;
// a quoted string, `""` a quote in it; `@"…"` the PEG's verbatim form
terminal STRING: /@?"(?:[^"]|"")*"/;
// `@title`, `@experts.quantiles`
terminal MODEL_ATTRIBUTE: /@[A-Za-z0-9._-]+/;
// as written: `.8`, `95%`, `1e-3`
terminal NUMBER: /(?:\d+(?:\.\d+)?|\.\d+)(?:e-?(?:\d+(?:\.\d+)?|\.\d+))?%?/;
// `$log_cps`: a custom attribute's name
terminal ID: /[A-Za-z$][A-Za-z0-9_-]*/;
terminal DOT: /\./;
