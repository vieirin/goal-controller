PATH  := /usr/local/bin/:node_modules/.bin/:/bin:/opt/homebrew/bin/:$(PATH)
SHELL := /bin/bash

# Generated parsers live in the goal-tree package, which is where they are consumed.
ANTLR_OUT := ../goal-tree/src/antlr

# Each engine declares its own RT notation grammar under grammar/<engine>/RTRegex.g4,
# generated into $(ANTLR_OUT)/<engine>/. Add an engine here to generate its parser.
RT_ENGINES := edge edgeV2

.PHONY: grammar grammarRT grammarAssertion clean $(addprefix grammarRT-,$(RT_ENGINES))

grammar: grammarRT grammarAssertion

grammarRT: $(addprefix grammarRT-,$(RT_ENGINES))

$(foreach engine,$(RT_ENGINES),$(eval grammarRT-$(engine): $(ANTLR_OUT)/$(engine)/RTRegexParser.ts))

$(ANTLR_OUT)/%/RTRegexLexer.ts $(ANTLR_OUT)/%/RTRegexListener.ts $(ANTLR_OUT)/%/RTRegexParser.ts: grammar/%/RTRegex.g4
	mkdir -p $(ANTLR_OUT)/$*
	cd grammar/$* && antlr -Dlanguage=TypeScript RTRegex.g4 && mv *.ts ../../$(ANTLR_OUT)/$* && rm -f *.interp *.tokens

grammarAssertion: $(ANTLR_OUT)/AssertionRegexLexer.ts $(ANTLR_OUT)/AssertionRegexListener.ts $(ANTLR_OUT)/AssertionRegexParser.ts

$(ANTLR_OUT)/AssertionRegexLexer.ts $(ANTLR_OUT)/AssertionRegexListener.ts $(ANTLR_OUT)/AssertionRegexParser.ts: grammar/AssertionRegex.g4
	cd grammar && antlr -Dlanguage=TypeScript AssertionRegex.g4 && mv *.ts ../$(ANTLR_OUT)

clean:
	rm -rf out
	rm -f $(foreach engine,$(RT_ENGINES),$(ANTLR_OUT)/$(engine)/RTRegex*.ts)
	rm -f $(ANTLR_OUT)/AssertionRegex*.ts
