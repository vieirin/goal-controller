/**
 * The engines' options as the workbench reads them from their declarations
 * (goal-controller#118): the keys each engine is given, the defaults, and a
 * manifest's options checked by their value types.
 */
import { describe, expect, it } from 'vitest';
import { hasOptions } from '@/lib/workbench/engineDialects';
import { checkedOptions, optionKeysOf } from '@/lib/workbench/projectSettings';
import { DEFAULT_OPTIONS } from '@/lib/workbench/types';

describe('engine options', () => {
  it('gives each engine the options it reads, MutRoSe, GRL, Tropos4AS and contextual goal models none', () => {
    expect({
      edge: optionKeysOf('edge'),
      edgev2: optionKeysOf('edgev2'),
      sleec: optionKeysOf('sleec'),
      goda: optionKeysOf('goda'),
      mutrose: optionKeysOf('mutrose'),
      grl: optionKeysOf('grl'),
      tropos4as: optionKeysOf('tropos4as'),
      cgm: optionKeysOf('cgm'),
      pistar: optionKeysOf(null),
    }).toEqual({
      edge: ['achievabilitySpace', 'generateDecisionVars', 'clean', 'reduce'],
      edgev2: [
        'discretisation',
        'taskLayout',
        'generateDecisionVars',
        'clean',
        'reduce',
      ],
      sleec: ['generateFluents', 'reduce'],
      goda: ['variant', 'runtimeFormulas'],
      mutrose: [],
      grl: [],
      tropos4as: [],
      cgm: [],
      pistar: [],
    });
    expect(
      hasOptions('mutrose') ||
        hasOptions('grl') ||
        hasOptions('tropos4as') ||
        hasOptions('cgm'),
    ).toBe(false);
  });

  it('starts from the declared defaults', () => {
    expect(DEFAULT_OPTIONS).toEqual({
      achievabilitySpace: 4,
      generateDecisionVars: true,
      clean: false,
      reduce: false,
      discretisation: 10,
      taskLayout: 'taskModules',
      generateFluents: false,
      variant: '5305bc1',
      runtimeFormulas: false,
      continuous: true,
      infeasibleActionPenalty: 100,
      // kaosexpert's (#190)
      samples: 10000,
      seed: 1,
      weighting: 're15',
      // kaosres's (#191)
      scope: 'anchor',
      semantics: 'seams17',
      limit: 4096,
    });
  });

  it('keeps a manifest’s option of its declared type, and reports the others', () => {
    const { options, problems } = checkedOptions({
      mode: 'edgev2',
      options: {
        discretisation: 20,
        taskLayout: 'oneBigModule',
        clean: 'yes',
        variant: 'cc808b6',
      },
    });
    expect(options).toEqual({ discretisation: 20 });
    expect(problems.map((p) => p.message)).toEqual([
      '"oneBigModule" is not a value of "taskLayout"; it is not used',
      '"yes" is not a value of "clean"; it is not used',
      'EdgeV2 has no option "variant"; it is not used',
    ]);
    expect(
      checkedOptions({ mode: 'edge', options: { achievabilitySpace: 0 } })
        .problems,
    ).toHaveLength(1);
  });
});
