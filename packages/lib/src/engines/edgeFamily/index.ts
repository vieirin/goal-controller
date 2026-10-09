/**
 * What the Edge engines (edge, edgeV2) share: their definitions'
 * common pieces, their properties, and the checks those properties name.
 */
export {
  CONSTRUCTS,
  DEFAULT_ELEMENT_FILL,
  RETRY,
  edgeElements,
  edgeFamily,
  edgeNotation,
} from './definition';
export { edgeProperties, edgePropertyLineOrder } from './properties';
export * from './checks';
