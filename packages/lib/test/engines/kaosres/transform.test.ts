/**
 * kaosres's transformations (goal-controller#191 part A, #202): one per
 * TSE'00 strategy and per countermeasure form, on a hand-written model.
 *
 * Root is refined into A and B; A Fails (an OR of Lost, 20 %, and Late,
 * 10 %) obstructs A, B Fails (30 %) obstructs B: EPS(A) = 0.72, EPS(B) =
 * 0.7, EPS(Root) = 0.504. Each test puts Lost at 1, so A fails for sure
 * (EPS(Root) 0) until the countermeasure resolving Lost is applied: the
 * oracle (#202) is that Lost no longer obstructs, under RE'12 propagation.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar, validateModel } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readKaos } from '../../../src/importers/kaos';
import { propagateProbabilities } from '../../../src/engines/kaosprop';
import {
  applyCountermeasures,
  applyCountermeasuresToView,
  countermeasuresOf,
  kaosresView,
  type ApplyOptions,
  type KaosModel,
} from '../../../src/engines/kaosres';

const BASE = `
declare goal [ root ] name "Achieve [Root]" refinedby a, b end
declare goal [ a ] name "Achieve [A]" obstructedby a_fails end
declare goal [ b ] name "Achieve [B]" obstructedby b_fails end
declare obstacle [ a_fails ] name "A Fails" refinedby lost refinedby late end
declare obstacle [ lost ] name "Lost" probability 1 end
declare obstacle [ late ] name "Late" probability 0.1 end
declare obstacle [ b_fails ] name "B Fails" probability 0.3 end
declare goal [ cm ] name "Achieve [Countermeasure]" end
`;

/** The base model, Lost resolved by `cm` as `resolution` says, and anything else. */
const modelOf = (resolution: string, more = ''): KaosModel => {
  const { model, diagnostics } = readKaos(
    `${BASE}override obstacle [ lost ] ${resolution} end\n${more}`,
  );
  assert.ok(model, JSON.stringify(diagnostics));
  return parsePistar(model, { metamodel: KAOS_OBSTACLES });
};

/** Every countermeasure of the model, applied. */
const applied = (model: KaosModel, options?: ApplyOptions) =>
  applyCountermeasures(
    model,
    countermeasuresOf(model).map((c) => c.id),
    options,
  );

const eps = (model: KaosModel, id: string) =>
  propagateProbabilities(kaosresView(model)).probabilities.get(id)!;
const near = (actual: number, expected: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${what}: ${actual} is not ${expected}`,
  );
const childrenOf = (model: KaosModel, parent: string) =>
  [...model.links.values()]
    .filter(
      (l) =>
        l.kind === 'kaos.RefinementLinkEnd' &&
        l.target === parent &&
        model.elements.has(l.source),
    )
    .map((end) =>
      [...model.links.values()]
        .filter(
          (l) =>
            l.kind === 'kaos.RefinementLinkStart' && l.target === end.source,
        )
        .map((l) => l.source),
    );
const obstructorsOf = (model: KaosModel, goal: string) =>
  [...model.links.values()]
    .filter(
      (l) => l.kind === 'kaosObstacles.ObstructionLink' && l.target === goal,
    )
    .map((l) => l.source);
const subObstaclesOf = (model: KaosModel, obstacle: string) =>
  [...model.links.values()]
    .filter(
      (l) =>
        l.kind === 'kaosObstacles.ObstacleRefinementLinkEnd' &&
        l.target === obstacle,
    )
    .map((end) =>
      [...model.links.values()]
        .filter(
          (l) =>
            l.kind === 'kaosObstacles.ObstacleRefinementLinkStart' &&
            l.target === end.source,
        )
        .map((l) => l.source),
    );

/** The variant is a model istar-ts validates, and nothing it says is an error. */
const valid = (variant: ReturnType<typeof applied>) => {
  assert.deepStrictEqual(variant.problems, []);
  assert.deepStrictEqual(validateModel(variant.model), []);
};

describe('kaosres: the hand-written model, as it is', () => {
  it('Lost at 1 leaves Root unsatisfied (EPS 0), and at .2 gives 0.504', () => {
    const model = modelOf('resolvedby cm');
    near(eps(model, 'root'), 0, 'Root, Lost at 1');
    const { model: base } = readKaos(
      BASE.replace('probability 1', 'probability 0.2'),
    );
    near(
      eps(parsePistar(base!, { metamodel: KAOS_OBSTACLES }), 'root'),
      0.504,
      'Root, Lost at .2',
    );
  });

  it('reads each resolution as a countermeasure, in kaosres’s dialect', () => {
    const model = modelOf(
      'resolvedby [mitigation:a] cm',
      'declare goal [ cm ] cost [lost] 3 end',
    );
    assert.deepStrictEqual(countermeasuresOf(model), [
      {
        id: 'cm-resolves-lost',
        goal: 'cm',
        obstacle: 'lost',
        strategy: 'obstacle mitigation',
        form: null,
        anchor: 'a',
        replaces: null,
        condition: null,
        cost: 3,
      },
    ]);
  });
});

describe('kaosres: the substitution schema (goal substitution, agent substitution, goal deidealization)', () => {
  for (const [pattern, strategy] of [
    ['substitution', 'goal substitution'],
    ['"agent substitution"', 'agent substitution'],
    ['weakening', 'goal deidealization'],
  ] as const)
    it(`${strategy}: CG takes the obstructed sub-goal's place in the anchor's refinement`, () => {
      const variant = applied(modelOf(`resolvedby [${pattern}:root] cm`));
      valid(variant);
      assert.strictEqual(variant.applied[0]!.integration, 'substitute');
      assert.deepStrictEqual(childrenOf(variant.model, 'root'), [['b', 'cm']]);
      // A stays, a root of its own, still obstructed: it no longer counts
      near(eps(variant.model, 'a'), 0, 'A');
      near(eps(variant.model, 'root'), 0.7, 'Root: B × CG');
    });

  it('with no Anchor, the obstructed goal’s parent is the anchor', () => {
    const variant = applied(modelOf('resolvedby [substitution] cm'));
    valid(variant);
    assert.deepStrictEqual(variant.applied[0]!.at, ['root']);
    near(eps(variant.model, 'root'), 0.7, 'Root');
  });

  it('anchored on the obstructed leaf itself: CG, its weakened version, takes its place (KAOSTools refuses it)', () => {
    const variant = applied(modelOf('resolvedby [weakening:a] cm'));
    valid(variant);
    assert.deepStrictEqual(variant.applied[0]!.at, ['root']);
    assert.deepStrictEqual(childrenOf(variant.model, 'root'), [['cm', 'b']]);
    near(eps(variant.model, 'root'), 0.7, 'Root');
  });

  it('refuses an anchor with two refinements (KAOSTools’ rule), and leaves the model as it was', () => {
    const model = modelOf(
      'resolvedby [substitution:root] cm',
      'override goal [ root ] refinedby b end',
    );
    const variant = applied(model);
    assert.deepStrictEqual(
      variant.problems.map((p) => p.message),
      [
        "cm resolving lost isn't applied: its anchor root has 2 refinements: it substitutes in one",
      ],
    );
    assert.deepStrictEqual(
      [...variant.model.links.keys()],
      [...model.links.keys()],
    );
    assert.strictEqual(variant.applied.length, 0);
  });
});

describe('kaosres: the anchoring schema (prevention, reduction, mitigation, restoration)', () => {
  for (const [pattern, strategy] of [
    ['prevention', 'obstacle prevention'],
    ['obstacle_reduction', 'obstacle reduction'],
    ['restoration', 'goal restoration'],
    ['mitigation', 'obstacle mitigation'],
    ['weak_mitigation', 'weak mitigation'],
  ] as const)
    it(`${strategy}: the obstructed goal is refined into itself unless Lost, and CG`, () => {
      const model = modelOf(`resolvedby [${pattern}] cm`);
      const variant = applied(model);
      valid(variant);
      assert.strictEqual(variant.applied[0]!.countermeasure.strategy, strategy);
      assert.strictEqual(variant.applied[0]!.integration, 'anchor');
      assert.deepStrictEqual(variant.applied[0]!.at, ['a']);
      const [kept] = variant.applied[0]!.added;
      assert.strictEqual(kept, 'a-unless-lost');
      assert.strictEqual(
        variant.model.elements.get(kept!)!.name,
        'Achieve [A] unless Lost',
      );
      assert.deepStrictEqual(childrenOf(variant.model, 'a'), [
        ['a-unless-lost', 'cm'],
      ]);
      // A Fails, used by A only, is cut in place: Late is all that is left
      assert.deepStrictEqual(obstructorsOf(variant.model, 'a-unless-lost'), [
        'a_fails',
      ]);
      assert.deepStrictEqual(subObstaclesOf(variant.model, 'a_fails'), [
        ['late'],
      ]);
      // Lost stays, with its resolution, and obstructs nothing
      assert.ok(variant.model.elements.has('lost'));
      near(eps(variant.model, 'a'), 0.9, 'A: (1 − Late) × CG');
      near(eps(variant.model, 'root'), 0.63, 'Root');
      // the model given is untouched
      assert.deepStrictEqual(subObstaclesOf(model, 'a_fails'), [
        ['lost'],
        ['late'],
      ]);
    });

  it('strong mitigation, anchored on Root (the obstructed goal’s parent): Root refined into Root unless Lost, and CG', () => {
    const variant = applied(modelOf('resolvedby [strong_mitigation:root] cm'));
    valid(variant);
    assert.deepStrictEqual(childrenOf(variant.model, 'root'), [
      ['root-unless-lost', 'cm'],
    ]);
    // A is cut in place too (only Root used it): its id and name stay
    assert.deepStrictEqual(childrenOf(variant.model, 'root-unless-lost'), [
      ['a', 'b'],
    ]);
    assert.strictEqual(variant.model.elements.get('a')!.name, 'Achieve [A]');
    near(eps(variant.model, 'root'), 0.63, 'Root');
  });

  it('below the anchor only: a goal outside it that Lost obstructs still sees Lost; with the model scope it doesn’t', () => {
    const model = modelOf(
      'resolvedby [prevention:a] cm',
      'declare goal [ c ] name "Achieve [C]" obstructedby a_fails end',
    );
    const below = applied(model);
    valid(below);
    // A Fails is C's too: its copy, without Lost, is A's
    const copy = obstructorsOf(below.model, 'a-unless-lost')[0]!;
    assert.notStrictEqual(copy, 'a_fails');
    assert.strictEqual(
      below.model.elements.get(copy)!.name,
      'A Fails unless Lost',
    );
    assert.deepStrictEqual(subObstaclesOf(below.model, 'a_fails'), [
      ['lost'],
      ['late'],
    ]);
    near(eps(below.model, 'c'), 0, 'C, anchor scope');
    near(eps(below.model, 'a'), 0.9, 'A, anchor scope');

    const everywhere = applied(model, { scope: 'model' });
    valid(everywhere);
    // KAOSTools' Resolved: Lost cannot occur; A's content moves to K as it is
    assert.strictEqual(
      everywhere.model.elements.get('lost')!.customProperties!.Probability,
      '0',
    );
    assert.deepStrictEqual(obstructorsOf(everywhere.model, 'a-unless-lost'), [
      'a_fails',
    ]);
    near(eps(everywhere.model, 'c'), 0.9, 'C, model scope');
    near(eps(everywhere.model, 'a'), 0.9, 'A, model scope');
  });

  it('two countermeasures on one anchor nest: each adds its goal', () => {
    const variant = applied(
      modelOf(
        'resolvedby [prevention:a] cm resolvedby [restoration:a] cm2',
        'declare goal [ cm2 ] esr .5 end',
      ),
    );
    valid(variant);
    assert.strictEqual(variant.applied.length, 2);
    near(eps(variant.model, 'a'), 0.45, 'A: (1 − Late) × CG × CG2');
  });

  it('a refined obstacle resolved: its obstruction goes', () => {
    const variant = applied(
      modelOf(
        '',
        'override obstacle [ a_fails ] resolvedby [prevention] cm end',
      ),
    );
    valid(variant);
    assert.deepStrictEqual(
      obstructorsOf(variant.model, 'a-unless-a_fails'),
      [],
    );
    near(eps(variant.model, 'a'), 1, 'A');
  });
});

describe('kaosres: domain transformation and do-nothing', () => {
  it('domain transformation: Lost cannot occur, anywhere (its estimate 0)', () => {
    const variant = applied(modelOf('resolvedby ["domain transformation"] cm'));
    valid(variant);
    assert.strictEqual(variant.applied[0]!.integration, 'eliminate');
    assert.strictEqual(
      variant.model.elements.get('lost')!.customProperties!.Probability,
      '0',
    );
    near(eps(variant.model, 'root'), 0.63, 'Root');
  });

  it('domain transformation of a refined obstacle: each refinement’s P(O|SO) is 0', () => {
    const variant = applied(
      modelOf(
        '',
        'override obstacle [ a_fails ] resolvedby ["domain transformation"] cm end',
      ),
    );
    valid(variant);
    near(eps(variant.model, 'a_fails'), 0, 'A Fails');
    near(eps(variant.model, 'root'), 0.7, 'Root');
  });

  it('do-nothing: the model as it was, the decision recorded', () => {
    const model = modelOf('resolvedby ["do-nothing"] cm');
    const variant = applied(model);
    valid(variant);
    assert.strictEqual(variant.applied[0]!.integration, 'record');
    assert.deepStrictEqual(variant.model.elements, model.elements);
    assert.deepStrictEqual(variant.model.links, model.links);
    near(eps(variant.model, 'root'), 0, 'Root');
  });
});

describe('kaosres: the countermeasure forms (KAOSTools’ annotations)', () => {
  it('except [lost] cm on A: the anchoring schema, at A', () => {
    const variant = applied(
      modelOf('', 'override goal [ a ] except [lost] cm end'),
    );
    valid(variant);
    assert.strictEqual(variant.applied[0]!.integration, 'anchor');
    assert.deepStrictEqual(variant.applied[0]!.at, ['a']);
    near(eps(variant.model, 'root'), 0.63, 'Root');
  });

  it('replaces [lost] a on CG: CG in A’s place', () => {
    const variant = applied(
      modelOf('', 'override goal [ cm ] replaces [lost] a end'),
    );
    valid(variant);
    assert.strictEqual(variant.applied[0]!.integration, 'replace');
    assert.deepStrictEqual(childrenOf(variant.model, 'root'), [['cm', 'b']]);
    near(eps(variant.model, 'root'), 0.7, 'Root');
  });

  for (const word of ['provided', 'providednot', 'relaxedTo'])
    it(`${word} [lost] …  on A: A deidealized in place, Lost no longer obstructs it`, () => {
      const variant = applied(
        modelOf('', `override goal [ a ] ${word} [lost] notLost() end`),
      );
      valid(variant);
      assert.strictEqual(variant.applied[0]!.integration, 'deidealize');
      assert.deepStrictEqual(obstructorsOf(variant.model, 'a'), ['a_fails']);
      assert.deepStrictEqual(subObstaclesOf(variant.model, 'a_fails'), [
        ['late'],
      ]);
      assert.strictEqual(variant.model.elements.get('a')!.name, 'Achieve [A]');
      near(eps(variant.model, 'root'), 0.63, 'Root');
    });
});

describe('kaosres: what isn’t applied, and the cost', () => {
  const messages = (variant: ReturnType<typeof applied>) =>
    variant.problems.map((p) => p.message);

  it('says why: no strategy, an anchor naming nothing, a replaces naming nothing, a goal the obstacle doesn’t reach', () => {
    assert.deepStrictEqual(messages(applied(modelOf('resolvedby cm'))), [
      "cm resolving lost isn't applied: it has no ResolutionType and no Form: nothing says what it does",
    ]);
    assert.deepStrictEqual(
      messages(applied(modelOf('resolvedby [prevention:nowhere] cm'))),
      ["cm resolving lost isn't applied: its Anchor nowhere names no goal"],
    );
    assert.deepStrictEqual(
      messages(
        applied(modelOf('', 'override goal [ b ] provided [lost] x() end')),
      ),
      ["b resolving lost isn't applied: Lost doesn't obstruct Achieve [B]"],
    );
    assert.deepStrictEqual(
      messages(
        applied(
          modelOf('', 'override goal [ cm ] replaces [lost] nowhere end'),
        ),
      ),
      [
        "cm resolving lost isn't applied: nowhere is no sub-goal: nothing to replace it in",
      ],
    );
    assert.deepStrictEqual(
      messages(
        applyCountermeasures(modelOf('resolvedby [prevention] cm'), [
          'nothing',
        ]),
      ),
      ['nothing is no resolution of the model'],
    );
  });

  it('warns, and applies it, when the obstacle obstructs nothing below its anchor', () => {
    const variant = applied(modelOf('resolvedby [prevention:b] cm'));
    assert.deepStrictEqual(
      variant.problems.map((p) => [p.severity, p.message]),
      [
        [
          'warning',
          'cm resolving lost: Lost obstructs nothing below Achieve [B]: Achieve [Countermeasure] is added to it, nothing is resolved',
        ],
      ],
    );
    assert.deepStrictEqual(childrenOf(variant.model, 'b'), [
      ['b-unless-lost', 'cm'],
    ]);
  });

  it('applies only the selection, and sums its costs (SEAMS’17’s resolution cost)', () => {
    const model = modelOf(
      'resolvedby [prevention:a] cm',
      `declare goal [ cm ] cost [lost] 2 end
override obstacle [ b_fails ] resolvedby [prevention] cm_b end
declare goal [ cm_b ] cost 3 end`,
    );
    assert.strictEqual(applied(model).cost, 5);
    const one = applyCountermeasures(model, ['cm_b-resolves-b_fails']);
    assert.strictEqual(one.cost, 3);
    near(eps(one.model, 'root'), 0, 'Root: Lost still at 1');
    near(eps(one.model, 'b'), 1, 'B');
  });

  it('the view adapter gives what the model does (part B’s enumeration)', () => {
    const model = modelOf('resolvedby [prevention] cm');
    const { view, applied: done } = applyCountermeasuresToView(
      kaosresView(model),
      ['cm-resolves-lost'],
    );
    assert.strictEqual(done.length, 1);
    near(propagateProbabilities(view).probabilities.get('root')!, 0.63, 'Root');
    assert.throws(
      () =>
        applyCountermeasuresToView(
          {
            actors: [],
            elements: [
              { id: 'g', kind: 'istar.Goal', name: 'G', properties: {} },
            ],
            links: [],
          },
          [],
        ),
      /istar\.Goal is no KAOS element kind/,
    );
  });
});
