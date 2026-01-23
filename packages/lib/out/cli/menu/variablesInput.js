"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inputDefaultVariables = exports.getVariablesFilePath = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const inquirer_1 = __importDefault(require("inquirer"));
const GoalTree_1 = require("../../GoalTree");
const creation_1 = require("../../GoalTree/creation");
const treeVariables_1 = require("../../GoalTree/treeVariables");
const variablesPath_1 = require("../../utils/variablesPath");
Object.defineProperty(exports, "getVariablesFilePath", { enumerable: true, get: function () { return variablesPath_1.getVariablesFilePath; } });
const utils_1 = require("../utils");
const saveVariables = async (variables, modelPath) => {
    try {
        const variablesFilePath = (0, variablesPath_1.getVariablesFilePath)(modelPath);
        const variablesDir = variablesFilePath.substring(0, variablesFilePath.lastIndexOf('/'));
        // Ensure the directory exists
        if (!(0, fs_1.existsSync)(variablesDir)) {
            await (0, promises_1.mkdir)(variablesDir, { recursive: true });
        }
        await (0, promises_1.writeFile)(variablesFilePath, JSON.stringify(variables, null, 2));
        console.log(`Variables saved to ${variablesFilePath}`);
    }
    catch (error) {
        console.error('Error saving variables:', error);
    }
};
const getExistingVariables = async (modelPath) => {
    try {
        const variablesFilePath = (0, variablesPath_1.getVariablesFilePath)(modelPath);
        if ((0, fs_1.existsSync)(variablesFilePath)) {
            const data = await (0, promises_1.readFile)(variablesFilePath, 'utf-8');
            return JSON.parse(data);
        }
        return {};
    }
    catch (error) {
        console.error('Error reading variables file:', error);
        return {};
    }
};
const inputDefaultVariables = async (selectedModel) => {
    try {
        let modelPath = selectedModel;
        if (!selectedModel) {
            // Always show the model list first
            const files = await (0, utils_1.getFilesInDirectory)('examples');
            if (files.length === 0) {
                console.log('No files found in the example directory.');
                return;
            }
            // Get the last selected model to use as default if available
            const lastSelectedModel = await (0, utils_1.getLastSelectedModel)();
            const { selectedFile } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedFile',
                    message: 'Select a model file to extract variables from:',
                    choices: files.map((file) => ({
                        name: file.name,
                        value: file.path,
                    })),
                    default: lastSelectedModel || files[0]?.path,
                },
            ]);
            modelPath = selectedFile;
        }
        // At this point modelPath is guaranteed to be a string
        const model = (0, GoalTree_1.loadPistarModel)({ filename: modelPath });
        const tree = (0, creation_1.convertToTree)({ model });
        const contextVariables = (0, treeVariables_1.treeContextVariables)(tree);
        const achievabilityVariables = (0, treeVariables_1.getTaskAchievabilityVariables)(tree);
        const variables = [...contextVariables, ...achievabilityVariables];
        if (variables.length === 0) {
            console.log('No variables found in the model.');
            return;
        }
        // Get existing variable values
        const existingVariables = await getExistingVariables(modelPath);
        // Create questions for each variable
        const questions = variables.map((variable) => contextVariables.includes(variable)
            ? {
                type: 'input',
                name: variable,
                message: `Enter default value for ${variable} (true/false):`,
                default: existingVariables[variable] !== undefined
                    ? String(existingVariables[variable])
                    : 'false',
                validate: (input) => {
                    const value = input.toLowerCase();
                    if (value === 'true' || value === 'false') {
                        return true;
                    }
                    return 'Please enter "true" or "false"';
                },
                filter: (input) => input.toLowerCase() === 'true',
            }
            : {
                type: 'input',
                name: variable,
                message: `Enter default value for ${variable} (0.0-1.0):`,
                default: existingVariables[variable] !== undefined
                    ? String(existingVariables[variable])
                    : '0.0',
                validate: (input) => {
                    const value = parseFloat(input);
                    if (!isNaN(value) && value >= 0.0 && value <= 1.0) {
                        return true;
                    }
                    return 'Please enter a value between 0.0 and 1.0';
                },
                filter: (input) => parseFloat(input),
            });
        // Prompt for variable values
        const answers = await inquirer_1.default.prompt(questions);
        // Save variables
        await saveVariables(answers, modelPath);
        console.log('Default variables have been set successfully!');
    }
    catch (error) {
        console.error('Error setting default variables:', error);
    }
};
exports.inputDefaultVariables = inputDefaultVariables;
//# sourceMappingURL=variablesInput.js.map