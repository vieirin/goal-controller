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

  describe('Evolvable parameters (#442)', () => {
    it('declares every decision variable as evolve int … [0..N] with the discretisation literal', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: true,
        evolvableDecisionVars: true,
        discretisation: 7,
      });
      assert.ok(
        !prism.includes('const int decision_'),
        `expected no "const int decision_" left, got:\n${prism}`,
      );
      const evolveLines = prism
        .split('\n')
        .filter((line) => line.startsWith('evolve int '));
      assert.ok(
        evolveLines.length > 0,
        'expected at least one evolve int line',
      );
      evolveLines.forEach((line) => {
        assert.match(line, /^evolve int \S+ \[0\.\.7\];$/);
      });
      assert.ok(prism.includes('const int N = 7;'));
    });

    it('is unchanged (plain consts) with the switch off', () => {
      const withSwitchOff = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: true,
        evolvableDecisionVars: false,
      });
      const withoutOption = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: true,
      });
      assert.strictEqual(withSwitchOff, withoutOption);
      assert.ok(!withSwitchOff.includes('evolve int'));
    });

    it('is ignored with Decision variables off', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: false,
        evolvableDecisionVars: true,
      });
      assert.ok(!prism.includes('evolve int'));
      assert.ok(!prism.includes('decision_'));
    });
  });

  describe('choice construct: two PRISM lines per child (#446 follow-up)', () => {
    const chooseOnceAndContinue = (prism: string): string[] =>
      prism
        .split('\n')
        .filter(
          (line) =>
            line.startsWith('  [pursue_G') && line.includes('g1_chosen'),
        );

    it('decision variables on, evolvable off', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: true,
        evolvableDecisionVars: false,
      });
      assert.deepStrictEqual(chooseOnceAndContinue(prism), [
        "  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=0 & G1_achievable*N > decision_G1 & g3_state=0 & G2_relative*N > _decision_G2 -> (g1_chosen'=1);",
        '  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=1 & G2_achievable*N > decision_G2 -> true;',
        "  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=0 & G1_achievable*N > decision_G1 & g2_state=0 & G3_relative*N > _decision_G3 & !(G2_relative*N > _decision_G2) -> (g1_chosen'=2);",
        '  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=2 & G3_achievable*N > decision_G3 -> true;',
      ]);
    });

    it('decision variables on, evolvable on', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: true,
        evolvableDecisionVars: true,
      });
      assert.deepStrictEqual(chooseOnceAndContinue(prism), [
        "  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=0 & G1_achievable*N > decision_G1 & g3_state=0 & G2_relative*N > _decision_G2 -> (g1_chosen'=1);",
        '  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=1 & G2_achievable*N > decision_G2 -> true;',
        "  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=0 & G1_achievable*N > decision_G1 & g2_state=0 & G3_relative*N > _decision_G3 & !(G2_relative*N > _decision_G2) -> (g1_chosen'=2);",
        '  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=2 & G3_achievable*N > decision_G3 -> true;',
      ]);
    });

    it('decision variables off', () => {
      const prism = generateValidatedPrismModel({
        gm: nodesOf(MODEL),
        fileName: 'simpleChoice',
        generateDecisionVars: false,
        evolvableDecisionVars: false,
      });
      assert.deepStrictEqual(chooseOnceAndContinue(prism), [
        "  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=0 & g3_state=0 -> (g1_chosen'=1);",
        '  [pursue_G2] !g1_achieved & g1_state=1 & g1_chosen=1 -> true;',
        "  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=0 & g2_state=0 -> (g1_chosen'=2);",
        '  [pursue_G3] !g1_achieved & g1_state=1 & g1_chosen=2 -> true;',
      ]);
    });
  });
});
