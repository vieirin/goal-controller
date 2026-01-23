"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.validatePrismModel = exports.serializeValidationReportToJSON = exports.getValidationSummary = exports.formatValidationReport = void 0;
const fs_1 = require("fs");
const filePath_1 = require("../logger/filePath");
const report_1 = require("./report");
Object.defineProperty(exports, "formatValidationReport", { enumerable: true, get: function () { return report_1.formatValidationReport; } });
Object.defineProperty(exports, "getValidationSummary", { enumerable: true, get: function () { return report_1.getValidationSummary; } });
Object.defineProperty(exports, "serializeValidationReportToJSON", { enumerable: true, get: function () { return report_1.serializeValidationReportToJSON; } });
const validator_1 = require("./validator");
Object.defineProperty(exports, "validatePrismModel", { enumerable: true, get: function () { return validator_1.validatePrismModel; } });
/**
 * Validates a PRISM model against the expected GoalTree structure
 * @param goalTree The GoalTree structure
 * @param prismModel The generated PRISM model string
 * @param modelFileName Optional model file name to write JSON report to logs folder
 * @returns Validation report with expected, emitted, and missing elements
 */
const validate = (goalTree, prismModel, modelFileName) => {
    const report = (0, validator_1.validatePrismModel)(goalTree, prismModel);
    // Write JSON report to logs folder if modelFileName is provided
    // Skip file writing in serverless environments (e.g., Vercel)
    if (modelFileName) {
        const jsonReport = (0, report_1.serializeValidationReportToJSON)(report);
        const jsonFilePath = (0, filePath_1.ensureLogFileDirectory)(modelFileName, '.validation.json');
        // Only write if directory creation succeeded (not in serverless environment)
        if (jsonFilePath) {
            try {
                (0, fs_1.writeFileSync)(jsonFilePath, JSON.stringify(jsonReport, null, 2), 'utf8');
            }
            catch {
                // Silently fail in serverless environments
            }
        }
    }
    return report;
};
exports.validate = validate;
//# sourceMappingURL=index.js.map