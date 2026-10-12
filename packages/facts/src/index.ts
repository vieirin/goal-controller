/**
 * A spike (goal-controller#61, option 5 of #60): a project's files as facts,
 * Datalog rules deriving name resolution, types (#58) and cross-file checks
 * (#59), and the services that query them. See
 * packages/dialect/docs/relational-core.md.
 */
export { Database, Program, Relation } from './datalog/evaluate';
export {
  DatalogSyntaxError,
  parseRules,
  type Tuple,
  type Value,
} from './datalog/syntax';
export {
  definePool,
  FactPool,
  PoolDefinitionError,
  type Hover,
  type PoolSetup,
  type PoolStats,
  type RenameResult,
} from './core/pool';
export { CORE_RULES, OPEN_RELATIONS } from './core/rules';
export * from './core/types';
export {
  hddlProvider,
  hddlProviderWith,
  type HddlOptions,
} from './providers/hddl';
export { modelProvider, type ModelOptions } from './providers/model';
export { mutroseProvider } from './providers/mutrose';
export { variablesProvider } from './providers/variables';
export { worldProvider } from './providers/world';
export { edgePool, godaPool, mutrosePool, poolFor } from './engines';
