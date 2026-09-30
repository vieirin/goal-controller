import { NextRequest } from 'next/server';
import { ApiResponse } from '../../../lib/api';
import { KNOWN_PROPERTIES } from '../../../lib/models/knownProperties';
import { isTransformEngine } from '../../../lib/types';

/**
 * GET ?engine=edgev2 → the custom properties the engine reads, per node kind.
 * Independent of any model, so the Inspector can offer them even without an analysis
 * (the piStar view of a model).
 */
export function GET(request: NextRequest) {
  const engine = request.nextUrl.searchParams.get('engine');
  if (!engine || !isTransformEngine(engine)) {
    return ApiResponse.badRequest('engine must be one of: edge, edgev2, sleec');
  }
  return ApiResponse.success({ knownProperties: KNOWN_PROPERTIES[engine] });
}
