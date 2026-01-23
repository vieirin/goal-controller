import type { GoalTree } from '../GoalTree/types';
import { formatValidationReport, getValidationSummary, serializeValidationReportToJSON } from './report';
import type { ValidationReport } from './types';
import { validatePrismModel } from './validator';
export type { ValidationReport } from './types';
export { formatValidationReport, getValidationSummary, serializeValidationReportToJSON, validatePrismModel, };
/**
 * Validates a PRISM model against the expected GoalTree structure
 * @param goalTree The GoalTree structure
 * @param prismModel The generated PRISM model string
 * @param modelFileName Optional model file name to write JSON report to logs folder
 * @returns Validation report with expected, emitted, and missing elements
 */
export declare const validate: (goalTree: GoalTree, prismModel: string, modelFileName?: string) => ValidationReport;
//# sourceMappingURL=index.d.ts.map