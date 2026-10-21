/**
 * CAIRIS's model files (`<cairis_model>`, cairis-platform/cairis, Apache
 * 2.0) into goal-controller (goal-controller#192): one KAOS model per
 * environment (./read.ts), kaosprop's quantities typed, CAIRIS's values
 * checked against its own vocabularies (the `cairis` profile). One way: no
 * CAIRIS writer (D4 of #192).
 */
export {
  CAIRIS_PUBLIC_ID,
  CAIRIS_REF_TYPES,
  CAIRIS_ROOT,
  isCairisModel,
  readCairisDocument,
  type CairisDocument,
} from './document';
export {
  CAIRIS_ENGINE,
  CAIRIS_ENVIRONMENT_KEY,
  CAIRIS_UNSUPPORTED_KEY,
  cairisEnvironmentOf,
  environmentSlug,
  importCairis,
  readCairis,
  type CairisDiagramProperties,
  type CairisEnvironmentModel,
  type CairisReadOptions,
} from './read';
export { cairisObstacleProbabilities } from './propagation';
