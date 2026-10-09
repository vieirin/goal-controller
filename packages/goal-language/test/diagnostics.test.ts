/** Checking and completing a document and a field (src/notation/{diagnostics,completion}.ts). */
import type { DefinitionContext } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  documentDiagnostics,
  fieldCompletionsAt,
  fieldDiagnostics,
} from '../src/index.js';
import { toy } from '../../dialect/test/support/toy.js';

const context: DefinitionContext = {
  elements: {
    G1: {
      kind: 'goal',
      children: ['G2', 'T1'],
      properties: {},
      relation: 'and',
      construct: 'sequence',
    },
    G2: { kind: 'goal', children: [], properties: {}, relation: null },
    T1: { kind: 'task', children: [], properties: {} },
    R1: {
      kind: 'resource',
      children: [],
      properties: {
        type: 'int',
        lowerBound: '0',
        upperBound: '9',
        initialValue: '5',
      },
    },
  },
  variables: ['ctx'],
};

const messages = (doc: string, options = {}) =>
  documentDiagnostics(toy, doc, context, options).map((d) => [
    doc.slice(d.from, d.to),
    d.severity,
    d.message,
  ]);

describe('documentDiagnostics', () => {
  it('is quiet on a matching document', () => {
    expect(
      messages('G1: Go [G2;T1]\n  G2: A\n  T1: B\n  R1: R {int 0..9 = 5}'),
    ).to.deep.equal([]);
  });

  it('flags non-children, missing children and unknown elements', () => {
    expect(messages('G1: Go [G2;T9]\nG7: New')).to.deep.equal([
      ['T9', 'error', 'Not a child'],
      ['G2;T9', 'warning', 'Missing: T1'],
      ['G7', 'error', 'Not in the diagram'],
    ]);
  });

  it('flags a construct contradicting the links', () => {
    const ctx = {
      ...context,
      elements: {
        ...context.elements,
        G1: { ...context.elements.G1!, relation: 'or' as const },
      },
    };
    const [d] = documentDiagnostics(toy, 'G1: Go [G2;T1]', ctx);
    expect(d!.severity).to.equal('error');
    expect(d!.message).to.equal('Sequence needs AND, has OR');
  });

  it('runs the named checks on property lines and declarations', () => {
    const calls: string[] = [];
    const runCheck = (
      check: string,
      properties: Readonly<Record<string, string>>,
    ) => {
      calls.push(check);
      return check === 'toy.resource.bounds' && properties.lowerBound === '7'
        ? 'out of bounds'
        : null;
    };
    const doc =
      'G1: Go [G2;T1]\n  priority high\n  deadline 3\nR1: R {int 7..9 = 8}';
    expect(messages(doc, { runCheck })).to.deep.equal([
      ['{int 7..9 = 8}', 'error', 'out of bounds'],
    ]);
    expect(calls).to.include('toy.goal.deadline');
  });

  it('flags properties that do not apply, and lines it cannot read', () => {
    expect(
      messages(
        '  robot r2\nG1: Go [G2;T1]\n  deadline 3\n  robot r2\n  nonsense here\n  [G2]',
      ),
    ).to.deep.equal([
      ['robot r2', 'error', 'A property belongs under an element line'],
      ['robot', 'warning', 'Not read for a goal'],
      ['nonsense', 'warning', 'Not read for a goal'],
      ['[G2]', 'error', 'Not a property line'],
      // what does not apply is checked once the element's lines are read
      [
        'deadline 3',
        'warning',
        'Only read when priority is high (it is unset)',
      ],
    ]);
  });

  it('shows the grammar error while the line is as saved', () => {
    const saved = { G1: { line: 'G1: Go [G2;;]', error: 'bad' } };
    expect(messages('G1: Go [G2;;]', { saved })[0]).to.deep.equal([
      'G1: Go [G2;;]',
      'error',
      'Not valid for this engine: bad',
    ]);
    expect(messages('G1: Go [G2;T1]', { saved })).to.deep.equal([]);
  });
});

describe('fieldDiagnostics', () => {
  it('checks the value with the element properties', () => {
    const d = fieldDiagnostics(
      toy,
      context,
      'R1',
      'lowerBound',
      '42',
      (check, p) =>
        check === 'toy.resource.bounds' && p.lowerBound === '42'
          ? 'nope'
          : null,
    );
    expect(d).to.deep.equal([
      { from: 0, to: 2, severity: 'error', message: 'nope' },
    ]);
  });
});

describe('completions', () => {
  it('offers children and keywords inside a notation', () => {
    const doc = 'G1: Go [G2;';
    const result = completionsAt(toy, doc, doc.length, context)!;
    expect(result.from).to.equal(doc.length);
    expect(result.options.map((o) => o.label)).to.deep.equal([
      'G2',
      'T1',
      'skip',
    ]);
    expect(completionsAt(toy, 'G1: Go', 3, context)).to.equal(null);
  });

  it('offers the keys a kind reads, not yet set', () => {
    const doc = 'G1: Go\n  priority high\n  ';
    const labels = completionsAt(toy, doc, doc.length, context)!.options.map(
      (o) => o.label,
    );
    expect(labels).to.include('deadline');
    expect(labels).to.not.include('priority');
    expect(labels).to.not.include('robot');
  });

  it('offers ids in reference lists, and names in expressions', () => {
    const refs = fieldCompletionsAt(
      toy,
      { type: 'refList', kind: 'goal' },
      'G1, ',
      4,
      context,
    )!;
    expect(refs.options.map((o) => o.label)).to.deep.equal(['G1', 'G2']);
    const expr = fieldCompletionsAt(
      toy,
      { type: 'assertion', resolves: ['resource', 'variable'] },
      'R',
      1,
      context,
    )!;
    expect(expr.from).to.equal(0);
    expect(expr.options.map((o) => o.label)).to.deep.equal([
      'R1',
      'ctx',
      'true',
      'false',
    ]);
  });
});
