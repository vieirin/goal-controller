"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runModel = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const GoalTree_1 = require("../../GoalTree");
const creation_1 = require("../../GoalTree/creation");
const logger_1 = require("../../logger/logger");
const engine_1 = require("../../templateEngine/engine");
const runModel = async (filePath, clean = false) => {
    const logger = (0, logger_1.initLogger)(filePath);
    try {
        const model = (0, GoalTree_1.loadPistarModel)({ filename: filePath });
        const tree = (0, creation_1.convertToTree)({ model });
        // last part of the path
        const fileName = filePath.split('/').pop();
        if (!fileName) {
            throw new Error('File name not found');
        }
        const output = (0, engine_1.generateValidatedPrismModel)({
            gm: tree,
            fileName,
            clean,
        });
        await (0, promises_1.writeFile)(`output/${path_1.default.parse(fileName).name}.prism`, output);
        console.log('The file was saved successfully!');
    }
    catch (error) {
        logger.error('Error running model:', error);
        throw error;
    }
    finally {
        logger.close();
    }
};
exports.runModel = runModel;
//# sourceMappingURL=selectModel.js.map