"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskVariables = exports.maxRetriesVariable = void 0;
const logger_1 = require("../../../../../logger/logger");
const common_1 = require("../../../../common");
const defineVariable = (variable) => {
    const upperBound = 1;
    const logger = (0, logger_1.getLogger)();
    logger.variableDefinition({
        variable,
        upperBound,
        initialValue: 0,
        type: 'int',
        context: 'task',
    });
    return `${variable}: [0..${upperBound}] init 0;`;
};
const maxRetriesVariable = (task) => {
    if (!task.properties.maxRetries) {
        return '';
    }
    const logger = (0, logger_1.getLogger)();
    logger.variableDefinition({
        variable: (0, common_1.failed)(task.id),
        upperBound: task.properties.maxRetries,
        initialValue: 0,
        type: 'int',
        context: 'task',
    });
    return `${(0, common_1.failed)(task.id)}: [0..${task.properties.maxRetries}] init 0;`;
};
exports.maxRetriesVariable = maxRetriesVariable;
const taskVariables = (task) => {
    const logger = (0, logger_1.getLogger)();
    logger.initTask(task);
    return `
  ${defineVariable((0, common_1.pursuedVariable)(task.id))}
  ${defineVariable((0, common_1.achievedVariable)(task.id))}
`.trim();
};
exports.taskVariables = taskVariables;
//# sourceMappingURL=variables.js.map