/**
 * The definition pool's facts module (goal-controller#82): the protocol an
 * engine declares its files with, and the core that reads them into the
 * pool (README.md). `createPool(poolOf(declarePool({ … })))` is #68's pool
 * of an engine's declared pool; #68's services read its index.
 */
export * from './protocol';
export { json, xml, yaml, goalModel, langium } from './parsers';
export { poolOf } from './engine';
export { annotationsFor, type TypedAnnotations } from './typed';
