import { validate, formatValidationReport } from '../validator';
import { GoalTree, Node } from '@goal-controller/goal-tree';
import { DEFAULT_DISCRETISATION, DEFAULT_TASK_LAYOUT, type TaskLayout } from './common';
import { decisionVariablesTemplate } from './decisionVariables';
import type { EdgeGoalNode, EdgeGoalTree, EdgeTask } from '../types';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules, goalNumberId } from './modules/goalModule/goalModules';
import { goalModule } from './modules/goalModule/template';
import { orderedChildren } from './modules/goalModule/template/children';
import { systemModule } from './modules/system/system';
import { taskModule } from './modules/taskModule/taskModule';

/**
 * Goal and task modules children-first (each goal after its children, root
 * last), as in the EDGE reference. PRISM orders its BDD variables by module
 * declaration; keeping a goal next to the tasks it reads lets the symbolic
 * engine build models that it cannot build with all tasks at the end.
 */
const treeOrderModules = (
  gm: EdgeGoalTree,
  variables: Record<string, boolean | number>,
): string => {
  const emitted = new Set<string>();
  const modules: string[] = [];
  const visit = (node: EdgeGoalNode | EdgeTask): void => {
    if (emitted.has(node.id)) {
      return;
    }
    emitted.add(node.id);
    if (Node.isTask(node)) {
      Node.children(node)
        .filter((child): child is EdgeTask => Node.isTask(child))
        .forEach(visit);
      modules.push(taskModule(node, variables));
      return;
    }
    orderedChildren(node).forEach(visit);
    modules.push(goalModule(node));
  };
  const goals = GoalTree.allByType(gm, 'goal');
  const byNumericId = (a: { id: string }, b: { id: string }): number =>
    Number(goalNumberId(a.id)) - Number(goalNumberId(b.id));
  // root first; anything not reachable from it keeps a deterministic order afterwards
  goals.filter((goal) => goal.properties.root).forEach(visit);
  [...goals, ...GoalTree.allByType(gm, 'task')].sort(byNumericId).forEach(visit);
  return modules.join('\n\n');
};

const edgeDTMCTemplate = ({
  gm,
  fileName,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  discretisation = DEFAULT_DISCRETISATION,
  taskLayout = DEFAULT_TASK_LAYOUT,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  /** @deprecated Ignored by edgeV2 (kept for call-site compatibility); use discretisation */
  achievabilitySpace?: number;
  /** N in X_achievable*N > decision_X (default 10) */
  discretisation?: number;
  /** 'taskModules' (one module per task, reference layout) or 'changeManager' (all tasks in one module) */
  taskLayout?: TaskLayout;
}): string => {
  const decisions = decisionVariablesTemplate({ gm, enabled: generateDecisionVars, discretisation });
  const system = systemModule({ gm, fileName, clean, variables });

  if (taskLayout === 'changeManager') {
    const dtmcModel = `dtmc

${decisions}

${goalModules({ gm })}

${changeManagerModule({ gm, variables })}

${system}
`;
    return dtmcModel;
  }

  return `dtmc

${decisions}

${treeOrderModules(gm, variables)}

${system}
`;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
  variables = {},
  generateDecisionVars = true,
  discretisation = DEFAULT_DISCRETISATION,
  taskLayout = DEFAULT_TASK_LAYOUT,
}: {
  gm: EdgeGoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
  /** @deprecated Ignored by edgeV2 (kept for call-site compatibility); use discretisation */
  achievabilitySpace?: number;
  /** N in X_achievable*N > decision_X (default 10) */
  discretisation?: number;
  /** 'taskModules' (one module per task, reference layout) or 'changeManager' (all tasks in one module) */
  taskLayout?: TaskLayout;
}): string => {
  if (taskLayout !== 'taskModules' && taskLayout !== 'changeManager') {
    throw new Error(
      `[INVALID OPTION]: taskLayout must be 'taskModules' or 'changeManager', got ${String(taskLayout)}`,
    );
  }
  const prismModel = edgeDTMCTemplate({
    gm,
    fileName,
    clean,
    variables,
    generateDecisionVars,
    discretisation,
    taskLayout,
  });

  const report = validate(gm, prismModel, fileName);
  if (report.summary.totalMissing > 0) {
    throw new Error(
      `PRISM model is not valid\n${formatValidationReport(report)}`,
    );
  }
  return prismModel;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_only_exports__ = {
  edgeDTMCTemplate,
};
