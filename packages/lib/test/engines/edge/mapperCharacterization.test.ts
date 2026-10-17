import { describe } from 'mocha';
import { GoalTree } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../../src/engines/edge';
import { characterizeEdgeMapper } from '../edgeFamily/mapperCharacterization';

describe('edgeEngineMapper characterization (#187)', () => {
  characterizeEdgeMapper('edge', (model) =>
    GoalTree.fromModel(model, edgeEngineMapper),
  );
});
