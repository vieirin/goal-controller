import {
  generateValidatedPrismModel,
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
      fileName,
      variables,
    } = await request.json();

    if (!modelJson) {
      return ApiResponse.badRequest('Model JSON is required');
    }

    if (!engine || !['prism', 'sleec'].includes(engine)) {
      return ApiResponse.badRequest('Valid engine (prism/sleec) is required');
    }

    // Parse and validate model
    const parseResult = GoalModel.parse(modelJson);

    if (!parseResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] Parse error:', parseResult.error);
      }
      return ApiResponse.error(
        parseResult.error,
        GoalModel.getErrorStatus(parseResult.stage),
      );
    }

    const { tree } = parseResult;

    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Model parsed and tree converted successfully');
    }

    // Initialize logger (in-memory mode for API)
    const logger = initLogger(fileName || 'model', false, true);

    // Generate output
    let output: string;
    let report: LoggerReport | null = null;
    try {
      if (engine === 'prism') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Generating PRISM model...');
        }
        output = generateValidatedPrismModel({
          gm: tree,
          fileName: fileName || 'model',
          clean,
          variables,
          generateDecisionVars,
        });
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Generating SLEEC model...');
        }
        output = sleecTemplateEngine(tree);
      }

      // Get logger report
      report = logger.getReport();
      logger.close();

      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Output generated successfully:', {
          outputLength: output.length,
          firstLines: output.split('\n').slice(0, 3).join('\n'),
        });
      }

      return ApiResponse.success({ output, report });
    } catch (generationError) {
      console.error('[API] Generation error:', generationError);
      return ApiResponse.serverError(
        `Generation failed: ${ApiResponse.extractMessage(generationError)}`,
        ApiResponse.extractDetails(generationError),
      );
    }
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return ApiResponse.fromError(error);
  }
}
