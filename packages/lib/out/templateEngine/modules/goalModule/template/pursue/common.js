"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasFailedAtMostNTimes = exports.hasFailedAtLeastNTimes = exports.hasBeenAchievedAndPursued = exports.hasBeenPursued = exports.hasBeenAchieved = void 0;
const common_1 = require("../../../../../mdp/common");
const formulas_1 = require("../formulas");
const hasBeenAchieved = (goal, { condition, update }) => {
    if (goal.execCondition?.maintain) {
        if (update) {
            throw new Error('Invalid update option for goal of type maintain, please verify');
        }
        return `${(0, formulas_1.achievedMaintain)(goal.id)}=${condition ? 'true' : 'false'}`;
    }
    return `${(0, common_1.achieved)(goal.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
};
exports.hasBeenAchieved = hasBeenAchieved;
const hasBeenPursued = (goal, { condition, update }) => {
    return `${(0, common_1.pursued)(goal.id)}${update ? "'" : ''}=${condition ? 1 : 0}`;
};
exports.hasBeenPursued = hasBeenPursued;
const hasBeenAchievedAndPursued = (goal, { achieved, pursued }) => {
    return [
        (0, exports.hasBeenPursued)(goal, { condition: pursued }),
        (0, exports.hasBeenAchieved)(goal, { condition: achieved }),
    ].join((0, common_1.separator)('and'));
};
exports.hasBeenAchievedAndPursued = hasBeenAchievedAndPursued;
const hasFailedAtLeastNTimes = (goalId, n) => {
    return `${goalId}_failed >= ${n}`;
};
exports.hasFailedAtLeastNTimes = hasFailedAtLeastNTimes;
const hasFailedAtMostNTimes = (goalId, n) => {
    return `${goalId}_failed <= ${n}`;
};
exports.hasFailedAtMostNTimes = hasFailedAtMostNTimes;
//# sourceMappingURL=common.js.map