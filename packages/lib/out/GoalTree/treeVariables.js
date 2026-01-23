"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.treeContextVariables = exports.getTaskAchievabilityVariables = void 0;
const common_1 = require("../templateEngine/common");
const utils_1 = require("./utils");
const getTreeContextVariables = (tree) => {
    const variables = new Set();
    const goals = (0, utils_1.allByType)({ gm: tree, type: 'goal' });
    goals.forEach((goal) => {
        goal.execCondition?.maintain?.variables.forEach((variable) => {
            variables.add(variable.name);
        });
        goal.execCondition?.assertion.variables.forEach((variable) => {
            variables.add(variable.name);
        });
    });
    return Array.from(variables);
};
exports.treeContextVariables = getTreeContextVariables;
const getTaskAchievabilityVariables = (tree) => {
    const tasks = (0, utils_1.allByType)({ gm: tree, type: 'task' });
    const taskAchievabilityVariables = tasks.map((task) => (0, common_1.achievableFormulaVariable)(task.id));
    return taskAchievabilityVariables;
};
exports.getTaskAchievabilityVariables = getTaskAchievabilityVariables;
//# sourceMappingURL=treeVariables.js.map