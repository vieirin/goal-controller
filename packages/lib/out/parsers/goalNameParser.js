"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoalDetail = void 0;
const antlr4_1 = require("antlr4");
const RTRegexLexer_1 = __importDefault(require("../antlr/RTRegexLexer"));
const RTRegexListener_1 = __importDefault(require("../antlr/RTRegexListener"));
const RTRegexParser_1 = __importDefault(require("../antlr/RTRegexParser"));
const getGoalDetail = ({ goalText, }) => {
    const chars = new antlr4_1.CharStream(goalText); // replace this with a FileStream as required
    const lexer = new RTRegexLexer_1.default(chars);
    const tokens = new antlr4_1.CommonTokenStream(lexer);
    const parser = new RTRegexParser_1.default(tokens);
    const tree = parser.rt();
    let id = '';
    let goalName = null;
    let alternative = [];
    let degradationList = [];
    let interleaved = [];
    let sequence = [];
    let retry = {};
    let choice = false;
    class RTNotationTreeWalker extends RTRegexListener_1.default {
        extractGoalIds = (expr) => {
            if (expr.getChildCount() === 1) {
                // Simple goal like G1
                return [expr.getText()];
            }
            else if (expr.getChildCount() === 2) {
                // Goal with ID, like G1
                return [expr.getText()];
            }
            else if (expr.getChildCount() === 3) {
                // Binary operation (e.g., G1|G2, G1->G2, G1#G2, G1;G2)
                const left = this.extractGoalIds(expr.getChild(0));
                const right = this.extractGoalIds(expr.getChild(2));
                return [...left, ...right];
            }
            return [];
        };
        exitGIdContinued = (ctx) => {
            if (id)
                return;
            id = `${ctx._t.text}${ctx.id().getText()}`;
            return id;
        };
        exitWord = (ctx) => {
            goalName = ctx.WORD().getText();
        };
        exitGAlternative = (ctx) => {
            alternative = ctx
                .expr_list()
                .flatMap((e) => this.extractGoalIds(e))
                .filter(Boolean);
        };
        exitGDegradation = (ctx) => {
            degradationList = ctx
                .expr_list()
                .flatMap((e) => this.extractGoalIds(e))
                .filter(Boolean);
        };
        exitGInterleaved = (ctx) => {
            interleaved = ctx
                .expr_list()
                .flatMap((e) => this.extractGoalIds(e))
                .filter(Boolean);
        };
        exitGSequence = (ctx) => {
            sequence = ctx
                .expr_list()
                .flatMap((e) => this.extractGoalIds(e))
                .filter(Boolean);
        };
        exitGRetry = (ctx) => {
            const goalToRetry = ctx.expr().getText();
            const amountOfRetries = ctx.FLOAT().getText();
            retry = { ...retry, [goalToRetry]: parseInt(amountOfRetries) };
        };
        exitGChoice = (ctx) => {
            choice = ctx._op.text === '+';
        };
    }
    const walker = new RTNotationTreeWalker();
    antlr4_1.ParseTreeWalker.DEFAULT.walk(walker, tree);
    const goalSanitizedName = goalName ?? '';
    if (degradationList.length > 0) {
        const executionDetail = {
            type: 'degradation',
            degradationList,
        };
        // Only include retryMap if it's not empty
        if (Object.keys(retry).length > 0) {
            executionDetail.retryMap = retry;
        }
        return {
            id,
            goalName: goalSanitizedName.trim(),
            executionDetail,
        };
    }
    if (sequence.length > 0) {
        return {
            id,
            goalName: goalSanitizedName.trim(),
            executionDetail: { type: 'sequence', sequence },
        };
    }
    if (alternative.length > 0) {
        return {
            id,
            goalName: goalSanitizedName.trim(),
            executionDetail: {
                type: 'alternative',
                alternative,
            },
        };
    }
    if (interleaved.length > 0) {
        return {
            id,
            goalName: goalSanitizedName.trim(),
            executionDetail: { type: 'interleaved', interleaved },
        };
    }
    if (choice) {
        return {
            id,
            goalName: goalSanitizedName.trim(),
            executionDetail: { type: 'choice' },
        };
    }
    return { id, goalName: goalSanitizedName.trim(), executionDetail: null };
};
exports.getGoalDetail = getGoalDetail;
//# sourceMappingURL=goalNameParser.js.map