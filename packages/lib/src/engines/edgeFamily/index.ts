/**
 * What the Edge engines (edge, edgeV2, edgeLangium) share: their definitions'
 * common pieces, their properties, the assertion language their conditions are
 * written in, and the checks those properties name.
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
export { assertionLanguage } from './assertion';
export * from './checks';
