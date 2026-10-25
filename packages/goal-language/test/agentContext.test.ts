/**
 * The goal language's part of an agent's context (goal-controller#415):
 * `notationHelpOf`, a dialect's notation as data (every example read back by
 * the language), and `validateNotation`, what the Notation editor reports
 * for a model's text, its context variables and project resources, as the
 * language server reports it with the same context. edgeV2's and KAOS's
 * dialects are lib's: their notation objects are checked there
 * (packages/lib/test/engines/agentContext.test.ts).
 */
import { expect } from 'chai';
import {
  notationContextOf,
  notationHelpOf,
  notationHelpText,
  readLine,
  savedLinesOf,
  validateNotation,
  type NotationTree,
} from '../src/index.js';
import { createGoalLspServices, serverDiagnostics } from '../src/lsp/server.js';
import { node, toy } from '../../dialect/test/support/toy.js';

const tree: NotationTree = {
  nodes: new Map([
    ['G1', node({ id: 'G1', kind: 'goal', children: ['T1'], notation: 'T1' })],
    ['T1', node({ id: 'T1', kind: 'task' })],
    ['R1', node({ id: 'R1', kind: 'resource', properties: { type: 'int' } })],
  ]),
  roots: ['G1', 'R1'],
};

describe("the notation's part of an agent's context (goal-controller#415)", () => {
  it("lists the dialect's own operators, tightest first, standalone last", () => {
    const help = notationHelpOf(toy);
    expect(help.refinement?.operators.map((o) => o.symbol)).to.deep.equal([
      '@',
      '|',
      ';',
      '*',
    ]);
    expect(help.refinement?.skip).to.equal('skip');
    expect(help.refinement?.operators[0]).to.include({
      form: 'postfix',
      meaning: 'retry',
      label: 'Retry',
    });
  });

  it('writes examples the language reads back', () => {
    const help = notationHelpOf(toy);
    const read = readLine(toy, help.elementLine.example);
    expect(read.kind).to.equal('element');
    expect(read.kind === 'element' && read.notation?.refs.length).to.equal(2);
    expect(help.propertyLine?.example).to.equal('priority <value>');
    expect(help.assertion?.comparators).to.include('>=');
    expect(notationHelpText(help)).to.contain(help.elementLine.example);
  });
});

describe('validateNotation (goal-controller#415)', () => {
  const inputs = { tree, variables: [{ kind: 'context', name: 'speed' }] };

  it('reads the context variables the editor passes', () => {
    const text = 'G1: Go [T1]\nT1: Do\n  guard speed > 1\nR1: Fuel';
    expect(validateNotation(toy, text, inputs)).to.deep.equal([]);
    expect(
      validateNotation(toy, text, { tree, variables: [] }).map((d) => d.key),
    ).to.deep.equal(['guard']);
  });

  it('runs the named checks it is given', () => {
    const found = validateNotation(toy, 'R1: Fuel {int 0..9 = 5}', inputs, {
      'toy.resource.bounds': () => 'out of bounds',
    });
    expect(found.map((d) => d.message)).to.include('out of bounds');
  });

  it('reports what the language server reports with the same context', async () => {
    const text = 'G1: Go [T1;T9]\n  priority urgent\nT1: Do';
    const { shared, store } = createGoalLspServices();
    store.set({
      dialect: toy,
      context: notationContextOf(toy, inputs),
      saved: savedLinesOf(toy, tree),
    });
    const served = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      text,
    );
    expect(served.length).to.be.greaterThan(0);
    expect(validateNotation(toy, text, inputs)).to.deep.equal(served);
  });
});
