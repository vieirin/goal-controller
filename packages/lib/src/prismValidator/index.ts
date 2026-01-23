import { writeFileSync } from 'fs';
import type { GoalTree } from '../GoalTree/types';
import { ensureLogFileDirectory } from '../logger/filePath';
import {
  formatValidationReport,
  getValidationSummary,
  serializeValidationReportToJSON,
} from './report';
import type { ValidationReport } from './types';
import { validatePrismModel } from './validator';

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
  goalTree: GoalTree,
  prismModel: string,
  modelFileName?: string,
): ValidationReport => {
  const report = validatePrismModel(goalTree, prismModel);

  // Write JSON report to logs folder if modelFileName is provided
  if (modelFileName) {
    const jsonReport = serializeValidationReportToJSON(report);
    const jsonFilePath = ensureLogFileDirectory(
      modelFileName,
      '.validation.json',
    );
    writeFileSync(jsonFilePath, JSON.stringify(jsonReport, null, 2), 'utf8');
  }

  return report;
};
