"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skipStatement = void 0;
const logger_1 = require("../../../../logger/logger");
const common_1 = require("../../../../mdp/common");
const childrenHasNotBeenPursued = (goal) => {
    const pursueMembers = goal.children?.length
        ? goal.children
        : goal.tasks?.length
            ? goal.tasks
            : [];
    return pursueMembers
        .map((child) => `${(0, common_1.pursued)(child.id)}=0`)
        .join((0, common_1.separator)('and'));
};
const skipStatement = (goal) => {
    const logger = (0, logger_1.getLogger)();
    const leftStatement = `${(0, common_1.pursued)(goal.id)}=1 & ${childrenHasNotBeenPursued(goal)}`;
    const updateStatement = `(${(0, common_1.pursued)(goal.id)}'=0);`;
    const prismLabelStatement = `[skip_${goal.id}] ${leftStatement} -> ${updateStatement}`;
    logger.skip(goal.id, leftStatement, updateStatement, prismLabelStatement);
    return prismLabelStatement;
};
exports.skipStatement = skipStatement;
//# sourceMappingURL=skip.js.map