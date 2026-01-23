"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateExpectedElements = void 0;
const treeVariables_1 = require("../GoalTree/treeVariables");
const utils_1 = require("../GoalTree/utils");
const common_1 = require("../mdp/common");
const common_2 = require("../templateEngine/common");
const achievedMaintain = (goalId) => {
    return `${goalId}_achieved_maintain`;
};
const calculateGoalVariables = (goal) => {
    const variables = [];
    // Always has pursued
    variables.push((0, common_2.pursuedVariable)(goal.id));
    // Has achieved if not maintain goal
    if (!goal.execCondition?.maintain) {
        variables.push((0, common_2.achievedVariable)(goal.id));
    }
    // Has chosen if choice execution detail
    if (goal.executionDetail?.type === 'choice') {
        const children = (0, utils_1.childrenIncludingTasks)({ node: goal });
        if (children.length > 0) {
            variables.push((0, common_2.chosenVariable)(goal.id));
        }
    }
    // Has failed variables for children with maxRetries
    const childrenWithRetries = (0, utils_1.childrenWithMaxRetries)({ node: goal });
    childrenWithRetries.forEach((child) => {
        variables.push((0, common_1.failed)(child.id));
    });
    return variables;
};
const calculateGoalTransitions = (goal) => {
    const transitions = [];
    // Always has pursue transitions: one for itself + one for each child
    transitions.push((0, common_2.pursueTransition)(goal.id));
    const children = (0, utils_1.childrenIncludingTasks)({ node: goal });
    children.forEach((child) => {
        transitions.push((0, common_2.pursueTransition)(child.id));
    });
    // Always has achieve transition
    transitions.push((0, common_2.achievedTransition)(goal.id));
    // Always has skip transition
    transitions.push(`skip_${goal.id}`);
    return transitions;
};
const calculateGoalFormulas = (goal) => {
    const formulas = [];
    // Always has achievability formula
    formulas.push((0, common_2.achievableFormulaVariable)(goal.id));
    // Has maintain formula if maintain goal
    if (goal.execCondition?.maintain) {
        formulas.push(achievedMaintain(goal.id));
    }
    return formulas;
};
const calculateGoalContextVariables = (goal) => {
    const variables = [];
    // Only count context variables from the goal's own assertion
    // These appear in the first pursue line of the goal's module
    // We don't count maintain variables because they're used in formulas, not pursue lines
    // We don't count children's context variables because they don't appear in the goal's first pursue line
    if (goal.execCondition?.assertion) {
        goal.execCondition.assertion.variables.forEach((v) => {
            variables.push(v.name);
        });
    }
    return variables;
};
const calculateChangeManagerTaskVariables = (tasks) => {
    const taskVariables = new Map();
    tasks.forEach((task) => {
        const variables = [];
        variables.push(`${task.id}_pursued`);
        variables.push((0, common_2.achievedVariable)(task.id));
        taskVariables.set(task.id, variables);
    });
    return taskVariables;
};
const calculateChangeManagerTaskTransitions = (tasks) => {
    const taskTransitions = new Map();
    tasks.forEach((task) => {
        const transitions = [];
        transitions.push((0, common_2.pursueTransition)(task.id));
        transitions.push(`try_${task.id}`);
        transitions.push((0, common_2.achievedTransition)(task.id));
        taskTransitions.set(task.id, transitions);
    });
    return taskTransitions;
};
const calculateExpectedElements = (goalTree) => {
    const goals = (0, utils_1.allByType)({ gm: goalTree, type: 'goal' });
    const tasks = (0, utils_1.allByType)({ gm: goalTree, type: 'task' });
    const resources = (0, utils_1.allByType)({ gm: goalTree, type: 'resource' });
    const goalElements = new Map();
    // Calculate expected elements for each goal
    goals.forEach((goal) => {
        goalElements.set(goal.id, {
            variables: calculateGoalVariables(goal),
            transitions: calculateGoalTransitions(goal),
            formulas: calculateGoalFormulas(goal),
            contextVariables: calculateGoalContextVariables(goal),
        });
    });
    // Calculate ChangeManager elements
    const changeManagerTaskVariables = calculateChangeManagerTaskVariables(tasks);
    const changeManagerTaskTransitions = calculateChangeManagerTaskTransitions(tasks);
    // Calculate System elements
    // Context variables from goals (using existing function)
    const goalContextVariables = (0, treeVariables_1.treeContextVariables)(goalTree);
    // Also collect context variables from tasks
    const taskContextVariables = new Set();
    tasks.forEach((task) => {
        if (task.execCondition?.assertion) {
            task.execCondition.assertion.variables.forEach((v) => {
                taskContextVariables.add(v.name);
            });
        }
        if (task.execCondition?.maintain?.variables) {
            task.execCondition.maintain.variables.forEach((v) => {
                taskContextVariables.add(v.name);
            });
        }
    });
    // Resource IDs to exclude from context variables (resources are separate)
    const resourceIds = new Set(resources.map((resource) => resource.id));
    // Combine goal and task context variables, but exclude resource IDs
    const allContextVars = new Set([
        ...goalContextVariables,
        ...Array.from(taskContextVariables),
    ]);
    const contextVariables = Array.from(allContextVars).filter((varName) => !resourceIds.has(varName));
    const resourceVariables = resources.map((resource) => resource.id);
    return {
        goals: goalElements,
        changeManager: {
            taskVariables: changeManagerTaskVariables,
            taskTransitions: changeManagerTaskTransitions,
        },
        system: {
            contextVariables,
            resourceVariables,
        },
    };
};
exports.calculateExpectedElements = calculateExpectedElements;
//# sourceMappingURL=expectedElements.js.map