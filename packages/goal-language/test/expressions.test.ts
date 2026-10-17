/** A dialect with an `expression` value and functions in its assertions: validated, completed, hovered, read. */
import {
  defineDialect,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import { toy } from '../../dialect/test/support/toy.js';
import {
  fieldCompletions,
  fieldDiagnostics,
  fieldHover,
  expressionNodes,
  readAssertion,
  readExpression,
} from '../src/index.js';

// the toy: a goal's reward is a formula over resources, its guard compares one
const previous = { name: 'previous', arity: 1 } as const;
const formulas = defineDialect({
  id: 'formulas',
  name: 'Formulas',
  elements: {
    goal: { prefix: 'G', fill: '#00FF00' },
    resource: { prefix: 'R', fill: '#FFFF00' },
  },
  defaultFill: '#FFFFFF',
  indent: '  ',
  problems: toy.problems,
  propertyLineOrder: ['reward', 'guard'],
  properties: {
    goal: [
      {
        key: 'reward',
        value: {
          type: 'expression',
          resolves: ['resource'],
          functions: [previous],
        },
        help: 'what achieving it is worth',
        check: 'formulas.goal.reward',
      },
      {
        key: 'guard',
        value: {
          type: 'assertion',
          resolves: ['resource', 'variable'],
          functions: [previous],
          decimals: true,
          declaresVariables: true,
        },
        help: 'when it is pursued',
      },
    ],
  },
});

const runCheck = (check: string, properties: Record<string, string>) =>
  check === 'formulas.goal.reward' &&
  // an engine's check reads the tree, never the text
  [readExpression(properties.reward ?? '')]
    .flatMap((tree) => (tree ? expressionNodes(tree) : []))
    .some(
      (node) =>
        node.kind === 'binary' &&
        node.operator === '/' &&
        node.right.kind === 'number' &&
        Number(node.right.value) === 0,
    )
    ? 'Divides by zero'
    : null;

const context: DefinitionContext = {
  elements: {
    G1: { kind: 'goal', name: 'Keep warm', children: [], properties: {} },
    G2: { kind: 'goal', name: 'Save power', children: [], properties: {} },
    R1: { kind: 'resource', name: 'heater', children: [], properties: {} },
  },
  variables: ['roomTemperature'],
};

const problems = (key: string, value: string) =>
  fieldDiagnostics(formulas, context, 'G1', key, value, (check, properties) =>
    runCheck(check, { ...properties, [key]: value }),
  ).map((d) => d.message);

describe('a dialect with expressions', () => {
  it('accepts a formula over its resources, variables and functions', () => {
    expect(
      problems('reward', '0.5 + 0.9 * previous(roomTemperature) - R1'),
    ).to.deep.equal([]);
    expect(problems('guard', '(previous(on) & !(off)) | x > 2')).to.deep.equal(
      [],
    );
    expect(problems('guard', 'previous(R1) < 18 & 0.9 * x >= 1')).to.deep.equal(
      [],
    );
  });

  it('reports an unknown reference, an unknown function and a wrong arity', () => {
    expect(problems('reward', 'R9 * 2')).to.deep.equal([
      'R9 is not an element of this model',
    ]);
    expect(problems('reward', 'G2 * 2')).to.deep.equal([
      'G2 is a goal, not a resource',
    ]);
    expect(problems('reward', 'next(x)')).to.deep.equal([
      'next is not a function here (previous)',
    ]);
    expect(problems('reward', 'previous(x, 2)')).to.deep.equal([
      'previous takes 1 argument, not 2',
    ]);
    expect(problems('guard', 'previous() < 18')).to.deep.equal([
      'previous takes 1 argument, not 0',
    ]);
    expect(problems('guard', 'on & next(on)')).to.deep.equal([
      'next is not a function here (previous)',
    ]);
    expect(problems('reward', '2 *')[0]).to.match(/^Not an expression: /);
  });

  it('runs its check on the tree', () => {
    expect(problems('reward', 'R1 / (2 - 2) + R1 / 0')).to.deep.equal([
      'Divides by zero',
    ]);
  });

  it('reads the guard’s comparisons as expressions', () => {
    expect(readAssertion('previous(R1) < 18')).to.deep.equal({
      kind: 'comparison',
      operator: '<',
      left: {
        kind: 'call',
        name: 'previous',
        args: [{ kind: 'ref', id: 'R1' }],
      },
      right: { kind: 'number', value: '18' },
    });
  });

  it('completes the resources, the variables and the functions', () => {
    const labels = (key: string) =>
      fieldCompletions(formulas, context, 'G1', key, '', 0)?.options.map(
        (o) => o.label,
      );
    expect(labels('reward')).to.deep.equal([
      'R1',
      'roomTemperature',
      'previous',
    ]);
    expect(labels('guard')).to.deep.equal([
      'R1',
      'roomTemperature',
      'previous',
      'true',
      'false',
    ]);
    const call = fieldCompletions(formulas, context, 'G1', 'reward', 'pre', 3);
    expect(call?.from).to.equal(0);
    expect(call?.options.find((o) => o.label === 'previous')?.snippet).to.equal(
      'previous(${1})',
    );
  });

  it('shows the element a reference names, and what a function takes', () => {
    const hover = (key: string, text: string, pos: number) =>
      fieldHover(formulas, context, 'G1', key, text, pos);
    expect(hover('reward', '2 * R1', 5)).to.deep.equal({
      from: 4,
      to: 6,
      markdown: '**R1**: heater (a resource of this model)',
    });
    expect(hover('guard', 'previous(R1) < 18', 2)?.markdown).to.equal(
      '**previous**: a function of 1 argument',
    );
    expect(hover('reward', 'x + 1', 0)?.markdown).to.equal('**x**: a variable');
    expect(hover('reward', 'x + 1', 4)).to.equal(null);
  });
});
