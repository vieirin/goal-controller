import {
    convertToTree,
    getTaskAchievabilityVariables,
    treeContextVariables,
    validateModel,
    type Model,
} from '@goal-controller/lib';
import { NextRequest, NextResponse } from 'next/server';
import { VariablesModel } from '../../../lib/models';

/**
 * GET: Retrieve stored variables for a model hash
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelHash = searchParams.get('hash');

    if (!modelHash) {
      return NextResponse.json(
        { error: 'Model hash is required', success: false },
        { status: 400 }
      );
    }

    const storedVariables = VariablesModel.findByHash(modelHash);

    return NextResponse.json({
      success: true,
      storedVariables,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Extract variable keys from a model and return stored values if available
 */
export async function POST(request: NextRequest) {
  try {
    const { modelJson } = await request.json();

    if (!modelJson) {
      return NextResponse.json(
        { error: 'Model JSON is required', success: false },
        { status: 400 }
      );
    }

    // Generate hash from model content
    const modelHash = VariablesModel.hashContent(modelJson);

    // Parse model JSON
    let model: Model;
    try {
      model = JSON.parse(modelJson);
      validateModel({ model });
    } catch (parseError) {
      return NextResponse.json(
        {
          error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          success: false,
        },
        { status: 400 }
      );
    }

    // Convert to tree
    let tree;
    try {
      tree = convertToTree({ model });
    } catch (treeError) {
      return NextResponse.json(
        {
          error: `Tree conversion failed: ${treeError instanceof Error ? treeError.message : 'Unknown error'}`,
          success: false,
        },
        { status: 500 }
      );
    }

    // Extract variables
    const contextVariables = treeContextVariables(tree);
    const taskVariables = getTaskAchievabilityVariables(tree);
    const allVariables = [...contextVariables, ...taskVariables];

    // Get stored variables for this model
    const storedVariables = VariablesModel.findByHash(modelHash);

    return NextResponse.json({
      success: true,
      modelHash,
      variables: allVariables,
      contextVariables,
      taskVariables,
      storedVariables,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT: Store variables for a model
 */
export async function PUT(request: NextRequest) {
  try {
    const { modelHash, variables } = await request.json();

    if (!modelHash) {
      return NextResponse.json(
        { error: 'Model hash is required', success: false },
        { status: 400 }
      );
    }

    if (!variables || typeof variables !== 'object') {
      return NextResponse.json(
        { error: 'Variables object is required', success: false },
        { status: 400 }
      );
    }

    // Store variables in the database
    VariablesModel.upsert(modelHash, variables);

    return NextResponse.json({
      success: true,
      message: 'Variables stored successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
