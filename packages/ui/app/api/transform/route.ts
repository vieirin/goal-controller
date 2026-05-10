import {
  generateValidatedEdgeV2PrismModel,
  generateValidatedPrismModel,
  initEdgeV2Logger,
  initLogger,
  sleecTemplateEngine,
  type LoggerReport,
} from '@goal-controller/lib';
import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { GoalModel } from '../../../lib/models';

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

    if (!engine || !['prism', 'sleec', 'edgeV2'].includes(engine)) {
      return ApiResponse.badRequest(
        'Valid engine (prism/sleec/edgeV2) is required',
      );
    }

    // Logger is engine-specific: Edge V2 template calls getLogger() from the edgeV2 module.
    const logger =
      engine === 'edgeV2'
        ? initEdgeV2Logger(fileName || 'model', false, true)
        : initLogger(fileName || 'model', false, true);

    // Generate output
    let output: string;
    let report: LoggerReport | null = null;
    try {
      if (engine === 'prism') {
        // Parse and validate model with Edge mapper for PRISM
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
          console.log('[API] Generating PRISM model...');
        }
        output = generateValidatedPrismModel({
          gm: parseResult.tree,
          fileName: fileName || 'model',
          clean,
          variables,
          generateDecisionVars,
          achievabilitySpace,
        });
      } else if (engine === 'edgeV2') {
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
          console.log('[API] Generating Edge V2 PRISM model...');
        }
        output = generateValidatedEdgeV2PrismModel({
          gm: parseResult.tree,
          fileName: fileName || 'model',
          clean,
          variables,
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
