import { expect } from 'chai';
import {
  completionsAt,
  documentDiagnostics,
  fieldCompletions,
  fieldCompletionsAt,
  fieldDiagnostics,
} from '@goal-controller/goal-language';
import type { DefinitionContext } from '@goal-controller/dialect';
import { edge, edgeV2, mutrose } from '../../src';

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
      messages('  maxRetries 2\nT1: B\n  maintain x\n  nonsense here\n  [T2]'),
    ).to.deep.equal([
      ['maxRetries 2', 'error', 'A property belongs under an element line'],
      ['maintain', 'warning', 'Not read for a task'],
      ['nonsense', 'warning', 'Not read for a task'],
      ['[T2]', 'error', 'Not a property line'],
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
      {
        from: 0,
        to: 2,
        severity: 'error',
        message: 'nope',
        elementId: 'R1',
        key: 'initialValue',
        check: 'edge.resource.initialValue',
      },
    ]);
  });
});

describe('completions', () => {
  it('offers children and the operators each engine enables inside a notation', () => {
    const doc = 'G1: Go [G2;';
    const result = completionsAt(edgeV2, doc, doc.length, context)!;
    expect(result.from).to.equal(doc.length);
    expect(result.options.map((o) => o.label)).to.deep.equal([
      'G2',
      'T1',
      'skip',
      '@3',
      '|',
      '?',
      '+',
      '#',
      ';',
      '->',
    ]);
    // Edge: no `?`, no binary `+`; a choice is a standalone `+`
    expect(
      completionsAt(edge, doc, doc.length, context)!
        .options.filter((o) => o.type === 'keyword')
        .map((o) => [o.label, o.detail]),
    ).to.deep.equal([
      ['skip', undefined],
      ['@3', 'Retry'],
      ['|', 'Alternative'],
      ['#', 'Interleaved'],
      [';', 'Sequence'],
      ['->', 'Degradation'],
      ['+', 'Choice (standalone)'],
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
      { type: 'refList', kind: 'goal' },
      'G1, ',
      4,
      context,
    )!;
    expect(refs.options.map((o) => o.label)).to.deep.equal(['G1', 'G2']);
    const expr = fieldCompletionsAt(
      edgeV2,
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

  it('completes an ocl field: the operations after ->, the names in scope after .', () => {
    const model: DefinitionContext = {
      elements: {
        G1: {
          kind: 'goal',
          children: ['G2'],
          properties: { Controls: 'rooms : Sequence(Room), robot : Robot' },
        },
        G2: {
          kind: 'goal',
          children: [],
          properties: { GoalType: 'Achieve', Monitors: 'rooms' },
        },
      },
      variables: ['battery'],
    };
    const field = (text: string) =>
      fieldCompletions(
        mutrose,
        model,
        'G2',
        'AchieveCondition',
        text,
        text.length,
      );
    const operations = field('rooms->fo')!;
    expect(operations.from).to.equal('rooms->'.length);
    expect(operations.options.map((o) => o.label)).to.deep.equal([
      'select',
      'forAll',
      'exists',
      'collect',
      'reject',
    ]);
    expect(operations.options[1]!.snippet).to.equal(
      'forAll(${1:x} | ${2:condition})',
    );
    // its arguments written already: the name only, over the whole name
    const written = 'rooms->sel(r:Room | r.dirty)';
    const renamed = fieldCompletions(
      mutrose,
      model,
      'G2',
      'AchieveCondition',
      written,
      'rooms->se'.length,
    )!;
    expect([renamed.from, renamed.to]).to.deep.equal([
      'rooms->'.length,
      'rooms->sel'.length,
    ]);
    expect(renamed.options.some((o) => o.snippet)).to.equal(false);
    const names = field('rooms->forAll(r | r.')!;
    expect(names.from).to.equal('rooms->forAll(r | r.'.length);
    expect(names.options.map((o) => [o.label, o.detail])).to.deep.equal([
      ['r', 'bound here'],
      ['rooms', 'Monitors of G2'],
      ['robot', 'Robot (Controls of G1)'],
      ['battery', 'variable'],
    ]);
    // a binding whose parenthesis closed is out of scope
    const after = field('rooms->exists(x | x.a) and rooms->forAll(r | r.')!;
    expect(after.options.map((o) => o.label)).to.deep.equal([
      'r',
      'rooms',
      'robot',
      'battery',
    ]);
    // in a string, nothing
    const quoted = 'assertion condition "r.';
    expect(
      fieldCompletions(
        mutrose,
        model,
        'G1',
        'CreationCondition',
        quoted,
        quoted.length,
      ),
    ).to.equal(null);
  });
});

describe('what each engine allows', () => {
  it('flags the operators an engine does not read', () => {
    const doc = 'G1: Go [G2?T1]';
    expect(documentDiagnostics(edgeV2, doc, context)).to.deep.equal([]);
    expect(
      documentDiagnostics(edge, doc, context).map((d) => [
        doc.slice(d.from, d.to),
        d.message,
      ]),
    ).to.deep.equal([['?', '`?` is not an operator of Edge']]);
    expect(
      documentDiagnostics(edgeV2, 'G1: Go [+]', context).map((d) => d.message),
    ).to.include('A standalone `+` is not a construct of EdgeV2');
  });

  it('flags values not of their type: dependsOn ids, variables pairs', () => {
    const messages = (doc: string) =>
      documentDiagnostics(edgeV2, doc, context).map((d) => d.message);
    expect(messages('G1: Go [G2;T1]\n  dependsOn G9')).to.deep.equal([
      'G9 is not an element of this model',
    ]);
    expect(messages('G1: Go [G2;T1]\n  variables t:x')).to.deep.equal([
      't: Not an integer: x',
    ]);
  });
});
