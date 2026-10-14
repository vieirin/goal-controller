/**
 * GRL's engine mapper: how goal-tree reads a GRL model for the workbench.
 * GRL generates nothing (its analyses evaluate the model, ./evaluation), so
 * the mapper keeps an element's GRL properties as written; a goal may be a
 * leaf (a strategy evaluates it).
 */
import { createEngineMapper } from '@goal-controller/goal-tree';
import { grl } from './definition';

/** the custom properties a GRL element keeps (#105: read, not yet declarable) */
const GRL_ELEMENT_KEYS = [
  'importance',
  'importanceQuantitative',
  'decompositionType',
] as const;

type GrlProps = { text: string };

export const grlEngineMapper = createEngineMapper<GrlProps, GrlProps, never>()({
  dialect: grl,
  allowedGoalKeys: GRL_ELEMENT_KEYS,
  allowedTaskKeys: GRL_ELEMENT_KEYS,
  // a resource is an element the evaluation reads, not one goal-tree maps
  skipResource: true,
  allowedQualityKeys: GRL_ELEMENT_KEYS,
  allowLeafGoals: true,
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
});
