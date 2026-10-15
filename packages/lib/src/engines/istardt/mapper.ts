/**
 * iStar-DT's engine mapper: how goal-tree reads an iStar-DT model for the
 * workbench (its tree, the inspector's unread keys). The writer reads the
 * model as a graph (`readIstardtModel`), so the mapper keeps the
 * properties as written.
 */
import { propertyKeys } from '@goal-controller/dialect';
import { createEngineMapper } from '@goal-controller/goal-tree';
import { istardt } from './definition';

type IstardtProps = { text: string };

export const istardtEngineMapper = createEngineMapper<
  IstardtProps,
  IstardtProps,
  never
>()({
  dialect: istardt,
  allowedGoalKeys: propertyKeys(istardt, 'goal'),
  allowedTaskKeys: propertyKeys(istardt, 'task'),
  skipResource: true,
  allowedQualityKeys: propertyKeys(istardt, 'quality'),
  mapGoalProps: ({ text }) => ({ text }),
  mapTaskProps: ({ text }) => ({ text }),
});
