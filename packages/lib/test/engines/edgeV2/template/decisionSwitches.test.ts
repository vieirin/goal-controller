import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import { edgeEngineMapper } from '../../../../src/engines/edgeV2';
import { initLogger } from '../../../../src/engines/edgeV2/logger/logger';
import { generateValidatedPrismModel } from '../../../../src/engines/edgeV2/template';

// G1 [G2?G3]; G2 → T1; G3 → T2 (OR choice goal with 2 children)
const MODEL = '../../examples/edgeV2/simpleChoice.txt';

const nodesOf = (file: string) =>
  GoalTree.fromModel(Model.load(file), edgeEngineMapper).nodes;

describe('edgeV2 decision variable switches (#441, #442)', () => {
  before(() => {
    initLogger('decisionSwitches-test', false, true);
  });

  describe('Decision variables off (#441)', () => {
    it('drops every decision_ term from guards, declarations and child selection', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: false,
      });
      assert.ok(
        !prism.includes('decision_'),
        `expected no "decision_" in the model, got:\n${prism}`,
      );
      assert.ok(prism.includes('const int N = 10;'));
    });

    it('leaves no dangling & in any guard', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: false,
      });
      assert.ok(!/&\s*->/.test(prism), 'found a guard ending in a dangling &');
      assert.ok(
        !/&\s*&/.test(prism),
        'found two guard terms joined by && or an empty term',
      );
      assert.ok(
        !prism.includes('!()'),
        "found an interleaved skip guard's negation with nothing to negate",
      );
    });
  });
});
