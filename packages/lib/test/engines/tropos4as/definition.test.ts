/**
 * Tropos4AS's definition, its checks and the model's problems
 * (goal-controller#136 item 1, #134 D4).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { checkOnKey } from '../../support/checkOn';
import { tropos4as as TROPOS4AS } from '../../../src/engines/tropos4as/definition';
import { propertyKeys } from '@goal-controller/dialect';
import {
  readTropos4asModel,
  tropos4as,
  tropos4asCheckRegistry,
  tropos4asExtension,
  tropos4asMetamodelBlock,
  tropos4asProblems,
} from '../../../src/engines/tropos4as';
import { tropos4asEngine } from '../../../src/engines/tropos4as/engine';
import { toy } from './toy';

const context = { self: 'G', kindOf: () => undefined };
const problems = (...args: Parameters<typeof toy>) =>
  tropos4asProblems(readTropos4asModel(toy(...args))).map(
    (p) => `${p.severity}: ${p.message}`,
  );

describe('Tropos4AS: the definition', () => {
  it('declares the goal types, the conditions and the kinds of #134 D2', () => {
    assert.deepStrictEqual(propertyKeys(tropos4as, 'goal'), [
      'type',
      'creation',
      'achievement',
      'failure',
      'onFailure',
      'maintain',
      'target',
      'drop',
      'precondition',
    ]);
    assert.deepStrictEqual(
      tropos4asExtension.elements.map((e) => e.kind),
      [
        'tropos4as.Artifact',
        'tropos4as.Failure',
        'tropos4as.Error',
        'tropos4as.Symptom',
      ],
    );
    assert.deepStrictEqual(
      tropos4asExtension.links.map((l) => l.kind),
      [
        'tropos4as.InhibitsLink',
        'tropos4as.SequenceLink',
        'tropos4as.FailureLink',
        'tropos4as.ErrorLink',
        'tropos4as.ReadsLink',
        'tropos4as.SymptomLink',
      ],
    );
    // an error is reached by a means-end as a goal is
    assert.strictEqual(
      tropos4asExtension.elements.find((e) => e.kind === 'tropos4as.Error')
        ?.behavesLike,
      'istar.Goal',
    );
    assert.strictEqual(tropos4asMetamodelBlock().links.length, 6);
    // every link kind it reads is declared (no properties), so a selected link is inspected
    assert.deepStrictEqual(Object.keys(tropos4as.links ?? {}), [
      'istar.AndRefinementLink',
      'istar.OrRefinementLink',
      'istar.ContributionLink',
      'istar.DependencyLink',
      ...tropos4asExtension.links
        .map((l) => l.kind)
        .filter(
          (kind) =>
            kind !== 'tropos4as.ReadsLink' && kind !== 'tropos4as.SymptomLink',
        ),
      'tropos4as.ReadsLink',
      'tropos4as.SymptomLink',
    ]);
    assert.strictEqual(tropos4asEngine.id, 'tropos4as');
  });

  it('a perform-goal evaluates no condition (§4.3.1, an error)', () => {
    const check = checkOnKey(
      TROPOS4AS,
      { element: 'goal' },
      'achievement',
      tropos4asCheckRegistry['tropos4as.goal.perform'],
    );
    assert.match(
      check({ type: 'perform', achievement: 'x', creation: 'y' }, context) ??
        '',
      /remove achievement, or make it/,
    );
    assert.strictEqual(
      check({ type: 'perform', creation: 'y' }, context),
      null,
    );
    assert.strictEqual(check({ achievement: 'x' }, context), null);
  });

  it('a target needs its maintain condition (M(m, t, d), §4.3.3)', () => {
    const check = checkOnKey(
      TROPOS4AS,
      { element: 'goal' },
      'target',
      tropos4asCheckRegistry['tropos4as.goal.target'],
    );
    assert.ok(check({ type: 'maintain', target: 't > 2' }, context));
    assert.strictEqual(
      check({ type: 'maintain', maintain: 't > 1', target: 't > 2' }, context),
      null,
    );
  });

  it("an artifact's attributes are name:type, a bool, a number or options", () => {
    const check = checkOnKey(
      TROPOS4AS,
      { element: 'tropos4as.Artifact' },
      'attributes',
      tropos4asCheckRegistry['tropos4as.artifact.attributes'],
    );
    assert.strictEqual(
      check(
        { attributes: 'clean:bool, level:number, n:int, mode:wet|dry' },
        context,
      ),
      null,
    );
    assert.match(
      check({ attributes: 'clean:boolean, level:numbr' }, context) ?? '',
      /not clean:boolean, level:numbr/,
    );
    // a pair without its type is no pairList: the value check's (#187)
    assert.strictEqual(
      check({ attributes: 'clean:boolean, level' }, context),
      null,
    );
  });
});

describe('Tropos4AS: the model as a whole', () => {
  it('warns of a creation condition below a root (fn. 1) and a maintain-goal under an achieve-goal (§4.4)', () => {
    assert.deepStrictEqual(
      problems(
        [
          ['R', 'goal', { achievement: 'done' }],
          ['M', 'goal', { type: 'maintain', maintain: 'ok', creation: 'x' }],
        ],
        [['M', 'and', 'R']],
      ),
      [
        "warning: M refines R: a creation condition is for root goals (AAMAS 2009 fn. 1), and the lifecycle doesn't read it",
        'warning: M is a maintain-goal under the achieve-goal R: it is suspended, never dropped, so R never hears from it (AAMAS 2009 §4.4)',
      ],
    );
  });

  it('rejects a perform-goal with a condition, a maintain-goal without m, an error without one', () => {
    // an unreadable condition is unset: the value check's (#187), so Q is
    // none of these
    const found = problems([
      ['P', 'goal', { type: 'perform', failure: 'x' }],
      ['Q', 'goal', { achievement: 'a <' }],
      ['M', 'goal', { type: 'maintain' }],
      ['E', 'error'],
    ]);
    const expected = [
      /^error: P: A perform-goal evaluates no condition/,
      /^error: M is a maintain-goal without its maintain condition/,
      /^error: E has no condition/,
    ];
    assert.strictEqual(found.length, expected.length, found.join('\n'));
    expected.forEach((pattern, i) => assert.match(found[i]!, pattern));
  });

  it('rejects an inhibition or sequence cycle, a link across actors, AND and OR together', () => {
    assert.deepStrictEqual(
      problems(
        [
          ['A', 'goal'],
          ['B', 'goal'],
          ['C', 'goal', {}, 'other'],
          ['X', 'goal'],
          ['T1', 'task'],
          ['T2', 'task'],
        ],
        [
          ['A', 'inhibits', 'B'],
          ['B', 'inhibits', 'A'],
          ['A', 'sequence', 'C'],
          ['T1', 'and', 'X'],
          ['T2', 'or', 'X'],
        ],
      ),
      [
        'error: X is refined with AND and OR links: a goal is AND- or OR-decomposed (AAMAS 2009 §4.2)',
        'error: A and C are in different actors: a sequence link joins goals of one actor',
        'error: Inhibition cycle: A → B → A',
      ],
    );
  });
});
