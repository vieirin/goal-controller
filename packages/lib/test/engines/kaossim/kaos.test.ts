/**
 * kaossim's `.kaos` (goal-controller#193, D1): a goal's quality variables,
 * objective functions and estimates, a refinement's option and equations,
 * an assignment's option and estimates, read into kaossim's keys (the file
 * opens in its mode), simulated through the engine's view, and written back.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readKaos, writeKaos } from '../../../src/importers/kaos';
import {
  kaossimAnalyses,
  kaossimAnalysisModel,
  quantitativeModel,
} from '../../../src/engines/kaossim';
import { runAnalysis } from '../../../src/engines/analysis';

const TEXT = `
@title "Response time"

declare goal [ intervention ]
  name "Achieve [AmbulanceIntervention]"
  qualityvariable [ResponseTime] Time
  samplespace [ResponseTime] "set of reported incidents"
  qualityvariable [Dropped] Boolean
  objective ["14MinRespRate"] "ResponseTime <= 14 * 60"
  modal ["14MinRespRate"] Max
  target ["14MinRespRate"] 95%
  current ["14MinRespRate"] 80%
  refinedby [milestone, ResponseTime = "CallTaking + Travel", Dropped = "Lost | Broken"] encoded, travel
end

declare goal [ encoded ]
  qualityvariable [CallTaking] Time
  assignedto [sysref = "1.1", CallTaking = "exponential[60]"] call_taker
  assignedto [sysref = "1.2", CallTaking = "exponential[40]"] computer
end

declare goal [ travel ]
  qualityvariable [Travel] Time
  distribution [Travel] normal[600, 60]
  qualityvariable [Lost] Boolean
  distribution [Lost] 1%
  qualityvariable [Broken] Boolean
  distribution [Broken] 2%
end

declare agent [ call_taker ] end
declare agent [ computer ] type software end
`;

describe('kaossim: .kaos (#193 D1)', () => {
  const read = readKaos(TEXT, { modelName: 'm' });

  it('reads the quantities into kaossim’s keys, and opens in its mode', () => {
    assert.ok(read.model, JSON.stringify(read.diagnostics));
    assert.deepStrictEqual(
      read.diagnostics.filter((d) => d.severity !== 'info'),
      [],
    );
    assert.strictEqual(read.dialectRecord!.engine, 'kaossim');
    const model = read.model as Record<string, any>;
    const goal = model.orphans.find((n: any) => n.id === 'intervention');
    assert.strictEqual(
      goal.customProperties['QualityVariable[ResponseTime]'],
      'Time',
    );
    assert.strictEqual(
      goal.customProperties['Objective[14MinRespRate]'],
      'ResponseTime <= 14 * 60',
    );
    assert.strictEqual(goal.customProperties['Target[14MinRespRate]'], '95%');
    const hub = model.links.find((l: any) => l.hub)!.hub;
    assert.strictEqual(hub.customProperties.Tactic, 'milestone-driven');
    assert.strictEqual(
      hub.customProperties['Equation[ResponseTime]'],
      'CallTaking + Travel',
    );
    assert.strictEqual(
      hub.customProperties['BooleanEquation[Dropped]'],
      'Lost | Broken',
    );
    const assignments = model.links.filter(
      (l: any) => l.type === 'kaos.ResponsibilityAssignment',
    );
    assert.deepStrictEqual(
      assignments.map((l: any) => l.customProperties),
      [
        { SysRef: '1.1', 'Distribution[CallTaking]': 'exponential[60]' },
        { SysRef: '1.2', 'Distribution[CallTaking]': 'exponential[40]' },
      ],
    );
  });

  it('runs: one case per design, through the engine’s view', () => {
    const view = kaossimAnalysisModel(
      parsePistar(read.model!, { metamodel: KAOS_OBSTACLES }) as never,
    );
    assert.deepStrictEqual(quantitativeModel(view).problems, []);
    const run = runAnalysis(kaossimAnalyses.simulation, view, undefined, {
      options: { samples: 2000 },
    });
    assert.ok('result' in run, JSON.stringify(run));
    assert.deepStrictEqual(
      run.result.cases.map((c) => c.label),
      ['1.1', '1.2'],
    );
    const [slow, fast] = run.result.cases.map(
      (c) => c.values.intervention!.value as number,
    );
    assert.ok(fast! > slow!, `${fast} > ${slow}`);
  });

  it('writes them back, and the text reads as the same model', () => {
    const written = writeKaos(read.model!, { modelName: 'm' });
    assert.deepStrictEqual(
      written.diagnostics.filter((d) => d.severity !== 'info'),
      [],
    );
    assert.match(written.text!, /qualityvariable \[ResponseTime\] Time/);
    assert.match(
      written.text!,
      /objective \["14MinRespRate"\] "ResponseTime <= 14 \* 60"/,
    );
    assert.match(written.text!, /distribution \[Travel\] normal\[600, 60\]/);
    assert.match(
      written.text!,
      /refinedby \[milestone, ResponseTime = "CallTaking \+ Travel", Dropped = "Lost \| Broken"\] encoded, travel/,
    );
    assert.match(
      written.text!,
      /assignedto \[sysref = "1.2", CallTaking = "exponential\[40\]"\] computer/,
    );
    const again = readKaos(written.text!, { modelName: 'm' });
    const strip = (m: any) =>
      JSON.stringify({
        ...m,
        orphans: m.orphans.map(({ x, y, ...n }: any) => n),
        links: m.links,
      });
    assert.strictEqual(strip(again.model), strip(read.model));
  });
});
