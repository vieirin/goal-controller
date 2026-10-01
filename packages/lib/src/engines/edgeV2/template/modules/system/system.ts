import { GoalTree } from '@goal-controller/goal-tree';
import { getLogger } from '../../../logger/logger';
import type { EdgeGoalTree, EdgeResource, EdgeTask } from '../../../types';
import { systemModuleTemplate } from './template';

/**
 * Extracts transition lines from the System module in a previous PRISM output
 * @param previousOutput The previous PRISM model's text
 * @returns Array of transition lines from the System module, or empty array if there are none
 */
const extractOldSystemTransitions = (previousOutput: string): string[] => {
  const lines = previousOutput.split('\n');

  let inSystemModule = false;
  const transitions: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const trimmedLine = line.trim();

    // Check if we're entering the System module
    if (trimmedLine === 'module System') {
      inSystemModule = true;
      continue;
    }

    // Check if we're leaving the System module
    if (inSystemModule && trimmedLine === 'endmodule') {
      break;
    }

    // If we're in the System module, check for transitions
    if (inSystemModule) {
      // Match transition pattern: [label] guard -> update;
      const transitionMatch = trimmedLine.match(
        /^\s*\[([^\]]+)\]\s*.+?\s*->\s*.+?\s*;?\s*$/,
      );
      if (transitionMatch) {
        // Collect preceding comment lines
        const precedingComments: string[] = [];
        let j = i - 1;
        while (j >= 0) {
          const prevLine = lines[j];
          if (!prevLine) {
            j--;
            continue;
          }
          const prevTrimmed = prevLine.trim();
          // Stop if we hit a non-comment, non-empty line
          if (prevTrimmed && !prevTrimmed.startsWith('//')) {
            break;
          }
          // Collect comment lines (preserve order by unshifting)
          if (prevTrimmed.startsWith('//')) {
            precedingComments.unshift(prevLine);
          }
          j--;
        }

        // Add preceding comments and the transition line
        transitions.push(...precedingComments);
        transitions.push(line);
      }
    }
  }

  return transitions;
};

export const systemModule = ({
  gm,
  previousOutput,
  clean = false,
  variables: defaultVariableValues,
}: {
  gm: EdgeGoalTree;
  previousOutput?: string;
  clean?: boolean;
  variables: Record<string, boolean | number>;
}): string => {
  const logger = getLogger();
  logger.initSystem();
  const goalContextVars = GoalTree.contextVariables(gm);

  // Also collect context variables from tasks
  const tasks = GoalTree.allByType(gm, 'task');
  const taskContextVariables = new Set<string>();
  tasks.forEach((task: EdgeTask) => {
    if (task.properties.engine.execCondition?.assertion) {
      task.properties.engine.execCondition.assertion.variables.forEach(
        (v: { name: string }) => {
          taskContextVariables.add(v.name);
        },
      );
    }
    if (task.properties.engine.execCondition?.maintain?.variables) {
      task.properties.engine.execCondition.maintain.variables.forEach(
        (v: { name: string }) => {
          taskContextVariables.add(v.name);
        },
      );
    }
  });

  // Combine goal and task context variables
  const allContextVars = new Set([
    ...goalContextVars,
    ...Array.from(taskContextVariables),
  ]);

  // Exclude resource IDs from context variables
  const resources = GoalTree.allByType(gm, 'resource');
  const resourceIds = new Set(
    resources.map((resource: EdgeResource) => resource.id),
  );
  const variables = Array.from(allContextVars).filter(
    (varName) => !resourceIds.has(varName),
  );

  const oldTransitions =
    clean || !previousOutput ? [] : extractOldSystemTransitions(previousOutput);
  return systemModuleTemplate({
    variables,
    resources,
    defaultVariableValues,
    oldTransitions,
  });
};

export const __test_only_exports__ = {
  extractOldSystemTransitions,
};
