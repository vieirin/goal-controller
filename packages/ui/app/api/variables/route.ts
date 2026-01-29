import { GoalTree } from '@goal-controller/goal-tree';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { GoalModel } from '../../../lib/models';

/**
 * POST: Extract variable keys from a model
 * Variables are ephemeral (session-only), no storage
 */
export async function POST(request: NextRequest) {
  try {
    const { modelJson } = await request.json();

    if (!modelJson) {
      return ApiResponse.badRequest('Model JSON is required');
    }

    // Parse and validate model
    const parseResult = GoalModel.parse(modelJson);

    if (!parseResult.success) {
      return ApiResponse.error(
        parseResult.error,
        GoalModel.getErrorStatus(parseResult.stage),
      );
    }

    const { tree } = parseResult;

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
