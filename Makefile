export PATH=$PATH:/usr/local/bin/:./node_modules/.bin/:/bin

.PHONY: grammar

grammar:
	antlr4 -Dlanguage=TypeScript grammar/Goal.g4 && mv grammar/*.ts src/antlr

run: grammar
	ts-node src/index.ts $(ARGS)

