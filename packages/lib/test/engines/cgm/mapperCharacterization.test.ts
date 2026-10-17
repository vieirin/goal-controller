/**
 * Contextual goal models' properties as the mapper hands them on and the
 * analyses read them, today (goal-controller#187 phase 2 pre-work): the
 * mapper keeps a link's `context`, `opposite` and `amount` as written, an
 * element's `cost`, `activation`, `formula` and `supportedBy` are as
 * written, and the analyses parse them later (`intOf`'s `parseInt`,
 * `formulaOf`'s `readAssertion`, the checks' trimming). Each model is
 * museum-guide-costs (Fig. 13), one property edited, read through
 * `cgmAnalysisModel` (the mapper). A value the dialect flags is marked
 * `#187: invalid value`: after the migration the mapper sees `undefined`.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import type { AnalysisModel } from '../../../src/engines/analysis';
import {
  cgmAnalysisModel,
  cgmCheckRegistry,
  cgmProblems,
  contextAt,
  contributionSign,
  readCgmModel,
  reContextCosts,
  reContextDlv,
} from '../../../src/engines/cgm';
import { EXAMPLES } from './support';

type Json = Record<string, any>;

const seedJson = (): Json =>
  JSON.parse(
    fs.readFileSync(
      path.join(EXAMPLES, 'museum-guide-costs', 'museum-guide-costs.txt'),
      'utf8',
    ),
  );
/** a node by the id its text starts with (`T3`) */
const nodeOf = (json: Json, id: string) =>
  [
    ...json.actors.flatMap((actor: Json) => actor.nodes),
    ...json.dependencies,
    ...json.orphans,
  ].find((node: Json) => node.text.startsWith(`${id}:`));
const PISTAR = (id: string) => nodeOf(seedJson(), id).id as string;
const linkOf = (json: Json, source: string, target: string) =>
  json.links.find(
    (link: Json) =>
      link.source === nodeOf(json, source).id &&
      link.target === nodeOf(json, target).id,
  );
/** the seed's view, edited first */
const viewOf = (edit: (json: Json) => void): AnalysisModel => {
  const json = seedJson();
  edit(json);
  return cgmAnalysisModel(parsePistar(json, { fileMetamodel: true }));
};
const linkIn = (model: AnalysisModel, source: string, target: string) =>
  model.links.find(
    (link) => link.source === PISTAR(source) && link.target === PISTAR(target),
  )!;
const messages = (model: AnalysisModel) =>
  cgmProblems(model).map((problem) => problem.message);

describe('Contextual goal models (#187 characterization): what the mapper keeps', () => {
  it("keeps a link's declared keys as written, any link kind's on any link, and drops the rest", () => {
    const model = viewOf((json) => {
      linkOf(json, 'G2', 'G1').customProperties = {
        context: ' C5 ',
        opposite: '',
        // an intersection's key on an OR refinement: the keys are every link kind's
        amount: '3',
        cost: '9',
        foo: 'x',
      };
    });
    assert.deepStrictEqual(linkIn(model, 'G2', 'G1').properties, {
      context: ' C5 ',
      opposite: '',
      amount: '3',
    });
  });

  it("keeps an element's properties as written, every key (the mapper doesn't see them)", () => {
    const model = viewOf((json) => {
      nodeOf(json, 'T3').customProperties = {
        cost: ' 60 ',
        foo: 'bar',
        activation: '',
      };
    });
    assert.deepStrictEqual(
      model.elements.find((e) => e.id === PISTAR('T3'))!.properties,
      { cost: ' 60 ', foo: 'bar', activation: '' },
    );
  });

  it('keeps a context on a link kind that has none, for cgmProblems to report', () => {
    const model = viewOf((json) => {
      linkOf(json, 'T2', 'T1').customProperties = { context: 'C5' };
    });
    assert.deepStrictEqual(linkIn(model, 'T2', 'T1').properties, {
      context: 'C5',
    });
    assert.deepStrictEqual(messages(model), [
      'T2 → T1: a IncludesLink has no context (REJ 2010 Table 1: contexts sit on AND and OR refinements, means-end, dependencies and contributions)',
    ]);
  });
});

describe('Contextual goal models (#187 characterization): cost and amount, `intOf` (parseInt, else 0)', () => {
  const costOf = (value: string) => {
    const cgm = readCgmModel(
      viewOf((json) => {
        nodeOf(json, 'T3').customProperties = { cost: value };
      }),
    );
    return cgm.costOf(PISTAR('T3'));
  };
  /** Intersect(T3, T4, amount) */
  const amountOf = (edit: (link: Json) => void) => {
    const cgm = readCgmModel(viewOf((json) => edit(linkOf(json, 'T3', 'T4'))));
    return cgm.overlaps.find(
      ({ a, b }) => a === PISTAR('T3') && b === PISTAR('T4'),
    )!.amount;
  };
  const amount = (value: string) =>
    amountOf((link) => {
      link.customProperties = { amount: value };
    });

  it('reads a valid int, trimmed; 0 when unset', () => {
    for (const read of [costOf, amount])
      assert.deepStrictEqual(
        ['50', ' 50 ', '0', '-0', '150', '', '  '].map(read),
        [50, 50, 0, -0, 150, 0, 0],
      );
    assert.strictEqual(
      readCgmModel(
        viewOf((json) => {
          nodeOf(json, 'T3').customProperties = {};
        }),
      ).costOf(PISTAR('T3')),
      0,
    );
    assert.strictEqual(
      amountOf((link) => {
        delete link.customProperties;
      }),
      0,
    );
  });

  it('reads a value below its minimum as written', () => {
    // #187: invalid value (cost is min 0, amount min 1)
    assert.deepStrictEqual(['-150', '-5'].map(costOf), [-150, -5]);
    assert.deepStrictEqual(['0', '-150'].map(amount), [0, -150]);
  });

  it("reads parseInt's prefix of what isn't an int", () => {
    // #187: invalid value: '1e2' is 1, '50%' is 50, '2.5' is 2
    for (const read of [costOf, amount])
      assert.deepStrictEqual(
        ['1.0', '1e2', '2.5', '50%', '+5'].map(read),
        [1, 1, 2, 50, 5],
      );
  });

  it('reads 0 for what parseInt reads nothing of', () => {
    // #187: invalid value
    for (const read of [costOf, amount])
      assert.deepStrictEqual(
        ['.5', '0x10', 'abc', 'Infinity', '５'].map(read),
        [0, 0, 0, 0, 0],
      );
  });

  it("an IncludesLink's amount: its target's cost, read the same", () => {
    const cgm = readCgmModel(
      viewOf((json) => {
        nodeOf(json, 'T1').customProperties = { cost: '1e2' };
      }),
    );
    // #187: invalid value: T2 includes T1, '1e2' read as 1
    assert.strictEqual(
      cgm.overlaps.find(({ a, b }) => a === PISTAR('T2') && b === PISTAR('T1'))!
        .amount,
      1,
    );
  });

  it("writes Code 4 for a task whose cost isn't blank, at what intOf reads", () => {
    /** T3's cost the only one; the cost relations' amounts cleared */
    const model = (value: string) =>
      viewOf((json) => {
        for (const node of json.actors.flatMap((a: Json) => a.nodes))
          if (node.type === 'istar.Task') node.customProperties = {};
        nodeOf(json, 'T3').customProperties = { cost: value };
        for (const link of json.links)
          if (link.type.startsWith('cgm.')) link.customProperties = {};
      });
    const costLines = (value: string) =>
      reContextDlv(model(value))
        .split('\n')
        .filter((line) => line.startsWith('cost(r_t3,'));
    assert.deepStrictEqual(costLines('-5'), ['cost(r_t3,-5) :- needed(r_t3).']);
    // a blank cost: no Code 4 at all, and no resource for T3
    assert.ok(!reContextDlv(model('  ')).includes('% Code 4'));
    assert.ok(
      !reContextCosts(model('  '), [PISTAR('T3')]).includes('cost(r_t3,'),
    );
    // #187: invalid value: a cost that isn't blank is a resource, at intOf's value
    assert.deepStrictEqual(costLines('abc'), ['cost(r_t3,0) :- needed(r_t3).']);
    assert.deepStrictEqual(costLines('1e2'), ['cost(r_t3,1) :- needed(r_t3).']);
    assert.ok(
      reContextCosts(model('abc'), [PISTAR('T3')]).includes(
        'todo(t3).\ncost(r_t3,0) :- needed(r_t3).\nneeded(r_t3) :- todo(t3).\n',
      ),
    );
  });
});

describe('Contextual goal models (#187 characterization): context, activation and opposite, `formulaOf`', () => {
  const VAR = (variable: string) => ({ kind: 'var', variable });

  it("a link's context: its assertion, trimmed; none when blank", () => {
    const read = (value: string) => {
      const model = viewOf((json) => {
        linkOf(json, 'G2', 'G1').customProperties = { context: value };
      });
      return [contextAt(linkIn(model, 'G2', 'G1').properties), messages(model)];
    };
    assert.deepStrictEqual(read(' C5 '), [VAR('C5'), []]);
    assert.deepStrictEqual(read('C5 & !C6'), [
      {
        kind: 'and',
        left: VAR('C5'),
        right: { kind: 'not', expr: VAR('C6') },
      },
      [],
    ]);
    assert.deepStrictEqual(read('true'), [{ kind: 'bool', value: true }, []]);
    assert.deepStrictEqual(read(''), [null, []]);
    assert.deepStrictEqual(read('   '), [null, []]);
    // a name that is no context: read, and reported
    assert.deepStrictEqual(read('c5'), [
      VAR('c5'),
      ["G2 → G1's context names c5, which is no context"],
    ]);
    assert.deepStrictEqual(read('C99'), [
      VAR('C99'),
      ["G2 → G1's context names C99, which is no context"],
    ]);
    // #187: invalid value: unreadable, so no guard (the variant is always
    // adoptable); only cgmProblems says so
    assert.deepStrictEqual(read('C5 &'), [
      null,
      ["G2 → G1's context is not a formula: C5 &"],
    ]);
  });

  it("a root goal's activation: the same", () => {
    const read = (value: string) => {
      const model = viewOf((json) => {
        nodeOf(json, 'G1').customProperties = { activation: value };
      });
      return [
        contextAt(
          model.elements.find((e) => e.id === PISTAR('G1'))!.properties,
          'activation',
        ),
        messages(model),
      ];
    };
    assert.deepStrictEqual(read(' C5 '), [VAR('C5'), []]);
    assert.deepStrictEqual(read(''), [null, []]);
    assert.deepStrictEqual(read('   '), [null, []]);
    // #187: invalid value
    assert.deepStrictEqual(read('C5 &'), [
      null,
      ["G1's activation is not a formula: C5 &"],
    ]);
  });

  it("a contribution's sign: context and opposite blank when only whitespace; its label's otherwise", () => {
    /** G10 → SG2's sign where every context holds, and where none does */
    const sign = (properties: Record<string, string>, label?: string) => {
      const model = viewOf((json) => {
        const link = linkOf(json, 'G10', 'SG2');
        link.customProperties = properties;
        if (label === undefined) delete link.label;
        else link.label = label;
      });
      const link = linkIn(model, 'G10', 'SG2');
      return [
        contributionSign(link, () => true),
        contributionSign(link, () => false),
        messages(model),
      ];
    };
    const NEEDS_CONTEXT =
      'G10 → SG2: An opposite context needs the contribution’s own context (REJ 2010 Table 1: positively iff Ci, negatively iff Cj)';
    assert.deepStrictEqual(sign({}, 'help'), ['pos', 'pos', []]);
    assert.deepStrictEqual(sign({ context: '  ' }, 'help'), ['pos', 'pos', []]);
    assert.deepStrictEqual(sign({ context: 'C14' }, 'help'), ['pos', null, []]);
    assert.deepStrictEqual(sign({ opposite: '!C14' }, 'help'), [
      'neg',
      null,
      [NEEDS_CONTEXT],
    ]);
    assert.deepStrictEqual(sign({ context: ' ', opposite: '!C14' }, 'hurt'), [
      'pos',
      null,
      [NEEDS_CONTEXT],
    ]);
    assert.deepStrictEqual(sign({ context: 'C14', opposite: 'C14 ' }, 'make'), [
      'pos',
      null,
      [
        'G10 → SG2: The opposite context is the contribution’s own: the two labels would apply together',
      ],
    ]);
    // no iStar label, or one that isn't make or help: negative
    assert.deepStrictEqual(sign({}), ['neg', 'neg', []]);
    assert.deepStrictEqual(sign({}, 'unknown'), ['neg', 'neg', []]);
  });
});

describe('Contextual goal models (#187 characterization): the checks', () => {
  const opposite = cgmCheckRegistry['cgm.contribution.opposite'];
  const activation = cgmCheckRegistry['cgm.goal.activation'];
  const context = { self: 'l', kindOf: () => undefined };
  const SAME =
    'The opposite context is the contribution’s own: the two labels would apply together';

  it('cgm.contribution.opposite: blank is unset; the two compared as text, whitespace removed', () => {
    assert.strictEqual(opposite({ opposite: '   ' }, context), null);
    assert.strictEqual(
      opposite({ context: ' ', opposite: 'C14' }, context),
      'An opposite context needs the contribution’s own context (REJ 2010 Table 1: positively iff Ci, negatively iff Cj)',
    );
    assert.strictEqual(
      opposite({ context: 'C1&C2', opposite: 'C1 & C2' }, context),
      SAME,
    );
    // the same formula written otherwise is not the same text
    assert.strictEqual(
      opposite({ context: 'C1 & C2', opposite: 'C2 & C1' }, context),
      null,
    );
    // #187: invalid value: `C 14` isn't an assertion, but is C14 without its space
    assert.strictEqual(
      opposite({ context: 'C14', opposite: 'C 14' }, context),
      SAME,
    );
  });

  it('cgm.goal.activation: a blank activation is unset, wherever the goal is', () => {
    const elements = {
      G1: { kind: 'goal', properties: {}, children: ['G2'] },
      G2: { kind: 'goal', properties: {}, children: [] },
    };
    assert.strictEqual(
      activation({ activation: '   ' }, { ...context, self: 'G2', elements }),
      null,
    );
    assert.match(
      activation(
        { activation: ' C0 ' },
        { ...context, self: 'G2', elements },
      ) ?? '',
      /^Only a root goal has an activation context .*G2 refines G1/,
    );
  });
});
