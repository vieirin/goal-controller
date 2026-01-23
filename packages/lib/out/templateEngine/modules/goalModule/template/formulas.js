"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.achievableGoalFormula = exports.maintainConditionFormula = exports.achievedMaintain = void 0;
const utils_1 = require("../../../../GoalTree/utils");
const logger_1 = require("../../../../logger/logger");
const common_1 = require("../../../../mdp/common");
const common_2 = require("../../../common");
const achievedMaintain = (goalId) => {
    return `${goalId}_achieved_maintain`;
};
exports.achievedMaintain = achievedMaintain;
const maintainConditionFormula = (goal) => {
    if (!goal.execCondition?.maintain) {
        return '';
    }
    const logger = (0, logger_1.getLogger)();
    const prismLine = `formula ${(0, exports.achievedMaintain)(goal.id)} = ${goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED'};`;
    logger.maintainFormulaDefinition(goal.id, (0, exports.achievedMaintain)(goal.id), goal.execCondition.maintain.sentence || 'ASSERTION_UNDEFINED', prismLine);
    return prismLine;
};
exports.maintainConditionFormula = maintainConditionFormula;
const achievableGoalFormula = (goal) => {
    const children = (0, utils_1.childrenIncludingTasks)({ node: goal });
    const formulaName = `${(0, common_2.achievableFormulaVariable)(goal.id)}`;
    const logger = (0, logger_1.getLogger)();
    if (children.length === 1) {
        const firstChild = children[0];
        if (!firstChild) {
            throw new Error(`Expected at least one child for goal ${goal.id} but children array is empty`);
        }
        const sentence = (0, common_2.achievableFormulaVariable)(firstChild.id);
        const formula = `formula ${formulaName} = ${sentence};`;
        logger.achievabilityFormulaDefinition(goal.id, formulaName, 'SINGLE_GOAL', sentence, formula);
        return formula;
    }
    const childrenVariables = children.map((child) => (0, common_2.achievableFormulaVariable)(child.id));
    const productPart = childrenVariables.join(' * ');
    switch (goal.relationToChildren) {
        case 'and': {
            const andFormula = `formula ${formulaName} = ${productPart};`;
            logger.achievabilityFormulaDefinition(goal.id, formulaName, 'AND', productPart, andFormula);
            return andFormula;
        }
        case 'or': {
            const sumPart = childrenVariables.join(' + ');
            const formulaValue = `${sumPart} - ${(0, common_1.parenthesis)(productPart)}`;
            const orFormula = `formula ${formulaName} = ${formulaValue};`;
            logger.achievabilityFormulaDefinition(goal.id, formulaName, 'OR', formulaValue, orFormula);
            return orFormula;
        }
        default:
            throw new Error(`Invalid relation to children: ${goal.relationToChildren ?? 'none'}`);
    }
};
exports.achievableGoalFormula = achievableGoalFormula;
//# sourceMappingURL=formulas.js.map