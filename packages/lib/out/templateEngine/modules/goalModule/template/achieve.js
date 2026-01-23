"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.achieveStatement = exports.achieveCondition = void 0;
const utils_1 = require("../../../../GoalTree/utils");
const logger_1 = require("../../../../logger/logger");
const common_1 = require("../../../../mdp/common");
const common_2 = require("../../../common");
const formulas_1 = require("./formulas");
const common_3 = require("./pursue/common");
const isValidSeparator = (relation) => {
    return ['and', 'or'].includes(relation ?? '');
};
const achieveCondition = (goal) => {
    if (isValidSeparator(goal.relationToChildren)) {
        const children = (0, utils_1.childrenIncludingTasks)({ node: goal });
        if (children.length) {
            return `(${children
                .map((child) => child.execCondition?.maintain
                ? `${(0, formulas_1.achievedMaintain)(child.id)}=true`
                : `${(0, common_2.achievedVariable)(child.id)}=1`)
                .join((0, common_1.separator)(goal.relationToChildren))})`;
        }
    }
    return '';
};
exports.achieveCondition = achieveCondition;
const achieveStatement = (goal) => {
    const logger = (0, logger_1.getLogger)();
    const leftStatement = [
        (0, common_3.hasBeenPursued)(goal, { condition: true }),
        (0, exports.achieveCondition)(goal),
    ]
        .filter(Boolean)
        .join((0, common_1.separator)('and'));
    const achievedUpdate = `${(0, common_1.achieved)(goal.id)}'=1`;
    const shouldHaveUpdateAchieved = !goal.execCondition?.maintain;
    const updateStatement = `(${(0, common_1.pursued)(goal.id)}'=0)${shouldHaveUpdateAchieved ? ` & (${achievedUpdate})` : ''};`;
    const prismLabelStatement = `[achieved_${goal.id}] ${leftStatement} -> ${updateStatement}`;
    logger.achieve(goal.id, leftStatement, updateStatement, prismLabelStatement);
    return prismLabelStatement;
};
exports.achieveStatement = achieveStatement;
//# sourceMappingURL=achieve.js.map