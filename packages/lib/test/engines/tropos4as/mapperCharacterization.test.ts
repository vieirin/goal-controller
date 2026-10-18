/**
 * Tropos4AS's properties as the mapper hands them on and the lifecycle and
 * the checks read them (goal-controller#187): the mapper keeps no actor or
 * link property (it maps none), an element's properties are as written, and
 * `readTropos4asModel` reads them as the dialect does, for `goalTypeOf`,
 * `onFailureOf`, the lifecycle's conditions (`conditionOf`) and the checks
 * (before phase 2 they parsed them: trimming, `readCondition`'s
 * `readAssertion`, `pairItems`). Each model is a seed (the Cleaner Agent,
 * patient monitoring), one property edited, read through
 * `tropos4asAnalysisModel` (the mapper). A value the dialect flags is
 * marked `#187: invalid value`: the readers see it unset.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { checkOnKey } from '../../support/checkOn';
import { tropos4as as TROPOS4AS } from '../../../src/engines/tropos4as/definition';
import {
  goalTypeOf,
  instantiationOf,
  readTropos4asModel,
  tropos4asAnalysisModel,
  tropos4asCheckRegistry,
  tropos4asProblems,
  type Instantiation,
  type Tropos4asModel,
} from '../../../src/engines/tropos4as';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

type Json = Record<string, any>;
type Seed = 'cleaner-agent' | 'patient-monitoring';

const EXAMPLES = path.join(__dirname, '../../../../../examples/tropos4as');
const viewOf = (seed: Seed, edit: (json: Json) => void) => {
  const json = JSON.parse(
    fs.readFileSync(path.join(EXAMPLES, seed, `${seed}.txt`), 'utf8'),
  );
  edit(json);
  return tropos4asAnalysisModel(parsePistar(json, { fileMetamodel: true }));
};
const modelOf = (seed: Seed, edit: (json: Json) => void) =>
  readTropos4asModel(viewOf(seed, edit));
/** a node by its piStar id */
const node = (json: Json, id: string) =>
  json.actors
    .flatMap((actor: Json) => actor.nodes)
    .find((n: Json) => n.id === id);
const problemsOf = (model: Tropos4asModel) =>
  tropos4asProblems(model).map((p) => `${p.severity}: ${p.message}`);
const sets = (instance: Instantiation) => ({
  E: instance.E.map((p) => `⟨${p.condition.text}, ${p.action}⟩`),
  C: instance.C.map((p) => `⟨${p.condition.text}, ${p.action}⟩`),
});
/** a goal's instance of §4.3, or what reading it throws */
const instanceOf = (model: Tropos4asModel, id: string) => {
  try {
    return sets(instantiationOf(model.find(id)!));
  } catch (error) {
    return (error as Error).message;
  }
};

/** A(roomClean, false), its onFailure `reactivate` (restart) or `drop` */
const achieve = (
  s: string,
  after: 'Reactivate' | 'DropFailure' = 'Reactivate',
) => ({
  E: [
    '⟨true, Activate⟩',
    '⟨false, DropFailure⟩',
    `⟨${s}, Succeed⟩`,
    `⟨${s}, DropSuccess⟩`,
    `⟨${not(s)}, ${after}⟩`,
    `⟨${not(s)}, Fail⟩`,
  ],
  C: [
    '⟨true, Activate⟩',
    '⟨false, DropFailure⟩',
    `⟨${s}, Succeed⟩`,
    `⟨${s}, DropSuccess⟩`,
    `⟨${not(s)}, ${after}⟩`,
    '⟨false, Fail⟩',
    `⟨${not(s)}, Retry⟩`,
  ],
});
const not = (s: string) =>
  s === 'true'
    ? 'false'
    : s === 'false'
      ? 'true'
      : /^[\w.()]+$/.test(s)
        ? `¬${s}`
        : `¬(${s})`;
const PERFORM = {
  E: ['⟨true, Activate⟩', '⟨true, DropFailure⟩', '⟨true, DropSuccess⟩'],
  C: ['⟨true, Activate⟩', '⟨true, DropFailure⟩', '⟨true, DropSuccess⟩'],
};
/** M(ok, false) */
const MAINTAIN_OK = {
  E: [
    '⟨¬ok, Activate⟩',
    '⟨false, DropFailure⟩',
    '⟨ok, Succeed⟩',
    '⟨ok, Suspend⟩',
    '⟨¬ok, Reactivate⟩',
    '⟨¬ok, Fail⟩',
  ],
  C: [
    '⟨¬ok, Activate⟩',
    '⟨false, DropFailure⟩',
    '⟨ok, Succeed⟩',
    '⟨ok, Suspend⟩',
    '⟨¬ok, Reactivate⟩',
    '⟨false, Fail⟩',
    '⟨¬ok, Retry⟩',
  ],
};

/** patient monitoring's one problem, whatever is edited elsewhere */
const SEED_WARNING =
  "warning: takeMedicine refines followInstructions: a creation condition is for root goals (AAMAS 2009 fn. 1), and the lifecycle doesn't read it";

describe('Tropos4AS (#187 characterization): what the mapper keeps', () => {
  it("keeps no actor's or link's property, and an element's as written, every key", () => {
    const view = viewOf('cleaner-agent', (json) => {
      json.actors[1].customProperties = { importance: 'High', type: 'x' };
      json.links[5].customProperties = { context: 'x', weight: '1' };
      node(json, 'RC').customProperties = {
        achievement: ' roomClean ',
        foo: 'bar',
        type: '',
      };
    });
    assert.deepStrictEqual(
      view.actors.map((actor) => actor.properties),
      [{}, {}],
    );
    assert.deepStrictEqual(view.links[5]!.properties, {});
    assert.deepStrictEqual(
      view.elements.find((e) => e.id === 'RC')!.properties,
      { achievement: ' roomClean ', foo: 'bar', type: '' },
    );
  });
});

describe("Tropos4AS (#187 characterization): a goal's type and onFailure", () => {
  /** RoomClean with an achievement and a maintain condition, and `type` */
  const typed = (type: string) => {
    const model = modelOf('cleaner-agent', (json) => {
      node(json, 'RC').customProperties = {
        type,
        achievement: 'roomClean',
        maintain: 'ok',
      };
    });
    return [
      goalTypeOf(model.find('RC')!),
      instanceOf(model, 'RC'),
      problemsOf(model),
    ];
  };
  const PERFORM_WITH_CONDITIONS =
    'error: RC: A perform-goal evaluates no condition (AAMAS 2009 §4.3.1): remove achievement, maintain, or make it an achieve- or maintain-goal';

  it('type: maintain or perform, trimmed; achieve otherwise', () => {
    assert.deepStrictEqual(typed('maintain'), ['maintain', MAINTAIN_OK, []]);
    assert.deepStrictEqual(typed(' maintain '), ['maintain', MAINTAIN_OK, []]);
    assert.deepStrictEqual(typed('perform'), [
      'perform',
      PERFORM,
      [PERFORM_WITH_CONDITIONS],
    ]);
    assert.deepStrictEqual(typed(' perform'), [
      'perform',
      PERFORM,
      [PERFORM_WITH_CONDITIONS],
    ]);
    for (const type of ['', 'achieve'])
      assert.deepStrictEqual(typed(type), [
        'achieve',
        achieve('roomClean'),
        [],
      ]);
  });

  it('type: any other casing or word is achieve, and no problem (the dialect has them)', () => {
    // #187: invalid value
    for (const type of ['Maintain', 'MAINTAIN', 'Perform', 'bogus'])
      assert.deepStrictEqual(typed(type), [
        'achieve',
        achieve('roomClean'),
        [],
      ]);
  });

  it('onFailure: drop, trimmed; restart otherwise', () => {
    const read = (onFailure: string) =>
      instanceOf(
        modelOf('cleaner-agent', (json) => {
          node(json, 'RC').customProperties = {
            onFailure,
            achievement: 'roomClean',
          };
        }),
        'RC',
      );
    assert.deepStrictEqual(read('drop'), achieve('roomClean', 'DropFailure'));
    assert.deepStrictEqual(read(' drop '), achieve('roomClean', 'DropFailure'));
    assert.deepStrictEqual(read('restart'), achieve('roomClean'));
    assert.deepStrictEqual(read(''), achieve('roomClean'));
    // #187: invalid value
    for (const onFailure of ['Drop', 'DROP', 'bogus'])
      assert.deepStrictEqual(read(onFailure), achieve('roomClean'));
  });
});

describe("Tropos4AS (#187 characterization): a goal's conditions", () => {
  /** RoomClean's instance and the model's problems, its achievement `value` */
  const read = (achievement: string) => {
    const model = modelOf('cleaner-agent', (json) => {
      node(json, 'RC').customProperties = { achievement };
    });
    return [instanceOf(model, 'RC'), problemsOf(model)];
  };

  it('an assertion, trimmed; blank is none (the goal runs as P)', () => {
    assert.deepStrictEqual(read('  roomClean  '), [achieve('roomClean'), []]);
    assert.deepStrictEqual(read('room.clean'), [achieve('room.clean'), []]);
    assert.deepStrictEqual(read('x = 1.5'), [achieve('x = 1.5'), []]);
    assert.deepStrictEqual(read('true'), [achieve('true'), []]);
    assert.deepStrictEqual(read('false'), [achieve('false'), []]);
    assert.deepStrictEqual(read(''), [PERFORM, []]);
    assert.deepStrictEqual(read('   '), [PERFORM, []]);
    // #240: TRUE / FALSE in any case are the constant, not a belief
    assert.deepStrictEqual(read('TRUE'), [achieve('true'), []]);
    assert.deepStrictEqual(read('FALSE'), [achieve('false'), []]);
  });

  it("what the goal language can't read: unset, as a blank one", () => {
    // #187: invalid value (the run threw, and the problems said, `RC's
    // achievement: "a <" is no condition`; the value check says so)
    for (const achievement of ['a <', 'x > .5', 'x > 1e2'])
      assert.deepStrictEqual(read(achievement), [PERFORM, []]);
  });

  it("a maintain-goal's maintain: blank is none, an error, and the run throws", () => {
    const maintained = (maintain: string) => {
      const model = modelOf('cleaner-agent', (json) => {
        node(json, 'MBL').customProperties = {
          type: 'maintain',
          maintain,
          target: 't',
          drop: ' ',
        };
      });
      return [instanceOf(model, 'MBL'), problemsOf(model)];
    };
    assert.deepStrictEqual(maintained('ok'), [
      {
        E: [
          '⟨¬ok, Activate⟩',
          '⟨false, DropFailure⟩',
          '⟨t, Succeed⟩',
          '⟨t, Suspend⟩',
          '⟨¬t, Reactivate⟩',
          '⟨¬t, Fail⟩',
        ],
        C: [
          '⟨¬ok, Activate⟩',
          '⟨false, DropFailure⟩',
          '⟨t, Succeed⟩',
          '⟨t, Suspend⟩',
          '⟨¬t, Reactivate⟩',
          '⟨false, Fail⟩',
          '⟨¬t, Retry⟩',
        ],
      },
      [],
    ]);
    assert.deepStrictEqual(maintained('  '), [
      'MBL is a maintain-goal without its maintain condition',
      [
        'error: MBL: A target condition needs a maintain condition (M(m, t, d), AAMAS 2009 §4.3.3)',
        'error: MBL is a maintain-goal without its maintain condition (M(m, d), AAMAS 2009 §4.3.3)',
      ],
    ]);
    // #187: invalid value: unset, as a blank one (it was `MBL's maintain:
    // "a <" is no condition`, thrown and reported)
    assert.deepStrictEqual(maintained('a <'), maintained('  '));
  });

  it('a creation condition below a root: warned of unless blank', () => {
    const read = (creation: string) =>
      problemsOf(
        modelOf('patient-monitoring', (json) => {
          node(json, 'eatMeals').customProperties = {
            achievement: 'done',
            creation,
          };
        }),
      );
    assert.deepStrictEqual(read('  '), [SEED_WARNING]);
    assert.deepStrictEqual(read('x'), [
      "warning: eatMeals refines followInstructions: a creation condition is for root goals (AAMAS 2009 fn. 1), and the lifecycle doesn't read it",
      SEED_WARNING,
    ]);
  });

  it("an error's condition: required, trimmed", () => {
    const read = (condition: string | undefined) =>
      problemsOf(
        modelOf('patient-monitoring', (json) => {
          node(json, 'errorNotEat').customProperties =
            condition === undefined ? {} : { condition };
        }),
      );
    const NONE =
      'error: errorNotEat has no condition: an error is adopted when its condition holds (#134 D7)';
    assert.deepStrictEqual(read(' !x '), [SEED_WARNING]);
    for (const condition of [undefined, '', '  '])
      assert.deepStrictEqual(read(condition), [SEED_WARNING, NONE]);
    // #187: invalid value: unset, no condition (it was `errorNotEat's
    // condition: "a <" is no condition`)
    assert.deepStrictEqual(read('a <'), [SEED_WARNING, NONE]);
  });
});

describe('Tropos4AS (#187 characterization): the goal checks', () => {
  const context = { self: 'G', kindOf: () => undefined };
  const perform = checkOnKey(
    TROPOS4AS,
    { element: 'goal' },
    'achievement',
    tropos4asCheckRegistry['tropos4as.goal.perform'],
  );
  const target = checkOnKey(
    TROPOS4AS,
    { element: 'goal' },
    'target',
    tropos4asCheckRegistry['tropos4as.goal.target'],
  );

  it('tropos4as.goal.perform: type perform, trimmed; blank conditions unset; creation and precondition allowed', () => {
    assert.strictEqual(
      perform({ type: ' perform ', achievement: 'x' }, context),
      'A perform-goal evaluates no condition (AAMAS 2009 §4.3.1): remove achievement, or make it an achieve- or maintain-goal',
    );
    assert.strictEqual(
      perform(
        {
          type: 'perform',
          achievement: '  ',
          failure: 'y',
          maintain: 'm',
          target: 't',
          drop: 'd',
          precondition: 'p',
          creation: 'c',
        },
        context,
      ),
      'A perform-goal evaluates no condition (AAMAS 2009 §4.3.1): remove failure, maintain, target, drop, or make it an achieve- or maintain-goal',
    );
    // #187: invalid value: not perform
    assert.strictEqual(
      perform({ type: 'Perform', achievement: 'x' }, context),
      null,
    );
  });

  it('tropos4as.goal.target: blank is unset', () => {
    assert.strictEqual(
      target({ target: 't', maintain: '  ' }, context),
      'A target condition needs a maintain condition (M(m, t, d), AAMAS 2009 §4.3.3)',
    );
    assert.strictEqual(target({ target: '  ' }, context), null);
  });
});

describe("Tropos4AS (#187 characterization): an artifact's attributes", () => {
  const read = (attributes: string) => {
    const model = modelOf('patient-monitoring', (json) => {
      node(json, 'medicineSensor').customProperties = { attributes };
    });
    return [
      model.attributesOf(model.find('medicineSensor')!),
      problemsOf(model),
    ];
  };
  const NOT = (text: string) =>
    `error: medicineSensor: An attribute is name:type, the type bool, int, number or its options (mode:wet|dry): not ${text}`;

  it('name:type pairs, trimmed', () => {
    assert.deepStrictEqual(read(' taken : bool '), [
      [['taken', 'bool']],
      [SEED_WARNING],
    ]);
    // #187: an empty pair is no pairList to the dialect (its value check
    // says "name:value pairs, comma-separated"), so unset; pairItems
    // dropped it, a:bool and b:int (unmarked before phase 2)
    assert.deepStrictEqual(read('a:bool,,b:int'), [[], [SEED_WARNING]]);
    assert.deepStrictEqual(read('n:number, mode:wet|dry, x:a|b|c'), [
      [
        ['n', 'number'],
        ['mode', 'wet|dry'],
        ['x', 'a|b|c'],
      ],
      [SEED_WARNING],
    ]);
    assert.deepStrictEqual(read(''), [[], [SEED_WARNING]]);
  });

  it('what tropos4as.artifact.attributes rejects: kept as read, and reported', () => {
    // a type the conditions can't read, its options written with spaces
    assert.deepStrictEqual(read('taken:Bool'), [
      [['taken', 'Bool']],
      [SEED_WARNING, NOT('taken:Bool')],
    ]);
    assert.deepStrictEqual(read('mode:wet|'), [
      [['mode', 'wet|']],
      [SEED_WARNING, NOT('mode:wet|')],
    ]);
    assert.deepStrictEqual(read('x:a | b'), [
      [['x', 'a | b']],
      [SEED_WARNING, NOT('x:a | b')],
    ]);
    // #187: invalid value (no name:value pair to the dialect): unset (pairItems
    // read taken:'', '':bool, a:'b:c', and the check reported them)
    for (const attributes of ['taken', ':bool', 'a:b:c'])
      assert.deepStrictEqual(read(attributes), [[], [SEED_WARNING]]);
  });
});
