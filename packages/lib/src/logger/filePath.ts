import fs from 'fs';
import path from 'path';

/**
 * Calculates the log file path for a given model file name
 * @param modelFileName The model file name (e.g., "examples/experiments/1-minimal.txt")
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file (e.g., "logs/examples/experiments/1-minimal.txt.log")
 */
export const getLogFilePath = (
  modelFileName: string,
  extension: string = '.log',
): string => {
  return `logs/${modelFileName}${extension}`;
};

/**
 * Ensures the directory for a log file exists and returns the full path
 * @param modelFileName The model file name
 * @param extension The file extension (default: ".log")
 * @returns The full path to the log file
 */
export const ensureLogFileDirectory = (
  modelFileName: string,
  extension: string = '.log',
): string => {
  const logFilePath = getLogFilePath(modelFileName, extension);
  const logDir = path.dirname(logFilePath);
  fs.mkdirSync(logDir, { recursive: true });
  return logFilePath;
};
