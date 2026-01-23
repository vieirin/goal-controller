"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDependency = void 0;
const utils_1 = require("./utils");
const resolve = ({ allMap, target, }) => {
    const targetDependency = allMap.get(target);
    if (!targetDependency) {
        return null;
    }
    const isFormula = (targetDependency.children?.length ?? 0) > 0;
    const dependencies = targetDependency.properties.dependsOn;
    return {
        goal: targetDependency.id,
        isFormula,
        depends: dependencies.map((dependency) => resolve({
            allMap,
            target: dependency,
        })),
    };
};
const resolveDependency = ({ gm, goal, }) => {
    const allGoals = (0, utils_1.allGoalsMap)({ gm });
    const dependencies = goal.properties.dependsOn;
    return {
        goal: goal.id,
        isVariant: !!goal.variantOf,
        depends: dependencies.map((dependency) => resolve({
            allMap: allGoals,
            target: dependency,
        })),
    };
};
exports.resolveDependency = resolveDependency;
//# sourceMappingURL=dependencyResolver.js.map