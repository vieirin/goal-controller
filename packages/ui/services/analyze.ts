import { GoalTree } from '@goal-controller/goal-tree';
import { GoalModel } from './goalModel';
import { KNOWN_PROPERTIES } from '../lib/models/knownProperties';
import { isPrismEngine, type TransformEngine } from '../lib/types';
import { mutroseProblem, type MutroseGoalTree } from '@goal-controller/lib';
import { nodeIdInMessage } from '../lib/workbench/localProblems';
import type {
  AnalyzeResponse,
  Problem,
  VariableInfo,
} from '../lib/workbench/types';

type WithCondition = {
  id: string;
  properties: {
    engine?: {
      execCondition?: {
        assertion?: { variables?: Array<{ name: string }> };
        maintain?: { variables?: Array<{ name: string }> };
      };
    };
  };
};

/**
 * { modelJson, engine } → engine-specific variables (with the nodes that use them),
 * problems, and the custom properties the engine reads. A parse failure is reported as
 * a problem, not thrown.
 */
export const analyze = (
  modelJson: string,
  engine: TransformEngine,
): AnalyzeResponse => {
  const parsed =
    engine === 'edgev2'
      ? GoalModel.parseForEdgeV2(modelJson)
      : engine === 'sleec'
        ? GoalModel.parseForSleec(modelJson)
        : engine === 'mutrose'
          ? GoalModel.parseForMutrose(modelJson)
          : GoalModel.parseForEdge(modelJson);

  const response: AnalyzeResponse = {
    success: true,
    variables: [],
    problems: [],
    knownProperties: KNOWN_PROPERTIES[engine],
  };

  if (!parsed.success) {
    const problem: Problem = {
      severity: 'error',
      source:
        parsed.stage === 'parse'
          ? 'json'
          : parsed.stage === 'validate'
            ? 'model'
            : 'engine',
      message: parsed.error,
      nodeId: nodeIdInMessage(parsed.error),
    };
    response.problems.push(problem);
    return response;
  }

  if (engine === 'mutrose') {
    // what the decomposer checks across goals (variables' scope, query types)
    const problem = mutroseProblem(parsed.tree as MutroseGoalTree);
    if (problem)
      response.problems.push({
        severity: 'error',
        source: 'engine',
        message: problem,
        nodeId: nodeIdInMessage(problem),
      });
  } else if (isPrismEngine(engine)) {
    const tree = parsed.tree as Parameters<typeof GoalTree.contextVariables>[0];
    const nodes = [
      ...GoalTree.allByType(tree, 'goal'),
      ...GoalTree.allByType(tree, 'task'),
    ] as unknown as WithCondition[];
    const usedBy = (variable: string): string[] =>
      nodes
        .filter((node) => {
          const condition = node.properties.engine?.execCondition;
          return [
            ...(condition?.assertion?.variables ?? []),
            ...(condition?.maintain?.variables ?? []),
          ].some((v) => v.name === variable);
        })
        .map((node) => node.id);

    const variables: VariableInfo[] = [
      ...GoalTree.contextVariables(tree).map((name) => ({
        name,
        kind: 'context' as const,
        usedBy: usedBy(name),
      })),
      ...GoalTree.taskAchievabilityVariables(tree).map((name) => ({
        name,
        kind: 'achievability' as const,
        usedBy: [name.replace(/_achievable$/, '')],
      })),
    ];
    response.variables = variables;
  }

  return response;
};
