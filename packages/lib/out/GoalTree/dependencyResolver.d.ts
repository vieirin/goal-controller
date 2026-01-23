import type { GoalNode, GoalTree } from './types';
export type Dependency = {
    goal: string;
    isFormula?: boolean;
    depends: Array<Dependency | null>;
};
export type ConditionDependency = Dependency & {
    isVariant: boolean;
};
export declare const resolveDependency: ({ gm, goal, }: {
    gm: GoalTree;
    goal: GoalNode;
}) => ConditionDependency;
//# sourceMappingURL=dependencyResolver.d.ts.map