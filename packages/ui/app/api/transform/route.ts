import {
  generateValidatedPrismModel,
  generateEdgeV2PrismModel,
  initLogger,
  initEdgeV2Logger,
  sleecTemplateEngine,
  type LoggerReport,
} from '@goal-controller/lib';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { GoalModel } from '../../../lib/models';
import {
  isTransformEngine,
  type TransformEngine,
} from '../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const {
      modelJson,
      engine,
      clean = false,
      generateDecisionVars = true,
      achievabilitySpace = 4,
      generateFluents = true,
      fileName,
      variables,
    } = await request.json();

    if (!modelJson) {
      return ApiResponse.badRequest('Model JSON is required');
    }

    if (!engine || !isTransformEngine(engine)) {
      return ApiResponse.badRequest(
        'Valid engine (edge/edgev2/sleec) is required',
      );
    }

    const selectedEngine = engine as TransformEngine;

    const logger =
      selectedEngine === 'edgev2'
        ? initEdgeV2Logger(fileName || 'model', false, true)
        : initLogger(fileName || 'model', false, true);

    // Generate output
    let output: string;
    let report: LoggerReport | null = null;
    try {
      if (selectedEngine === 'edge') {
        const parseResult = GoalModel.parseForEdge(modelJson);

        if (!parseResult.success) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[API] Parse error:', parseResult.error);
          }
          return ApiResponse.error(
            parseResult.error,
            GoalModel.getErrorStatus(parseResult.stage),
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Model parsed and tree converted successfully');
          console.log('[API] Generating Edge model...');
        }
        output = generateValidatedPrismModel({
          gm: parseResult.tree,
          fileName: fileName || 'model',
          clean,
          variables,
          generateDecisionVars,
          achievabilitySpace,
        });
      } else if (selectedEngine === 'edgev2') {
        const parseResult = GoalModel.parseForEdgeV2(modelJson);

        if (!parseResult.success) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[API] Parse error:', parseResult.error);
          }
          return ApiResponse.error(
            parseResult.error,
            GoalModel.getErrorStatus(parseResult.stage),
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Model parsed and tree converted successfully');
          console.log('[API] Generating EdgeV2 model...');
        }
        output = generateEdgeV2PrismModel({
          gm: parseResult.tree,
          fileName: fileName || 'model',
          clean,
          variables,
          generateDecisionVars,
          achievabilitySpace,
        });
      } else {
        // Parse and validate model with SLEEC mapper
        const parseResult = GoalModel.parseForSleec(modelJson);

        if (!parseResult.success) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[API] Parse error:', parseResult.error);
          }
          return ApiResponse.error(
            parseResult.error,
            GoalModel.getErrorStatus(parseResult.stage),
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Model parsed and tree converted successfully');
          console.log('[API] Generating SLEEC model...');
        }
        output = sleecTemplateEngine(parseResult.tree, { generateFluents });
      }

      // Get logger report
      report = logger.getReport();
      logger.close();

      return ApiResponse.success({ output, report });
    } catch (generationError) {
      console.error('[API] Generation error:', generationError);
      // Use 422 Unprocessable Entity for lib errors (processing errors, not server crashes)
      return ApiResponse.error(
        `Generation failed: ${ApiResponse.extractMessage(generationError)}`,
        422,
        ApiResponse.extractDetails(generationError),
      );
    }
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return ApiResponse.fromError(error);
  }
}
