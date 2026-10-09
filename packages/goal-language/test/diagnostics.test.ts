/** Checking and completing a document and a field (src/notation/{diagnostics,completion}.ts). */
import type { DefinitionContext } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  documentDiagnostics,
  fieldCompletionsAt,
  fieldDiagnostics,
  notationRefs,
  parseElementLine,
  readNotation,
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

  it('names what a condition compares that the model does not know', () => {
    const field = (value: string) =>
      fieldDiagnostics(toy, context, 'T1', 'guard', value, undefined);
    expect(field('R1 > 2 & ctx & !nowhere & G2')).to.deep.equal([
      {
        from: 0,
        to: 28,
        severity: 'info',
        message: 'nowhere is not a resource of this model or a known variable',
      },
      {
        from: 0,
        to: 28,
        severity: 'info',
        message: 'G2 is not a resource of this model or a known variable',
      },
    ]);
    // a condition that doesn't parse says only that
    expect(field('R1 >').map((d) => d.severity)).to.deep.equal(['error']);
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
      // the operators Toy enables, and only those
      '@2',
      ';',
      '|',
      '*',
    ]);
    // a partial id: no operators
    const typing = 'G1: Go [G';
    expect(
      completionsAt(toy, typing, typing.length, context)!.options.map(
        (o) => o.label,
      ),
    ).to.deep.equal(['G2', 'T1', 'skip']);
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

describe('what the dialect allows', () => {
  it('flags operators and standalone symbols the dialect does not enable', () => {
    expect(messages('G1: Go [G2+T1]')).to.deep.equal([
      ['+', 'error', '`+` is not an operator of Toy'],
    ]);
    expect(messages('G1: Go [G2;T1]\nG2: A [+]')).to.deep.equal([
      ['+', 'error', 'A standalone `+` is not a construct of Toy'],
    ]);
    // enabled: ; | @ and a standalone *
    expect(messages('G1: Go [G2@2|T1]')).to.deep.equal([]);
  });

  it('flags a call the dialect does not enable, and one with another number of operands', () => {
    expect(messages('G1: Go [FALLBACK(G2,T1)]')).to.deep.equal([
      ['FALLBACK', 'error', '`FALLBACK` is not an operator of Toy'],
    ]);
    const calling = {
      ...toy,
      notation: {
        ...toy.notation,
        operators: { ...toy.notation.operators, FALLBACK: 'fallback' },
      },
    } as typeof toy;
    const found = (doc: string) =>
      documentDiagnostics(calling, doc, context).map((d) => [
        doc.slice(d.from, d.to),
        d.message,
      ]);
    expect(found('G1: Go [FALLBACK(G2,T1)]')).to.deep.equal([]);
    const typing = 'G1: Go [G2;';
    expect(
      completionsAt(calling, typing, typing.length, context)!.options.map(
        (o) => o.label,
      ),
    ).to.include('FALLBACK(');
    expect(found('G1: Go [FALLBACK(G2;T1)]')).to.deep.equal([
      ['FALLBACK', '`FALLBACK` takes 2 operands, not 1'],
    ]);
    // a call is an operand of its own, as a group is; every id it names is named
    const tree = parseElementLine('G1: Go [T1;FALLBACK(G2,T1)]').value!
      .notation;
    expect(notationRefs(tree)).to.deep.equal(['T1', 'G2', 'T1']);
    const read = readNotation(calling, tree);
    expect(read.constructs.get('fallback')).to.deep.equal(['G2', 'T1']);
    expect(read.constructs.get('sequence')).to.deep.equal(['T1']);
  });

  it('flags skip where the dialect has no skip', () => {
    const strict = {
      ...toy,
      notation: { ...toy.notation, operand: { kinds: ['goal', 'task'] } },
    } as typeof toy;
    expect(
      documentDiagnostics(strict, 'G1: Go [G2;T1;skip]', context).map(
        (d) => d.message,
      ),
    ).to.deep.equal(['`skip` is not an operand of Toy']);
  });

  it('flags values not of their property’s type, options or bounds', () => {
    expect(
      messages(
        'G1: Go [G2;T1]\n  priority urgent\nT1: B\n  after G9, T1\n  guard x >\nR1: R {int 0..9 = yes}',
      ),
    ).to.deep.equal([
      ['priority urgent', 'error', 'One of high, not urgent'],
      ['after G9, T1', 'error', 'G9 is not an element of this model'],
      [
        'guard x >',
        'error',
        'Not a condition: Expecting end of file but found `>`.',
      ],
      ['{int 0..9 = yes}', 'error', 'Not an integer: yes'],
    ]);
    expect(messages('G1: Go [G2;T1]\nT1: B\n  after T1')).to.deep.equal([
      ['after T1', 'error', 'T1 is a task, not a goal'],
    ]);
    expect(
      messages('G1: Go [G2;T1]\n  priority high\n  deadline 0'),
    ).to.deep.equal([['deadline 0', 'error', 'At least 1']]);
  });

  it('checks a field’s value with its type when the engine says nothing', () => {
    expect(
      fieldDiagnostics(toy, context, 'R1', 'lowerBound', 'x', () => null),
    ).to.deep.equal([
      { from: 0, to: 1, severity: 'error', message: 'Not an integer: x' },
    ]);
  });

  it('flags annotations and declarations on kinds that carry none', () => {
    expect(messages('<<urgent>> G1: Go [G2;T1]\nT1: B {int}')).to.deep.equal([
      ['<<urgent>>', 'error', 'A goal carries no annotations in Toy'],
      ['{int}', 'error', 'A task declares nothing on its line in Toy'],
    ]);
  });

  it('flags what a line cannot read, once, where it starts', () => {
    expect(messages('G1: Go [G2;;T1]')).to.deep.equal([
      [';', 'error', 'Unexpected ;'],
    ]);
    expect(messages('G1: Go [G2;T1$]')).to.deep.equal([
      ['$', 'error', "Not part of the goal language: '$'"],
    ]);
    expect(messages('G1: Go [G2;T1')).to.deep.equal([
      ['1', 'error', 'The line ends before it is complete'],
    ]);
  });
});
