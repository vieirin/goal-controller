import type { GoalExecutionDetail, GoalNode } from '../GoalTree/types';
type LoggerStore = {
    goalModules: number;
    goalVariables: number;
    goalPursueLines: number;
    goalAchievabilityFormulas: number;
    goalMaintainFormulas: number;
    goalAchievedLines: number;
    goalSkipLines: number;
    tasksVariables: number;
    tasksLabels: number;
    tasksAchievabilityConstants: number;
    tasksTryLines: number;
    tasksFailedLines: number;
    tasksAchievedLines: number;
    tasksSkippedLines: number;
    systemVariables: number;
    systemResources: number;
    systemContextVariables: number;
    totalGoals: number;
    goalTypeDegradation: number;
    goalTypeChoice: number;
    goalTypeAlternative: number;
    goalTypeSequence: number;
    goalTypeInterleaved: number;
    totalTasks: number;
    totalResources: number;
    totalNodes: number;
    totalVariables: number;
};
type LoggerReport = {
    log: string;
    summary: {
        elapsedTime: string;
        elapsedTimeMs: number;
        totalGoals: number;
        totalTasks: number;
        totalResources: number;
        totalNodes: number;
        totalVariables: number;
        goalTypeDegradation: number;
        goalTypeChoice: number;
        goalTypeAlternative: number;
        goalTypeSequence: number;
        goalTypeInterleaved: number;
        goalModules: number;
        goalVariables: number;
        goalPursueLines: number;
        goalAchievedLines: number;
        goalSkippedLines: number;
        goalAchievabilityFormulas: number;
        goalMaintainFormulas: number;
        tasksVariables: number;
        tasksLabels: number;
        tasksTryLines: number;
        tasksFailedLines: number;
        tasksAchievedLines: number;
        tasksSkippedLines: number;
        tasksAchievabilityConstants: number;
        systemVariables: number;
        systemResources: number;
        systemContextVariables: number;
    };
};
export type { LoggerReport };
type VariableDefinitionBase = {
    variable: string;
    initialValue: number | boolean | 'MISSING_VARIABLE_DEFINITION';
    upperBound?: number | boolean;
    lowerBound?: number | boolean;
    type?: 'boolean' | 'int';
};
type VariableDefinition = (VariableDefinitionBase & {
    context: 'goal' | 'task';
}) | (VariableDefinitionBase & {
    context: 'system';
    subContext: 'resource' | 'context';
});
export declare const createStore: () => LoggerStore;
declare const createLogger: (modelFileName: string, store: LoggerStore, logToConsole?: boolean, inMemory?: boolean) => {
    decisionVariable: (decisionVariable: [string, number]) => void;
    initGoal: (goal: GoalNode) => void;
    initTask: (task: GoalNode) => void;
    initSystem: () => void;
    maintainFormulaDefinition: (goalId: string, formula: string, sentence: string, prismLine: string) => void;
    achievabilityFormulaDefinition: (goalId: string, formula: string, type: "AND" | "OR" | "SINGLE_GOAL", sentence: string, prismLine: string) => void;
    achievabilityTaskConstant: (taskId: string, constant: string, value: number) => void;
    taskTranstions: {
        transition: (taskId: string, leftStatement: string, updateStatement: string, prismLabelStatement: string, transition: "pursue" | "achieve" | "failed" | "try", maxRetries?: number) => void;
    };
    pursue: {
        pursue: (goal: GoalNode, step: number) => void;
        defaultPursueCondition: (pursueCondition: string) => void;
        update: (update: string) => void;
        goalDependency: (goalId: string, dependsOn: string[]) => void;
        executionDetail: {
            choice: (currentGoal: string, otherGoals: string[], guardStatement: string) => void;
            degradation: {
                init: (currentGoal: string, degradation: string[]) => void;
                retry: (currentGoal: string, goalToRetry: string, amountOfRetries: number) => void;
                alternative: (currentGoal: string, alternative: string[]) => void;
            };
            sequence: (goalId: string, currentGoal: string, leftGoals: string[], rightGoals: string[]) => void;
            alternative: (currentGoal: string, alternative: string[]) => void;
            interleaved: () => void;
            activationContext: (sentence: string) => void;
            noActivationContext: (goalId: string) => void;
        };
        stepStatement: (step: number, left: string, right: string) => void;
        finish: () => void;
    };
    achieve: (goalId: string, condition: string, update: string, prismLabelStatement: string) => void;
    skip: (goalId: string, leftStatement: string, updateStatement: string, prismLabelStatement: string) => void;
    variableDefinition: ({ variable, initialValue, upperBound, lowerBound, type, context, ...props }: VariableDefinition) => void;
    executionDetail: (executionDetail: GoalExecutionDetail) => void;
    info: (message: string, level: number) => void;
    error: (source: string, message: string | Error | unknown) => void;
    trace: (source: string, message: string, level?: number) => void;
    getReport: () => LoggerReport;
    close: () => void;
};
export declare const initLogger: (modelFileName: string, logToConsole?: boolean, inMemory?: boolean) => ReturnType<typeof createLogger>;
export declare const getLogger: () => ReturnType<typeof createLogger>;
//# sourceMappingURL=logger.d.ts.map