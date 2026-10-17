/**
 * iStar-DT's properties as the mapper hands them on and the checks and the
 * DT-Golog writer read them (goal-controller#187): the mapper keeps the
 * actor's sets and the links' probabilities and weights as written, an
 * element's properties are as written, and `readIstardtModel` reads them as
 * the dialect does, for `istardtProblems` and `istardtTemplate` (before
 * phase 2 they parsed them: `=== 'true'`, `Number`, `parseInt`, `pairItems`,
 * `readExpression`, `readAssertion`; the actor's `crossRun` and `exported`
 * are texts, still split by `listItems`). Each model is a seed (Order,
 * Heating, istardt-own), one property edited, read through
 * `istardtAnalysisModel` (the mapper). A value the dialect flags is marked
 * `#187: invalid value`: the readers see it unset.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import {
  istardtAnalysisModel,
  istardtCheckRegistry,
  istardtProblems,
  istardtTemplate,
  readIstardtModel,
  type IstardtModel,
} from '../../../src/engines/istardt';

type Json = Record<string, any>;

const PROJECTS = path.join(__dirname, '../../../../../examples/istardt');
const SEEDS = {
  order: 'istardt-order/Order.txt',
  heating: 'istardt-heating/Heating.txt',
  own: 'istardt-own/istardt-own.txt',
} as const;
const json = (seed: keyof typeof SEEDS): Json =>
  JSON.parse(fs.readFileSync(path.join(PROJECTS, SEEDS[seed]), 'utf8'));
const viewOf = (seed: keyof typeof SEEDS, edit: (json: Json) => void) => {
  const model = json(seed);
  edit(model);
  return istardtAnalysisModel(parsePistar(model, { fileMetamodel: true }));
};
const modelOf = (seed: keyof typeof SEEDS, edit: (json: Json) => void) =>
  readIstardtModel(viewOf(seed, edit));
/** a node by the id its text starts with (`G1`) */
const node = (model: Json, id: string) =>
  model.actors[0].nodes.find((n: Json) => n.text.startsWith(`${id}:`));
/** an effect's link from its group (its probability's) */
const groupLinkTo = (model: Json, effect: string) =>
  model.links.find(
    (l: Json) =>
      l.type === 'istardt.EffectGroupLink' &&
      l.target === node(model, effect).id,
  );
const problemsOf = (model: IstardtModel) =>
  istardtProblems(model).map((p) => `${p.severity}: ${p.message}`);
/** the writer's lines matching `pattern`, or what it throws */
const written = (model: IstardtModel, pattern: RegExp) => {
  try {
    return [
      ...(istardtTemplate(model, { modelName: 'Spec' }).match(pattern) ?? []),
    ];
  } catch (error) {
    return `${(error as Error).constructor.name}: ${(error as Error).message}`;
  }
};

/** istardt-own's one problem, whatever is edited */
const OWN_INFO =
  "info: T2 (lookAtPlants)'s npr from T1 (checkSoilSensor) says nothing more: OR siblings already exclude each other";
/** Heating's one problem, whatever is edited */
const HEATING_WARNING =
  'warning: C1 (hvacOn) is exported, but DT-Golog exports goals, tasks and predicates (discrete), qualities and variables (continuous): the writer leaves it out, as dtx2dtg';

describe('iStar-DT (#187 characterization): what the mapper keeps', () => {
  it("keeps the actor's sets and a link's declared keys as written, any link kind's on any link, and drops the rest", () => {
    const view = viewOf('order', (model) => {
      model.actors[0].customProperties = {
        crossRun: ' a ',
        foo: 'x',
        identifier: 'y',
      };
      // an effect group link; weight is a utility link's
      model.links[3].customProperties = {
        probability: ' 1 ',
        weight: '2',
        foo: 'z',
      };
    });
    assert.deepStrictEqual(view.actors[0]!.properties, { crossRun: ' a ' });
    assert.deepStrictEqual(view.links[3]!.properties, {
      probability: ' 1 ',
      weight: '2',
    });
  });

  it("keeps an element's properties as written, every key (the mapper doesn't see them)", () => {
    const view = viewOf('order', (model) => {
      node(model, 'G1').customProperties = { root: 'true', foo: ' bar ' };
    });
    assert.deepStrictEqual(
      view.elements.find((e) => e.name.startsWith('G1:'))!.properties,
      { root: 'true', foo: ' bar ' },
    );
  });
});

describe("iStar-DT (#187 characterization): a goal's root and episodeLength", () => {
  it("root: true, trimmed; anything else isn't", () => {
    const read = (value: string) => {
      const model = modelOf('order', (m) => {
        node(m, 'G1').customProperties.root = value;
      });
      return [problemsOf(model), written(model, /^goalAchieved.*$/gm)];
    };
    const NO_ROOT = 'iStar-DT needs a root goal: set root to true on one goal';
    assert.deepStrictEqual(read('true'), [
      [],
      ['goalAchieved(S) :- orderMaterial_Sat(S).'],
    ]);
    assert.deepStrictEqual(read(' true '), [
      [],
      ['goalAchieved(S) :- orderMaterial_Sat(S).'],
    ]);
    assert.deepStrictEqual(read(''), [
      [`error: ${NO_ROOT}`],
      `IstardtWriteError: ${NO_ROOT}`,
    ]);
    // #187: invalid value
    for (const value of ['TRUE', 'True', 'yes'])
      assert.deepStrictEqual(read(value), [
        [`error: ${NO_ROOT}`],
        `IstardtWriteError: ${NO_ROOT}`,
      ]);
  });

  it("istardt.goal.root: another goal's root, trimmed, is a second root", () => {
    const check = istardtCheckRegistry['istardt.goal.root'];
    const context = (root: string) => ({
      self: 'G1',
      kindOf: () => 'goal' as const,
      elements: {
        G1: { kind: 'goal', properties: { root: 'true' } },
        G2: { kind: 'goal', properties: { root } },
      } as any,
    });
    assert.strictEqual(
      check({ root: ' true ' }, context(' true ')),
      'One goal is the root: G2 is too',
    );
    // #187: invalid value
    assert.strictEqual(check({ root: 'TRUE' }, context('true')), null);
    assert.strictEqual(check({ root: 'true' }, context('TRUE')), null);
  });

  it("episodeLength: parseInt's, 1 when unset, 0 or no number", () => {
    const read = (value: string | undefined) =>
      written(
        modelOf('order', (m) => {
          if (value === undefined)
            delete node(m, 'G1').customProperties.episodeLength;
          else node(m, 'G1').customProperties.episodeLength = value;
        }),
        /getNumRuns\(.*?\)/g,
      );
    assert.deepStrictEqual(['5', ' 5 ', '', undefined].map(read), [
      ['getNumRuns(5)'],
      ['getNumRuns(5)'],
      ['getNumRuns(1)'],
      ['getNumRuns(1)'],
    ]);
    // #187: invalid value (min 1; not an int): what isn't an int is unset,
    // 1 (parseInt read '2.5' as 2, '10x' as 10); 0 is 1 (`|| 1`); -3 the
    // int reads (its value check says "At least 1"); istardtProblems says
    // nothing of any of them
    assert.deepStrictEqual(['0', '-3', '2.5', '1e2', '10x', 'abc'].map(read), [
      ['getNumRuns(1)'],
      ['getNumRuns(-3)'],
      ['getNumRuns(1)'],
      ['getNumRuns(1)'],
      ['getNumRuns(1)'],
      ['getNumRuns(1)'],
    ]);
    assert.deepStrictEqual(
      problemsOf(
        modelOf('order', (m) => {
          node(m, 'G1').customProperties.episodeLength = '-3';
        }),
      ),
      [],
    );
  });
});

describe("iStar-DT (#187 characterization): a quality's root, formula and export bounds", () => {
  it('root: true, trimmed', () => {
    const read = (value: string) => {
      const model = modelOf('order', (m) => {
        node(m, 'Q3').customProperties.root = value;
      });
      return [problemsOf(model), written(model, /^rewardInst.*$/gm)];
    };
    const NO_ROOT =
      'iStar-DT needs a root quality: set root to true on one quality (the reward)';
    assert.deepStrictEqual(read(' true '), [
      [],
      ['rewardInst(R,S) :- overallQuality(R,S).'],
    ]);
    // #187: invalid value
    assert.deepStrictEqual(read('TRUE'), [
      [`error: ${NO_ROOT}`],
      `IstardtWriteError: ${NO_ROOT}`,
    ]);
  });

  it('formula: an expression, trimmed; blank is none', () => {
    const read = (value: string) => {
      const model = modelOf('own', (m) => {
        node(m, 'Q2').customProperties.formula = value;
      });
      return [
        problemsOf(model),
        written(model, /^waterCost\(V,S\) :- [\s\S]*?\.\n/gm),
      ];
    };
    /** `waterCost(0,s0) :- `'s width */
    const INDENT = ' '.repeat(19);
    assert.deepStrictEqual(read('  -(moisture / 100)  '), [
      [OWN_INFO],
      [
        `waterCost(V,S) :- \n${INDENT}moisture(R_moisture,S),\n${INDENT}V is \n-((R_moisture) / (100.0)).\n`,
      ],
    ]);
    assert.deepStrictEqual(read('   '), [
      ['error: Q2 (waterCost) has no formula and no utility links', OWN_INFO],
      'IstardtWriteError: Q2 (waterCost) has no formula and no utility links',
    ]);
    assert.deepStrictEqual(read('nowhere * 2'), [
      [
        "error: Q2 (waterCost)'s formula names nowhere, which is no element",
        "warning: Q2 (waterCost)'s links don't show what its formula reads: a link from moisture, which it doesn't read",
        OWN_INFO,
      ],
      "IstardtWriteError: Q2 (waterCost)'s formula names nowhere, which is no element",
    ]);
    // #187: invalid value: unset, as a blank one (it was "Q2 (waterCost)'s
    // formula is not an expression: …"; the value check says so)
    for (const value of ['1 +', '1e2 * moisture', '.5 * moisture'])
      assert.deepStrictEqual(read(value), [
        ['error: Q2 (waterCost) has no formula and no utility links', OWN_INFO],
        'IstardtWriteError: Q2 (waterCost) has no formula and no utility links',
      ]);
  });

  it('istardt.export.bounds: the numbers, trimmed; blank is unset', () => {
    const check = istardtCheckRegistry['istardt.export.bounds'];
    const read = (exportMin: string, exportMax: string) =>
      check({ exportMin, exportMax }, { self: 'Q', kindOf: () => undefined });
    const NOT = (min: string, max: string) =>
      `An export's minimum is below its maximum: ${min} is not below ${max}`;
    assert.deepStrictEqual(
      [
        read(' 0 ', ' 100 '),
        read('', '1'),
        read('-0', '0'),
        read('-10', '-10'),
      ],
      [null, null, NOT('0', '0'), NOT('-10', '-10')],
    );
    // #187: invalid value: unset (Number read '1e2' as 100, 'abc' as NaN)
    assert.deepStrictEqual(
      [read('.5', '1'), read('1e2', '1'), read('abc', '1')],
      [null, null, null],
    );
  });

  it("an export's bounds as the writer reads them: the numbers, `|| 0`", () => {
    const read = (exportMin: string, exportMax: string) => {
      const model = modelOf('heating', (m) => {
        Object.assign(node(m, 'Q4').customProperties, { exportMin, exportMax });
      });
      return [problemsOf(model), written(model, /^continuousExportedSet.*$/gm)];
    };
    const set = (q4: string) => [
      `continuousExportedSet([[roomTemperature(_),${q4}], [runningTime(_),0.0,100.0]]).`,
    ];
    assert.deepStrictEqual(read('0', '100'), [
      [HEATING_WARNING],
      set('0.0,100.0'),
    ]);
    assert.deepStrictEqual(read('-0', '5'), [
      [HEATING_WARNING],
      set('0.0,5.0'),
    ]);
    // one bound blank: warned of as if both were, and written 0.0
    assert.deepStrictEqual(read('', '50'), [
      [
        HEATING_WARNING,
        'warning: Q4 (roomTemperature) is exported continuous without exportMin and exportMax: written as 0.0..0.0',
      ],
      set('0.0,50.0'),
    ]);
    // #187: invalid value: unset, as a blank one (Number read '1e2' as 100,
    // '.5' as 0.5, 'abc' as NaN, an error)
    const UNBOUNDED =
      'warning: Q4 (roomTemperature) is exported continuous without exportMin and exportMax: written as 0.0..0.0';
    assert.deepStrictEqual(read('1e2', '1e3'), [
      [HEATING_WARNING, UNBOUNDED],
      set('0.0,0.0'),
    ]);
    assert.deepStrictEqual(read('.5', '2.25'), [
      [HEATING_WARNING, UNBOUNDED],
      set('0.0,2.25'),
    ]);
    assert.deepStrictEqual(read('abc', '1'), [
      [HEATING_WARNING, UNBOUNDED],
      set('0.0,1.0'),
    ]);
  });
});

describe("iStar-DT (#187 characterization): an effect's probability, satisfying and set", () => {
  /** E1's probability (on its group link), its problems, its prob/3 line */
  const probability = (value: string | undefined) => {
    const model = modelOf('order', (m) => {
      const link = groupLinkTo(m, 'E1');
      if (value === undefined) delete link.customProperties;
      else link.customProperties = { probability: value };
    });
    return [
      model.probabilityOf(model.byIdentifier.get('deliveredInTimeA_Eff')!),
      problemsOf(model),
      written(model, /^prob\(deliveredInTimeA_Eff.*$/gm),
    ];
  };
  const NOT_A_NUMBER = (text: string) =>
    `E1 (deliveredInTimeA_Eff)'s probability (on its effect group link) is a number in 0..1, not ${text}`;
  const SUM = (sum: number) =>
    `T1 (orderFromSupplierA)'s effects' probabilities sum to ${sum}, not 1`;

  it('probability: trimmed; a number in 0..1, the group summing to 1', () => {
    assert.deepStrictEqual(probability(' 0.75 '), [
      '0.75',
      [],
      ['prob(deliveredInTimeA_Eff,0.75,_).'],
    ]);
    assert.deepStrictEqual(probability('-0'), [
      '-0',
      [`error: ${SUM(0.25)}`],
      `IstardtWriteError: ${SUM(0.25)}`,
    ]);
    // #187: invalid value (out of 0..1)
    assert.deepStrictEqual(probability('1.5'), [
      '1.5',
      [`error: ${NOT_A_NUMBER('1.5')}`, `error: ${SUM(1.75)}`],
      `IstardtWriteError: ${NOT_A_NUMBER('1.5')}\n${SUM(1.75)}`,
    ]);
  });

  it('probability unset: "unset" when absent, nothing when blank', () => {
    assert.deepStrictEqual(probability(undefined), [
      undefined,
      [`error: ${NOT_A_NUMBER('unset')}`, `error: ${SUM(0.25)}`],
      `IstardtWriteError: ${NOT_A_NUMBER('unset')}\n${SUM(0.25)}`,
    ]);
    for (const value of ['', '   '])
      assert.deepStrictEqual(probability(value), [
        '',
        [`error: ${NOT_A_NUMBER('')}`, `error: ${SUM(0.25)}`],
        `IstardtWriteError: ${NOT_A_NUMBER('')}\n${SUM(0.25)}`,
      ]);
  });

  it("probability: unset where the dialect's number isn't one", () => {
    // #187: invalid value: '.75', exponents and hex are unset (Number read
    // '.75' and '7.5e-1' as 0.75, '0x1' as 1); the text is as written
    for (const value of ['.75', '7.5e-1', '0x1'])
      assert.deepStrictEqual(probability(value), [
        value,
        [`error: ${NOT_A_NUMBER(value)}`, `error: ${SUM(0.25)}`],
        `IstardtWriteError: ${NOT_A_NUMBER(value)}\n${SUM(0.25)}`,
      ]);
    // #187: invalid value: no number (the sum was NaN, unreported)
    for (const value of ['abc', '75%'])
      assert.deepStrictEqual(probability(value), [
        value,
        [`error: ${NOT_A_NUMBER(value)}`, `error: ${SUM(0.25)}`],
        `IstardtWriteError: ${NOT_A_NUMBER(value)}\n${SUM(0.25)}`,
      ]);
  });

  it('satisfying: false, trimmed, is unsatisfying; anything else satisfies', () => {
    const read = (value: string) =>
      written(
        modelOf('order', (m) => {
          node(m, 'E1').customProperties.satisfying = value;
        }),
        /^orderFromSupplierA_Sat\(S\) :- .*$/gm,
      );
    const SATISFYING = [
      'orderFromSupplierA_Sat(S) :- deliveredInTimeA_fl(S);deliveredLateA_fl(S).',
    ];
    const UNSATISFYING = ['orderFromSupplierA_Sat(S) :- deliveredLateA_fl(S).'];
    assert.deepStrictEqual(['true', 'false', ' false ', ''].map(read), [
      SATISFYING,
      UNSATISFYING,
      UNSATISFYING,
      SATISFYING,
    ]);
    // #187: invalid value
    assert.deepStrictEqual(['FALSE', 'no'].map(read), [SATISFYING, SATISFYING]);
  });

  it('set: its pairs, each value a number term for the writer', () => {
    const read = (value: string) => {
      const model = modelOf('own', (m) => {
        node(m, 'E1').customProperties.set = value;
      });
      return [
        problemsOf(model),
        written(model, /^moisture\(V,do\(A,S\)\) :- A=readDry.*$/gm),
      ];
    };
    const SETS = (...values: string[]) =>
      values.map((v) => `moisture(V,do(A,S)) :- A=readDry,!,V is ${v}.`);
    assert.deepStrictEqual(read(' moisture : 25 '), [[OWN_INFO], SETS('25.0')]);
    assert.deepStrictEqual(read('moisture:-5'), [[OWN_INFO], SETS('-5.0')]);
    assert.deepStrictEqual(read('moisture:2.5'), [[OWN_INFO], SETS('2.5')]);
    assert.deepStrictEqual(read('moisture:20, moisture:30'), [
      [OWN_INFO],
      SETS('20.0', '30.0'),
    ]);
    assert.deepStrictEqual(read(''), [[OWN_INFO], []]);
    assert.deepStrictEqual(read('nowhere:5'), [
      [
        "error: E1 (readDry)'s set names nowhere, which is no element",
        OWN_INFO,
      ],
      "IstardtWriteError: E1 (readDry)'s set names nowhere, which is no element",
    ]);
    // #187: invalid value: istardtProblems says nothing; the writer stops
    // (the dialect's pairList reads these values though its value check
    // says "Not a number": they reach the writer)
    for (const [value, text] of [
      ['moisture:1e2', '1e2'],
      ['moisture:.5', '.5'],
      ['moisture:1+1', '1+1'],
    ] as const)
      assert.deepStrictEqual(read(value), [
        [OWN_INFO],
        `IstardtWriteError: an effect sets moisture to a number, not ${text}`,
      ]);
    // #187: invalid value: a pair without its value is no pairList, unset
    // (pairItems read it as moisture set to '', and the writer stopped)
    assert.deepStrictEqual(read('moisture'), [[OWN_INFO], []]);
    // #187: invalid value: a word as the value escapes as the formula's own
    // error, not an IstardtWriteError
    assert.deepStrictEqual(read('moisture:abc'), [
      [OWN_INFO],
      'FormulaError: abc names no element',
    ]);
  });
});

describe("iStar-DT (#187 characterization): a condition's formula", () => {
  it('an assertion, trimmed; what the goal language can’t read is an empty condition to the writer', () => {
    const read = (value: string) => {
      const model = modelOf('own', (m) => {
        node(m, 'C2').customProperties.formula = value;
      });
      return [
        problemsOf(model),
        written(model, /^waterByHandPre_fl\(S\) :- .*$/gm),
      ];
    };
    assert.deepStrictEqual(read(' soilDry '), [
      [
        "warning: C2 (waterByHandPre)'s links don't show what its formula reads: a link from plantsWilted, which it doesn't read",
        OWN_INFO,
      ],
      ['waterByHandPre_fl(S) :- soilDry_fl(S).'],
    ]);
    assert.deepStrictEqual(read('nowhere'), [
      [
        "error: C2 (waterByHandPre)'s formula names nowhere, which is no element",
        "warning: C2 (waterByHandPre)'s links don't show what its formula reads: a link from soilDry, plantsWilted, which it doesn't read",
        OWN_INFO,
      ],
      "IstardtWriteError: C2 (waterByHandPre)'s formula names nowhere, which is no element",
    ]);
    // required: blank is the value type's problem; istardtProblems says nothing
    assert.deepStrictEqual(read('   '), [
      [OWN_INFO],
      "IstardtWriteError: C2's formula: an empty condition",
    ]);
    // #187: invalid value: the same
    for (const value of ['(soilDry |', 'moisture > .5', 'moisture > 1e2'])
      assert.deepStrictEqual(read(value), [
        [OWN_INFO],
        "IstardtWriteError: C2's formula: an empty condition",
      ]);
  });
});

describe("iStar-DT (#187 characterization): a utility link's weight", () => {
  /** Q1 (cost)'s first utility link, from E1 */
  const read = (value: string | undefined) => {
    const model = modelOf('order', (m) => {
      const link = m.links.filter(
        (l: Json) => l.type === 'istardt.UtilityLink',
      )[0];
      if (value === undefined) delete link.customProperties;
      else link.customProperties = { weight: value };
    });
    return [
      model.utilities(model.byIdentifier.get('cost')!)[0]!.weight,
      problemsOf(model),
      written(model, /V is R_cost_init \+\n.*/g),
    ];
  };
  const SUM = (first: string) => [
    `V is R_cost_init +\n((((((${first}) * (R_deliveredInTimeA_fl)) + ((0.5) * (R_deliveredLateA_fl))) + ((0.5) * (R_neverDeliveredA_fl))) + ((1.0) * (R_deliveredInTimeB_fl))) + ((1.0) * (R_deliveredLateB_fl))) + ((1.0) * (R_neverDeliveredB_fl)).`,
  ];

  it('trimmed, spliced into the weighted sum as text; blank or unset is 1', () => {
    assert.deepStrictEqual(read(' 0.5 '), ['0.5', [], SUM('0.5')]);
    assert.deepStrictEqual(read('-1'), ['-1', [], SUM('-1.0')]);
    assert.deepStrictEqual(read('2.25'), ['2.25', [], SUM('2.25')]);
    assert.deepStrictEqual(read(''), ['', [], SUM('1.0')]);
    assert.deepStrictEqual(read(undefined), ['', [], SUM('1.0')]);
  });

  it('what the dialect’s number can’t read is unset, 1', () => {
    // #187: invalid value (spliced as text, the writer stopped: "Q1's formula
    // is not an expression: .5 * deliveredInTimeA + …"; a word was a name,
    // "abc names no element")
    for (const value of ['.5', '5e-1', '50%', 'abc'])
      assert.deepStrictEqual(read(value), [value, [], SUM('1.0')]);
  });
});

describe("iStar-DT (#187 characterization): the actor's sets and identifiers", () => {
  it('crossRun and exported: listItems, trimmed, the empty ones dropped; initializations: its pairs', () => {
    const model = modelOf('order', (m) => {
      m.actors[0].customProperties = {
        crossRun: ' cost ,, happyCustomer, ',
        exported: '',
        initializations: ' cost : 5 , happyCustomer, overallQuality:x:y,,',
      };
    });
    assert.deepStrictEqual(model.crossRun, ['cost', 'happyCustomer']);
    assert.deepStrictEqual(model.exported, []);
    // #187: invalid value: a pair without its value, one with two colons:
    // no pairList, unset (pairItems read cost:5, happyCustomer:'',
    // overallQuality:'x:y', written init([cost(5),happyCustomer(),overallQuality(x:y)]))
    assert.deepStrictEqual(model.initializations, []);
    assert.deepStrictEqual(problemsOf(model), []);
    assert.deepStrictEqual(
      written(model, /^(transStateStructure|discreteExportedSet|init)\(.*$/gm),
      [
        'transStateStructure([cost(_),happyCustomer(_)]).',
        'discreteExportedSet([]).',
        'init([]).',
      ],
    );
  });

  it("initializations: each value written as it is, unchecked; a predicate's dropped", () => {
    const read = (value: string) => {
      const model = modelOf('own', (m) => {
        m.actors[0].customProperties.initializations = value;
      });
      return [problemsOf(model), written(model, /^init\(.*$/gm)];
    };
    assert.deepStrictEqual(read(' moisture : 40 , plantHealth:0'), [
      [OWN_INFO],
      ['init([moisture_fl(40),plantHealth(0)]).'],
    ]);
    assert.deepStrictEqual(read('soilDry:true'), [
      [OWN_INFO],
      ['init([soilDry_fl]).'],
    ]);
    assert.deepStrictEqual(read('nowhere:1'), [
      [
        'error: the initializations names nowhere, which is no element',
        OWN_INFO,
      ],
      'IstardtWriteError: the initializations names nowhere, which is no element',
    ]);
    // the dialect's pairList of text takes these; the writer writes them as text
    assert.deepStrictEqual(read('moisture:4e1'), [
      [OWN_INFO],
      ['init([moisture_fl(4e1)]).'],
    ]);
    assert.deepStrictEqual(read('moisture:abc'), [
      [OWN_INFO],
      ['init([moisture_fl(abc)]).'],
    ]);
    // #187: invalid value: no value, so no pairList: unset (it was
    // init([moisture_fl()]))
    assert.deepStrictEqual(read('moisture'), [[OWN_INFO], ['init([]).']]);
  });

  it("identifier: trimmed; blank is the name's camelCase", () => {
    const read = (value: string) =>
      modelOf('order', (m) => {
        node(m, 'T1').customProperties = { identifier: value };
      })
        .ofKind('task')
        .map((task) => task.identifier);
    assert.deepStrictEqual([' myName ', '', '   '].map(read), [
      ['myName', 'orderFromSupplierB'],
      ['orderFromSupplierA', 'orderFromSupplierB'],
      ['orderFromSupplierA', 'orderFromSupplierB'],
    ]);
  });
});
