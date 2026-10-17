/**
 * A value type carries its operations as members (goal-controller#188): the
 * value the language reads is its plain data, with members that JSON, a
 * structured clone and a deep comparison don't see. An operation takes the
 * value, never its text.
 */
import { expect } from 'chai';
import type { WithNotation } from '@goal-controller/dialect';
import {
  asAssertion,
  asExpression,
  asRefList,
  assertionVariables,
  executionOf,
  parseElementLine,
  parseValue,
  readAssertion,
  readExpression,
  type Assertion,
  type Expression,
} from '../src/index.js';

const assertion = (text: string): Assertion =>
  parseValue('assertion', text).value!;
const expression = (text: string): Expression => readExpression(text)!;

describe('value members (#188)', () => {
  it('an assertion: its text, variables, comparisons, expressions, reading and refs', () => {
    const value = assertion('previous(t) < 18 & !on & G1 > 2 & room.clean');
    expect(value.text()).to.equal(
      'previous(t) < 18 & !on & G1 > 2 & room.clean',
    );
    expect(value.variables()).to.deep.equal([
      { name: 't', value: null },
      { name: 'on', value: null },
      { name: 'G1', value: null },
      { name: 'room', value: null },
    ]);
    expect(value.comparisons().map((c) => c.kind)).to.deep.equal([
      'comparison',
    ]);
    expect(value.expressions().map((e) => e.kind)).to.deep.equal([
      'call',
      'number',
    ]);
    expect(value.refs()).to.deep.equal(['G1']);
    expect(value.tree).to.equal(value);
  });

  it("reads an assertion's variables from its tree as the text did", () => {
    for (const text of [
      'battery > 20 & !charging',
      'x = true & x = false & y != true',
      'room.clean = true | T1.1 > 3',
      'f(a, G2) > 0.5',
    ])
      expect(assertion(text).variables(), text).to.deep.equal(
        assertionVariables(text),
      );
  });

  it("gives an assertion's reading as readAssertion reads it", () => {
    for (const text of [
      'x > 3',
      'G1 >= 2 & !(T1.1 < 4)',
      'E1 > 3 | previous(t) < 18',
      'x = true',
    ])
      expect(assertion(text).asReading(), text).to.deep.equal(
        readAssertion(text),
      );
    expect(readAssertion('x > 3')!.comparisons()).to.have.length(1);
  });

  it('an expression: its text, nodes, calls and refs', () => {
    const value = expression('0.5 + 0.9 * previous(G2) - room.level + R1.2.x');
    expect(value.text()).to.equal(
      '0.5 + 0.9 * previous(G2) - room.level + R1.2.x',
    );
    expect(value.nodes()[0]!.kind).to.equal('binary');
    expect(value.calls().map((call) => call.name)).to.deep.equal(['previous']);
    expect(value.refs()).to.deep.equal(['G2', 'R1.2']);
  });

  it('a refList and a pairList', () => {
    const ids = parseValue('refList', 'G2, G5').value;
    expect(ids).to.deep.equal(['G2', 'G5']);
    expect(ids.ids).to.equal(ids);
    expect(ids.refs()).to.deep.equal(['G2', 'G5']);
    expect(ids.text()).to.equal('G2, G5');
    const pairs = parseValue('pairList', 'x:3, y:2').value;
    expect(pairs.get('y')).to.equal('2');
    expect(pairs.get('z')).to.equal(undefined);
    expect(pairs.names()).to.deep.equal(['x', 'y']);
    expect(pairs.text()).to.equal('x:3, y:2');
  });

  it('a notation: its text, operand ids, refs and execution in a dialect', () => {
    const dialect = {
      notation: {
        operand: { kinds: ['goal'] },
        operators: { ';': 'sequence', '@': 'retry' },
        modifiers: {
          retry: {
            argument: { name: 'n', value: { type: 'int' }, default: '1' },
            label: 'retry',
            help: '',
            appliesTo: ['sequence'],
            action: 'retry',
          },
        },
        constructs: { sequence: { label: 'sequence', help: '' } },
        defaultConstruct: { and: 'sequence', or: 'sequence' },
      },
    } as const satisfies WithNotation;
    const value = parseElementLine('G1: Deliver [G2@3;[G3;G4]]').value!
      .notation!;
    expect(value.text()).to.equal('G2@3;[G3;G4]');
    expect(value.operandIds()).to.deep.equal(['G2']);
    expect(value.refs()).to.deep.equal(['G2', 'G3', 'G4']);
    expect(value.execution(dialect)).to.deep.equal(executionOf(dialect, value));
    expect(value.execution(dialect)?.modifiers).to.deep.equal({
      retry: { G2: 3 },
    });
  });

  it('is its data only, to JSON, a structured clone and a deep comparison', () => {
    const value = assertion('x > 3');
    expect(JSON.parse(JSON.stringify(value))).to.deep.equal({
      kind: 'compare',
      variable: 'x',
      operator: '>',
      value: '3',
    });
    expect(Object.keys(value)).to.deep.equal([
      'kind',
      'variable',
      'operator',
      'value',
    ]);
    expect(structuredClone(value)).to.deep.equal(value);
    const ids = parseValue('refList', 'G2').value;
    expect(structuredClone(ids)).to.deep.equal(['G2']);
    expect(
      JSON.stringify(parseElementLine('G1: A [G2;G3]').value),
    ).not.to.include('text');
  });

  it('builds the members over data read before, once', () => {
    const stored = JSON.parse(JSON.stringify(expression('2 * R1')));
    const value = asExpression(stored);
    expect(value).to.equal(stored);
    expect(value.text()).to.equal('2 * R1');
    expect(asExpression(value)).to.equal(value);
    expect(
      asAssertion({ kind: 'var', variable: 'on' }).variables(),
    ).to.deep.equal([{ name: 'on', value: null }]);
    expect(asRefList(['G1']).refs()).to.deep.equal(['G1']);
    // frozen data gets its members on a copy
    const frozen = Object.freeze(['G3']);
    expect(asRefList(frozen as string[]).refs()).to.deep.equal(['G3']);
  });
});
