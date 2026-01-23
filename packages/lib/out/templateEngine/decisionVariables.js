"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decisionVariablesTemplate = exports.decisionVariableName = exports.decisionVariablesForGoal = void 0;
const utils_1 = require("../GoalTree/utils");
const logger_1 = require("../logger/logger");
// each decision variable is a tuple of values containing name:space
// we need to generate all possible combinations of these tuples
// and then generate a variable for each combination
// if the space for a variable t is 9, for example, we generate 10 variables:
// decision_G0_0, decision_G0_1, ..., decision_G0_9
// if we have two variables t and s, we generate 10*2=20 variables:
// decision_G0_0_0, decision_G0_0_1, ..., decision_G0_9_1
const decisionVariablesForGoal = ({ goal, }) => {
    const spaceArray = goal.decisionVars.map((decision) => Array.from({ length: decision.space }, (_, i) => i));
    const variableArray = goal.decisionVars.map((decision) => decision.variable);
    const decisionVars = (0, utils_1.cartesianProduct)(...spaceArray);
    return [variableArray, decisionVars, spaceArray];
};
exports.decisionVariablesForGoal = decisionVariablesForGoal;
const decisionVariableName = (goalId, variableCombination, vars) => {
    return `decision_${goalId}_${variableCombination
        .map((v, i) => `${vars[i]}${v}`)
        .join('_')}`;
};
exports.decisionVariableName = decisionVariableName;
const decisionVariablesTemplate = ({ gm }) => {
    if (!process.env.EXPERIMENTAL_DECISION_VARIABLES) {
        return '';
    }
    const logger = (0, logger_1.getLogger)();
    const decisionVariables = [];
    const allGoals = (0, utils_1.allByType)({ gm, type: 'goal' });
    const goalsWithDecisionVariables = allGoals.filter((goal) => goal.decisionVars.length);
    goalsWithDecisionVariables.forEach((goal) => {
        const [vars, decisionVars, spaceArray] = (0, exports.decisionVariablesForGoal)({ goal });
        spaceArray.forEach((space, i) => {
            const varName = vars[i];
            if (!varName) {
                throw new Error(`Variable at index ${i} is undefined for goal ${goal.id}`);
            }
            logger.decisionVariable([varName, space.length]);
        });
        for (const variableCombination of decisionVars) {
            const variable = `const int ${(0, exports.decisionVariableName)(goal.id, variableCombination, vars)};`;
            decisionVariables.push(variable);
        }
    });
    return decisionVariables.join('\n');
};
exports.decisionVariablesTemplate = decisionVariablesTemplate;
//# sourceMappingURL=decisionVariables.js.map