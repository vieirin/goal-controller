#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initLogger = exports.validate = exports.treeContextVariables = exports.getTaskAchievabilityVariables = exports.validateModel = exports.loadPistarModel = exports.dumpTreeToJSON = exports.convertToTree = exports.sleecTemplateEngine = exports.generateValidatedPrismModel = void 0;
// Import for CLI usage and re-export
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const GoalTree_1 = require("./GoalTree");
Object.defineProperty(exports, "loadPistarModel", { enumerable: true, get: function () { return GoalTree_1.loadPistarModel; } });
Object.defineProperty(exports, "validateModel", { enumerable: true, get: function () { return GoalTree_1.validateModel; } });
const creation_1 = require("./GoalTree/creation");
Object.defineProperty(exports, "convertToTree", { enumerable: true, get: function () { return creation_1.convertToTree; } });
const utils_1 = require("./GoalTree/utils");
Object.defineProperty(exports, "dumpTreeToJSON", { enumerable: true, get: function () { return utils_1.dumpTreeToJSON; } });
const logger_1 = require("./logger/logger");
Object.defineProperty(exports, "initLogger", { enumerable: true, get: function () { return logger_1.initLogger; } });
const prismValidator_1 = require("./prismValidator");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return prismValidator_1.validate; } });
const sleecTemplateEngine_1 = require("./sleecTemplateEngine");
Object.defineProperty(exports, "sleecTemplateEngine", { enumerable: true, get: function () { return sleecTemplateEngine_1.sleecTemplateEngine; } });
const engine_1 = require("./templateEngine/engine");
Object.defineProperty(exports, "generateValidatedPrismModel", { enumerable: true, get: function () { return engine_1.generateValidatedPrismModel; } });
// Variable extraction
var treeVariables_1 = require("./GoalTree/treeVariables");
Object.defineProperty(exports, "getTaskAchievabilityVariables", { enumerable: true, get: function () { return treeVariables_1.getTaskAchievabilityVariables; } });
Object.defineProperty(exports, "treeContextVariables", { enumerable: true, get: function () { return treeVariables_1.treeContextVariables; } });
// CLI entry point - if this file is executed directly, run the CLI script
if (require.main === module) {
    /* eslint-disable no-console */
    // Parse command line arguments
    const args = process.argv.slice(2);
    const inputFile = args.find((arg) => !arg.startsWith('--') && !arg.startsWith('-'));
    if (!inputFile) {
        console.error('missing file param');
        console.error('Usage: goal-controller <file>');
        process.exit(1);
    }
    const model = (0, GoalTree_1.loadPistarModel)({ filename: inputFile });
    const tree = (0, creation_1.convertToTree)({ model });
    const logger = (0, logger_1.initLogger)(inputFile);
    const fileName = path_1.default.parse(inputFile).name;
    const outputPath = `output/${fileName}.prism`;
    (0, fs_1.writeFile)(outputPath, (0, sleecTemplateEngine_1.sleecTemplateEngine)(tree), function (err) {
        if (err) {
            console.log(err);
            logger.close();
            return;
        }
        console.log(`The file was saved to ${outputPath}!`);
        logger.close();
    });
}
//# sourceMappingURL=index.js.map