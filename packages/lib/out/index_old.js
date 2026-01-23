"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const GoalTree_1 = require("./GoalTree");
const creation_1 = require("./GoalTree/creation");
const logger_1 = require("./logger/logger");
const sleecTemplateEngine_1 = require("./sleecTemplateEngine");
// Parse command line arguments
const args = process.argv.slice(2);
// const cleanFlag = args.includes('--clean') || args.includes('-c');
const inputFile = args.find((arg) => !arg.startsWith('--') && !arg.startsWith('-'));
if (!inputFile) {
    console.error('missing file param');
    console.error('Usage: npx ts-node src/index.ts <file> [--clean|-c]');
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
//# sourceMappingURL=index_old.js.map