import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import { edgeEngineMapper } from '../../../../src/engines/edgeV2';
import { initLogger } from '../../../../src/engines/edgeV2/logger/logger';
import { orderedChildIds } from '../../../../src/engines/edgeV2/template/modules/goalModule/template/children';
import { decisionVariablesTemplate } from '../../../../src/engines/edgeV2/template/decisionVariables';

// G1: Goal [G2?G2] (notation repeats G2); real children are G2 and G3
const MODEL = '../../examples/edgeV2/duplicateChoiceChild.txt';

const nodesOf = (file: string) =>
  GoalTree.fromModel(Model.load(file), edgeEngineMapper).nodes;

describe('edgeV2 orderedChildren with a duplicate id in notation', () => {
  before(() => {
    initLogger('children-duplicate-test', false, true);
  });

  it('drops the repeated id, keeping the other child once (appended)', () => {
    const gm = nodesOf(MODEL);
    const g1 = gm.find((node) => node.id === 'G1');
    assert.ok(g1 && g1.type === 'goal');
    assert.deepStrictEqual(orderedChildIds(g1), ['G2', 'G3']);
  });

  it('declares each child-selection decision variable once', () => {
    const gm = nodesOf(MODEL);
    const prism = decisionVariablesTemplate({ gm });
    const decisionG2Lines = prism
      .split('\n')
      .filter((line) => line.includes('_decision_G2'));
    assert.strictEqual(
      decisionG2Lines.length,
      1,
      `expected one _decision_G2 declaration, got:\n${prism}`,
    );
  });
});
