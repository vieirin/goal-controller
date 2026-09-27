import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import { edgeEngineMapper } from '../../../../src/engines/edgeV2';
import { initLogger } from '../../../../src/engines/edgeV2/logger/logger';
import { generateValidatedPrismModel } from '../../../../src/engines/edgeV2/template';
import { rewardsTemplate } from '../../../../src/engines/edgeV2/template/modules/rewards';

// simpleChoice with T1 cost 3 / utility 3, T2 cost 1.5, G1 utility 5, G2 cost 0
const WITH_REWARDS = '../../examples/edgeV2/simpleChoiceRewards.txt';
const WITHOUT_REWARDS = '../../examples/edgeV2/simpleChoice.txt';

// return type inferred: keeps the edgeV2 engine types of the nodes
const nodesOf = (file: string) =>
  GoalTree.fromModel(Model.load(file), edgeEngineMapper).nodes;

describe('edgeV2 rewards', () => {
  before(() => {
    initLogger('rewards-test', false, true);
  });

  it('emits cost on pursue and utility on achieved, skipping zero values', () => {
    assert.strictEqual(
      rewardsTemplate({ gm: nodesOf(WITH_REWARDS) }),
      [
        'rewards "cost"',
        '  [pursue_T1] true : 3;',
        '  [pursue_T2] true : 1.5;',
        'endrewards',
        '',
        'rewards "utility"',
        '  [achieved_T1] true : 3;',
        '  [achieved_G1] true : 5;',
        'endrewards',
      ].join('\n'),
    );
  });

  it('appends the reward structures to the model in both task layouts', () => {
    const nodes = nodesOf(WITH_REWARDS);
    for (const taskLayout of ['taskModules', 'changeManager'] as const) {
      const prism = generateValidatedPrismModel({ gm: nodes, fileName: 'simpleChoiceRewards', taskLayout });
      assert.match(prism, /endmodule\n\nrewards "cost"\n[\s\S]*endrewards\n\nrewards "utility"\n[\s\S]*endrewards\n$/);
    }
  });

  it('emits nothing when the model has no cost or utility', () => {
    const nodes = nodesOf(WITHOUT_REWARDS);
    assert.strictEqual(rewardsTemplate({ gm: nodes }), '');
    assert.doesNotMatch(
      generateValidatedPrismModel({ gm: nodes, fileName: 'simpleChoice' }),
      /rewards/,
    );
  });

  it('rejects values that are not non-negative numbers', () => {
    const nodes = nodesOf(WITH_REWARDS);
    const t1 = GoalTree.allByType(nodes, 'task').find((task) => task.id === 'T1');
    assert.ok(t1);
    t1.properties.engine.cost = 'high';
    assert.throws(
      () => rewardsTemplate({ gm: nodes }),
      /T1 has cost "high"; it must be a non-negative number/,
    );
    t1.properties.engine.cost = '-2';
    assert.throws(() => rewardsTemplate({ gm: nodes }), /T1 has cost "-2"/);
  });
});
