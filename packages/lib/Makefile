PATH  := /usr/local/bin/:node_modules/.bin/:/bin:/opt/homebrew/bin/:$(PATH)
SHELL := /bin/bash

.PHONY: grammar grammarRT grammarAssertion clean

grammar: grammarRT grammarAssertion

grammarRT: src/antlr/RTRegexLexer.ts src/antlr/RTRegexListener.ts src/antlr/RTRegexParser.ts

src/antlr/RTRegexLexer.ts src/antlr/RTRegexListener.ts src/antlr/RTRegexParser.ts: grammar/RTRegex.g4
	antlr -Dlanguage=TypeScript grammar/RTRegex.g4 && mv grammar/*.ts src/antlr

grammarAssertion: src/antlr/AssertionRegexLexer.ts src/antlr/AssertionRegexListener.ts src/antlr/AssertionRegexParser.ts

src/antlr/AssertionRegexLexer.ts src/antlr/AssertionRegexListener.ts src/antlr/AssertionRegexParser.ts: grammar/AssertionRegex.g4
	antlr -Dlanguage=TypeScript grammar/AssertionRegex.g4 && mv grammar/*.ts src/antlr

clean:
	rm -rf out
	rm -f src/antlr/RTRegex*.ts
	rm -f src/antlr/AssertionRegex*.ts
