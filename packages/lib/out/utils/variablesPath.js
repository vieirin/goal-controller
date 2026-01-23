"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariablesFilePath = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const getVariablesFilePath = (modelPath) => {
    const fileName = (0, path_1.basename)(modelPath, '.txt'); // Remove extension if present
    const relativePath = (0, path_1.join)('input', fileName, 'variables.json');
    // Try multiple paths to support both direct execution and monorepo (from packages/lib)
    if ((0, fs_1.existsSync)(relativePath)) {
        return relativePath;
    }
    const monorepoPath = (0, path_1.join)('..', '..', 'input', fileName, 'variables.json');
    if ((0, fs_1.existsSync)(monorepoPath)) {
        return monorepoPath;
    }
    // Return the default path (will fail with helpful error if file doesn't exist)
    return relativePath;
};
exports.getVariablesFilePath = getVariablesFilePath;
//# sourceMappingURL=variablesPath.js.map