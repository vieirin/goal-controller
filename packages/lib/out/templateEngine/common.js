"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failed = exports.achievableFormulaVariable = exports.tryTransition = exports.failedTransition = exports.achievedTransition = exports.pursueTransition = exports.chosenVariable = exports.achievedVariable = exports.pursuedVariable = void 0;
// Variable names
const pursuedVariable = (goalId) => `${goalId}_pursued`;
exports.pursuedVariable = pursuedVariable;
const achievedVariable = (goalId) => `${goalId}_achieved`;
exports.achievedVariable = achievedVariable;
const chosenVariable = (goalId) => `${goalId}_chosen`;
exports.chosenVariable = chosenVariable;
// Transition labels
const pursueTransition = (goalId) => `pursue_${goalId}`;
exports.pursueTransition = pursueTransition;
const achievedTransition = (goalId) => `achieved_${goalId}`;
exports.achievedTransition = achievedTransition;
const failedTransition = (goalId) => `failed_${goalId}`;
exports.failedTransition = failedTransition;
const tryTransition = (goalId) => `try_${goalId}`;
exports.tryTransition = tryTransition;
// formulas
const achievableFormulaVariable = (goalId) => `${goalId}_achievable`;
exports.achievableFormulaVariable = achievableFormulaVariable;
const failed = (goalId) => `${goalId}_failed`;
exports.failed = failed;
//# sourceMappingURL=common.js.map