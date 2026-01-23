"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.greaterThan = exports.equals = exports.AND = exports.OR = exports.failed = exports.skip = exports.pursueDefault = exports.pursueThrough = exports.pursue = exports.achievedOrPursued = exports.pursued = exports.achievable = exports.achieved = exports.parenthesis = exports.not = exports.formulaForGoal = exports.separator = void 0;
const utils_1 = require("../GoalTree/utils");
const separator = (relation) => {
    switch (relation) {
        case 'or':
            return ' | ';
        case 'and':
            return ' & ';
        default:
            throw new Error(`Relation "${relation}" not allowed`);
    }
};
exports.separator = separator;
const formulaForGoal = (goalId) => `${(0, utils_1.goalRootId)({ id: goalId })}_achieved_or_pursued`;
exports.formulaForGoal = formulaForGoal;
const not = (s) => (s ? `!${s}` : s);
exports.not = not;
const parenthesis = (s) => (s ? `(${s})` : s);
exports.parenthesis = parenthesis;
const achieved = (goalId) => `${goalId}_achieved`;
exports.achieved = achieved;
const achievable = (goalId) => `${goalId}_achievable`;
exports.achievable = achievable;
const pursued = (goalId) => `${goalId}_pursued`;
exports.pursued = pursued;
const achievedOrPursued = (goalId) => (0, exports.pursued)(`${(0, exports.achieved)(goalId)}_or`);
exports.achievedOrPursued = achievedOrPursued;
const pursue = (goalId) => `${goalId}_pursue`;
exports.pursue = pursue;
const pursueThrough = (goalId, through) => `pursue${goalId}_${through}`;
exports.pursueThrough = pursueThrough;
const pursueDefault = (goalId) => `${goalId}_pursue0`;
exports.pursueDefault = pursueDefault;
const skip = (goalId) => `${goalId}_skip`;
exports.skip = skip;
const failed = (goalId) => `${goalId}_failed`;
exports.failed = failed;
const OR = (elements) => elements.join((0, exports.separator)('or'));
exports.OR = OR;
const AND = (elements) => elements.join((0, exports.separator)('or'));
exports.AND = AND;
const equals = (operand, value) => `${operand}=${value}`;
exports.equals = equals;
const greaterThan = (goal, than) => `${goal}>${than}`;
exports.greaterThan = greaterThan;
//# sourceMappingURL=common.js.map