/**
 * The Tropos4AS lifecycle (goal-controller#136): AAMAS 2009 §4.3's
 * instantiations as quoted, the paper's trace on the Cleaner Agent seed
 * end to end, and runs derived by hand from the rules (labelled so): the
 * heating goal's hysteresis (§4.3.3), creation, inhibition, sequence and
 * errors.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import {
  achieve,
  maintain,
  perform,
  readCondition,
  runLifecycle,
  stateChanges,
  traceText,
  type Condition,
} from '../../../src/engines/tropos4as/lifecycle';
import { runLifecycleAnalysis } from '../../../src/engines/tropos4as/lifecycle';
import {
  readScenarios,
  readTropos4asModel,
  tropos4asAnalysisModel,
  type Scenario,
} from '../../../src/engines/tropos4as';
import { toy } from './toy';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const EXAMPLES = path.join(__dirname, '../../../../../examples/tropos4as');
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(EXAMPLES, ...parts), 'utf8');

const seed = (name: string) =>
  readTropos4asModel(
    tropos4asAnalysisModel(
      parsePistar(read(name, `${name}.txt`), { fileMetamodel: true }),
    ),
  );
const scenarioOf = (name: string, file: string): Scenario =>
  readScenarios([{ path: file, text: read(name, 'scenarios', file) }])
    .scenarios[0]!;
/** A trace's rows, its `#` lines aside. */
const rows = (text: string) =>
  text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

const condition = (text: string) => readCondition(text) as Condition;
const sets = (inst: ReturnType<typeof perform>) => ({
  E: inst.E.map((p) => `⟨${p.condition.text}, ${p.action}⟩`),
  C: inst.C.map((p) => `⟨${p.condition.text}, ${p.action}⟩`),
});

const steps = (...list: Scenario['steps']): Scenario => ({
  path: 'test.json',
  label: 'test',
  steps: list,
});
const step = (
  beliefs: Scenario['steps'][number]['beliefs'] = {},
  outcomes: Scenario['steps'][number]['outcomes'] = {},
) => ({ label: 'step', beliefs, outcomes });
const lines = (
  model: ReturnType<typeof readTropos4asModel>,
  scenario: Scenario,
) => rows(traceText(model, runLifecycle(model, scenario))).slice(1);

describe('Tropos4AS: AAMAS 2009 §4.3, the instantiations', () => {
  it('P: E = C = {⟨true, Activate⟩, ⟨true, DropFailure⟩, ⟨true, DropSuccess⟩}', () => {
    const P = [
      '⟨true, Activate⟩',
      '⟨true, DropFailure⟩',
      '⟨true, DropSuccess⟩',
    ];
    assert.deepStrictEqual(sets(perform()), { E: P, C: P });
  });

  it('A(s, f): E = H ∪ {⟨¬s ∨ f, Fail⟩}, C = H ∪ {⟨f, Fail⟩, ⟨¬s, Retry⟩}', () => {
    const H = [
      '⟨true, Activate⟩',
      '⟨broken, DropFailure⟩',
      '⟨clean, Succeed⟩',
      '⟨clean, DropSuccess⟩',
      '⟨¬clean, Reactivate⟩',
    ];
    assert.deepStrictEqual(
      sets(achieve(condition('clean'), condition('broken'))),
      {
        E: [...H, '⟨¬clean ∨ broken, Fail⟩'],
        C: [...H, '⟨broken, Fail⟩', '⟨¬clean, Retry⟩'],
      },
    );
    // behaviour b): ⟨¬s, Reactivate⟩ replaced with ⟨¬s, DropFailure⟩
    assert.strictEqual(
      sets(achieve(condition('clean'), undefined, 'drop')).E[4],
      '⟨¬clean, DropFailure⟩',
    );
    // f = false: ¬s ∨ false is ¬s
    assert.strictEqual(
      sets(achieve(condition('clean'))).E[5],
      '⟨¬clean, Fail⟩',
    );
  });

  it('M(m, d): H = {⟨¬m, Activate⟩, ⟨d, DropFailure⟩, ⟨m, Succeed⟩, ⟨m, Suspend⟩, ⟨¬m, Reactivate⟩}', () => {
    const H = [
      '⟨¬warm, Activate⟩',
      '⟨off, DropFailure⟩',
      '⟨warm, Succeed⟩',
      '⟨warm, Suspend⟩',
      '⟨¬warm, Reactivate⟩',
    ];
    assert.deepStrictEqual(
      sets(maintain(condition('warm'), condition('off'))),
      {
        E: [...H, '⟨¬warm ∨ off, Fail⟩'],
        C: [...H, '⟨off, Fail⟩', '⟨¬warm, Retry⟩'],
      },
    );
  });

  it('M(m, t, d): every m changed to t, except ⟨¬m, Activate⟩', () => {
    const { E, C } = sets(
      maintain(condition('t >= 20'), undefined, condition('t >= 22')),
    );
    assert.strictEqual(E[0], '⟨¬(t >= 20), Activate⟩');
    assert.deepStrictEqual(E.slice(2), [
      '⟨t >= 22, Succeed⟩',
      '⟨t >= 22, Suspend⟩',
      '⟨¬(t >= 22), Reactivate⟩',
      '⟨¬(t >= 22), Fail⟩',
    ]);
    assert.strictEqual(C[6], '⟨¬(t >= 22), Retry⟩');
  });
});

describe('Tropos4AS: the lifecycle on the seeds', () => {
  it("reproduces AAMAS 2009 §5 / Fig. 3 exactly: RoomClean's seven states and rules", () => {
    const model = seed('cleaner-agent');
    const run = runLifecycle(model, scenarioOf('cleaner-agent', 'paper.json'));
    assert.deepStrictEqual(
      rows(traceText(model, run, 'RC')),
      rows(read('cleaner-agent', 'reference', 'trace-paper.txt')),
    );
    // the self-loop Fig. 3 doesn't draw, and success(RoomClean) at the end
    assert.ok(
      run.rows.some((r) => r.goal === 'RC' && r.rule === 'OR:subg-achieve'),
    );
    assert.deepStrictEqual(run.steps[1]!.goals.get('RC'), {
      state: 'success',
      rule: 'drop-successE',
    });
    assert.deepStrictEqual(
      stateChanges(run.rows, 'RC').map((r) => r.rule),
      [
        'adopt',
        'activateE',
        'deliberateE',
        'OR:subg-succeed',
        'retryC',
        'cond-succeedE',
        'drop-successE',
      ],
    );
  });

  for (const [name, scenario] of [
    ['cleaner-agent', 'all-fail'],
    ['patient-monitoring', 'a-day'],
  ] as const)
    it(`${name}: ${scenario}, derived by hand from the rules, exactly`, () => {
      const model = seed(name);
      assert.deepStrictEqual(
        rows(
          traceText(
            model,
            runLifecycle(model, scenarioOf(name, `${scenario}.json`)),
          ),
        ),
        rows(read(name, 'reference', `trace-${scenario}.txt`)),
      );
    });

  it('tries the OR alternative whose means contribute most to the qualities first (§3.1)', () => {
    const model = seed('cleaner-agent');
    const run = runLifecycle(model, scenarioOf('cleaner-agent', 'paper.json'));
    // WC's link is first in the file; DC's means (sweep) helps efficiency
    assert.deepStrictEqual(
      run.rows.find((r) => r.rule === 'deliberateE')?.gamma,
      ['DC', 'WC'],
    );
  });

  it("marks a failed goal's failures as occurred", () => {
    const model = seed('patient-monitoring');
    const run = runLifecycle(
      model,
      scenarioOf('patient-monitoring', 'a-day.json'),
    );
    assert.deepStrictEqual([...run.steps[2]!.failures], ['medicineNotTaken']);
    assert.deepStrictEqual([...run.steps[1]!.failures], []);
  });
});

describe('Tropos4AS: runs derived by hand (not from the paper)', () => {
  it('heating, M(m, t, d): activates below 20, heats till 22, not reactivated at 21', () => {
    const model = readTropos4asModel(
      toy(
        [
          [
            'H',
            'goal',
            { type: 'maintain', maintain: 't >= 20', target: 't >= 22' },
          ],
          ['heat', 'task'],
        ],
        [['heat', 'and', 'H']],
      ),
    );
    const heat = { heat: 'success' } as const;
    const trace = lines(
      model,
      steps(
        step({ t: 19 }, heat),
        step({ t: 21 }, heat),
        step({ t: 22 }, heat),
        step({ t: 21 }),
        step({ t: 19 }, heat),
      ),
    );
    const restart = (n: number) => [
      `${n} | heat | outcome | success | {}`,
      `${n} | H | AND:subg-achieve | AU | {}`,
      `${n} | H | cond-failE | AF | {}`,
      `${n} | H | reactivateE | AD | {}`,
      `${n} | H | deliberateE | AU | {heat}`,
    ];
    assert.deepStrictEqual(trace, [
      '1 | H | adopt | Suspended | {}',
      '1 | H | activateE | AD | {}',
      '1 | H | deliberateE | AU | {heat}',
      ...restart(1),
      ...restart(2),
      '3 | heat | outcome | success | {}',
      '3 | H | AND:subg-achieve | AU | {}',
      '3 | H | AND:subg-succeed | AS | {}',
      '3 | H | suspendE | Suspended | {}',
      // step 4, 21 °C: m holds, nothing fires
      '5 | H | activateE | AD | {}',
      '5 | H | deliberateE | AU | {heat}',
      ...restart(5),
    ]);
  });

  it('adopts a root goal when its creation condition becomes true, once', () => {
    const model = readTropos4asModel(
      toy(
        [
          ['G', 'goal', { creation: 'morning', achievement: 'done' }],
          ['T', 'task'],
        ],
        [['T', 'and', 'G']],
      ),
    );
    const trace = lines(
      model,
      steps(
        step({ morning: false }),
        step({ morning: true }),
        step({}, { T: 'success' }),
      ),
    );
    assert.deepStrictEqual(trace.slice(0, 1), [
      '2 | G | adopt | Suspended | {}',
    ]);
    assert.strictEqual(trace.filter((l) => l.includes('adopt')).length, 1);
  });

  it('orders Γ by sequence links, and skips a goal while an active goal inhibits it', () => {
    const model = readTropos4asModel(
      toy(
        [
          ['P', 'goal', { type: 'perform' }],
          ['A', 'goal', { type: 'perform' }],
          ['B', 'goal', { type: 'perform' }],
          ['I', 'goal', { creation: 'alarm', achievement: 'quiet' }],
          ['TI', 'task'],
        ],
        [
          ['A', 'and', 'P'],
          ['B', 'and', 'P'],
          ['B', 'sequence', 'A'],
          ['TI', 'and', 'I'],
          ['I', 'inhibits', 'A'],
        ],
      ),
    );
    // I is adopted at step 1 with P; A is next after B, but I is active
    const trace = lines(
      model,
      steps(
        step({ alarm: true }, { B: 'success', A: 'success' }),
        step({ quiet: true }, { TI: 'success', A: 'success' }),
      ),
    );
    assert.ok(
      trace.includes('1 | P | deliberateE | AU | {B, A}'),
      'B before A',
    );
    assert.ok(trace.includes('1 | P | AND:subg-achieve | AU | {A}'));
    assert.ok(
      !trace.some((l) => l.startsWith('1 | A |')),
      'A waits while I is active',
    );
    const dropped = trace.indexOf('2 | I | drop-successE | success | {}');
    assert.ok(dropped >= 0);
    assert.strictEqual(
      trace.indexOf('2 | A | outcome | success | {}'),
      dropped + 1,
    );
  });

  it('adopts an error when its condition holds, its recovery tasks as its means', () => {
    const model = readTropos4asModel(
      toy(
        [
          ['E', 'error', { condition: 'leak' }],
          ['fix', 'task'],
        ],
        [['fix', 'or', 'E']],
      ),
    );
    assert.deepStrictEqual(
      lines(
        model,
        steps(step({ leak: false }), step({ leak: true }, { fix: 'success' })),
      ),
      [
        '2 | E | adopt | Suspended | {}',
        '2 | E | activateE | AD | {}',
        '2 | E | deliberateE | AU | {fix}',
        '2 | fix | outcome | success | {}',
        '2 | E | OR:subg-succeed | AS | {}',
        '2 | E | drop-successE | success | {}',
      ],
    );
  });

  it('behaviour b) drops an achieve-goal whose subgoals are done and s is false', () => {
    const model = readTropos4asModel(
      toy(
        [
          ['G', 'goal', { achievement: 'done', onFailure: 'drop' }],
          ['T', 'task'],
        ],
        [['T', 'and', 'G']],
      ),
    );
    assert.deepStrictEqual(
      lines(model, steps(step({}, { T: 'success' }))).slice(-3),
      [
        '1 | G | AND:subg-achieve | AU | {}',
        '1 | G | cond-failE | AF | {}',
        '1 | G | drop-failureE | failed | {}',
      ],
    );
  });
});

describe('Tropos4AS: the lifecycle analysis', () => {
  it("gives a case per scenario step, each goal's state and rule on its element", () => {
    const files = Object.fromEntries(
      ['paper.json'].map((f) => [
        `scenarios/${f}`,
        read('cleaner-agent', 'scenarios', f),
      ]),
    );
    const model = tropos4asAnalysisModel(
      parsePistar(read('cleaner-agent', 'cleaner-agent.txt'), {
        fileMetamodel: true,
      }),
    );
    const { cases } = runLifecycleAnalysis(model, files);
    assert.deepStrictEqual(
      cases.map((c) => c.id),
      ['scenarios/paper.json#1', 'scenarios/paper.json#2'],
    );
    assert.deepStrictEqual(cases[0]!.values.RC, {
      value: 'AU',
      label: 'active-undefined [retryC]',
    });
    assert.strictEqual(
      cases[0]!.label,
      'AAMAS 2009 §5, step 1: DryCleaning succeeds',
    );
    assert.deepStrictEqual(cases[1]!.values.RC, {
      value: 'success',
      label: 'dropped: success [drop-successE]',
    });
    assert.deepStrictEqual(cases[1]!.values.MBL, {
      value: 'Suspended',
      label: 'suspended [adopt]',
    });
  });

  it('runs no scenario as one empty step, and refuses a model with an error', () => {
    const ok = toy([['G', 'goal', { type: 'perform' }]]);
    assert.strictEqual(runLifecycleAnalysis(ok).cases.length, 1);
    assert.throws(
      () => runLifecycleAnalysis(toy([['G', 'goal', { type: 'maintain' }]])),
      /G is a maintain-goal without its maintain condition/,
    );
  });
});

describe('Tropos4AS: scenarios', () => {
  it('reads steps, and says what is wrong where', () => {
    const { scenarios, diagnostics } = readScenarios([
      {
        path: 'b.json',
        text: JSON.stringify({
          label: 'B',
          steps: [{ beliefs: { x: [1] }, outcomes: { G: 'maybe' } }],
        }),
      },
      {
        path: 'a.json',
        text: '{"steps": [{"label": "one", "beliefs": {"x": true}, "outcomes": {"G": "success"}}]}',
      },
      { path: 'c.json', text: '{"steps": 3}' },
    ]);
    assert.deepStrictEqual(
      scenarios.map((s) => [s.path, s.label, s.steps.length]),
      [
        ['a.json', 'a.json', 1],
        ['b.json', 'B', 1],
      ],
    );
    assert.deepStrictEqual(scenarios[0]!.steps[0], {
      label: 'one',
      beliefs: { x: true },
      outcomes: { G: 'success' },
    });
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'Step 1: belief x is a bool, a number or a word',
        "Step 1: G's outcome is success or failure",
        'A scenario has a `steps` list',
      ],
    );
  });
});
