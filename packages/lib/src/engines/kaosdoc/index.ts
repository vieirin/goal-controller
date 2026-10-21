/**
 * kaosdoc (goal-controller#171): a requirements document from a KAOS model.
 *
 * - mapper.ts: how goal-tree reads a KAOS model for it (its IR)
 * - template.ts: the document, Markdown tables
 * - engine.ts: its registration
 */
export {
  kaosdocEngineMapper,
  kaosdocGoalModel,
  readKaosModel,
  KAOSDOC_GOAL_KEYS,
  KAOSDOC_DOMAIN_PROPERTY_KEYS,
  KAOSDOC_LINK_KEYS,
  type KaosdocGoalModel,
  type KaosdocNode,
  type KaosdocNodeProps,
  type KaosdocRefinementProperties,
} from './mapper';
export { kaosdocDocument, kaosdocOutput } from './template';
export { kaosdocEngine } from './engine';
