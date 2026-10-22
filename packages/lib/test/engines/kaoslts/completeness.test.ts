/**
 * The completeness of an operationalisation (goal-controller#209, FSE'02
 * Def. 3, condition 1): the mine pump's (ASE'08 Fig. 3) is complete, and a
 * mutation of it is not: a dropped ReqTrig, a weakened obligation (a
 * stronger trigger condition), ASE'08 §5.1's dropped ReqPre. What the check
 * can't decide is said, never a Problem.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parseLtl } from '@goal-controller/goal-language';
import {
  immediateAchieve,
  INCOMPLETE,
  operationalisationCompleteness,
  operationalisationProblems,
  stateFormula,
  type CompletenessVerdict,
} from '../../../src/engines/kaoslts';
import { edited, minePumpText, operationsOf } from './support';

const HIGH_WATER = 'pump_on_when_high_water_and_no_methane';
const METHANE = 'pump_off_when_methane';
const LOW_WATER = 'pump_off_when_low_water';

const verdictsOf = (kaos: string) =>
  new Map(
    operationalisationCompleteness(operationsOf(kaos)).map((v) => [
      v.requirement,
      v,
    ]),
  );
const statusOf = (verdict: CompletenessVerdict | undefined) => verdict?.status;
const problemsOf = (verdict: CompletenessVerdict | undefined) =>
  verdict?.status === 'incomplete' ? verdict.problems : [];

describe('kaoslts: the completeness of an operationalisation (FSE’02 Def. 3)', () => {
  it('the mine pump’s operationalisation (ASE’08 Fig. 3) is complete for each requirement', () => {
    const verdicts = operationalisationCompleteness(
      operationsOf(minePumpText()),
    );
    assert.deepStrictEqual(
      verdicts.map((v) => [v.requirement, v.status]),
      [
        [HIGH_WATER, 'complete'],
        [METHANE, 'complete'],
        [LOW_WATER, 'complete'],
      ],
    );
    assert.deepStrictEqual(
      operationalisationProblems(operationsOf(minePumpText())),
      [],
    );
  });

  it('a dropped ReqTrig: nothing obliges stopPump when methane appears', () => {
    const verdicts = verdictsOf(
      edited(minePumpText(), [
        '  reqtrig [pump_off_when_methane] mine.methane\n',
        '',
      ]),
    );
    assert.strictEqual(statusOf(verdicts.get(METHANE)), 'incomplete');
    const [problem, ...rest] = problemsOf(verdicts.get(METHANE));
    assert.deepStrictEqual(rest, []);
    assert.strictEqual(problem!.code, INCOMPLETE);
    assert.strictEqual(problem!.severity, 'error');
    assert.strictEqual(problem!.elementId, METHANE);
    assert.match(
      problem!.message,
      /No operation establishing .* has a ReqTrig/,
    );
    // the others are as they were
    assert.strictEqual(statusOf(verdicts.get(HIGH_WATER)), 'complete');
    assert.strictEqual(statusOf(verdicts.get(LOW_WATER)), 'complete');
  });

  it('a weakened obligation (its trigger condition strengthened): methane alone no longer stops the pump', () => {
    const verdict = verdictsOf(
      edited(minePumpText(), [
        'reqtrig [pump_off_when_methane] mine.methane\n',
        'reqtrig [pump_off_when_methane] mine.methane and sump.highWater\n',
      ]),
    ).get(METHANE);
    assert.strictEqual(statusOf(verdict), 'incomplete');
    const [problem] = problemsOf(verdict);
    assert.strictEqual(problem!.elementId, METHANE);
    // the counterexample: methane, the pump on, the water not high
    assert.match(problem!.message, /don't cover/);
    assert.match(problem!.message, /¬sump\.highWater/);
  });

  it('ASE’08 §5.1’s dropped ReqPre: stopPump may stop the pump on high water and no methane', () => {
    const text = edited(minePumpText(), [
      '  reqpre [pump_on_when_high_water_and_no_methane] not (sump.highWater and not mine.methane)\n',
      '',
    ]);
    const verdict = verdictsOf(text).get(HIGH_WATER);
    assert.strictEqual(statusOf(verdict), 'incomplete');
    const [problem, ...rest] = problemsOf(verdict);
    assert.deepStrictEqual(rest, []);
    // on stopPump's operationalisation of the requirement, its ReqPre
    const link = operationsOf(text).operationalisations.find(
      (l) => l.operation === 'stop_pump' && l.requirement === HIGH_WATER,
    )!;
    assert.strictEqual(problem!.elementId, link.id);
    assert.strictEqual(problem!.key, 'ReqPre');
    assert.match(problem!.message, /^stopPump may make pump\.pumpOn false/);
  });

  it('a ReqPre too weak to exclude C is incomplete too', () => {
    const verdict = verdictsOf(
      edited(minePumpText(), [
        'reqpre [pump_off_when_methane] not mine.methane\n',
        'reqpre [pump_off_when_methane] not mine.methane or sump.highWater\n',
      ]),
    ).get(METHANE);
    assert.strictEqual(statusOf(verdict), 'incomplete');
    assert.match(problemsOf(verdict)[0]!.message, /^startPump may make/);
  });

  it('FSE’02’s own form (∀, comparisons with values) is decided where the entailments hold', () => {
    const kaos = `
declare goal [ g ]
  name "Maintain [PumpSwitchOnWhenHighWaterDetected]"
  formalspec forall c: PumpController . when c.highWaterFlag == "On" then next c.pumpSwitch == "On"
end
declare operation [ on ]
  name "SwitchPumpOn"
  dompre c.pumpSwitch != "On"
  dompost c.pumpSwitch == "On"
  operationalizes g
  reqtrig [g] c.highWaterFlag == "On"
end
declare operation [ off ]
  name "SwitchPumpOff"
  dompre c.pumpSwitch != "Off"
  dompost c.pumpSwitch == "Off"
  operationalizes g
  reqpre [g] c.highWaterFlag != "On"
end
`;
    assert.strictEqual(statusOf(verdictsOf(kaos).get('g')), 'complete');
    // without the ReqPre, SwitchPumpOff falsifies the target only if On and
    // Off exclude each other, which the solver doesn't know: undecided
    const dropped = verdictsOf(
      edited(kaos, ['  reqpre [g] c.highWaterFlag != "On"\n', '']),
    ).get('g');
    assert.strictEqual(statusOf(dropped), 'undecided');
  });

  it('says what it doesn’t decide: another pattern, no definition, a temporal condition', () => {
    const verdicts = verdictsOf(
      edited(
        minePumpText(),
        [
          'formalspec when mine.methane then next not pump.pumpOn',
          'formalspec when mine.methane then sooner-or-later not pump.pumpOn',
        ],
        ['  formalspec when sump.lowWater then next not pump.pumpOn\n', ''],
        [
          'reqtrig [pump_on_when_high_water_and_no_methane] sump.highWater and not mine.methane',
          'reqtrig [pump_on_when_high_water_and_no_methane] next sump.highWater',
        ],
      ),
    );
    const reason = (id: string) => {
      const v = verdicts.get(id);
      return v?.status === 'undecided' ? v.reason : `${v?.status}`;
    };
    assert.match(reason(METHANE), /not of the form C ⇒ ○T/);
    assert.match(reason(LOW_WATER), /no formal definition/);
    assert.match(reason(HIGH_WATER), /ReqTrig is no state formula/);
    assert.deepStrictEqual(
      operationalisationProblems(operationsOf(minePumpText())),
      [],
    );
  });

  it('reads C ⇒ ○T under □, a ∀ and a strong implication, and nothing else', () => {
    const pattern = (text: string) => {
      const found = immediateAchieve(parseLtl(text).value!);
      return found && [found.current.kind, found.target.kind];
    };
    assert.deepStrictEqual(pattern('□ (a.b ⇒ ○ c.d)'), [
      'attributeAccess',
      'attributeAccess',
    ]);
    assert.deepStrictEqual(pattern('when a.b and c.d then next not e.f'), [
      'and',
      'not',
    ]);
    assert.deepStrictEqual(pattern('forall x: X . when x.a then next x.b'), [
      'attributeAccess',
      'attributeAccess',
    ]);
    assert.strictEqual(pattern('when a.b then sooner-or-later c.d'), null);
    assert.strictEqual(pattern('a.b and ○ c.d'), null);
  });

  it('a state formula: booleans are atoms, other comparisons opaque, temporal operators refused', () => {
    const read = (text: string) => stateFormula(parseLtl(text).value!);
    assert.deepStrictEqual(read('s.on == false').tree, {
      kind: 'assign',
      variable: 's',
      member: 'on',
      value: false,
    });
    assert.deepStrictEqual(read('s.mode != "On"').tree, {
      kind: 'not',
      expr: {
        kind: 'compare',
        variable: 's.mode',
        operator: '==',
        value: 'On',
      },
    });
    assert.match(read('next s.on').reason!, /next/);
  });
});
