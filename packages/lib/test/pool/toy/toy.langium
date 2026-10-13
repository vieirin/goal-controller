grammar Toy

entry Model: (things+=Thing | puts+=Put)*;

Thing: 'thing' name=ID ('{' parts+=Part* '}')?;
Part: 'part' name=ID ('of' kind=[Thing:ID])?;
Put: 'put' thing=[Thing:ID] ('.' part=[Part:ID])? 'on' shelf=[Shelf:ID];

// a shelf is written in shelves.json, not here
interface Shelf { name: string }

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w]*/;
