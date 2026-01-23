"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastSelectedModel = exports.saveLastSelectedModel = exports.getFilesInDirectory = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const LAST_SELECTED_DB = 'lastSelected.db';
const getFilesInDirectory = async (directory) => {
    try {
        const files = await (0, promises_1.readdir)(directory);
        const fileStats = await Promise.all(files.map(async (file) => {
            const filePath = (0, path_1.join)(directory, file);
            const stats = await (0, promises_1.stat)(filePath);
            // If it's a directory, recursively get files from it
            if (stats.isDirectory()) {
                return await (0, exports.getFilesInDirectory)(filePath);
            }
            // If it's a file and ends with .txt, return it
            if (file.endsWith('.txt')) {
                return [
                    {
                        name: file,
                        path: filePath,
                        mtime: stats.mtime,
                    },
                ];
            }
            // Otherwise, return empty array
            return [];
        }));
        // Flatten the array of arrays and sort by modification time
        const allFiles = fileStats.flat();
        return allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    }
    catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
};
exports.getFilesInDirectory = getFilesInDirectory;
const saveLastSelectedModel = async (filePath) => {
    try {
        await (0, promises_1.writeFile)(LAST_SELECTED_DB, filePath);
        console.log(`Last selected model saved to ${LAST_SELECTED_DB}`);
    }
    catch (error) {
        console.error('Error saving last selected model:', error);
    }
};
exports.saveLastSelectedModel = saveLastSelectedModel;
const getLastSelectedModel = async () => {
    try {
        const data = await (0, promises_1.readFile)(LAST_SELECTED_DB, 'utf-8');
        return data.trim();
    }
    catch (error) {
        // File doesn't exist or can't be read
        return null;
    }
};
exports.getLastSelectedModel = getLastSelectedModel;
//# sourceMappingURL=utils.js.map