import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getVariablesFilePath } from '../../../utils/variablesPath';
import { isResource } from '@goal-controller/goal-tree';
import { treeContextVariables } from '@goal-controller/goal-tree';
import type { GoalTree, GoalNode } from '@goal-controller/goal-tree';
import { allByType } from '@goal-controller/goal-tree';
import { getLogger } from '../../../logger/logger';
import { systemModuleTemplate } from './template';

/**
 * Extracts transition lines from the System module in an existing PRISM file
 * @param fileName The input file name (e.g., "examples/experiments/1-minimal.txt")
 * @returns Array of transition lines from the System module, or empty array if file doesn't exist or has no transitions
 */
const extractOldSystemTransitions = (fileName: string): string[] => {
  // Extract base name from fileName (e.g., "examples/experiments/1-minimal.txt" -> "1-minimal")
  const parsedPath = path.parse(fileName);
  const baseName = parsedPath.name;

  // Try multiple paths to find the output file (supports both monorepo and direct execution)
  const possiblePaths = [
    `output/${baseName}.prism`, // From project root
    `../../output/${baseName}.prism`, // From packages/lib (monorepo)
  ];

  const oldPrismFilePath = possiblePaths.find((p) => existsSync(p));

  // Check if the old PRISM file exists
  if (!oldPrismFilePath) {
    return [];
  }

  try {
    const prismContent = readFileSync(oldPrismFilePath, 'utf8');
    const lines = prismContent.split('\n');

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
  } catch (error) {
    // If there's an error reading the file, return empty array
    return [];
  }
};

export const systemModule = ({
  gm,
  fileName,
  clean = false,
  variables: variablesParam,
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
}): string => {
  const logger = getLogger();
  logger.initSystem();
  const goalContextVars = treeContextVariables(gm);

  // Also collect context variables from tasks
  const tasks = allByType({ gm, type: 'task' });
  const taskContextVariables = new Set<string>();
  tasks.forEach((task: GoalNode) => {
    if (task.execCondition?.assertion) {
      task.execCondition.assertion.variables.forEach((v: { name: string }) => {
        taskContextVariables.add(v.name);
      });
    }
    if (task.execCondition?.maintain?.variables) {
      task.execCondition.maintain.variables.forEach((v: { name: string }) => {
        taskContextVariables.add(v.name);
      });
    }
  });

  // Combine goal and task context variables
  const allContextVars = new Set([
    ...goalContextVars,
    ...Array.from(taskContextVariables),
  ]);

  // Exclude resource IDs from context variables
  const resources = allByType({ gm, type: 'resource' });
  if (!isResource(resources)) {
    throw new Error('Resources must be an array of resources');
  }
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const variables = Array.from(allContextVars).filter(
    (varName) => !resourceIds.has(varName),
  );

  // If variables are provided directly, use them; otherwise try to read from file
  if (variablesParam) {
    const oldTransitions = clean ? [] : extractOldSystemTransitions(fileName);
    return systemModuleTemplate({
      variables,
      resources,
      defaultVariableValues: variablesParam,
      oldTransitions,
    });
  }

  try {
    const variablesFilePath = getVariablesFilePath(fileName);
    const defaultVariableValues =
      variables.length > 0
        ? JSON.parse(readFileSync(variablesFilePath, 'utf8'))
        : {};
    const oldTransitions = clean ? [] : extractOldSystemTransitions(fileName);
    return systemModuleTemplate({
      variables,
      resources,
      defaultVariableValues,
      oldTransitions,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading variables file:', error);
    throw new Error('Error reading variables file');
  }
};

export const __test_only_exports__ = {
  extractOldSystemTransitions,
};
