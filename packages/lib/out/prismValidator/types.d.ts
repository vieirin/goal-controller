export type VariableInfo = {
    name: string;
    type: 'int' | 'bool';
    bounds?: {
        lower: number;
        upper: number;
    };
    initialValue?: number | boolean;
};
export type TransitionInfo = {
    label: string;
    guard: string;
    update: string;
    variablesReferenced: string[];
};
export type FormulaInfo = {
    name: string;
    expression: string;
};
export type ModuleInfo = {
    name: string;
    variables: VariableInfo[];
    transitions: TransitionInfo[];
    goalType?: 'choice' | 'degradation' | 'sequence' | 'interleaved' | 'alternative' | 'basic';
    lineCount?: number;
};
export type ParsedPrismModel = {
    goalModules: Map<string, ModuleInfo>;
    changeManagerModule?: ModuleInfo;
    systemModule?: ModuleInfo;
    formulas: FormulaInfo[];
    constants: Map<string, number>;
};
export type ElementCount = {
    expected: number;
    emitted: number;
    missing: number;
};
export type ElementDetails = {
    expected: string[];
    emitted: string[];
    missing: string[];
};
export type GoalValidation = {
    module: ElementCount & {
        lineCount?: number;
    };
    variables: ElementCount & {
        details: ElementDetails;
    };
    transitions: ElementCount & {
        details: ElementDetails;
    };
    formulas: ElementCount & {
        details: ElementDetails;
    };
    contextVariables: ElementCount & {
        details: ElementDetails;
    };
};
export type ChangeManagerValidation = {
    taskVariables: ElementCount & {
        details: ElementDetails;
    };
    taskTransitions: ElementCount & {
        details: ElementDetails;
    };
};
export type SystemValidation = {
    contextVariables: ElementCount & {
        details: ElementDetails;
    };
    resourceVariables: ElementCount & {
        details: ElementDetails;
    };
};
export type GoalTypeCounts = {
    choice: ElementCount;
    degradation: ElementCount;
    sequence: ElementCount;
    interleaved: ElementCount;
    alternative: ElementCount;
    basic: ElementCount;
};
export type ValidationReport = {
    goals: Map<string, GoalValidation>;
    changeManager: ChangeManagerValidation;
    system: SystemValidation;
    goalTypes: GoalTypeCounts;
    summary: {
        totalExpected: number;
        totalEmitted: number;
        totalMissing: number;
        byNodeType: {
            goals: {
                modules: {
                    expected: number;
                    emitted: number;
                };
            };
            tasks: {
                variables: {
                    expected: number;
                    emitted: number;
                };
                transitions: {
                    expected: number;
                    emitted: number;
                };
            };
            resources: {
                variables: {
                    expected: number;
                    emitted: number;
                };
            };
        };
    };
};
export type ExpectedElements = {
    goals: Map<string, {
        variables: string[];
        transitions: string[];
        formulas: string[];
        contextVariables: string[];
    }>;
    changeManager: {
        taskVariables: Map<string, string[]>;
        taskTransitions: Map<string, string[]>;
    };
    system: {
        contextVariables: string[];
        resourceVariables: string[];
    };
};
//# sourceMappingURL=types.d.ts.map