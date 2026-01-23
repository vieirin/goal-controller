import type { ValidationReport } from './types';
export declare const serializeValidationReportToJSON: (report: ValidationReport) => Record<string, unknown>;
export declare const formatValidationReport: (report: ValidationReport) => string;
export declare const getValidationSummary: (report: ValidationReport) => {
    expected: number;
    emitted: number;
    missing: number;
    byCategory: Record<string, {
        expected: number;
        emitted: number;
        missing: number;
    }>;
};
//# sourceMappingURL=report.d.ts.map