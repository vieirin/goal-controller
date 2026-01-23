"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const inquirer_1 = __importDefault(require("inquirer"));
const path_1 = __importDefault(require("path"));
const selectModel_1 = require("./cli/menu/selectModel");
const variablesInput_1 = require("./cli/menu/variablesInput");
const utils_1 = require("./cli/utils");
const GoalTree_1 = require("./GoalTree");
const creation_1 = require("./GoalTree/creation");
const utils_2 = require("./GoalTree/utils");
// Parse command line arguments for clean flag
const args = process.argv.slice(2);
const cleanFlag = args.includes('--clean') || args.includes('-c');
const mainMenu = async () => {
    const lastSelectedModel = await (0, utils_1.getLastSelectedModel)();
    const menuChoices = [
        { name: 'Run the model', value: 'run' },
        { name: 'Input default variables', value: 'variables' },
        { name: 'Dump tree to JSON', value: 'dumpTree' },
    ];
    if (process.env.MODE === 'last' && lastSelectedModel) {
        await (0, selectModel_1.runModel)(lastSelectedModel, cleanFlag);
        return;
    }
    // Add "Run last selected model" option if it exists
    if (lastSelectedModel) {
        const fileName = lastSelectedModel.split('/').pop() || 'unknown';
        menuChoices.unshift({
            name: `Run last selected model (${fileName})`,
            value: 'last',
        });
    }
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: menuChoices,
        },
    ]);
    if (action === 'last' && lastSelectedModel) {
        // Check if variables file exists for the last selected model
        const variablesFilePath = (0, variablesInput_1.getVariablesFilePath)(lastSelectedModel);
        if (!(0, fs_1.existsSync)(variablesFilePath)) {
            console.log('Variables file not found for the last selected model. Please input variables first.');
            await (0, variablesInput_1.inputDefaultVariables)(lastSelectedModel);
        }
        await (0, selectModel_1.runModel)(lastSelectedModel, cleanFlag);
    }
    else if (action === 'run') {
        const files = await (0, utils_1.getFilesInDirectory)('examples');
        if (files.length === 0) {
            console.log('No files found in the example directory.');
            await mainMenu();
        }
        const { selectedFile } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selectedFile',
                message: 'Select a model file to run:',
                choices: files.map((file) => ({
                    name: file.name,
                    value: file.path,
                })),
                default: lastSelectedModel || files[0]?.path,
            },
        ]);
        await (0, utils_1.saveLastSelectedModel)(selectedFile);
        // Check if variables file exists for the selected model
        const variablesFilePath = (0, variablesInput_1.getVariablesFilePath)(selectedFile);
        if (!(0, fs_1.existsSync)(variablesFilePath)) {
            console.log('Variables file not found for the selected model. Please input variables first.');
            await (0, variablesInput_1.inputDefaultVariables)(selectedFile);
        }
        await (0, selectModel_1.runModel)(selectedFile, cleanFlag);
    }
    else if (action === 'variables') {
        await (0, variablesInput_1.inputDefaultVariables)();
    }
    else if (action === 'dumpTree') {
        const files = await (0, utils_1.getFilesInDirectory)('examples');
        if (files.length === 0) {
            console.log('No files found in the example directory.');
            await mainMenu();
            return;
        }
        const { selectedFile } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selectedFile',
                message: 'Select a model file to run:',
                choices: files.map((file) => ({
                    name: file.name,
                    value: file.path,
                })),
                default: lastSelectedModel || files[0]?.path,
            },
        ]);
        const model = (0, GoalTree_1.loadPistarModel)({ filename: selectedFile });
        const tree = (0, creation_1.convertToTree)({ model });
        const json = (0, utils_2.dumpTreeToJSON)({ gm: tree });
        await (0, promises_1.writeFile)(`output/${path_1.default.parse(selectedFile).name}.json`, json);
        console.log(`The file ${path_1.default.parse(selectedFile).name}.json was saved successfully!`);
    }
    // Return to main menu
    await mainMenu();
};
// Start the CLI
mainMenu().catch((error) => {
    if (error.name === 'ExitPromptError') {
        console.log('Exiting...');
        process.exit(0);
    }
    console.error(error);
});
//# sourceMappingURL=cli.js.map