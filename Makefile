export PATH=$PATH:/usr/local/bin/:./node_modules/.bin/:/bin

node_modules: package.json
	npm install
	@rm -f node_modules/.modified
	@touch -m node_modules/.modified

grammar:
	antlr4 -Dlanguage=TypeScript grammar/RTRegex.g4 && mv grammar/*.ts src/antlr

run: grammar
	npm run ts-node src/index.ts $(ARGS)

exec:
	npx ts-node src/index.ts ./examples/edgeModel.txt 

