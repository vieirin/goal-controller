"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalModules = exports.goalNumberId = void 0;
const utils_1 = require("../../../GoalTree/utils");
const template_1 = require("./template");
const goalNumberId = (goalId) => {
    const id = goalId.match(/\d+/)?.[0];
    if (!id) {
        throw new Error(`The goal id must follow the pattern 'G%d', got: '${goalId}'`);
    }
    return id;
};
exports.goalNumberId = goalNumberId;
const goalModules = ({ gm }) => {
    const goals = (0, utils_1.allByType)({ gm, type: 'goal' });
    return `
${goals
        .sort((a, b) => Number(a.id.match(/\d+/)?.[0]) - Number(b.id.match(/\d+/)?.[0]))
        .map(template_1.goalModule)
        .join('\n\n')}
`;
};
exports.goalModules = goalModules;
//# sourceMappingURL=goalModules.js.map