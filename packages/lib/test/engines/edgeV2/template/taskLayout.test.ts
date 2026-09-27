import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import { edgeEngineMapper } from '../../../../src/engines/edgeV2';
import { initLogger } from '../../../../src/engines/edgeV2/logger/logger';
import { generateValidatedPrismModel } from '../../../../src/engines/edgeV2/template';
import type { TaskLayout } from '../../../../src/engines/edgeV2/template/common';

// G1 [G2?G3]; G2 → T1; G3 → T2
const MODEL = '../../examples/edgeV2/simpleChoice.txt';

const generate = (taskLayout: TaskLayout): string => {
  const tree = GoalTree.fromModel(Model.load(MODEL), edgeEngineMapper);
  return generateValidatedPrismModel({ gm: tree.nodes, fileName: 'simpleChoice', taskLayout });
};

const moduleNames = (prism: string): string[] =>
  Array.from(prism.matchAll(/^module (\w+)/gm), (match) => match[1] ?? '');

/** Commands and formulas, independent of where they are declared */
const behaviour = (prism: string): string[] =>
  prism
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[') || line.startsWith('formula ') || line.startsWith('const '))
    .sort();

describe('edgeV2 task layout', () => {
  before(() => {
    initLogger('taskLayout-test', false, true);
  });

  it('defaults to one module per task, children first and root last (EDGE reference)', () => {
    assert.deepStrictEqual(moduleNames(generate('taskModules')), [
      'T1',
      'G2',
      'T2',
      'G3',
      'G1',
      'System',
    ]);
    const tree = GoalTree.fromModel(Model.load(MODEL), edgeEngineMapper);
    assert.strictEqual(
      generateValidatedPrismModel({ gm: tree.nodes, fileName: 'simpleChoice' }),
      generate('taskModules'),
    );
  });

  it('keeps all tasks in one ChangeManager module when asked', () => {
    assert.deepStrictEqual(moduleNames(generate('changeManager')), [
      'G1',
      'G2',
      'G3',
      'ChangeManager',
      'System',
    ]);
  });

  it('emits the same commands, formulas and constants in both layouts', () => {
    assert.deepStrictEqual(behaviour(generate('taskModules')), behaviour(generate('changeManager')));
  });

  it('declares each task module with its achievability and achieved formula', () => {
    const prism = generate('taskModules');
    assert.match(
      prism,
      /const double T1_achievable = [\d.]+;\nformula t1_achieved = \(t1_achieved_=1\);\nmodule T1\n {2}t1_state: \[0\.\.1\] init 0;\n {2}t1_achieved_: \[0\.\.1\] init 0;/,
    );
  });

  it('rejects an unknown layout', () => {
    const tree = GoalTree.fromModel(Model.load(MODEL), edgeEngineMapper);
    assert.throws(
      () =>
        generateValidatedPrismModel({
          gm: tree.nodes,
          fileName: 'simpleChoice',
          // @ts-expect-error — invalid on purpose
          taskLayout: 'perGoal',
        }),
      /taskLayout must be 'taskModules' or 'changeManager'/,
    );
  });
});
