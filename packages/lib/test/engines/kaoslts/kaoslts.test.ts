/**
 * kaoslts (goal-controller#209): the mine pump's operation model as FSP for
 * LTSA, by KAOS2LTSA's five steps (ASE'08 §4): its fluents, its alphabet,
 * each agent's processes and the system, byte for byte as committed in
 * ./fixtures; and what it says it doesn't translate.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import {
  actionName,
  kaosltsOutput,
  ltsModel,
  processName,
} from '../../../src/engines/kaoslts';
import { engineOutputProblems } from '../../../src/engines/output';
import { edited, goalModelOf, minePumpText, operationsOf } from './support';

const FIXTURES = 'test/engines/kaoslts/fixtures';
const outputOf = (kaos: string) =>
  kaosltsOutput(goalModelOf(kaos), { modelName: 'mine-pump.txt' });

describe('kaoslts: KAOS operations as FSP for LTSA (KAOS2LTSA)', () => {
  it('writes the system, one file per agent and the completeness report', () => {
    const output = outputOf(minePumpText());
    assert.deepStrictEqual(engineOutputProblems(output), []);
    assert.deepStrictEqual(
      output.files.map((f) => [f.id, f.fileName, f.primary ?? false]),
      [
        ['system', 'mine-pump.lts', true],
        ['agent-pump_controller', 'PumpController.lts', false],
        ['agent-environment', 'Environment.lts', false],
        ['completeness', 'mine-pump.completeness.md', false],
      ],
    );
    for (const file of output.files)
      assert.strictEqual(
        file.text,
        readFileSync(`${FIXTURES}/${file.fileName}`, 'utf8'),
        file.fileName,
      );
  });

  it('traces each line of the system to the elements it comes from', () => {
    const [system] = outputOf(minePumpText()).files;
    const lines = system!.text.split('\n');
    const ownersOf = (start: string) =>
      system!.owners![lines.findIndex((l) => l.startsWith(start))];
    assert.deepStrictEqual(ownersOf('fluent PumpOn'), ['pump']);
    assert.deepStrictEqual(ownersOf('constraint ReqTrig_startPump'), [
      'start_pump',
      'pump_on_when_high_water_and_no_methane',
    ]);
    assert.deepStrictEqual(ownersOf('minimal ||PumpController'), [
      'pump_controller',
    ]);
  });

  it('steps 1-2: Boolean attributes are fluents, defined by the DomPosts', () => {
    const lts = ltsModel(operationsOf(minePumpText()));
    assert.deepStrictEqual(
      lts.fluents.map((f) => [
        f.name,
        f.initiating,
        f.terminating,
        f.initially,
      ]),
      [
        ['HighWater', ['aboveHigh'], ['belowHigh'], false],
        ['LowWater', ['belowLow'], ['aboveLow'], true],
        ['Methane', ['methaneAppears'], ['methaneLeaves'], false],
        ['PumpOn', ['startPump'], ['stopPump'], false],
      ],
    );
    assert.deepStrictEqual(lts.alphabet, [
      'tick',
      'startPump',
      'stopPump',
      'aboveHigh',
      'belowHigh',
      'aboveLow',
      'belowLow',
      'methaneAppears',
      'methaneLeaves',
    ]);
    assert.deepStrictEqual(lts.notes, []);
  });

  it('steps 3-5: each agent composes its operations’ constraints and its objects’ tick processes', () => {
    const lts = ltsModel(operationsOf(minePumpText()));
    const [controller, environment] = lts.agents;
    assert.deepStrictEqual(
      controller!.constraints.map((c) => [c.name, c.condition]),
      [
        ['DomPre_startPump', '!PumpOn'],
        [
          'ReqTrig_startPump_For_PumpOnWhenHighWaterAndNoMethane',
          'HighWater && !Methane',
        ],
        ['ReqPre_startPump_For_PumpOffWhenMethane', '!Methane'],
        ['ReqPre_startPump_For_PumpOffWhenLowWater', '!LowWater'],
        ['DomPre_stopPump', 'PumpOn'],
        [
          'ReqPre_stopPump_For_PumpOnWhenHighWaterAndNoMethane',
          '!(HighWater && !Methane)',
        ],
        ['ReqTrig_stopPump_For_PumpOffWhenMethane', 'Methane'],
        ['ReqTrig_stopPump_For_PumpOffWhenLowWater', 'LowWater'],
      ],
    );
    assert.deepStrictEqual(
      controller!.processes.map((p) => [p.name, p.events]),
      [['OnePerTick_PumpOn', ['startPump', 'stopPump']]],
    );
    assert.deepStrictEqual(
      environment!.processes.map((p) => [p.name, p.events]),
      [
        ['OnePerTick_HighWater', ['aboveHigh', 'belowHigh']],
        ['OnePerTick_LowWater', ['aboveLow', 'belowLow']],
        ['OnePerTick_Methane', ['methaneAppears', 'methaneLeaves']],
      ],
    );
    assert.strictEqual(environment!.constraints.length, 6);
    assert.deepStrictEqual(lts.shared, { constraints: [], processes: [] });
  });

  it('encodes each requirement with ticks (ASE’08 §2.2.3’s Tr)', () => {
    const lts = ltsModel(operationsOf(minePumpText()));
    assert.deepStrictEqual(
      lts.asserts.map((a) => a.lines.join('\n')),
      [
        'assert PumpOnWhenHighWaterAndNoMethane = [](tick -> ((HighWater && !Methane) -> X(!tick W (tick && PumpOn))))',
        'assert PumpOffWhenMethane = [](tick -> (Methane -> X(!tick W (tick && !PumpOn))))',
        'assert PumpOffWhenLowWater = [](tick -> (LowWater -> X(!tick W (tick && !PumpOn))))',
      ],
    );
  });

  it('says what it leaves out: a non-Boolean attribute, a temporal condition, an operation no agent performs', () => {
    const lts = ltsModel(
      operationsOf(
        edited(
          minePumpText(),
          [
            '  attribute pumpOn : bool\n',
            '  attribute pumpOn : bool\n  attribute level : int\n',
          ],
          [
            'reqtrig [pump_off_when_methane] mine.methane',
            'reqtrig [pump_off_when_methane] next mine.methane',
          ],
          [
            '  dompost not mine.methane\n  performedby environment\n',
            '  dompost not mine.methane\n',
          ],
        ),
      ),
    );
    assert.deepStrictEqual(lts.notes, [
      "pump.level : int is no Boolean attribute: bounding it as a parameterised fluent is the analyst's step 1, left out",
      'ReqTrig_stopPump_For_PumpOffWhenMethane: not translated, it has a next, not a fluent',
      "methaneLeaves: no agent performs it, its constraints are the system's",
    ]);
    assert.deepStrictEqual(
      lts.shared.constraints.map((c) => c.name),
      ['DomPre_methaneLeaves'],
    );
    // the methane fluent's tick process has two performers' events: the system's
    assert.deepStrictEqual(
      lts.shared.processes.map((p) => p.name),
      ['OnePerTick_Methane'],
    );
  });

  it('step 3: one OnePerTick process per fluent, not per object (rv392’s #392 review)', () => {
    // a Robot with two independent Boolean attributes: the paper (ASE'08 §4
    // step 3) allows raiseArm and raiseLeg in the same tick interval; a
    // single per-object process would forbid it (the models archive's
    // grouping, reference-defects.md's ASE'08 entry)
    const robot = `
declare agent [ robot ]
  name "Robot"
end

declare entity [ robot_body ]
  name "Robot"
  attribute armUp : bool
  attribute legUp : bool
end

declare operation [ raise_arm ]
  name "raiseArm"
  dompost robot_body.armUp
  performedby robot
  output robot_body
end

declare operation [ raise_leg ]
  name "raiseLeg"
  dompost robot_body.legUp
  performedby robot
  output robot_body
end
`;
    const lts = ltsModel(operationsOf(robot));
    assert.deepStrictEqual(
      lts.agents.map((a) => [
        a.name,
        a.processes.map((p) => [p.name, p.events]),
      ]),
      [
        [
          'Robot',
          [
            ['OnePerTick_ArmUp', ['raiseArm']],
            ['OnePerTick_LegUp', ['raiseLeg']],
          ],
        ],
      ],
    );
  });

  it('names: FSP processes are capitalised words, actions lower camel case', () => {
    assert.strictEqual(processName('Pump controller'), 'PumpController');
    assert.strictEqual(processName('2nd sensor'), 'P2ndSensor');
    assert.strictEqual(actionName('startPump'), 'startPump');
    assert.strictEqual(actionName('Switch pump on'), 'switchPumpOn');
  });
});
