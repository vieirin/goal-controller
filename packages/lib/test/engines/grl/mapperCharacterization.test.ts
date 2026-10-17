/**
 * GRL's properties as the mapper hands them on and the evaluation graph
 * reads them (goal-controller#187): what each value of an actor's, an
 * element's and a contribution's property becomes, now that the graph reads
 * them as the dialect does (`viewValues`; before phase 2, `pick`, `integer`
 * and the check's `Number`). Every model is grl-own's, one property
 * edited, read through `grlAnalysisModel` (the mapper) and `grlGraph`. A
 * value the dialect flags is marked `#187: invalid value`: the graph sees
 * it unset.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { linkPropertiesOf, type ValueConfig } from '@goal-controller/dialect';
import { valueProblem } from '@goal-controller/goal-language';
import {
  grl,
  grlAnalysisModel,
  grlGraph,
  type GrlGraph,
} from '../../../src/engines/grl';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const FILE = path.join(
  __dirname,
  '../../../../../examples/grl/grl-own/grl-own.txt',
);

type Json = Record<string, any>;

/** grl-own's view, edited first */
const viewOf = (edit: (json: Json) => void) => {
  const json = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  edit(json);
  return grlAnalysisModel(parsePistar(json, { fileMetamodel: true }));
};
const graphOf = (edit: (json: Json) => void): GrlGraph =>
  grlGraph(viewOf(edit));

/** the Home owner actor; its task 4 (Heat with the heat pump), goal 3 (Keep the home warm, OR-refined) */
const owner = (json: Json) => json.actors[0];
const node = (json: Json, id: string) =>
  owner(json).nodes.find((n: Json) => n.id === id);
const link = (json: Json, id: string) =>
  json.links.find((l: Json) => l.id === id);

const element = (graph: GrlGraph, id: string) =>
  graph.elements.find((e) => e.id === id)!;
/** the contribution into 2 (Low running cost) from `source` */
const contributionFrom = (graph: GrlGraph, source: string) => {
  const edge = graph.incoming
    .get('2')!
    .find((e) => e.kind === 'contribution' && e.src === source);
  return edge?.kind === 'contribution' ? edge : undefined;
};

describe('GRL (#187 characterization): what the mapper keeps', () => {
  it("keeps an actor's and a link's declared keys as written, any link kind's on any link, and drops the rest", () => {
    const view = viewOf((json) => {
      owner(json).customProperties = {
        importance: ' high',
        importanceQuantitative: '',
        foo: 'bar',
        contribution: 'Make',
      };
      link(json, '24').customProperties = {
        contribution: ' Make ',
        quantitativeContribution: '',
        correlation: 'TRUE',
        importance: 'High',
        other: 'x',
      };
      // a contribution's key on an OR refinement: the keys are every link kind's
      link(json, '20').customProperties = { contribution: 'Make' };
    });
    assert.deepStrictEqual(view.actors[0]!.properties, {
      importance: ' high',
      importanceQuantitative: '',
    });
    assert.deepStrictEqual(view.links.find((l) => l.id === '24')!.properties, {
      contribution: ' Make ',
      quantitativeContribution: '',
      correlation: 'TRUE',
    });
    assert.deepStrictEqual(view.links.find((l) => l.id === '20')!.properties, {
      contribution: 'Make',
    });
  });

  it("keeps an element's properties as written, every key (the mapper doesn't see them)", () => {
    const view = viewOf((json) => {
      node(json, '4').customProperties = { foo: ' bar ', importance: '' };
    });
    assert.deepStrictEqual(
      view.elements.find((e) => e.id === '4')!.properties,
      {
        foo: ' bar ',
        importance: '',
      },
    );
  });

  it('gives an actor and a link without custom properties none', () => {
    const view = viewOf((json) => {
      delete owner(json).customProperties;
      delete link(json, '24').customProperties;
    });
    assert.deepStrictEqual(view.actors[0]!.properties, {});
    assert.deepStrictEqual(
      view.links.find((l) => l.id === '24')!.properties,
      {},
    );
  });
});

describe('GRL (#187 characterization): importanceQuantitative and quantitativeContribution, `integer`', () => {
  const quantitative = (read: (value: string) => number, fallback: number) => {
    // valid ints (and the empty value, unset)
    assert.deepStrictEqual(['50', ' 50 ', '-0', '0', '', '  '].map(read), [
      50,
      50,
      -0,
      0,
      fallback,
      fallback,
    ]);
    // #249: changed (was read unclamped): outside its bounds (an
    // importance's 0..100, a contribution's -100..100) it is unset, the
    // default; the dialect's int check reports it
    assert.deepStrictEqual(['-150', '150', '101'].map(read), [
      fallback,
      fallback,
      fallback,
    ]);
    // #187: invalid value (not an integer to the dialect): unset, the
    // default (Number read them as 1, 100, 16, 5)
    assert.deepStrictEqual(['1.0', '1e2', '0x10', '+5'].map(read), [
      fallback,
      fallback,
      fallback,
      fallback,
    ]);
    // #187: invalid value: not an integer to Number either, the default
    assert.deepStrictEqual(
      ['.5', '2.5', '50%', 'abc', 'Infinity', '５'].map(read),
      [fallback, fallback, fallback, fallback, fallback, fallback],
    );
  };

  it("an element's: its integer, 0 when unset, no integer or out of bounds", () => {
    quantitative(
      (value) =>
        element(
          graphOf((json) => {
            node(json, '4').customProperties = {
              importanceQuantitative: value,
            };
          }),
          '4',
        ).importanceQuantitative,
      0,
    );
    assert.strictEqual(
      element(
        graphOf((json) => {
          node(json, '4').customProperties = {};
        }),
        '4',
      ).importanceQuantitative,
      0,
    );
  });

  it("an actor's: the same, through the mapper", () => {
    quantitative(
      (value) =>
        graphOf((json) => {
          owner(json).customProperties = { importanceQuantitative: value };
        }).actors[0]!.importanceQuantitative,
      0,
    );
    assert.strictEqual(
      graphOf((json) => {
        owner(json).customProperties = {};
      }).actors[0]!.importanceQuantitative,
      0,
    );
  });

  it("a contribution's weight: the same, 25 (EMF's default) when unset or no integer", () => {
    quantitative(
      (value) =>
        contributionFrom(
          graphOf((json) => {
            link(json, '24').customProperties = {
              quantitativeContribution: value,
            };
          }),
          '4',
        )!.quantitative,
      25,
    );
    assert.strictEqual(
      contributionFrom(
        graphOf((json) => {
          delete link(json, '24').customProperties;
        }),
        '4',
      )!.quantitative,
      25,
    );
  });
});

describe('GRL (#187 characterization): importance, decompositionType and contribution, `pick`', () => {
  const IMPORTANCE = ['High', 'Medium', 'Low', 'None', ''];
  // #187: invalid value: the literals were matched as written; the enum
  // reads its value trimmed (' High' is High), and no other case
  const IMPORTANCE_INVALID = ['high', 'HIGH', ' High', 'High ', 'Bogus'];
  const IMPORTANCE_READ = ['None', 'None', 'High', 'High', 'None'];

  it("an element's importance: its literal, exactly; None otherwise", () => {
    const read = (value: string) =>
      element(
        graphOf((json) => {
          node(json, '4').customProperties = { importance: value };
        }),
        '4',
      ).importance;
    assert.deepStrictEqual(IMPORTANCE.map(read), [
      'High',
      'Medium',
      'Low',
      'None',
      'None',
    ]);
    // #187: invalid value
    assert.deepStrictEqual(IMPORTANCE_INVALID.map(read), IMPORTANCE_READ);
  });

  it("an actor's importance: the same, through the mapper", () => {
    const read = (value: string) =>
      graphOf((json) => {
        owner(json).customProperties = { importance: value };
      }).actors[0]!.importance;
    assert.deepStrictEqual(IMPORTANCE.map(read), [
      'High',
      'Medium',
      'Low',
      'None',
      'None',
    ]);
    // #187: invalid value
    assert.deepStrictEqual(IMPORTANCE_INVALID.map(read), IMPORTANCE_READ);
  });

  it("a decomposition type: its literal, exactly; else its refinement links' (Or for goal 3), else And", () => {
    const read = (id: string, value?: string) =>
      element(
        graphOf((json) => {
          node(json, id).customProperties =
            value === undefined ? {} : { decompositionType: value };
        }),
        id,
      ).decompositionType;
    assert.deepStrictEqual(
      ['Xor', 'And', 'Or', ''].map((value) => read('3', value)),
      ['Xor', 'And', 'Or', 'Or'],
    );
    assert.strictEqual(read('3'), 'Or');
    // a task refined by nothing
    assert.strictEqual(read('4'), 'And');
    // #187: invalid value: unset, the links' (' Xor' is Xor, trimmed)
    assert.deepStrictEqual(
      ['xor', 'XOR', ' Xor', 'Bogus'].map((value) => read('3', value)),
      ['Or', 'Or', 'Xor', 'Or'],
    );
  });

  it("a contribution: its literal, exactly; else its iStar label's, else Help", () => {
    /** link 25 runs from 5 to 2, labelled break */
    const read = (value: string | undefined, label?: string | null) =>
      contributionFrom(
        graphOf((json) => {
          const l = link(json, '25');
          l.customProperties =
            value === undefined ? {} : { contribution: value };
          if (label === null) delete l.label;
          else if (label !== undefined) l.label = label;
        }),
        '5',
      )!.contribution;
    assert.deepStrictEqual(
      [
        'Make',
        'Help',
        'SomePositive',
        'Unknown',
        'SomeNegative',
        'Hurt',
        'Break',
      ].map((value) => read(value)),
      [
        'Make',
        'Help',
        'SomePositive',
        'Unknown',
        'SomeNegative',
        'Hurt',
        'Break',
      ],
    );
    assert.deepStrictEqual(
      [
        read(''),
        read(undefined),
        read(undefined, 'help'),
        read(undefined, null),
      ],
      ['Break', 'Break', 'Help', 'Help'],
    );
    // a label piStar doesn't have: Help
    assert.strictEqual(read(undefined, 'unknown'), 'Help');
    // #187: invalid value: unset, the label's (' Make' is Make, trimmed)
    assert.deepStrictEqual(
      ['make', 'MAKE', ' Make', 'Bogus'].map((value) => read(value)),
      ['Break', 'Break', 'Make', 'Break'],
    );
  });

  it("reads no contribution's correlation: the graph has none", () => {
    const edge = contributionFrom(
      graphOf((json) => {
        link(json, '24').customProperties = {
          contribution: 'Make',
          correlation: 'true',
        };
      }),
      '4',
    );
    assert.deepStrictEqual(Object.keys(edge!).sort(), [
      'contribution',
      'dest',
      'kind',
      'quantitative',
      'src',
    ]);
  });
});

describe('GRL (#187 characterization): a quantitative contribution, its int check', () => {
  // grl.link.quantitativeContribution went (#187): it agreed with `integer`,
  // and its range is the int's bounds; the dialect's value check says it
  const config = linkPropertiesOf(grl, 'istar.ContributionLink').find(
    (p) => p.key === 'quantitativeContribution',
  )!.value as ValueConfig;
  /** an unset value isn't checked */
  const read = (value: string | undefined) =>
    value === undefined ? null : valueProblem(config, value);

  it('accepts an integer in −100..100, trimmed, and says nothing of an unset one', () => {
    assert.deepStrictEqual(
      ['-100', '100', '0', '-0', ' 50 ', '', '   ', undefined].map(read),
      [null, null, null, null, null, null, null, null],
    );
  });

  it('rejects one out of range', () => {
    // #187: invalid value (out of range): the int's bounds (the check said
    // "A quantitative contribution is an integer, −100..100, not 150")
    assert.deepStrictEqual(['150', ' -101 '].map(read), [
      'At most 100',
      'At least -100',
    ]);
  });

  it('rejects what the int type reads as no integer, though Number did', () => {
    // #187: invalid value (the check accepted them, as `integer` read them)
    assert.deepStrictEqual(['1.0', '1e2', '0x10', '+5'].map(read), [
      'Not an integer: 1.0',
      'Not an integer: 1e2',
      'Not an integer: 0x10',
      'Not an integer: +5',
    ]);
  });

  it('rejects what Number reads as no integer, as written', () => {
    // #187: invalid value (the check's message was "… not 2.5", trimmed)
    assert.deepStrictEqual(
      ['2.5', '.5', '50%', 'abc', 'Infinity', '５', ' 2.5 '].map(read),
      [
        'Not an integer: 2.5',
        'Not an integer: .5',
        'Not an integer: 50%',
        'Not an integer: abc',
        'Not an integer: Infinity',
        'Not an integer: ５',
        'Not an integer:  2.5 ',
      ],
    );
  });
});
