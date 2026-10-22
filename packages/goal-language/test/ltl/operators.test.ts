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

/** every node with a `Surface` has it: `.surface` is unknown to the type at the `LtlNode` union level */
const surfaceOf = (node: LtlNode): string | undefined =>
  'surface' in node ? node.surface : undefined;

describe('LTL: quantifiers (the sugar grammar has no symbolic spelling attested, but its shape does)', () => {
  it('forall / ∀', () => {
    const sugar = parsed('forall x: T . p(x)');
    assert.strictEqual(sugar.kind, 'forall');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('∀ x: T · p(x)');
    assert.strictEqual(symbolic.kind, 'forall');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('exists / ∃', () => {
    const sugar = parsed('exists x: T . p(x)');
    assert.strictEqual(sugar.kind, 'exists');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('∃ x: T · p(x)');
    assert.strictEqual(symbolic.kind, 'exists');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
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
  it('the `.`/`·`/`∙` separator is optional (RE’01’s own quantified formulas never write one, p.5-9, goal-controller#399)', () => {
    const noSeparator = parsed(
      '∀ tr: Train, b: Block On(tr, b) ⇒ ◇ On(tr, b2)',
    );
    assert.deepStrictEqual(
      noSeparator,
      parsed('∀ tr: Train, b: Block · On(tr, b) ⇒ ◇ On(tr, b2)'),
    );
    const sugarNoSeparator = parsed('exists x: T p(x)');
    assert.deepStrictEqual(sugarNoSeparator, parsed('exists x: T . p(x)'));
  });
  it('a parenthesized header: `(∀x:T)`/`(∃x:T)`, its body outside the parens (RE’01 p.9’s `◇ (∃ tr: Train) (…)`, goal-controller#399)', () => {
    const tree = parsed('(∃ amb: Ambulance) Intervention(amb, inc)');
    assert.strictEqual(tree.kind, 'exists');
    if (tree.kind === 'exists') {
      assert.deepStrictEqual(tree.variables, [
        { name: 'amb', type: 'Ambulance' },
      ]);
      assert.deepStrictEqual(tree.body, {
        kind: 'predicateCall',
        name: 'Intervention',
        args: ['amb', 'inc'],
      });
    }
    // still a plain group, and still a relation membership, when the parenthesized content isn't a quantifier header
    const group = parsed('(a() and b())');
    assert.strictEqual(group.kind, 'paren');
    const relation = parsed('(x, y) in R');
    assert.strictEqual(relation.kind, 'relationMembership');
  });
});

describe('LTL: boolean connectives', () => {
  it('and / ∧', () => {
    const sugar = parsed('a() and b()');
    assert.strictEqual(sugar.kind, 'and');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() ∧ b()');
    assert.strictEqual(symbolic.kind, 'and');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('or / ∨', () => {
    const sugar = parsed('a() or b()');
    assert.strictEqual(sugar.kind, 'or');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() ∨ b()');
    assert.strictEqual(symbolic.kind, 'or');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('not / ¬', () => {
    const sugar = parsed('not a()');
    assert.strictEqual(sugar.kind, 'not');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('¬ a()');
    assert.strictEqual(symbolic.kind, 'not');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('iff / ⇔', () => {
    const sugar = parsed('a() iff b()');
    assert.strictEqual(sugar.kind, 'iff');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() ⇔ b()');
    assert.strictEqual(symbolic.kind, 'iff');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('plain implication: `if … then …` / symbolic ⇒', () => {
    const sugar = parsed('if a() then b()');
    assert.strictEqual(sugar.kind, 'implies');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() ⇒ b()');
    assert.strictEqual(symbolic.kind, 'implies');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('strong implication: `when … then …` (no symbolic spelling is attested)', () => {
    assert.strictEqual(parsed('when a() then b()').kind, 'strongImplies');
  });
});

describe('LTL: future temporal operators', () => {
  it('next / ○', () => {
    const sugar = parsed('next a()');
    assert.strictEqual(sugar.kind, 'next');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('○ a()');
    assert.strictEqual(symbolic.kind, 'next');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('eventually: sooner-or-later / eventually / ◇', () => {
    const soonerOrLater = parsed('sooner-or-later a()');
    assert.strictEqual(soonerOrLater.kind, 'eventually');
    assert.strictEqual(surfaceOf(soonerOrLater), 'sugar');
    const eventually = parsed('eventually a()');
    assert.strictEqual(eventually.kind, 'eventually');
    assert.strictEqual(surfaceOf(eventually), 'sugar');
    const symbolic = parsed('◇ a()');
    assert.strictEqual(symbolic.kind, 'eventually');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('◊ (U+25CA, the glyph the paper transcriptions’ verbatim quotes print) is the same operator as ◇ (U+25C7, goal-controller#399), its glyph as read reproduced by printLtl', () => {
    const synonym = parsed('◊ a()');
    const canonical = parsed('◇ a()');
    assert.strictEqual(synonym.kind, 'eventually');
    assert.strictEqual(canonical.kind, 'eventually');
    if (synonym.kind === 'eventually' && canonical.kind === 'eventually') {
      assert.deepStrictEqual(
        { ...synonym, glyph: undefined },
        { ...canonical, glyph: undefined },
      );
      assert.strictEqual(synonym.glyph, '◊');
      assert.strictEqual(canonical.glyph, '◇');
    }
    assert.strictEqual(printLtl(synonym), '◊ a()');
    assert.strictEqual(printLtl(canonical), '◇ a()');
  });
  it('a bare (unparenthesized) quantifier as a unary operator’s operand (goal-controller#404; examples/kaos/ebanking/ebanking.kaos’s own shape)', () => {
    const tree = parsed(
      '◊ ∃ p: Person, acc: Account · ¬ (Owner(p, acc) ∨ Proxy(p, acc) ∨ Manager(p, acc)) ∧ KnowsV[p] acc.AccNum ∧ KnowsV[p] acc.PIN',
    );
    assert.strictEqual(tree.kind, 'eventually');
    if (tree.kind === 'eventually') {
      assert.strictEqual(tree.expr.kind, 'exists');
      if (tree.expr.kind === 'exists')
        assert.deepStrictEqual(tree.expr.variables, [
          { name: 'p', type: 'Person' },
          { name: 'acc', type: 'Account' },
        ]);
    }
    // the same shape under every unary operator, not just ◊
    assert.strictEqual(parsed('not ∃ x: T · p(x)').kind, 'not');
    assert.strictEqual(parsed('always ∀ x: T · p(x)').kind, 'always');
  });
  it("a bare quantifier's body extends as far right as possible: `◊ ∃ p: P · A(p) ∧ B(p)` is `◊(∃p · (A(p) ∧ B(p)))`, not `(◊∃p · A(p)) ∧ B(p)`", () => {
    const tree = parsed('◊ ∃ p: P · A(p) ∧ B(p)');
    assert.strictEqual(tree.kind, 'eventually');
    if (tree.kind !== 'eventually') return;
    assert.strictEqual(tree.expr.kind, 'exists');
    if (tree.expr.kind !== 'exists') return;
    assert.deepStrictEqual(tree.expr.body, {
      kind: 'and',
      left: { kind: 'predicateCall', name: 'A', args: ['p'] },
      right: { kind: 'predicateCall', name: 'B', args: ['p'] },
      surface: 'symbolic',
    });
    // the same greedy extension where the quantifier is itself what a
    // binary operator's `left` computes down to (`parseAnd`'s/`parseOr`'s
    // `left = parseUnary()`, which the quantifier is now reachable from):
    // `not`'s operand swallows the whole `∧`, so the outer node is `not`,
    // not `and`.
    const underNot = parsed('not ∃ p: P · A(p) ∧ B(p)');
    assert.strictEqual(underNot.kind, 'not');
    if (underNot.kind !== 'not') return;
    assert.strictEqual(underNot.expr.kind, 'exists');
    if (underNot.expr.kind !== 'exists') return;
    assert.deepStrictEqual(underNot.expr.body, {
      kind: 'and',
      left: { kind: 'predicateCall', name: 'A', args: ['p'] },
      right: { kind: 'predicateCall', name: 'B', args: ['p'] },
      surface: 'symbolic',
    });
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
    const always = parsed('always a()');
    assert.strictEqual(always.kind, 'always');
    assert.strictEqual(surfaceOf(always), 'sugar');
    const globally = parsed('globally a()');
    assert.strictEqual(globally.kind, 'always');
    assert.strictEqual(surfaceOf(globally), 'sugar');
    const symbolic = parsed('□ a()');
    assert.strictEqual(symbolic.kind, 'always');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
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
    const sugar = parsed('a() until b()');
    assert.strictEqual(sugar.kind, 'until');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() U b()');
    assert.strictEqual(symbolic.kind, 'until');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
    assert.strictEqual(
      parsed('a() until, before 2 minutes, b()').kind,
      'until',
    );
  });
  it('release / R (the sugar grammar has it; no RE’01 attestation)', () => {
    const sugar = parsed('a() release b()');
    assert.strictEqual(sugar.kind, 'release');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() R b()');
    assert.strictEqual(symbolic.kind, 'release');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('weak-until: unless / W, bounded before the keyword (sugar) or after it (symbolic)', () => {
    const sugar = parsed('a() unless b()');
    assert.strictEqual(sugar.kind, 'weakUntil');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    const symbolic = parsed('a() W b()');
    assert.strictEqual(symbolic.kind, 'weakUntil');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
    assert.strictEqual(
      parsed('a(), for 2 minutes, unless b()').kind,
      'weakUntil',
    );
    const boundedSymbolic = parsed('a() W≤2 minutes b()');
    assert.strictEqual(boundedSymbolic.kind, 'weakUntil');
    if (boundedSymbolic.kind === 'weakUntil')
      assert.deepStrictEqual(boundedSymbolic.bound, {
        surface: 'symbolic',
        strictly: false,
        comparator: '<=',
        duration: [{ amount: 2, unit: 'minutes' }],
      });
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

describe('LTL: epistemic operators (ICSE’04, #212; the `[ag]` subscript spelling is unattested, see ../../src/ltl/ast.ts’s Knows doc)', () => {
  it('Knows / knows', () => {
    const sugar = parsed('knows [p] a()');
    assert.strictEqual(sugar.kind, 'knows');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    if (sugar.kind === 'knows') {
      assert.strictEqual(sugar.agent, 'p');
      assert.strictEqual(sugar.asValue, false);
    }
    const symbolic = parsed('Knows[p] a()');
    assert.strictEqual(symbolic.kind, 'knows');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
    if (symbolic.kind === 'knows') assert.strictEqual(symbolic.asValue, false);
  });
  it('KnowsV / knows-value', () => {
    const sugar = parsed('knows-value [p] acc.PIN');
    assert.strictEqual(sugar.kind, 'knows');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    if (sugar.kind === 'knows') assert.strictEqual(sugar.asValue, true);
    const symbolic = parsed('KnowsV[p] acc.PIN');
    assert.strictEqual(symbolic.kind, 'knows');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
    if (symbolic.kind === 'knows') {
      assert.strictEqual(symbolic.agent, 'p');
      assert.strictEqual(symbolic.asValue, true);
    }
  });
  it('Belief / believes', () => {
    const sugar = parsed('believes [ag] a()');
    assert.strictEqual(sugar.kind, 'belief');
    assert.strictEqual(surfaceOf(sugar), 'sugar');
    if (sugar.kind === 'belief') assert.strictEqual(sugar.agent, 'ag');
    const symbolic = parsed('Belief[ag] a()');
    assert.strictEqual(symbolic.kind, 'belief');
    assert.strictEqual(surfaceOf(symbolic), 'symbolic');
  });
  it('the paper’s own instantiated confidentiality goal (ICSE’04 §2)', () => {
    parsed(
      'forall p: Person, acc: Account . not (Owner(p, acc) or Proxy(p, acc) or Manager(p, acc)) ⇒ not (KnowsV[p] acc.AccNum and KnowsV[p] acc.PIN)',
    );
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
