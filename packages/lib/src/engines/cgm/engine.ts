import { defineEngine } from '../engine';
import { cgmCheckRegistry } from './checks';
import { cgm } from './definition';
import { cgmProjectResourceParsers } from './index';
import { cgmEngineMapper } from './mapper';

/**
 * Contextual goal models, as the workbench registers them
 * (goal-controller#153): the dialect, its checks and resources, its models
 * declaring its dialect's kinds (contexts, statements, facts).
 */
export const cgmEngine = defineEngine({
  id: 'cgm',
  help: 'Contextual goal models (REJ 2010, IST 2013): contexts at the variation points of a Tropos model, with context analysis',
  dialect: cgm,
  checks: cgmCheckRegistry,
  mapper: cgmEngineMapper,
  output: { label: 'Variants', extension: 'txt', language: 'text' },
  projectResources: cgmProjectResourceParsers,
  // its models declare its dialect's kinds (contexts, statements, facts)
  fileKinds: true,
});
