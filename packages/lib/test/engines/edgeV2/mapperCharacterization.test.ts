import { describe } from 'mocha';
import { GoalTree } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../../src/engines/edgeV2';
import { characterizeEdgeMapper } from '../edgeFamily/mapperCharacterization';

describe('edgeV2EngineMapper characterization (#187)', () => {
  characterizeEdgeMapper('edgeV2', (model) =>
    GoalTree.fromModel(model, edgeEngineMapper),
  );
});
