import type { GoalTree } from '../../../GoalTree/types';
export declare const systemModule: ({ gm, fileName, clean, variables: variablesParam, }: {
    gm: GoalTree;
    fileName: string;
    clean?: boolean;
    variables?: Record<string, boolean | number>;
}) => string;
export declare const __test_only_exports__: {
    extractOldSystemTransitions: (fileName: string) => string[];
};
//# sourceMappingURL=system.d.ts.map