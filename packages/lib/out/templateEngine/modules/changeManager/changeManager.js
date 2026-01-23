"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeManagerModule = void 0;
const fs_1 = require("fs");
const variablesPath_1 = require("../../../utils/variablesPath");
const treeVariables_1 = require("../../../GoalTree/treeVariables");
const utils_1 = require("../../../GoalTree/utils");
const logger_1 = require("../../../logger/logger");
const template_1 = require("./template");
const taskAchievabilityVariables_1 = require("./template/achievabilityVariables/taskAchievabilityVariables");
const changeManagerModule = ({ gm, fileName, variables, }) => {
    const tasks = (0, utils_1.allByType)({ gm, type: 'task' });
    const logger = (0, logger_1.getLogger)();
    logger.info('[CHANGE MANAGER MODULE START]', 0);
    const taskAchieveVariables = (0, treeVariables_1.getTaskAchievabilityVariables)(gm);
    // If variables are provided directly, use them; otherwise try to read from file
    if (variables) {
        // Filter to only include number values (task achievability variables)
        const numericVariables = Object.fromEntries(Object.entries(variables).filter(([, value]) => typeof value === 'number'));
        return ((0, taskAchievabilityVariables_1.taskAchievabilityVariables)(tasks, numericVariables) +
            '\n\n' +
            (0, template_1.changeManagerModuleTemplate)({ tasks }));
    }
    try {
        const variablesFilePath = (0, variablesPath_1.getVariablesFilePath)(fileName);
        const defaultVariableValues = taskAchieveVariables.length > 0
            ? JSON.parse((0, fs_1.readFileSync)(variablesFilePath, 'utf8'))
            : {};
        return ((0, taskAchievabilityVariables_1.taskAchievabilityVariables)(tasks, defaultVariableValues) +
            '\n\n' +
            (0, template_1.changeManagerModuleTemplate)({ tasks }));
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error reading variables file:', error);
        throw new Error('Error reading variables file');
    }
};
exports.changeManagerModule = changeManagerModule;
//# sourceMappingURL=changeManager.js.map