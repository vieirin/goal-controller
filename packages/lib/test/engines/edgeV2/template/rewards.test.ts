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
      const prism = generateValidatedPrismModel({
        gm: nodes,
        fileName: 'simpleChoiceRewards',
        taskLayout,
      });
      assert.match(
        prism,
        /endmodule\n\nrewards "cost"\n[\s\S]*endrewards\n\nrewards "utility"\n[\s\S]*endrewards\n$/,
      );
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

  it('writes no line when the mapper left cost empty (dialect rejected it)', () => {
    // #236: the template no longer parses; a bad value never reaches it
    const nodes = nodesOf(WITH_REWARDS);
    const t1 = GoalTree.allByType(nodes, 'task').find(
      (task) => task.id === 'T1',
    );
    assert.ok(t1);
    t1.properties.engine.cost = '';
    assert.doesNotMatch(rewardsTemplate({ gm: nodes }), /pursue_T1/);
  });
});

/**
 * #236 characterization: what the rewards template makes of a utility or cost
 * as the model writes it, through the mapper (which hands it the text as
 * written when the dialect reads a number, '' otherwise): the line it writes,
 * none, or what it throws.
 */
describe('edgeV2 rewards: the texts it accepts (#236 characterization)', () => {
  before(() => {
    initLogger('rewards-test', false, true);
  });

  /** the line T1's cost, or G1's utility, written as `text`, gives: none, or what it throws */
  const rewardOf = (key: 'cost' | 'utility', text: string): string => {
    const id = key === 'cost' ? 'T1' : 'G1';
    const original = Model.load(WITH_REWARDS);
    const element = [...original.elements.values()].find((e) =>
      e.name.startsWith(`${id}:`),
    );
    if (!element) throw new Error(`${id} not found in the model`);
    const elements = new Map(original.elements);
    elements.set(element.id, {
      ...element,
      customProperties: { ...element.customProperties, [key]: text },
    });
    const nodes = GoalTree.fromModel(
      { ...original, elements },
      edgeEngineMapper,
    ).nodes;
    const transition = key === 'cost' ? `[pursue_${id}]` : `[achieved_${id}]`;
    try {
      const line = rewardsTemplate({ gm: nodes })
        .split('\n')
        .find((l) => l.includes(transition));
      return line?.trim() ?? 'none';
    } catch (error) {
      return `throws ${(error as Error).message}`;
    }
  };

  for (const key of ['cost', 'utility'] as const) {
    const id = key === 'cost' ? 'T1' : 'G1';
    const at = key === 'cost' ? `[pursue_${id}] true` : `[achieved_${id}] true`;

    it(`${key}: writes a non-negative decimal as written, trimmed`, () => {
      assert.strictEqual(rewardOf(key, '3'), `${at} : 3;`);
      assert.strictEqual(rewardOf(key, ' 3 '), `${at} : 3;`);
      assert.strictEqual(rewardOf(key, '1.5'), `${at} : 1.5;`);
      assert.strictEqual(rewardOf(key, '007'), `${at} : 007;`);
    });

    it(`${key}: writes no line for unset, blank or zero`, () => {
      for (const text of ['', ' ', '0', '0.0', '00'])
        assert.strictEqual(rewardOf(key, text), 'none', JSON.stringify(text));
    });

    it(`${key}: writes no line for a text the dialect reads as no number (the mapper gives '')`, () => {
      for (const text of [
        '3.',
        '.5',
        '+3',
        '1e2',
        'Infinity',
        'NaN',
        '0x10',
        '1,5',
        'high',
      ])
        assert.strictEqual(rewardOf(key, text), 'none', JSON.stringify(text));
    });

    it(`${key}: writes no line for a negative number (dialect min: 0, #236)`, () => {
      // #236: changed (was a throw from the template's regex): below min the
      // mapper gives '', and -0 is a zero reward
      for (const text of ['-2', '-0'])
        assert.strictEqual(rewardOf(key, text), 'none', JSON.stringify(text));
    });
  }
});
