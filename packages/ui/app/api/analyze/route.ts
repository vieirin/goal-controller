import { GoalTree } from '@goal-controller/goal-tree';
import {
  EDGE_GOAL_KEYS,
  EDGE_RESOURCE_KEYS,
  EDGE_TASK_KEYS,
  EDGE_V2_GOAL_KEYS,
  EDGE_V2_RESOURCE_KEYS,
  EDGE_V2_TASK_KEYS,
  SLEEC_GOAL_KEYS,
  SLEEC_TASK_KEYS,
} from '@goal-controller/lib';
import { NextRequest } from 'next/server';
import { ApiResponse, readJson } from '../../../lib/api';
import { GoalModel } from '../../../lib/models';
import { isTransformEngine, type TransformEngine } from '../../../lib/types';
import type {
  AnalyzeResponse,
  Problem,
  VariableInfo,
} from '../../../lib/workbench/types';

const KNOWN_PROPERTIES: Record<TransformEngine, AnalyzeResponse['knownProperties']> = {
  edge: {
    goal: [...EDGE_GOAL_KEYS],
    task: [...EDGE_TASK_KEYS],
    resource: [...EDGE_RESOURCE_KEYS],
  },
  edgev2: {
    goal: [...EDGE_V2_GOAL_KEYS],
    task: [...EDGE_V2_TASK_KEYS],
    resource: [...EDGE_V2_RESOURCE_KEYS],
  },
  sleec: { goal: [...SLEEC_GOAL_KEYS], task: [...SLEEC_TASK_KEYS], resource: [] },
};

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

const firstNodeId = (message: string): string | undefined =>
  /\b([GT]\d+[A-Za-z0-9]*)\b/.exec(message)?.[1];

/**
 * POST { modelJson, engine } → engine-specific variables (with the nodes that
 * use them), problems, and the custom properties the engine reads.
 * The goal tree itself is built client-side from the piStar JSON.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ modelJson?: unknown; engine?: unknown }>(request);
    if (!body) {
      return ApiResponse.badRequest('The request body must be JSON');
    }
    const { modelJson, engine } = body;
    if (typeof modelJson !== 'string' || !modelJson) {
      return ApiResponse.badRequest('modelJson is required');
    }
    if (typeof engine !== 'string' || !isTransformEngine(engine)) {
      return ApiResponse.badRequest('engine must be one of: edge, edgev2, sleec');
    }

    const parsed =
      engine === 'edgev2'
        ? GoalModel.parseForEdgeV2(modelJson)
        : engine === 'sleec'
          ? GoalModel.parseForSleec(modelJson)
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
        source: parsed.stage === 'parse' ? 'json' : parsed.stage === 'validate' ? 'model' : 'engine',
        message: parsed.error,
        nodeId: firstNodeId(parsed.error),
      };
      response.problems.push(problem);
      return ApiResponse.success(response);
    }

    if (engine !== 'sleec') {
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

    return ApiResponse.success(response);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
