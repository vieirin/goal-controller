"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskAchievabilityVariables = exports.taskAchievabilityVariable = void 0;
const logger_1 = require("../../../../../logger/logger");
const common_1 = require("../../../../common");
const taskAchievabilityVariable = (task, variableValues) => {
    const logger = (0, logger_1.getLogger)();
    const variableName = (0, common_1.achievableFormulaVariable)(task.id);
    const variableValue = variableValues[variableName];
    if (!variableValue) {
        throw new Error(`Variable value not found for task ${task.id}: ${variableName}`);
    }
    const achievabilityConst = `const double ${variableName} = ${variableValue};`;
    logger.achievabilityTaskConstant(task.id, variableName, variableValue);
    return achievabilityConst;
};
exports.taskAchievabilityVariable = taskAchievabilityVariable;
const taskAchievabilityVariables = (tasks, variableValues) => {
    return tasks
        .map((task) => (0, exports.taskAchievabilityVariable)(task, variableValues))
        .join('\n');
};
exports.taskAchievabilityVariables = taskAchievabilityVariables;
//# sourceMappingURL=taskAchievabilityVariables.js.map