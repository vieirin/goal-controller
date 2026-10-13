// HDDL's domains (Höller et al., 2020), as MutRoSe's decomposer reads them:
// the definitions (types, predicates, functions, tasks, methods, actions,
// their parameters) and what refers to them. Names are read in any case
// (langium-config.json's caseInsensitive keywords; the pool's kinds compare
// names lowercased).
grammar Hddl

entry Domain:
    '(' 'define' '(' 'domain' name=NAME ')' sections+=Section* ')';

Section:
    '(' (Requirements | Types | Constants | Predicates | Functions
        | Task | Method | Action) ')';

Requirements:
    ':requirements' {infer Requirements} flags+=KEYWORD*;

// `room nurse - object robot`: the names, then their supertype
Types:
    ':types' {infer Types} groups+=TypeGroup*;

TypeGroup:
    types+=TypeDecl+ ('-' supertype=TypeRef)?;

TypeDecl:
    name=NAME;

// `object`, HDDL's root, is no domain's type
TypeRef:
    type=[TypeDecl:NAME] | object?='object';

Constants:
    ':constants' {infer Constants} groups+=ConstantGroup*;

ConstantGroup:
    constants+=Constant+ ('-' type=TypeRef)?;

Constant:
    name=NAME;

Predicates:
    ':predicates' {infer Predicates} predicates+=Predicate*;

Predicate:
    '(' name=NAME parameters+=VariableGroup* ')';

Functions:
    ':functions' {infer Functions} functions+=FunctionDecl*;

FunctionDecl:
    '(' name=NAME parameters+=VariableGroup* ')' ('-' 'number')?;

// `?a ?b - room ?c`: the variables, then their type (`object` when none)
VariableGroup:
    variables+=Parameter+ ('-' type=TypeRef)?;

Parameter:
    name=VARIABLE;

Task:
    ':task' name=NAME Parameters?
    (':precondition' precondition=Formula)?
    (':effect' effect=Formula)?;

fragment Parameters:
    ':parameters' '(' parameters+=VariableGroup* ')';

Method:
    ':method' name=NAME Parameters?
    ':task' '(' task=[Task:NAME] args+=Term* ')'
    (':precondition' precondition=Formula)?
    (SubtaskKeyword subtasks=Network)?
    (':ordering' ordering=SExpr)?
    (':constraints' constraints=SExpr)?;

SubtaskKeyword returns string:
    ':subtasks' | ':ordered-subtasks' | ':tasks' | ':ordered-tasks';

Action:
    ':action' name=NAME Parameters?
    (':precondition' precondition=Formula)?
    (':effect' effect=Formula)?;

type Operation = Task | Action;

// `()`, `(move ?b ?l)`, `(and (task0 (move ?b ?l)) (give ?b ?r))`
Network:
    '(' {infer Network} ('and' subtasks+=Subtask* | subtasks+=SubtaskBody)? ')';

Subtask infers SubtaskBody:
    '(' SubtaskBody ')';

// a labelled subtask (`task0 (move ?b ?l)`) or not
SubtaskBody:
    label=NAME '(' task=[Operation:NAME] args+=Term* ')'
    | task=[Operation:NAME] args+=Term*;

// `?b`: a parameter of the operation, or of a quantifier around it; a name:
// a constant
Term:
    VariableRef | ConstantRef;

VariableRef:
    variable=[Parameter:VARIABLE];

ConstantRef:
    name=NAME;

Formula:
    '(' {infer Formula} body=FormulaBody? ')';

FormulaBody:
    And | Or | Not | Imply | When | Quantified | Numeric | Atomic;

And:
    'and' {infer And} parts+=Formula*;

Or:
    'or' {infer Or} parts+=Formula*;

Not:
    'not' part=Formula;

Imply:
    'imply' condition=Formula consequence=Formula;

When:
    'when' condition=Formula effect=Formula;

// its variables are its own: they hide the operation's of the same name
Quantified:
    quantifier=('forall' | 'exists') '(' variables+=VariableGroup* ')' body=Formula;

// a comparison or a numeric effect over functions' terms (`(objects ?r)`)
Numeric:
    operator=('=' | '<' | '>' | '<=' | '>=' | 'increase' | 'decrease'
        | 'assign' | 'scale-up' | 'scale-down') args+=NumericTerm*;

NumericTerm:
    FunctionTerm | Term | NumberLiteral;

FunctionTerm:
    '(' function=[FunctionDecl:NAME] args+=Term* ')';

NumberLiteral:
    value=NUMBER;

Atomic:
    predicate=[Predicate:NAME] args+=Term*;

// what the pool doesn't read (`:ordering`, `:constraints`), kept parseable
SExpr:
    '(' {infer SExpr} items+=SItem* ')';

SItem:
    SExpr | SAtom;

SAtom:
    value=(NAME | VARIABLE | NUMBER | KEYWORD | 'and' | 'or' | 'not' | '<'
        | '>' | '=' | '<=' | '>=' | '-');

terminal VARIABLE: /\?[A-Za-z][A-Za-z0-9_-]*/;
terminal NAME: /[A-Za-z][A-Za-z0-9_-]*/;
terminal NUMBER: /-?[0-9]+(\.[0-9]+)?/;
terminal KEYWORD: /:[A-Za-z][A-Za-z0-9_-]*/;

hidden terminal WS: /\s+/;
hidden terminal COMMENT: /;[^\n\r]*/;
