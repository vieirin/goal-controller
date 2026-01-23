"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__test_only_exports__ = exports.systemModule = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const variablesPath_1 = require("../../../utils/variablesPath");
const nodeUtils_1 = require("../../../GoalTree/nodeUtils");
const treeVariables_1 = require("../../../GoalTree/treeVariables");
const utils_1 = require("../../../GoalTree/utils");
const logger_1 = require("../../../logger/logger");
const template_1 = require("./template");
/**
 * Extracts transition lines from the System module in an existing PRISM file
 * @param fileName The input file name (e.g., "examples/experiments/1-minimal.txt")
 * @returns Array of transition lines from the System module, or empty array if file doesn't exist or has no transitions
 */
const extractOldSystemTransitions = (fileName) => {
    // Extract base name from fileName (e.g., "examples/experiments/1-minimal.txt" -> "1-minimal")
    const parsedPath = path_1.default.parse(fileName);
    const baseName = parsedPath.name;
    // Try multiple paths to find the output file (supports both monorepo and direct execution)
    const possiblePaths = [
        `output/${baseName}.prism`, // From project root
        `../../output/${baseName}.prism`, // From packages/lib (monorepo)
    ];
    const oldPrismFilePath = possiblePaths.find((p) => (0, fs_1.existsSync)(p));
    // Check if the old PRISM file exists
    if (!oldPrismFilePath) {
        return [];
    }
    try {
        const prismContent = (0, fs_1.readFileSync)(oldPrismFilePath, 'utf8');
        const lines = prismContent.split('\n');
        let inSystemModule = false;
        const transitions = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue;
            const trimmedLine = line.trim();
            // Check if we're entering the System module
            if (trimmedLine === 'module System') {
                inSystemModule = true;
                continue;
            }
            // Check if we're leaving the System module
            if (inSystemModule && trimmedLine === 'endmodule') {
                break;
            }
            // If we're in the System module, check for transitions
            if (inSystemModule) {
                // Match transition pattern: [label] guard -> update;
                const transitionMatch = trimmedLine.match(/^\s*\[([^\]]+)\]\s*.+?\s*->\s*.+?\s*;?\s*$/);
                if (transitionMatch) {
                    // Collect preceding comment lines
                    const precedingComments = [];
                    let j = i - 1;
                    while (j >= 0) {
                        const prevLine = lines[j];
                        if (!prevLine) {
                            j--;
                            continue;
                        }
                        const prevTrimmed = prevLine.trim();
                        // Stop if we hit a non-comment, non-empty line
                        if (prevTrimmed && !prevTrimmed.startsWith('//')) {
                            break;
                        }
                        // Collect comment lines (preserve order by unshifting)
                        if (prevTrimmed.startsWith('//')) {
                            precedingComments.unshift(prevLine);
                        }
                        j--;
                    }
                    // Add preceding comments and the transition line
                    transitions.push(...precedingComments);
                    transitions.push(line);
                }
            }
        }
        return transitions;
    }
    catch (error) {
        // If there's an error reading the file, return empty array
        return [];
    }
};
const systemModule = ({ gm, fileName, clean = false, variables: variablesParam, }) => {
    const logger = (0, logger_1.getLogger)();
    logger.initSystem();
    const goalContextVars = (0, treeVariables_1.treeContextVariables)(gm);
    // Also collect context variables from tasks
    const tasks = (0, utils_1.allByType)({ gm, type: 'task' });
    const taskContextVariables = new Set();
    tasks.forEach((task) => {
        if (task.execCondition?.assertion) {
            task.execCondition.assertion.variables.forEach((v) => {
                taskContextVariables.add(v.name);
            });
        }
        if (task.execCondition?.maintain?.variables) {
            task.execCondition.maintain.variables.forEach((v) => {
                taskContextVariables.add(v.name);
            });
        }
    });
    // Combine goal and task context variables
    const allContextVars = new Set([
        ...goalContextVars,
        ...Array.from(taskContextVariables),
    ]);
    // Exclude resource IDs from context variables
    const resources = (0, utils_1.allByType)({ gm, type: 'resource' });
    if (!(0, nodeUtils_1.isResource)(resources)) {
        throw new Error('Resources must be an array of resources');
    }
    const resourceIds = new Set(resources.map((resource) => resource.id));
    const variables = Array.from(allContextVars).filter((varName) => !resourceIds.has(varName));
    // If variables are provided directly, use them; otherwise try to read from file
    if (variablesParam) {
        const oldTransitions = clean ? [] : extractOldSystemTransitions(fileName);
        return (0, template_1.systemModuleTemplate)({
            variables,
            resources,
            defaultVariableValues: variablesParam,
            oldTransitions,
        });
    }
    try {
        const variablesFilePath = (0, variablesPath_1.getVariablesFilePath)(fileName);
        const defaultVariableValues = variables.length > 0
            ? JSON.parse((0, fs_1.readFileSync)(variablesFilePath, 'utf8'))
            : {};
        const oldTransitions = clean ? [] : extractOldSystemTransitions(fileName);
        return (0, template_1.systemModuleTemplate)({
            variables,
            resources,
            defaultVariableValues,
            oldTransitions,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error reading variables file:', error);
        throw new Error('Error reading variables file');
    }
};
exports.systemModule = systemModule;
exports.__test_only_exports__ = {
    extractOldSystemTransitions,
};
//# sourceMappingURL=system.js.map