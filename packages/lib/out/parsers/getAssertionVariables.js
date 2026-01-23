"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssertionVariables = void 0;
const antlr4_1 = require("antlr4");
const AssertionRegexLexer_1 = __importDefault(require("../antlr/AssertionRegexLexer"));
const AssertionRegexListener_1 = __importDefault(require("../antlr/AssertionRegexListener"));
const AssertionRegexParser_1 = __importDefault(require("../antlr/AssertionRegexParser"));
const getAssertionVariables = ({ assertionSentence, }) => {
    if (!assertionSentence) {
        return [];
    }
    const chars = new antlr4_1.CharStream(assertionSentence);
    const lexer = new AssertionRegexLexer_1.default(chars);
    const tokens = new antlr4_1.CommonTokenStream(lexer);
    const parser = new AssertionRegexParser_1.default(tokens);
    const tree = parser.assertion();
    const variables = [];
    class AssertionTreeWalker extends AssertionRegexListener_1.default {
        exitAssignment = (ctx) => {
            const name = ctx.ID().getText();
            const value = ctx.BOOLEAN().getText() === 'true';
            variables.push({ name, value });
        };
        exitIdentifier = (ctx) => {
            const name = ctx.ID().getText();
            // If it's just a variable without assignment, value is null
            if (!variables.some((v) => v.name === name)) {
                variables.push({ name, value: null });
            }
        };
        exitIntComparison = (ctx) => {
            const name = ctx.ID().getText();
            // For integer comparisons, the variable name is extracted but value is null
            // (the comparison value is in the INT token, not a boolean assignment)
            if (!variables.some((v) => v.name === name)) {
                variables.push({ name, value: null });
            }
        };
    }
    const walker = new AssertionTreeWalker();
    antlr4_1.ParseTreeWalker.DEFAULT.walk(walker, tree);
    return variables;
};
exports.getAssertionVariables = getAssertionVariables;
//# sourceMappingURL=getAssertionVariables.js.map