/**
 * AAMAS 2009 §4.2's transition rules, each in isolation: the rule fires
 * when its premises hold and not when one of them doesn't
 * (goal-controller#136 item 7). The goals are built on hand-written
 * condition–action sets, so each premise is set on its own.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  CONDITION_RULES,
  mayAdopt,
  nextTransition,
  subgoalTransition,
  type GoalInstance,
} from '../../../src/engines/tropos4as/lifecycle/architecture';
import type { Beliefs } from '../../../src/engines/tropos4as/lifecycle/conditions';
import type { Pair } from '../../../src/engines/tropos4as/lifecycle/instantiations';
import {
  RULES,
  type Action,
  type GoalState,
} from '../../../src/engines/tropos4as/vocabulary';

/** ⟨c, action⟩ with c the belief `name` */
const pair = (action: Action, name = action): Pair => ({
  condition: { text: name, holds: (b) => b.get(name) === true },
  action,
});

const goal = (
  state: GoalState,
  gamma: string[],
  sets: { E?: Pair[]; C?: Pair[] },
  relation: 'AND' | 'OR' = 'AND',
): GoalInstance => ({
  state,
  gamma,
  relation,
  instantiation: { name: 'test', E: sets.E ?? [], C: sets.C ?? [] },
});

const believe = (...names: string[]): Beliefs =>
  new Map(names.map((name) => [name, true]));

const NOTHING = () => ['x', 'y'];

/** The rule that fires, its state and Γ; or null. */
const fire = (g: GoalInstance, beliefs: Beliefs) => {
  const t = nextTransition(g, beliefs, NOTHING);
  return (
    t && { rule: t.rule, state: t.state, gamma: t.gamma, dropped: t.dropped }
  );
};

describe('Tropos4AS: AAMAS 2009 §4.2, one rule at a time', () => {
  it('names every rule of the paper, and defines each condition rule once', () => {
    const named = CONDITION_RULES.map((rule) => rule.name);
    assert.strictEqual(new Set(named).size, named.length);
    for (const name of named) assert.ok(RULES.includes(name), name);
  });

  describe('4.2.1 activation', () => {
    it('[activateC]: Γ ≠ ∅, ⟨c, Activate⟩ ∈ C, B |= c: Suspended → AD, Γ kept', () => {
      const g = goal('Suspended', ['x'], { C: [pair('Activate')] });
      assert.deepStrictEqual(fire(g, believe('Activate')), {
        rule: 'activateC',
        state: 'AD',
        gamma: ['x'],
        dropped: undefined,
      });
      assert.strictEqual(fire(g, believe()), null);
    });

    it('[activateE]: Γ = ∅, ⟨c, Activate⟩ ∈ E, B |= c: Suspended → AD', () => {
      const g = goal('Suspended', [], { E: [pair('Activate')] });
      assert.strictEqual(fire(g, believe('Activate'))?.rule, 'activateE');
      assert.strictEqual(fire(g, believe()), null);
      // a pair in C is not read with Γ = ∅
      assert.strictEqual(
        fire(
          goal('Suspended', [], { C: [pair('Activate')] }),
          believe('Activate'),
        ),
        null,
      );
    });
  });

  describe('4.2.2 subgoal achievement', () => {
    it('[deliberateE]: AD, Γ = ∅ → AU, Γ = deliberate(g, B)', () => {
      assert.deepStrictEqual(fire(goal('AD', [], {}), believe()), {
        rule: 'deliberateE',
        state: 'AU',
        gamma: ['x', 'y'],
        dropped: undefined,
      });
    });

    it('[deliberateC]: AD, Γ ≠ ∅ → AU, Γ kept (no deliberation)', () => {
      assert.deepStrictEqual(fire(goal('AD', ['y'], {}), believe())?.gamma, [
        'y',
      ]);
      assert.strictEqual(
        fire(goal('AD', ['y'], {}), believe())?.rule,
        'deliberateC',
      );
    });

    it('adopting a subgoal needs ¬∃⟨c, a⟩ ∈ C . B |= c ∧ a ∈ {Fail, Succeed}', () => {
      const g = goal('AU', ['x'], { C: [pair('Fail'), pair('Succeed')] });
      assert.ok(mayAdopt(g, believe()));
      assert.ok(!mayAdopt(g, believe('Fail')));
      assert.ok(!mayAdopt(g, believe('Succeed')));
      assert.ok(!mayAdopt(goal('AU', [], {}), believe()), 'Γ = ∅');
      assert.ok(!mayAdopt(goal('AS', ['x'], {}), believe()), 'not in AU');
    });

    it('[AND:subg-achieve]: B′ |= success(γ): stays in AU, γ leaves Γ', () => {
      assert.deepStrictEqual(
        subgoalTransition(goal('AU', ['x', 'y'], {}), 'x', 'success'),
        { rule: 'AND:subg-achieve', state: 'AU', gamma: ['y'] },
      );
    });

    it('[AND:subg-fail]: B′ |= failure(γ): AU → AF', () => {
      assert.deepStrictEqual(
        subgoalTransition(goal('AU', ['x', 'y'], {}), 'x', 'failure'),
        { rule: 'AND:subg-fail', state: 'AF', gamma: ['y'] },
      );
    });

    it('[OR:subg-achieve]: B′ |= failure(γ): stays in AU', () => {
      assert.deepStrictEqual(
        subgoalTransition(goal('AU', ['x', 'y'], {}, 'OR'), 'x', 'failure'),
        { rule: 'OR:subg-achieve', state: 'AU', gamma: ['y'] },
      );
    });

    it('[OR:subg-succeed]: B′ |= success(γ): AU → AS', () => {
      assert.deepStrictEqual(
        subgoalTransition(goal('AU', ['x', 'y'], {}, 'OR'), 'x', 'success'),
        { rule: 'OR:subg-succeed', state: 'AS', gamma: ['y'] },
      );
    });

    it('[AND:subg-succeed]: AU, Γ = ∅, ¬∃⟨c, Fail⟩ ∈ E with B |= c → AS', () => {
      const g = goal('AU', [], { E: [pair('Fail')] });
      assert.strictEqual(fire(g, believe())?.rule, 'AND:subg-succeed');
      assert.strictEqual(fire(g, believe())?.state, 'AS');
      // a true Fail: the failure wins ([cond-failE])
      assert.strictEqual(fire(g, believe('Fail'))?.rule, 'cond-failE');
    });

    it('[OR:subg-fail]: AU, Γ = ∅, ¬∃⟨c, Succeed⟩ ∈ E with B |= c → AF', () => {
      const g = goal('AU', [], { E: [pair('Succeed')] }, 'OR');
      assert.strictEqual(fire(g, believe())?.rule, 'OR:subg-fail');
      assert.strictEqual(fire(g, believe())?.state, 'AF');
      // a true Succeed: §5's step 6, [cond-succeedE] instead
      assert.strictEqual(fire(g, believe('Succeed'))?.rule, 'cond-succeedE');
    });
  });

  describe('4.2.3 success and failure by conditions', () => {
    it('[cond-succeedC]: X ∈ {AU, AS}, Γ ≠ ∅, Succeed true, no Fail true → AS', () => {
      const g = goal('AU', ['x'], { C: [pair('Succeed'), pair('Fail')] });
      assert.deepStrictEqual(fire(g, believe('Succeed')), {
        rule: 'cond-succeedC',
        state: 'AS',
        gamma: ['x'],
        dropped: undefined,
      });
      // both true: failure conditions have precedence
      assert.strictEqual(
        fire(g, believe('Succeed', 'Fail'))?.rule,
        'cond-failC',
      );
      // from AS to AS it would change nothing: it doesn't fire
      assert.strictEqual(
        fire(goal('AS', ['x'], { C: [pair('Succeed')] }), believe('Succeed')),
        null,
      );
    });

    it('[cond-failC]: X ∈ {AU, AS}, Γ ≠ ∅, ⟨c, Fail⟩ ∈ C, B |= c → AF, Γ kept', () => {
      for (const state of ['AU', 'AS'] as const) {
        const t = fire(
          goal(state, ['x'], { C: [pair('Fail')] }),
          believe('Fail'),
        );
        assert.deepStrictEqual(
          [t?.rule, t?.state, t?.gamma],
          ['cond-failC', 'AF', ['x']],
        );
      }
      assert.strictEqual(
        fire(goal('AU', ['x'], { C: [pair('Fail')] }), believe()),
        null,
      );
    });

    it('[cond-succeedE]: AU, Γ = ∅, Succeed ∈ E true, no Fail true → AS', () => {
      const g = goal('AU', [], { E: [pair('Succeed'), pair('Fail')] }, 'OR');
      assert.strictEqual(fire(g, believe('Succeed'))?.rule, 'cond-succeedE');
      assert.strictEqual(
        fire(g, believe('Succeed', 'Fail'))?.rule,
        'cond-failE',
      );
    });

    it('[cond-failE]: AU, Γ = ∅, ⟨c, Fail⟩ ∈ E, B |= c → AF', () => {
      const t = fire(goal('AU', [], { E: [pair('Fail')] }), believe('Fail'));
      assert.deepStrictEqual([t?.rule, t?.state], ['cond-failE', 'AF']);
    });
  });

  describe('4.2.4 dropping', () => {
    it('[drop-successC] and [drop-successE]: from AS, success(g)', () => {
      const c = fire(
        goal('AS', ['x'], { C: [pair('DropSuccess')] }),
        believe('DropSuccess'),
      );
      assert.deepStrictEqual(
        [c?.rule, c?.dropped],
        ['drop-successC', 'success'],
      );
      const e = fire(
        goal('AS', [], { E: [pair('DropSuccess')] }),
        believe('DropSuccess'),
      );
      assert.deepStrictEqual(
        [e?.rule, e?.dropped],
        ['drop-successE', 'success'],
      );
      assert.strictEqual(
        fire(goal('AS', [], { E: [pair('DropSuccess')] }), believe()),
        null,
      );
    });

    it('[drop-failureC] and [drop-failureE]: from AF, failed(g)', () => {
      const c = fire(
        goal('AF', ['x'], { C: [pair('DropFailure')] }),
        believe('DropFailure'),
      );
      assert.deepStrictEqual(
        [c?.rule, c?.dropped],
        ['drop-failureC', 'failed'],
      );
      const e = fire(
        goal('AF', [], { E: [pair('DropFailure')] }),
        believe('DropFailure'),
      );
      assert.deepStrictEqual(
        [e?.rule, e?.dropped],
        ['drop-failureE', 'failed'],
      );
    });
  });

  describe('4.2.5 reactivation, suspension and retry', () => {
    it('[reactivateC] and [reactivateE]: AF → AD, Γ emptied', () => {
      const c = fire(
        goal('AF', ['x'], { C: [pair('Reactivate')] }),
        believe('Reactivate'),
      );
      assert.deepStrictEqual(
        [c?.rule, c?.state, c?.gamma],
        ['reactivateC', 'AD', []],
      );
      const e = fire(
        goal('AF', [], { E: [pair('Reactivate')] }),
        believe('Reactivate'),
      );
      assert.deepStrictEqual([e?.rule, e?.state], ['reactivateE', 'AD']);
    });

    it('[suspendC] and [suspendE]: AS → Suspended, Γ emptied', () => {
      const c = fire(
        goal('AS', ['x'], { C: [pair('Suspend')] }),
        believe('Suspend'),
      );
      assert.deepStrictEqual(
        [c?.rule, c?.state, c?.gamma],
        ['suspendC', 'Suspended', []],
      );
      const e = fire(
        goal('AS', [], { E: [pair('Suspend')] }),
        believe('Suspend'),
      );
      assert.deepStrictEqual([e?.rule, e?.state], ['suspendE', 'Suspended']);
    });

    it('[retryC]: AS, Γ ≠ ∅, ⟨c, Retry⟩ ∈ C, B |= c → AU, Γ kept', () => {
      const t = fire(
        goal('AS', ['x'], { C: [pair('Retry')] }),
        believe('Retry'),
      );
      assert.deepStrictEqual(
        [t?.rule, t?.state, t?.gamma],
        ['retryC', 'AU', ['x']],
      );
      assert.strictEqual(
        fire(goal('AS', [], { E: [pair('Retry')] }), believe('Retry')),
        null,
      );
    });

    it('applicable rules take precedence in the order their pairs are defined (§4.2.5)', () => {
      const drop = fire(
        goal('AF', [], { E: [pair('DropFailure'), pair('Reactivate')] }),
        believe('DropFailure', 'Reactivate'),
      );
      assert.strictEqual(drop?.rule, 'drop-failureE');
      const reactivate = fire(
        goal('AF', [], { E: [pair('Reactivate'), pair('DropFailure')] }),
        believe('DropFailure', 'Reactivate'),
      );
      assert.strictEqual(reactivate?.rule, 'reactivateE');
    });
  });
});
