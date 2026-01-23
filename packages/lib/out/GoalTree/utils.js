"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVariant = exports.leafGoals = exports.goalRootId = exports.allGoalsMap = exports.allByType = void 0;
exports.cartesianProduct = cartesianProduct;
exports.childrenWithTasksAndResources = childrenWithTasksAndResources;
exports.childrenLength = childrenLength;
exports.childrenWithMaxRetries = childrenWithMaxRetries;
exports.dumpTreeToJSON = dumpTreeToJSON;
exports.childrenIncludingTasks = childrenIncludingTasks;
const allByType = ({ gm, type, preferVariant = true, }) => {
    const allCurrent = gm
        .flatMap((node) => {
        // we need to make resources and tasks back as children so we can
        // filter them out in the next step
        const children = childrenWithTasksAndResources({ node });
        if (children.length > 0) {
            return [
                node,
                ...((0, exports.allByType)({ gm: children, type, preferVariant }) ?? []),
            ];
        }
        return [node];
    })
        .filter((node) => node.type === type)
        .sort((a, b) => a.id.localeCompare(b.id))
        .reduce((acc, current) => {
        if (acc[current.id]) {
            if (preferVariant && current.variantOf) {
                return { ...acc, [current.id]: current };
            }
            return { ...acc };
        }
        return { ...acc, [current.id]: current };
    }, {});
    return Object.values(allCurrent);
};
exports.allByType = allByType;
const allGoalsMap = ({ gm, preferVariant = true, }) => {
    return new Map((0, exports.allByType)({ gm, type: 'goal', preferVariant }).map((goal) => [
        goal.id,
        goal,
    ]));
};
exports.allGoalsMap = allGoalsMap;
const goalRootId = ({ id }) => {
    return id.slice(0, (id.slice(1).match('[a-zA-Z]')?.index ?? 2) + 1);
};
exports.goalRootId = goalRootId;
const leafGoals = ({ gm }) => {
    const leaves = (0, exports.allByType)({ gm, type: 'goal' })?.filter((goal) => !!goal.tasks);
    return leaves;
};
exports.leafGoals = leafGoals;
const isVariant = ({ variantOf }) => !!variantOf;
exports.isVariant = isVariant;
function* cartesianProduct(...arrays) {
    if (arrays.length === 0) {
        yield [];
        return;
    }
    const [first, ...rest] = arrays;
    if (!first) {
        yield [];
        return;
    }
    for (const item of first) {
        if (rest.length === 0) {
            yield [item];
        }
        else {
            for (const subProduct of cartesianProduct(...rest)) {
                yield [item, ...subProduct];
            }
        }
    }
}
function childrenWithTasksAndResources({ node, }) {
    return [
        ...(node.children ?? []),
        ...node.resources,
        ...(node.tasks ?? []),
    ];
}
function childrenLength({ node }) {
    return childrenWithTasksAndResources({ node }).length;
}
function childrenWithMaxRetries({ node, }) {
    return childrenWithTasksAndResources({ node }).filter((child) => !!child.properties.maxRetries);
}
function dumpTreeToJSON({ gm }) {
    return JSON.stringify(gm, null, 2);
}
function childrenIncludingTasks({ node, }) {
    return childrenWithTasksAndResources({ node });
}
//# sourceMappingURL=utils.js.map