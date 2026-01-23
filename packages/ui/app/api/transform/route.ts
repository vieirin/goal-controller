import {
  convertToTree,
  generateValidatedPrismModel,
  initLogger,
  sleecTemplateEngine,
  validateModel,
  type LoggerReport,
  type Model,
} from '@goal-controller/lib';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { modelJson, engine, clean = false, fileName, variables } = await request.json();

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Transform request received:', {
        engine,
        clean,
        fileName,
        hasModelJson: !!modelJson,
        modelJsonLength: modelJson?.length || 0,
      });
    }

    if (!modelJson) {
      console.error('[API] Error: Model JSON is required');
      return NextResponse.json(
        { error: 'Model JSON is required', success: false },
        { status: 400 }
      );
    }

    if (!engine || !['prism', 'sleec'].includes(engine)) {
      console.error('[API] Error: Invalid engine:', engine);
      return NextResponse.json(
        { error: 'Valid engine (prism/sleec) is required', success: false },
        { status: 400 }
      );
    }

    // Parse model JSON
    let model: Model;
    try {
      model = JSON.parse(modelJson);
      validateModel({ model });
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Model parsed successfully:', {
          actors: model.actors?.length || 0,
          hasNodes: !!model.actors?.[0]?.nodes,
        });
      }
    } catch (parseError) {
      console.error('[API] JSON parse error:', parseError);
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
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Tree converted successfully');
      }
    } catch (treeError) {
      console.error('[API] Tree conversion error:', treeError);
      return NextResponse.json(
        {
          error: `Tree conversion failed: ${treeError instanceof Error ? treeError.message : 'Unknown error'}`,
          success: false,
        },
        { status: 500 }
      );
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

      return NextResponse.json({
        output,
        report,
        success: true,
      });
    } catch (generationError) {
      console.error('[API] Generation error:', generationError);
      console.error('[API] Error stack:', generationError instanceof Error ? generationError.stack : 'No stack');
      return NextResponse.json(
        {
          error: `Generation failed: ${generationError instanceof Error ? generationError.message : 'Unknown error'}`,
          success: false,
          details: process.env.NODE_ENV === 'development' && generationError instanceof Error
            ? generationError.stack
            : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.stack
          : undefined,
      },
      { status: 500 }
    );
  }
}
