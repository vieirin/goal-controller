/**
 * kaosres's selection (goal-controller#191 part B): SEAMS'17's safe,
 * consistent and cost-optimal selection (D4), and KAOSTools' optimiser's
 * rules as an option.
 *
 * The model is KAOSTools' own optimiser test (UCLouvain.KAOSTools.
 * Optimizer.Tests/TestCMSelection.cs at 05a5125, MIT): Anchor (RSR .75)
 * refined into Child1 and Child2; O1 (.2) obstructs Child1, O2, an OR of
 * SO1 (.1) and SO2 (.3), obstructs Child2; CM1 resolves O1, CM2 SO1, CM3
 * SO2, each substituting at Anchor. ESR(Anchor) = .8 × .63 = .504; CM1
 * gives .63, CM2 or CM3 .8. KAOSTools expects the minimal cost 1 and the
 * two optimal selections {CM2} and {CM3}.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readKaos } from '../../../src/importers/kaos';
import {
  kaosresAnalyses,
  kaosresAnalysisModel,
  selectCountermeasures,
  type KaosModel,
  type Selection,
  type SelectionOptions,
} from '../../../src/engines/kaosres';
import { runAnalysis } from '../../../src/engines/analysis';

const KAOSTOOLS_TEST = `
declare goal [ anchor ] rsr .75 refinedby child1, child2 end
declare goal [ child1 ] obstructedby o1 end
declare goal [ child2 ] obstructedby o2 end
declare obstacle [ o1 ] probability .2 resolvedby [substitution:anchor] cm1 end
declare obstacle [ so1 ] probability .1 resolvedby [substitution:anchor] cm2 end
declare obstacle [ so2 ] probability .3 resolvedby [substitution:anchor] cm3 end
declare obstacle [ o2 ] refinedby so1 refinedby so2 end
`;

const modelOf = (text: string): KaosModel => {
  const { model, diagnostics } = readKaos(text);
  assert.ok(model, JSON.stringify(diagnostics));
  return parsePistar(model, { metamodel: KAOS_OBSTACLES });
};
const select = (text: string, options?: Partial<SelectionOptions>) =>
  selectCountermeasures(modelOf(text), options);
const goalsOf = (selections: readonly Selection[]) =>
  selections.map((s) => s.goals.join('+') || '∅');
const near = (actual: number, expected: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${what}: ${actual} is not ${expected}`,
  );

describe('kaosres: the selection, on KAOSTools’ optimiser test', () => {
  it('evaluates every selection in cost order, the empty one first; the minimal cost 1, {CM2} and {CM3} chosen (KAOSTools’ expectation)', () => {
    const result = select(KAOSTOOLS_TEST);
    assert.strictEqual(result.costBasis, 'count');
    assert.deepStrictEqual(
      result.highLevel.map((g) => [g.id, g.rsr]),
      [['anchor', 0.75]],
    );
    assert.strictEqual(result.candidates, 8);
    assert.ok(result.exhaustive && result.exact);
    assert.deepStrictEqual(goalsOf(result.selections), [
      '∅',
      'cm1',
      'cm2',
      'cm3',
      'cm1+cm2',
      'cm1+cm3',
      'cm2+cm3',
      'cm1+cm2+cm3',
    ]);
    const esr = result.selections.map((s) => s.esr.get('anchor')!);
    [0.504, 0.63, 0.8, 0.8, 1, 1, 0.8, 1].forEach((e, i) =>
      near(esr[i]!, e, goalsOf(result.selections)[i]!),
    );
    assert.deepStrictEqual(
      result.selections.map((s) => s.safe),
      [false, false, true, true, true, true, true, true],
    );
    assert.strictEqual(result.minimalCost, 1);
    assert.deepStrictEqual(goalsOf(result.chosen), ['cm2', 'cm3']);
  });

  it('cost-optimal: no consistent selection costing no more is more satisfying', () => {
    const result = select(KAOSTOOLS_TEST);
    assert.deepStrictEqual(
      result.selections
        .filter((s) => s.costOptimal)
        .map((s) => s.goals.join('+') || '∅'),
      ['∅', 'cm2', 'cm3', 'cm1+cm2', 'cm1+cm3', 'cm1+cm2+cm3'],
    );
  });

  it('a Conflict between a countermeasure and a goal still in use makes it inconsistent; two countermeasures in conflict, never together', () => {
    // CM2 conflicts with Child1, which stays in use unless CM1 substitutes it
    const withChild = select(
      `${KAOSTOOLS_TEST}declare constraint [ c ] conflict cm2, child1 end`,
    );
    assert.deepStrictEqual(
      withChild.selections
        .filter((s) => !s.consistent)
        .map((s) => s.goals.join('+')),
      ['cm2', 'cm2+cm3'],
    );
    assert.deepStrictEqual(goalsOf(withChild.chosen), ['cm3']);
    // CM1 and CM3 in conflict: never selected together
    const pair = select(
      `${KAOSTOOLS_TEST}declare constraint [ c ] conflict cm1, cm3 end`,
    );
    assert.deepStrictEqual(
      pair.selections
        .filter((s) => !s.consistent)
        .map((s) => s.goals.join('+')),
      ['cm1+cm3', 'cm1+cm2+cm3'],
    );
    assert.deepStrictEqual(
      pair.selections.find((s) => !s.consistent)!.conflicts,
      [['cm1', 'cm3']],
    );
  });

  it('with Costs set, a selection’s cost is their sum (unset: 0), and the cheapest safe one is chosen', () => {
    const result = select(
      `${KAOSTOOLS_TEST}declare goal [ cm2 ] cost [so1] 5 end
declare goal [ cm3 ] cost [so2] 2 end
declare goal [ cm1 ] cost [o1] 1 end`,
    );
    assert.strictEqual(result.costBasis, 'Cost');
    assert.deepStrictEqual(
      result.selections.map((s) => [s.goals.join('+') || '∅', s.cost]),
      [
        ['∅', 0],
        ['cm1', 1],
        ['cm3', 2],
        ['cm1+cm3', 3],
        ['cm2', 5],
        ['cm1+cm2', 6],
        ['cm2+cm3', 7],
        ['cm1+cm2+cm3', 8],
      ],
    );
    assert.strictEqual(result.minimalCost, 2);
    assert.deepStrictEqual(goalsOf(result.chosen), ['cm3']);
  });

  it('none safe: no minimal cost, the most satisfying selection at the lowest cost chosen, unsafe', () => {
    const result = select(KAOSTOOLS_TEST.replace('rsr .75', 'rsr 1'));
    assert.strictEqual(result.minimalCost, null);
    assert.deepStrictEqual(goalsOf(result.chosen), ['cm1+cm2', 'cm1+cm3']);
    assert.ok(result.chosen.every((s) => !s.safe));
  });

  it('bounded: past the limit it evaluates in cost order and says the chosen one isn’t exact when the minimal cost’s level isn’t complete', () => {
    const cut = select(KAOSTOOLS_TEST, { limit: 3 });
    assert.deepStrictEqual(goalsOf(cut.selections), ['∅', 'cm1', 'cm2']);
    assert.ok(!cut.exhaustive && !cut.exact);
    assert.deepStrictEqual(goalsOf(cut.chosen), ['cm2']);
    // with the level complete, it stops there, exact
    const level = select(KAOSTOOLS_TEST, { limit: 4 });
    assert.deepStrictEqual(goalsOf(level.selections), [
      '∅',
      'cm1',
      'cm2',
      'cm3',
    ]);
    assert.ok(!level.exhaustive && level.exact);
    assert.deepStrictEqual(goalsOf(level.chosen), ['cm2', 'cm3']);
  });
});

describe('kaosres: KAOSTools’ rules (semantics kaostools, NaiveCountermeasureSelectionOptimizer at 05a5125)', () => {
  it('on its own test: the same minimal cost and selections', () => {
    const result = select(KAOSTOOLS_TEST, { semantics: 'kaostools' });
    assert.strictEqual(result.minimalCost, 1);
    assert.deepStrictEqual(goalsOf(result.chosen), ['cm2', 'cm3']);
  });

  it('ignores conflicts, and with the empty selection safe (minimal cost 0) takes the most satisfying non-empty ones, every tie', () => {
    const text = `${KAOSTOOLS_TEST.replace('rsr .75', 'rsr .4')}declare constraint [ c ] conflict cm1, cm2 end`;
    const seams = select(text);
    assert.strictEqual(seams.minimalCost, 0);
    assert.deepStrictEqual(goalsOf(seams.chosen), ['∅']);
    const kaostools = select(text, { semantics: 'kaostools' });
    assert.ok(kaostools.selections.every((s) => s.consistent));
    assert.strictEqual(kaostools.minimalCost, 0);
    assert.deepStrictEqual(goalsOf(kaostools.chosen), [
      'cm1+cm2',
      'cm1+cm3',
      'cm1+cm2+cm3',
    ]);
  });
});

describe('kaosres: the flood seed (SEAMS’17’s running example, the thesis’s model2.kaos)', () => {
  const flood = readFileSync(
    join(__dirname, '../../../../../examples/kaos/flood/flood.kaos'),
    'utf8',
  );

  it('selects Camera with Camera Speed Accurate (their conflicts) and SMS or Email: cost 3, ESR 76 %', () => {
    const result = select(flood);
    assert.strictEqual(result.candidates, 16);
    assert.strictEqual(result.minimalCost, 3);
    assert.deepStrictEqual(goalsOf(result.chosen), [
      'speed_acquired_by_camera+acquired_camera_speed_accurate+locals_warned_by_sms',
      'speed_acquired_by_camera+acquired_camera_speed_accurate+locals_warned_by_email',
    ]);
    near(
      result.chosen[0]!.esr.get('locals_warned_when_risk_imminent')!,
      0.76,
      'root',
    );
    // Camera alone breaks cst11 (UltrasoundSpeedAccurate still in use)
    const camera = result.selections.find(
      (s) => s.goals.join('+') === 'speed_acquired_by_camera',
    )!;
    assert.deepStrictEqual(camera.conflicts, [
      ['speed_acquired_by_camera', 'acquired_ultrasound_speed_accurate'],
    ]);
    // Email resolves two obstacles, one countermeasure: no resolution refused
    assert.deepStrictEqual(
      result.selections.find(
        (s) => s.goals.join('+') === 'locals_warned_by_email',
      )!.problems,
      [],
    );
  });

  it('as an analysis: the chosen first, drawn without what it leaves out', () => {
    const view = kaosresAnalysisModel(modelOf(flood));
    const out = runAnalysis(kaosresAnalyses.selection, view);
    assert.ok('result' in out, JSON.stringify(out));
    const [chosen] = out.result.cases;
    assert.strictEqual(
      chosen!.label,
      'Chosen: Achieve [SpeedAcquiredEvery5SecondsByCamera] + Maintain [CameraSpeedAccurate] + Achieve [LocalsWarnedBySMSWhenLevelsCritical]',
    );
    assert.ok(
      chosen!.summary!.startsWith(
        'cost 3; Achieve [LocalsWarnedWhenRiskImminent]: ESR 76.00% (RSR 65.00%); safe, consistent, cost-optimal. 16 of 16 selections',
      ),
    );
    const kept = new Set(chosen!.selection);
    // the countermeasures, what they bring, the obstacles they resolve
    for (const id of [
      'speed_acquired_by_camera',
      'images_acquired',
      'locals_warned_by_sms',
      'noisy_image',
      'ultrasound_broken',
      'speed_acquired_by_camera-resolves-ultrasound_broken',
    ])
      assert.ok(kept.has(id), id);
    // what they substitute, its obstacles, the countermeasures not selected
    for (const id of [
      'speed_acquired_every_5_seconds',
      'speed_not_acquired',
      'locals_warned',
      'locals_warned_by_email',
      'locals_warned_by_email-resolves-voice_down',
    ])
      assert.ok(!kept.has(id), id);
    assert.strictEqual(out.result.cases.length, 16);
  });
});
