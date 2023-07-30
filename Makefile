export PATH=$PATH:/usr/local/bin/:./node_modules/.bin/:/bin

.PHONY: grammar

grammar:
	antlr4 -Dlanguage=TypeScript grammar/Hello.g4 && mv grammar/*.ts src/antlr

run: 
	ts-node src/index.ts

