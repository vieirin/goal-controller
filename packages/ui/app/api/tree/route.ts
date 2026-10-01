import { parsePistar } from '@istar-ts/core';
import { goalView, type RTGrammar } from '@goal-controller/goal-tree';
import { NextRequest } from 'next/server';
import { ApiResponse, readJson } from '../../../lib/api';
import { isTransformEngine, type TransformEngine } from '../../../lib/types';

/** The RT grammar each engine reads goal texts with (its mapper's `grammar`). */
const GRAMMAR: Record<TransformEngine, RTGrammar> = {
  edgev2: 'edgeV2',
  edge: 'edge',
  sleec: 'edge',
};

/**
 * POST { modelJson, engine } → the goal model as the workbench shows it (goal-tree's
 * `goalView`): structure, RT ids, names, notations and their constructs, read with the
 * engine's grammar. Lenient: any model that parses gets a view, problems included.
 */
export async function POST(request: NextRequest) {
  const body = await readJson<{ modelJson?: unknown; engine?: unknown }>(
    request,
  );
  if (!body) return ApiResponse.badRequest('The request body must be JSON');
  const { modelJson, engine } = body;
  if (typeof modelJson !== 'string' || !modelJson) {
    return ApiResponse.badRequest('modelJson is required');
  }
  if (typeof engine !== 'string' || !isTransformEngine(engine)) {
    return ApiResponse.badRequest('engine must be one of: edge, edgev2, sleec');
  }
  let model;
  try {
    model = parsePistar(modelJson);
  } catch (error) {
    return ApiResponse.badRequest(
      error instanceof Error ? error.message : String(error),
    );
  }
  return ApiResponse.success({ view: goalView(model, GRAMMAR[engine]) });
}
