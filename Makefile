export PATH=$PATH:/usr/local/bin/:./node_modules/.bin/

grammar:
	antlr4 -Dlanguage=TypeScript MyGrammar.g4

start: 
	ts-node src/index.ts

