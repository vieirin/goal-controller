/**
 * Calculates the log file path for a given model file name
 * @param modelFileName The model file name (e.g., "examples/experiments/1-minimal.txt")
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file (e.g., "logs/examples/experiments/1-minimal.txt.log")
 */
export declare const getLogFilePath: (modelFileName: string, extension?: string) => string;
/**
 * Ensures the directory for a log file exists and returns the full path
 * @param modelFileName The model file name
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file, or null if directory creation fails (e.g., in serverless environments)
 */
export declare const ensureLogFileDirectory: (modelFileName: string, extension?: string) => string | null;
//# sourceMappingURL=filePath.d.ts.map