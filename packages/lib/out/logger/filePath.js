"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLogFileDirectory = exports.getLogFilePath = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Calculates the log file path for a given model file name
 * @param modelFileName The model file name (e.g., "examples/experiments/1-minimal.txt")
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file (e.g., "logs/examples/experiments/1-minimal.txt.log")
 */
const getLogFilePath = (modelFileName, extension = '.log') => {
    return `logs/${modelFileName}${extension}`;
};
exports.getLogFilePath = getLogFilePath;
/**
 * Ensures the directory for a log file exists and returns the full path
 * @param modelFileName The model file name
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file, or null if directory creation fails (e.g., in serverless environments)
 */
const ensureLogFileDirectory = (modelFileName, extension = '.log') => {
    // In serverless environments (like Vercel), filesystem is read-only
    // Check if we're in a serverless environment
    if (process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NEXT_PHASE) {
        return null;
    }
    try {
        const logFilePath = (0, exports.getLogFilePath)(modelFileName, extension);
        const logDir = path_1.default.dirname(logFilePath);
        fs_1.default.mkdirSync(logDir, { recursive: true });
        return logFilePath;
    }
    catch {
        // If directory creation fails (e.g., read-only filesystem), return null
        return null;
    }
};
exports.ensureLogFileDirectory = ensureLogFileDirectory;
//# sourceMappingURL=filePath.js.map