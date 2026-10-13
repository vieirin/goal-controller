/**
 * The definition pool's facts module (goal-controller#82): the protocol an
 * engine declares its files with, and the core that reads them into the
 * pool (README.md). `createPool(poolOf(engine))` is #68's pool of a
 * declared engine; #68's services read its index.
 */
export * from './protocol';
export { json, xml, yaml, goalModel, langium } from './parsers';
export { poolOf } from './engine';
