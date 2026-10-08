/**
 * EdgeLangium Engine
 * EdgeV2's semantics and PRISM templates, with the RT notation read by the
 * Langium grammar of @goal-controller/rt-language (the grammar the notation
 * editor's language server uses) instead of edgeV2's ANTLR grammar. The trees
 * are edgeV2's, so generation is `generateEdgeV2PrismModel`.
 */
import { createEdgeV2Mapper } from '../edgeV2/mapper';

export const edgeLangiumEngineMapper = createEdgeV2Mapper('edgeLangium');
