// The toy textual format of goal-controller#143: a chore list, its goals
// needing all or any of its items, its tasks with a cost. Five rules.
grammar Chores

entry ChoreList:
    'chores' title=STRING items+=Item*;

Item:
    Goal | Task;

Goal:
    'goal' name=ID label=STRING Needs?;

fragment Needs:
    'needs' (all?='all' | 'any') needs+=[Item:ID] (',' needs+=[Item:ID])*;

Task:
    'task' name=ID label=STRING ('cost' cost=NUMBER)?;

hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
terminal ID: /[A-Za-z_][A-Za-z0-9_]*/;
terminal NUMBER returns number: ('0'..'9')+ ('.' ('0'..'9')+)?;
terminal STRING: /"[^"]*"/;
