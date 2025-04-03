PATH  := /usr/local/bin/:node_modules/.bin/:/bin:/opt/homebrew/bin/:$(PATH)
SHELL := /bin/bash

node_modules: package.json
	npm install
	@rm -f node_modules/.modified
	@touch -m node_modules/.modified

grammar: grammar/RTRegex.g4
	antlr -Dlanguage=TypeScript grammar/RTRegex.g4 && mv grammar/*.ts src/antlr

run: grammar
	@echo $(FILE)
	npx ts-node src/index.ts "$(FILE)"

exec:
	npx ts-node src/index.ts ./examples/edgeModel.txt 

