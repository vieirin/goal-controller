import type {
  GoalNode,
  GoalTreeType,
  Resource,
  Task,
} from '@goal-controller/goal-tree';
import { GoalTree, Node } from '@goal-controller/goal-tree';
import { failed } from '../mdp/common';
import {
  achievableFormulaVariable,
  achievedTransition,
  achievedVariable,
  chosenVariable,
  pursuedVariable,
  pursueTransition,
} from '../templateEngine/common';
import type { ExpectedElements } from './types';

const achievedMaintain = (goalId: string): string => {
  return `${goalId}_achieved_maintain`;
};

const calculateGoalVariables = (goal: GoalNode): string[] => {
  const variables: string[] = [];

  // Always has pursued
  variables.push(pursuedVariable(goal.id));

  // Has achieved if not maintain goal
  if (!goal.properties.edge.execCondition?.maintain) {
    variables.push(achievedVariable(goal.id));
  }

  // Has chosen if choice execution detail
  if (goal.properties.edge.executionDetail?.type === 'choice') {
    const children = Node.children(goal);
    if (children.length > 0) {
      variables.push(chosenVariable(goal.id));
    }
  }

  // Has failed variables for children with maxRetries
  const childrenWithRetries = Node.childrenWithRetries(goal);
  childrenWithRetries.forEach((child) => {
    variables.push(failed(child.id));
  });

  return variables;
};

const calculateGoalTransitions = (goal: GoalNode): string[] => {
  const transitions: string[] = [];

  // Always has pursue transitions: one for itself + one for each child
  transitions.push(pursueTransition(goal.id));
  const children = Node.children(goal);
  children.forEach((child) => {
    transitions.push(pursueTransition(child.id));
  });

  // Always has achieve transition
  transitions.push(achievedTransition(goal.id));

  // Always has skip transition
  transitions.push(`skip_${goal.id}`);

  return transitions;
};

const calculateGoalFormulas = (goal: GoalNode): string[] => {
  const formulas: string[] = [];

  // Always has achievability formula
  formulas.push(achievableFormulaVariable(goal.id));

  // Has maintain formula if maintain goal
  if (goal.properties.edge.execCondition?.maintain) {
    formulas.push(achievedMaintain(goal.id));
  }

  return formulas;
};

const calculateGoalContextVariables = (goal: GoalNode): string[] => {
  const variables: string[] = [];

  // Only count context variables from the goal's own assertion
  // These appear in the first pursue line of the goal's module
  // We don't count maintain variables because they're used in formulas, not pursue lines
  // We don't count children's context variables because they don't appear in the goal's first pursue line
  if (goal.properties.edge.execCondition?.assertion) {
    goal.properties.edge.execCondition.assertion.variables.forEach(
      (v: { name: string }) => {
        variables.push(v.name);
      },
    );
  }

  return variables;
};

const calculateChangeManagerTaskVariables = (
  tasks: Task[],
): Map<string, string[]> => {
  const taskVariables = new Map<string, string[]>();

  tasks.forEach((task: Task) => {
    const variables: string[] = [];
    variables.push(`${task.id}_pursued`);
    variables.push(achievedVariable(task.id));

    taskVariables.set(task.id, variables);
  });

  return taskVariables;
};

const calculateChangeManagerTaskTransitions = (
  tasks: Task[],
): Map<string, string[]> => {
  const taskTransitions = new Map<string, string[]>();

  tasks.forEach((task: Task) => {
    const transitions: string[] = [];
    transitions.push(pursueTransition(task.id));
    transitions.push(`try_${task.id}`);
    transitions.push(achievedTransition(task.id));
    taskTransitions.set(task.id, transitions);
  });

  return taskTransitions;
};

export const calculateExpectedElements = (
  goalTree: GoalTreeType,
): ExpectedElements => {
  const goals = GoalTree.allByType(goalTree, 'goal');
  const tasks = GoalTree.allByType(goalTree, 'task');
  const resources = GoalTree.allByType(goalTree, 'resource');

  const goalElements = new Map<
    string,
    {
      variables: string[];
      transitions: string[];
      formulas: string[];
      contextVariables: string[];
    }
  >();

  // Calculate expected elements for each goal
  goals.forEach((goal: GoalNode) => {
    goalElements.set(goal.id, {
      variables: calculateGoalVariables(goal),
      transitions: calculateGoalTransitions(goal),
      formulas: calculateGoalFormulas(goal),
      contextVariables: calculateGoalContextVariables(goal),
    });
  });

  // Calculate ChangeManager elements
  const changeManagerTaskVariables = calculateChangeManagerTaskVariables(tasks);
  const changeManagerTaskTransitions =
    calculateChangeManagerTaskTransitions(tasks);

  // Calculate System elements
  // Context variables from goals (using existing function)
  const goalContextVariables = GoalTree.contextVariables(goalTree);

  // Also collect context variables from tasks
  const taskContextVariables = new Set<string>();
  tasks.forEach((task: Task) => {
    if (task.properties.edge.execCondition?.assertion) {
      task.properties.edge.execCondition.assertion.variables.forEach(
        (v: { name: string }) => {
          taskContextVariables.add(v.name);
        },
      );
    }
    if (task.properties.edge.execCondition?.maintain?.variables) {
      task.properties.edge.execCondition.maintain.variables.forEach(
        (v: { name: string }) => {
          taskContextVariables.add(v.name);
        },
      );
    }
  });

  // Resource IDs to exclude from context variables (resources are separate)
  const resourceIds = new Set(
    resources.map((resource: Resource) => resource.id),
  );

  // Combine goal and task context variables, but exclude resource IDs
  const allContextVars = new Set([
    ...goalContextVariables,
    ...Array.from(taskContextVariables),
  ]);
  const contextVariables = Array.from(allContextVars).filter(
    (varName) => !resourceIds.has(varName),
  );
  const resourceVariables = resources.map((resource: Resource) => resource.id);

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
