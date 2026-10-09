// The parser API, usable from CommonJS (bundled with Langium in out/cjs). The
// catalog is also `@goal-controller/goal-language/catalog`, without the parser.
export * from './catalog.js';
export * from './parse.js';
export { GoalLexer, type LexerStart } from './lexer.js';
export { createGoalCoreServices, parseWith, START_RULE } from './module.js';
