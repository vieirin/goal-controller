import type { Resource } from '../../../../GoalTree/types';
export declare const resourceVariableName: (resource: Resource) => string;
export declare const defineVariable: (variable: string, initialValue: number | boolean | "MISSING_VARIABLE_DEFINITION", type: "boolean" | "int", context: "resource" | "context", lowerBound?: number | boolean, upperBound?: number | boolean) => string;
//# sourceMappingURL=variable.d.ts.map