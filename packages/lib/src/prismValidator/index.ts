import { writeFileSync } from 'fs';
import { ensureLogFileDirectory } from '../logger/filePath';
import {
  formatValidationReport,
  getValidationSummary,
  serializeValidationReportToJSON,
} from './report';
import type { ValidationReport } from './types';
import { validatePrismModel } from './validator';
import type { EdgeGoalTree } from '../templateEngine/edgeTypes';

export type { ValidationReport } from './types';
export {
  formatValidationReport,
  getValidationSummary,
  serializeValidationReportToJSON,
  validatePrismModel,
};

/**
 * Validates a PRISM model against the expected GoalTree structure
 * @param goalTree The GoalTree structure
 * @param prismModel The generated PRISM model string
 * @param modelFileName Optional model file name to write JSON report to logs folder
 * @returns Validation report with expected, emitted, and missing elements
 */
export const validate = (
  goalTree: EdgeGoalTree,
  prismModel: string,
  modelFileName?: string,
): ValidationReport => {
  const report = validatePrismModel(goalTree, prismModel);

  // Write JSON report to logs folder if modelFileName is provided
  // Skip file writing in serverless environments (e.g., Vercel)
  if (modelFileName) {
    const jsonReport = serializeValidationReportToJSON(report);
    const jsonFilePath = ensureLogFileDirectory(
      modelFileName,
      '.validation.json',
    );
    // Only write if directory creation succeeded (not in serverless environment)
    if (jsonFilePath) {
      try {
        writeFileSync(
          jsonFilePath,
          JSON.stringify(jsonReport, null, 2),
          'utf8',
        );
      } catch {
        // Silently fail in serverless environments
      }
    }
  }

  return report;
};
