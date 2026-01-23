import type { GenericGoal, GenericTree, GoalNode, Type } from './types';
export declare const allByType: <T extends GenericTree>({ gm, type, preferVariant, }: {
    gm: T;
    type: Type;
    preferVariant?: boolean;
}) => T;
export declare const allGoalsMap: <T extends GenericTree>({ gm, preferVariant, }: {
    gm: T;
    preferVariant?: boolean;
}) => Map<string, T[number]>;
export declare const goalRootId: ({ id }: {
    id: string;
}) => string;
export declare const leafGoals: <T extends GenericTree>({ gm }: {
    gm: T;
}) => T;
export declare const isVariant: ({ variantOf }: GoalNode) => boolean;
export declare function cartesianProduct<T>(...arrays: T[][]): Generator<T[]>;
export declare function childrenWithTasksAndResources<T extends GenericGoal>({ node, }: {
    node: T;
}): T[];
export declare function childrenLength({ node }: {
    node: GenericGoal;
}): number;
export declare function childrenWithMaxRetries({ node, }: {
    node: GenericGoal;
}): GenericGoal[];
export declare function dumpTreeToJSON({ gm }: {
    gm: GenericTree;
}): string;
export declare function childrenIncludingTasks<T extends GenericGoal>({ node, }: {
    node: T;
}): T[];
//# sourceMappingURL=utils.d.ts.map