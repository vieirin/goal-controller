/**
 * The LTL AST (../../src/ltl/ast.ts) over both surfaces, one operator at a
 * time (goal-controller#211): KAOSTools' word sugar and RE'01's symbolic
 * RT-LTL parse to the same shape, and `printLtl` is idempotent (print,
 * re-parse, compare) — see ../../src/ltl/print.ts for why this is not a
 * byte-for-byte reconstruction of the original text.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { parseLtl, printLtl, type LtlNode } from '../../src/ltl/index.js';

/** parses, asserts no errors, and asserts print → re-parse is a fixed point */
const parsed = (text: string): LtlNode => {
  const { value, errors } = parseLtl(text);
  assert.deepStrictEqual(errors, [], `parsing ${JSON.stringify(text)}`);
  const printed = printLtl(value!);
  const reparsed = parseLtl(printed);
  assert.deepStrictEqual(
    reparsed.errors,
    [],
    `re-parsing ${JSON.stringify(printed)}`,
  );
  assert.deepStrictEqual(
    reparsed.value,
    value,
    `print → re-parse of ${JSON.stringify(text)}`,
  );
  return value!;
};

const bad = (text: string) => {
  const { value, errors } = parseLtl(text);
  assert.notDeepStrictEqual(errors, []);
  assert.strictEqual(value, null);
};

describe('LTL: quantifiers (KAOSTools has no symbolic spelling attested, but the grammar does)', () => {
  it('forall / ∀', () => {
    assert.strictEqual(parsed('forall x: T . p(x)').kind, 'forall');
    assert.strictEqual(parsed('∀ x: T · p(x)').kind, 'forall');
  });
  it('exists / ∃', () => {
    assert.strictEqual(parsed('exists x: T . p(x)').kind, 'exists');
    assert.strictEqual(parsed('∃ x: T · p(x)').kind, 'exists');
  });
  it('several typed variables', () => {
    const tree = parsed('forall x: Train, y: Block . p(x, y)');
    assert.strictEqual(tree.kind, 'forall');
    if (tree.kind === 'forall')
      assert.deepStrictEqual(tree.variables, [
        { name: 'x', type: 'Train' },
        { name: 'y', type: 'Block' },
      ]);
  });
});

describe('LTL: boolean connectives', () => {
  it('and / ∧', () => {
    assert.strictEqual(parsed('a() and b()').kind, 'and');
    assert.strictEqual(parsed('a() ∧ b()').kind, 'and');
  });
  it('or / ∨', () => {
    assert.strictEqual(parsed('a() or b()').kind, 'or');
    assert.strictEqual(parsed('a() ∨ b()').kind, 'or');
  });
  it('not / ¬', () => {
    assert.strictEqual(parsed('not a()').kind, 'not');
    assert.strictEqual(parsed('¬ a()').kind, 'not');
  });
  it('iff / ⇔', () => {
    assert.strictEqual(parsed('a() iff b()').kind, 'iff');
    assert.strictEqual(parsed('a() ⇔ b()').kind, 'iff');
  });
  it('plain implication: `if … then …` / symbolic ⇒', () => {
    const sugar = parsed('if a() then b()');
    assert.strictEqual(sugar.kind, 'implies');
    const symbolic = parsed('a() ⇒ b()');
    assert.strictEqual(symbolic.kind, 'implies');
  });
  it('strong implication: `when … then …` (no symbolic spelling is attested)', () => {
    assert.strictEqual(parsed('when a() then b()').kind, 'strongImplies');
  });
});

describe('LTL: future temporal operators', () => {
  it('next / ○', () => {
    assert.strictEqual(parsed('next a()').kind, 'next');
    assert.strictEqual(parsed('○ a()').kind, 'next');
  });
  it('eventually: sooner-or-later / eventually / ◇', () => {
    assert.strictEqual(parsed('sooner-or-later a()').kind, 'eventually');
    assert.strictEqual(parsed('eventually a()').kind, 'eventually');
    assert.strictEqual(parsed('◇ a()').kind, 'eventually');
  });
  it('bounded eventually: sugar `, before 2 minutes,` / symbolic `≤`', () => {
    const sugar = parsed('sooner-or-later, before 2 minutes, a()');
    assert.strictEqual(sugar.kind, 'eventually');
    if (sugar.kind === 'eventually')
      assert.deepStrictEqual(sugar.bound, {
        surface: 'sugar',
        qualifier: 'before',
        strictly: false,
        duration: [{ amount: 2, unit: 'minutes' }],
      });
    const symbolic = parsed('◇≤2 minutes a()');
    assert.strictEqual(symbolic.kind, 'eventually');
    if (symbolic.kind === 'eventually')
      assert.deepStrictEqual(symbolic.bound, {
        surface: 'symbolic',
        strictly: false,
        comparator: '<=',
        duration: [{ amount: 2, unit: 'minutes' }],
      });
  });
  it('always: always / globally / □, bounded', () => {
    assert.strictEqual(parsed('always a()').kind, 'always');
    assert.strictEqual(parsed('globally a()').kind, 'always');
    assert.strictEqual(parsed('□ a()').kind, 'always');
    assert.strictEqual(parsed('always, for 2 minutes, a()').kind, 'always');
    assert.strictEqual(parsed('□≤2 minutes a()').kind, 'always');
  });
  it('bounded always with `for more/less than` (sugar only)', () => {
    const more = parsed('always, for more than 2 minutes, a()');
    assert.strictEqual(more.kind, 'always');
    if (more.kind === 'always')
      assert.strictEqual(more.bound?.qualifier, 'moreThan');
    const strictlyLess = parsed(
      'always, for strictly less than 2 minutes, a()',
    );
    if (strictlyLess.kind === 'always') {
      assert.strictEqual(strictlyLess.bound?.qualifier, 'lessThan');
      assert.strictEqual(strictlyLess.bound?.strictly, true);
    }
  });
  it('until / U, bounded', () => {
    assert.strictEqual(parsed('a() until b()').kind, 'until');
    assert.strictEqual(parsed('a() U b()').kind, 'until');
    assert.strictEqual(
      parsed('a() until, before 2 minutes, b()').kind,
      'until',
    );
  });
  it('release / R (KAOSTools sugar; no RE’01 attestation)', () => {
    assert.strictEqual(parsed('a() release b()').kind, 'release');
    assert.strictEqual(parsed('a() R b()').kind, 'release');
  });
  it('weak-until: unless / W, bounded before the keyword', () => {
    assert.strictEqual(parsed('a() unless b()').kind, 'weakUntil');
    assert.strictEqual(parsed('a() W b()').kind, 'weakUntil');
    assert.strictEqual(
      parsed('a(), for 2 minutes, unless b()').kind,
      'weakUntil',
    );
  });
});

describe('LTL: past temporal operators (the standard KAOS RT-LTL set, #211; symbolic only — KAOSTools has no past sugar)', () => {
  it('previous / ●', () => {
    assert.strictEqual(parsed('● a()').kind, 'previous');
  });
  it('once / ♦', () => {
    assert.strictEqual(parsed('♦ a()').kind, 'once');
  });
  it('historically / ■, bounded (RE 01 p.9’s own example)', () => {
    assert.strictEqual(parsed('■ a()').kind, 'historically');
    const bounded = parsed('■≤0.5 sec a()');
    assert.strictEqual(bounded.kind, 'historically');
    if (bounded.kind === 'historically')
      assert.deepStrictEqual(bounded.bound, {
        surface: 'symbolic',
        strictly: false,
        comparator: '<=',
        duration: [{ amount: 0.5, unit: 'sec' }],
      });
  });
});

describe('LTL: the state-label operator', () => {
  it('@P', () => {
    const tree = parsed('a()@P');
    assert.strictEqual(tree.kind, 'atLabel');
    if (tree.kind === 'atLabel') assert.strictEqual(tree.label, 'P');
  });
});

describe('LTL: predicates, attributes, relations, comparisons, literals', () => {
  it('a predicate with arguments', () => {
    const tree = parsed('p(x, y)');
    assert.deepStrictEqual(tree, {
      kind: 'predicateCall',
      name: 'p',
      args: ['x', 'y'],
    });
  });
  it('attribute access, chained no further than one member (as the grammar has it)', () => {
    assert.deepStrictEqual(parsed('tr.Doors'), {
      kind: 'attributeAccess',
      variable: 'tr',
      attribute: 'Doors',
    });
  });
  it('relation membership', () => {
    assert.deepStrictEqual(parsed('(x, y) in Tracking'), {
      kind: 'relationMembership',
      args: ['x', 'y'],
      relation: 'Tracking',
    });
  });
  it('every comparator', () => {
    for (const op of ['==', '!=', '>=', '<=', '>', '<'])
      assert.strictEqual(parsed(`x ${op} y`).kind, 'comparison');
  });
  it('a bare variable, and literals', () => {
    assert.deepStrictEqual(parsed('x'), { kind: 'variableRef', name: 'x' });
    assert.deepStrictEqual(parsed('true'), { kind: 'literal', value: true });
    assert.deepStrictEqual(parsed('false'), { kind: 'literal', value: false });
    assert.deepStrictEqual(parsed('3'), { kind: 'literal', value: 3 });
    assert.deepStrictEqual(parsed('"closed"'), {
      kind: 'literal',
      value: 'closed',
    });
  });
  it('an explicit parenthesised group is kept, not flattened', () => {
    assert.strictEqual(parsed('(a() and b())').kind, 'paren');
  });
});

describe('LTL: the paper’s and KAOSTools’ own examples parse', () => {
  it('RE 01 p.6: DoorsClosedWhileMoving', () => {
    parsed(
      'forall tr: Train, loc: Location, locp: Location . At(tr, loc) and next At(tr, locp) and loc != locp ⇒ tr.Doors == "closed" and next tr.Doors == "closed"',
    );
  });
  it('RE 01 p.9: the ReqTrig bounded historically example', () => {
    parsed('■≤0.5 sec ¬ cm2.Sent');
  });
  it('KAOSTools las.kaos: when … then sooner-or-later …', () => {
    parsed('when incidentReported() then sooner-or-later ambulanceOnScene()');
  });
  it('ADS validation-model.kaos: nested and/or/not with a bounded always', () => {
    parsed(
      '((IncReported1() and not IncAllocated1()) or (IncReported2() and not IncAllocated2())) and always, for 2 minutes, not AmbAvailable()',
    );
  });
});

describe('LTL: a syntax error is reported, not a crash', () => {
  it('an unterminated group', () => bad('(a() and b()'));
  it('a dangling operator', () => bad('a() and'));
  it('an unknown trailing token', () => bad('a() b()'));
});
