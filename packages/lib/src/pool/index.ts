/**
 * The definition pool's facts module (goal-controller#82): the protocol an
 * engine declares its files with, and the core that reads them into the
 * pool (README.md).
 */
export * from './protocol';
export { json, xml, yaml, goalModel, langium } from './parsers';
