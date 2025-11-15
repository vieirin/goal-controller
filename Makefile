PATH  := /usr/local/bin/:node_modules/.bin/:/bin:/opt/homebrew/bin/:$(PATH)
SHELL := /bin/bash

node_modules: package.json
	npm install
	@rm -f node_modules/.modified
	@touch -m node_modules/.modified


grammarRT: src/antlr/RTRegexLexer.ts src/antlr/RTRegexListener.ts src/antlr/RTRegexParser.ts

src/antlr/RTRegexLexer.ts src/antlr/RTRegexListener.ts src/antlr/RTRegexParser.ts: grammar/RTRegex.g4
	antlr -Dlanguage=TypeScript grammar/RTRegex.g4 && mv grammar/*.ts src/antlr

grammarAssertion: src/antlr/AssertionRegexLexer.ts src/antlr/AssertionRegexListener.ts src/antlr/AssertionRegexParser.ts

src/antlr/AssertionRegexLexer.ts src/antlr/AssertionRegexListener.ts src/antlr/AssertionRegexParser.ts: grammar/AssertionRegex.g4
	antlr -Dlanguage=TypeScript grammar/AssertionRegex.g4 && mv grammar/*.ts src/antlr

run: grammarRT grammarAssertion
	@echo $(FILE)
	npx ts-node src/index.ts "$(FILE)"

cli: grammarRT grammarAssertion
	npx ts-node src/cli.ts

exec:
	npx ts-node src/index.ts ./examples/edgeModel.txt 

