import { GoalTree, type GoalTreeType } from '@goal-controller/goal-tree';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { GoalModel } from '../../../lib/models';

/**
 * POST: Extract variable keys from a model
 * Variables are ephemeral (session-only), no storage
 */
export async function POST(request: NextRequest) {
  try {
    const { modelJson, engine = 'prism' } = await request.json();

    if (!modelJson) {
      return ApiResponse.badRequest('Model JSON is required');
    }

    const parseResult =
      engine === 'edgeV2'
        ? GoalModel.parseForEdgeV2(modelJson)
        : engine === 'sleec'
          ? GoalModel.parseForSleec(modelJson)
          : GoalModel.parseForEdge(modelJson);

    if (!parseResult.success) {
      return ApiResponse.error(
        parseResult.error,
        GoalModel.getErrorStatus(parseResult.stage),
      );
    }

    const { tree: rawTree } = parseResult;
    const tree = rawTree as GoalTreeType;

    // Extract variables
    const contextVariables = GoalTree.contextVariables(tree);
    const taskVariables = GoalTree.taskAchievabilityVariables(tree);
    const allVariables = [...contextVariables, ...taskVariables];

    return ApiResponse.success({
      variables: allVariables,
      contextVariables,
      taskVariables,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
