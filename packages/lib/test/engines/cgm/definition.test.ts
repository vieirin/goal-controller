/**
 * The contextual goal models' dialect (goal-controller#153 item 1): its
 * kinds, link properties and checks, the model's problems, and the seeds in
 * the Notation view.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { linkPropertyKeys, propertyKeys } from '@goal-controller/dialect';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import {
  cgm,
  cgmCheckRegistry,
  cgmExtension,
  cgmMetamodelBlock,
  cgmProblems,
} from '../../../src/engines/cgm';
import { cgmEngine } from '../../../src/engines/cgm/engine';
import { SEEDS, seedModel, seedView, toy } from './support';

const elements = (
  list: Record<
    string,
    { kind: string; properties?: Record<string, string>; children?: string[] }
  >,
) =>
  Object.fromEntries(
    Object.entries(list).map(
      ([id, { kind, properties = {}, children = [] }]) => [
        id,
        { kind, properties, children },
      ],
    ),
  );
const context = (self: string, model?: Parameters<typeof elements>[0]) => ({
  self,
  kindOf: () => undefined,
  ...(model && { elements: elements(model) }),
});

describe('Contextual goal models: the definition', () => {
  it('declares the kinds, the variation points and the cost relations of #151 D2, D10, D11', () => {
    assert.deepStrictEqual(propertyKeys(cgm, 'goal'), ['activation']);
    assert.deepStrictEqual(propertyKeys(cgm, 'task'), ['cost']);
    assert.deepStrictEqual(propertyKeys(cgm, 'cgm.Context'), [
      'formula',
      'description',
    ]);
    assert.deepStrictEqual(propertyKeys(cgm, 'cgm.Statement'), ['supportedBy']);
    assert.deepStrictEqual(propertyKeys(cgm, 'cgm.Fact'), ['technology']);
    assert.deepStrictEqual(
      cgmExtension.elements.map((e) => e.kind),
      ['cgm.Context', 'cgm.Statement', 'cgm.Fact'],
    );
    assert.deepStrictEqual(
      cgmExtension.links.map((l) => [l.kind, l.rules.sameActor]),
      [
        ['cgm.IncludesLink', false],
        ['cgm.IntersectsLink', false],
      ],
    );
    assert.strictEqual(cgmMetamodelBlock().elements.length, 3);
    // a context on the five variation points' links (Table 1), the opposite on a contribution
    assert.deepStrictEqual(
      Object.entries(cgm.links ?? {}).map(([kind, list]) => [
        kind,
        list.map((p) => p.key),
      ]),
      [
        ['istar.AndRefinementLink', ['context']],
        ['istar.OrRefinementLink', ['context']],
        ['istar.DependencyLink', ['context']],
        ['istar.ContributionLink', ['context', 'opposite']],
        ['cgm.IncludesLink', []],
        ['cgm.IntersectsLink', ['amount']],
      ],
    );
    assert.deepStrictEqual(linkPropertyKeys(cgm), [
      'context',
      'opposite',
      'amount',
    ]);
    // ids (#151 D9): goals, tasks, contexts, statements and facts have lines
    assert.deepStrictEqual(
      Object.entries(cgm.elements).map(([kind, e]) => [kind, e.prefix]),
      [
        ['goal', 'G'],
        ['task', 'T'],
        ['cgm.Context', 'C'],
        ['cgm.Statement', 'ST'],
        ['cgm.Fact', 'F'],
      ],
    );
    assert.strictEqual(cgmEngine.id, 'cgm');
    assert.deepStrictEqual(Object.keys(cgm.projectResources ?? {}), [
      'situations',
      'relations',
    ]);
  });
});

describe('Contextual goal models: the checks', () => {
  const analysed = {
    C1: { kind: 'cgm.Context', properties: { formula: 'F1.1 & ST1.2' } },
    'F1.1': { kind: 'cgm.Fact' },
    'ST1.2': { kind: 'cgm.Statement', properties: { supportedBy: 'ST1 & F8' } },
    ST1: { kind: 'cgm.Statement', properties: { supportedBy: 'F1 | F3' } },
    F1: { kind: 'cgm.Fact' },
    F3: { kind: 'cgm.Fact' },
    F8: { kind: 'cgm.Fact' },
  };
  const monitorable = cgmCheckRegistry['cgm.context.monitorable'];
  const supported = cgmCheckRegistry['cgm.statement.supported'];

  it('a context whose statements are supported down to facts is monitorable (Defs. 6–7)', () => {
    assert.strictEqual(
      monitorable({ formula: 'F1.1 & ST1.2' }, context('C1', analysed)),
      null,
    );
  });

  it('reports a statement supported by nothing, a cycle, and a name that is no world predicate', () => {
    assert.strictEqual(
      monitorable(
        { formula: 'F1.1 & ST2' },
        context('C1', { ...analysed, ST2: { kind: 'cgm.Statement' } }),
      ),
      'Not monitorable (REJ 2010 Defs. 6–7): statement ST2 is supported by no formula',
    );
    assert.strictEqual(
      supported(
        { supportedBy: 'ST3' },
        context('ST2', {
          ...analysed,
          ST2: { kind: 'cgm.Statement', properties: { supportedBy: 'ST3' } },
          ST3: {
            kind: 'cgm.Statement',
            properties: { supportedBy: 'ST2 | F1' },
          },
        }),
      ),
      'Not monitorable (REJ 2010 Defs. 6–7): ST3 → ST2 → ST3 is a support cycle',
    );
    assert.strictEqual(
      monitorable(
        { formula: 'C2' },
        context('C1', { ...analysed, C2: { kind: 'cgm.Context' } }),
      ),
      'Not monitorable (REJ 2010 Defs. 6–7): C2 is neither a statement nor a fact',
    );
    // without the model, a check says nothing
    assert.strictEqual(monitorable({ formula: 'ST9' }, context('C1')), null);
  });

  it('puts an activation context on a root goal only (Table 1, kind 1)', () => {
    const tree = {
      G1: { kind: 'goal', children: ['G2'] },
      G2: { kind: 'goal' },
    };
    const activation = cgmCheckRegistry['cgm.goal.activation'];
    assert.strictEqual(
      activation({ activation: 'C0' }, context('G1', tree)),
      null,
    );
    assert.match(
      activation({ activation: 'C0' }, context('G2', tree)) ?? '',
      /^Only a root goal has an activation context .*G2 refines G1/,
    );
  });

  it("a contribution's opposite needs its context, and differs from it (#151 D10)", () => {
    const opposite = cgmCheckRegistry['cgm.contribution.opposite'];
    assert.strictEqual(
      opposite({ context: 'C14', opposite: '!C14' }, context('l')),
      null,
    );
    assert.match(
      opposite({ opposite: '!C14' }, context('l')) ?? '',
      /needs the contribution’s own context/,
    );
    assert.match(
      opposite({ context: 'C14', opposite: 'C14 ' }, context('l')) ?? '',
      /is the contribution’s own/,
    );
  });
});

describe('Contextual goal models: the model’s problems', () => {
  for (const seed of SEEDS)
    it(`${seed} has none`, () => {
      assert.deepStrictEqual(cgmProblems(seedModel(seed)), []);
    });

  it('reports an unreadable formula, a name of the wrong kind, a context off the variation points', () => {
    const model = toy(
      [
        ['G1', 'goal', { activation: 'C1 &' }],
        ['G2', 'goal'],
        ['T1', 'task'],
        ['C1', 'context', { formula: 'F1 & G2' }],
        ['F1', 'fact'],
        ['ST1', 'statement'],
      ],
      [
        ['G2', 'and', 'G1', { context: 'F1' }],
        ['T1', 'neededBy', 'G2', { context: 'C1' }],
      ],
    );
    assert.deepStrictEqual(
      cgmProblems(model).map((p) => p.message),
      [
        "G1's activation is not a formula: C1 &",
        "C1's formula names G2, which is no statement or fact",
        'C1: Not monitorable (REJ 2010 Defs. 6–7): G2 is neither a statement nor a fact',
        'ST1: a statement is supported by a formula (REJ 2010 Def. 6)',
        "G2 → G1's context names F1, which is no context",
        'T1 → G2: a NeededByLink has no context (REJ 2010 Table 1: contexts sit on AND and OR refinements, means-end, dependencies and contributions)',
      ],
    );
  });
});

describe('Contextual goal models in the Notation view', () => {
  it("writes the Fig. 13 fragment's elements, costs and contexts as lines", () => {
    const { text } = notationDocument(cgm, seedView('museum-guide-costs'));
    for (const lines of [
      'G1: visitor (v) gets informed about a piece of art (p) in museum (m)\n  G2: (v) gets info via his/her PDA\n    link G1 {context = C5}',
      '      T3: (p) info is presented to (v) via video\n        cost 60\n        link T4 {amount = 40}\n        link T5 {amount = 20}',
      '    G10: (s) gives (p) info to (v) in person\n      link SG2 {context = C14} {opposite = !C14}',
      'C14: the visitor is close to the staff member\n  description the visitor is close to the staff member',
    ])
      assert.ok(text.includes(lines), lines);
  });

  it("writes C1's context analysis (Fig. 4) as lines", () => {
    const { text } = notationDocument(cgm, seedView('museum-guide'));
    for (const lines of [
      'C1: the visitor is still inside the gallery building and is interested in the piece of art\n  formula F1.1 & ST1.2',
      'ST1.2: visitor (v) is interested in getting explanation of piece of art (p) in museum (m)\n  supportedBy ST1 & ST2 & ST3 & ST4',
      'F1.1: visitor is inside the gallery building',
      '        T17: alert (v) via PDA vibration and SMS\n          link G17 {context = !C9}',
    ])
      assert.ok(text.includes(lines), lines);
  });

  for (const seed of SEEDS)
    it(`${seed}: the document reads back to the same model`, () => {
      const view = seedView(seed);
      const { text } = notationDocument(cgm, view);
      assert.deepStrictEqual(notationEdits(cgm, text, view), []);
      // a link line to a quality is written, and read back, but the validator
      // doesn't know the quality yet: #152 item 4 (#151, green's finding)
      const model = contextFromView(cgm, view, []);
      const runCheck = (
        name: string,
        properties: Readonly<Record<string, string>>,
        self: string,
      ) =>
        cgmCheckRegistry[name as keyof typeof cgmCheckRegistry](
          properties,
          checkContextOf(model, self),
        );
      assert.deepStrictEqual(
        documentDiagnostics(cgm, text, model, { runCheck }).filter(
          (d) => !/^No element SG\d+$/.test(d.message),
        ),
        [],
      );
    });

  it('sets a link context and a cost from their lines', () => {
    const view = seedView('museum-guide-costs');
    const { text } = notationDocument(cgm, view);
    assert.deepStrictEqual(
      notationEdits(
        cgm,
        text.replace('link G1 {context = C5}', 'link G1 {context = C5 & !C6}'),
        view,
      ),
      [{ link: 'G2-OrRefinementLink-G1', key: 'context', value: 'C5 & !C6' }],
    );
    assert.deepStrictEqual(
      notationEdits(cgm, text.replace('cost 60', 'cost 65'), view),
      [{ iStarId: 'T3', key: 'cost', value: '65' }],
    );
  });
});
