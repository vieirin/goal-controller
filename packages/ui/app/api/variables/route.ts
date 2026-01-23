import {
  getTaskAchievabilityVariables,
  treeContextVariables,
} from '@goal-controller/lib';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { GoalModel, VariablesModel } from '../../../lib/models';

/**
 * GET: Retrieve stored variables for a model hash
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelHash = searchParams.get('hash');

    if (!modelHash) {
      return ApiResponse.badRequest('Model hash is required');
    }

    const storedVariables = VariablesModel.findByHash(modelHash);

    return ApiResponse.success({ storedVariables });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

/**
 * POST: Extract variable keys from a model and return stored values if available
 */
export async function POST(request: NextRequest) {
  try {
    const { modelJson } = await request.json();

    if (!modelJson) {
      return ApiResponse.badRequest('Model JSON is required');
    }

    // Generate hash from model content
    const modelHash = VariablesModel.hashContent(modelJson);

    // Parse and validate model
    const parseResult = GoalModel.parse(modelJson);

    if (!parseResult.success) {
      return ApiResponse.error(
        parseResult.error,
        GoalModel.getErrorStatus(parseResult.stage)
      );
    }

    const { tree } = parseResult;

    // Extract variables
    const contextVariables = treeContextVariables(tree);
    const taskVariables = getTaskAchievabilityVariables(tree);
    const allVariables = [...contextVariables, ...taskVariables];

    // Get stored variables for this model
    const storedVariables = VariablesModel.findByHash(modelHash);

    return ApiResponse.success({
      modelHash,
      variables: allVariables,
      contextVariables,
      taskVariables,
      storedVariables,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

/**
 * PUT: Store variables for a model
 */
export async function PUT(request: NextRequest) {
  try {
    const { modelHash, variables } = await request.json();

    if (!modelHash) {
      return ApiResponse.badRequest('Model hash is required');
    }

    if (!variables || typeof variables !== 'object') {
      return ApiResponse.badRequest('Variables object is required');
    }

    // Store variables in the database
    VariablesModel.upsert(modelHash, variables);

    return ApiResponse.success({ message: 'Variables stored successfully' });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
