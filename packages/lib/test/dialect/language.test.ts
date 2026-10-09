import { expect } from 'chai';
import {
  completionsAt,
  documentDiagnostics,
  fieldCompletionsAt,
  fieldDiagnostics,
  type DefinitionContext,
} from '@goal-controller/dialect';
import { edgeV2 } from '../../src';

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
        upperBound: '10',
        initialValue: '5',
      },
    },
  },
  variables: ['ctx'],
};

const messages = (doc: string, options = {}) =>
  documentDiagnostics(edgeV2, doc, context, options).map((d) => [
    doc.slice(d.from, d.to),
    d.severity,
    d.message,
  ]);

describe('documentDiagnostics', () => {
  it('is quiet on a matching document', () => {
    expect(
      messages('G1: Go [G2;T1]\n  G2: A\n  T1: B\n  R1: R {int 0..10 = 5}'),
    ).to.deep.equal([]);
  });

  it('flags non-children, missing children and unknown lines', () => {
    expect(messages('G1: Go [G2;T9]\nG7: New')).to.deep.equal([
      ['T9', 'error', 'Not a child of this goal'],
      ['G2;T9', 'warning', 'Missing from the notation: T1'],
      ['G7', 'error', 'Add this element in the diagram'],
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
    const [d] = documentDiagnostics(edgeV2, 'G1: Go [G2;T1]', ctx);
    expect(d!.severity).to.equal('error');
    expect(d!.message).to.match(/^Sequence needs AND refinement links/);
  });

  it('runs the named checks on property lines and declarations', () => {
    const calls: string[] = [];
    const runCheck = (
      check: string,
      properties: Readonly<Record<string, string>>,
    ) => {
      calls.push(check);
      return check === 'edge.resource.initialValue' &&
        properties.initialValue === '99'
        ? 'out of bounds'
        : null;
    };
    const doc =
      'G1: Go [G2;T1]\n  maxRetries 2\n  maintain x\nR1: R {int 0..10 = 99}';
    expect(messages(doc, { runCheck })).to.deep.equal([
      ['maintain x', 'warning', 'Only read when type is maintain'],
      ['{int 0..10 = 99}', 'error', 'out of bounds'],
    ]);
    expect(calls).to.include('edge.goal.maxRetries');
  });

  it('flags lines it cannot read', () => {
    expect(
      messages('  maxRetries 2\nT1: B\n  maintain x\n  nonsense here'),
    ).to.deep.equal([
      ['maxRetries 2', 'error', 'A property belongs under an element line'],
      ['maintain', 'warning', 'Not read for a task'],
      ['nonsense here', 'error', 'Not a property line'],
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
      edgeV2,
      context,
      'R1',
      'initialValue',
      '42',
      (check, p) =>
        check === 'edge.resource.initialValue' && p.initialValue === '42'
          ? 'nope'
          : null,
    );
    expect(d).to.deep.equal([
      { from: 0, to: 2, severity: 'error', message: 'nope' },
    ]);
  });
});

describe('completions', () => {
  it('offers children inside a notation', () => {
    const doc = 'G1: Go [G2;';
    const result = completionsAt(edgeV2, doc, doc.length, context)!;
    expect(result.from).to.equal(doc.length);
    expect(result.options.map((o) => o.label)).to.deep.equal([
      'G2',
      'T1',
      'skip',
    ]);
    expect(completionsAt(edgeV2, 'G1: Go', 3, context)).to.equal(null);
  });

  it('offers the keys a kind reads, not yet set', () => {
    const doc = 'G1: Go\n  maxRetries 1\n  ma';
    const result = completionsAt(edgeV2, doc, doc.length, context)!;
    expect(result.from).to.equal(doc.length - 2);
    const labels = result.options.map((o) => o.label);
    expect(labels).to.include('maintain');
    expect(labels).to.not.include('maxRetries');
    expect(labels).to.not.include('root');
  });

  it('offers ids and names in fields', () => {
    const refs = fieldCompletionsAt(
      edgeV2,
      { type: 'refList', kind: 'goal', separator: ',' },
      'G1, ',
      4,
      context,
    )!;
    expect(refs.options.map((o) => o.label)).to.deep.equal(['G1', 'G2']);
    const expr = fieldCompletionsAt(
      edgeV2,
      { type: 'expression', language: 'assertion' },
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
