/**
 * GODA's dialect (goal-controller#32): its models read in the editors with no
 * diagnostics and round-trip through the Notation view, and what the language
 * grew for it reads as GODA's ANTLR grammars and model reader do.
 */
import { expect } from 'chai';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  goalNameParserFor,
  kindOfId,
  notationDocument,
  notationEdits,
  parseElementLine,
  readLine,
} from '@goal-controller/goal-language';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import { transform } from '../../../ui/services/transform';
import {
  edge,
  edgeV2,
  goda,
  godaCheckRegistry,
  mutrose,
  type GodaCheckName,
} from '../../src';
import { models, ROOT } from './support/models';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { EXAMPLES } = require('../../../../scripts/goda-stress/fetch.cjs');

const dialect = goda as AnyDialect;

/** Our own models, and upstream's AND and OR when they are fetched (#34 D1). */
const GODA_MODELS = [
  ...models('examples/goda'),
  ...['AND/and2.txt', 'OR/or2.txt']
    .map((file) => join(EXAMPLES, file))
    .filter(existsSync)
    .map((file) => ({ file, model: readFileSync(file, 'utf8') })),
];

describe('GODA: its models in the editors', () => {
  it('has models to read', () => {
    expect(GODA_MODELS.length).to.be.greaterThan(0);
  });

  for (const { file, model } of GODA_MODELS)
    it(`${file.replace(`${ROOT}/`, '')}: no diagnostics, and its Notation view changes nothing`, () => {
      const view = goalView(parsePistar(model), goda);
      const { text } = notationDocument(goda, view);
      expect(notationEdits(goda, text, view)).to.deep.equal([]);
      const context = contextFromView(goda, view, []);
      const runCheck = (
        check: string,
        properties: Readonly<Record<string, string>>,
        self: string,
      ) =>
        godaCheckRegistry[check as GodaCheckName](
          properties,
          checkContextOf(context, self),
        );
      expect(
        documentDiagnostics(dialect, text, context, { runCheck }),
      ).to.deep.equal([]);
    });
});

describe('GODA: what the language reads for it', () => {
  const read = goalNameParserFor(goda);

  it('reads DM with any number of operands as decision making, spaces in the bracket ignored', () => {
    expect(
      read({ goalText: 'T1: Monitor [DM(T1.1,T1.2,T1.3,T1.X)]' })
        .executionDetail,
    ).to.deep.equal({
      type: 'decisionMaking',
      ids: ['T1.1', 'T1.2', 'T1.3', 'T1.X'],
      modifiers: {},
    });
    // Fragmented.txt writes `D M(T1.11,T1.1 2,…)`
    const errors: string[] = [];
    expect(
      read({
        goalText: 'T1.1: task [D M(T1.11,T1.1 2,T1.13 ,T1.14)]',
        onSyntaxError: (message) => errors.push(message),
      }).executionDetail?.ids,
    ).to.deep.equal(['T1.11', 'T1.12', 'T1.13', 'T1.14']);
    expect(errors).to.deep.equal([]);
  });

  it('points at an id as written when it reads the bracket without its spaces', () => {
    const text = 'T1: Pick [D M(T1.1 1,T1.2)]';
    const line = readLine(dialect, text);
    if (line.kind !== 'element') throw new Error('an element line');
    expect(
      line.notation?.refs.map(({ id, span }) => [
        id,
        text.slice(span.from, span.to),
      ]),
    ).to.deep.equal([
      ['T1.11', 'T1.1 1'],
      ['T1.2', 'T1.2'],
    ]);
    expect(line.notation?.text).to.equal('D M(T1.1 1,T1.2)');
    // without the dialect's rule, a space in the bracket is an error (RTRegex.g4's)
    expect(
      readLine({ elements: dialect.elements }, text).errors,
    ).not.to.deep.equal([]);
  });

  it("reads a leaf's cost, and every id form GODA's models write", () => {
    expect(parseElementLine('T1.1: Pick [W = 0.5x]').value?.cost).to.deep.equal(
      {
        value: '0.5',
        variable: 'x',
      },
    );
    expect(parseElementLine('T1.1: Pick [W = x]').value?.cost).to.deep.equal({
      value: null,
      variable: 'x',
    });
    for (const id of ['T1.11', 'T1.411', 'T1.X', 'T1.1X', 'TX', 'GX'])
      expect(parseElementLine(`${id}: Pick`).value?.id, id).to.equal(id);
  });

  it('reads the same task id under two goals, and one twice under a goal as a duplicate', () => {
    const doc = [
      'G3: Collect',
      '  T1.1: Read',
      'G4: Report',
      '  T1.1: Read',
    ].join('\n');
    const context = {
      elements: {
        G3: { kind: 'goal', children: ['T1.1'], properties: {} },
        G4: { kind: 'goal', children: ['T1.1'], properties: {} },
        'T1.1': { kind: 'task', children: [], properties: {} },
      },
      variables: [],
    };
    expect(documentDiagnostics(dialect, doc, context)).to.deep.equal([]);
    expect(
      documentDiagnostics(dialect, `${doc}\n  T1.1: Again`, context).map(
        (d) => d.message,
      ),
    ).to.deep.equal(['Duplicate id T1.1 under G4']);
    // Edge's ids are unique in the model
    expect(
      documentDiagnostics(
        { ...dialect, idScope: undefined, name: 'Edge' },
        doc,
        context,
      ).map((d) => d.message),
    ).to.deep.equal(['Duplicate id T1.1']);
  });
});

describe('GODA in the workbench', () => {
  it('generates its eight files, the MDP first and primary, through transform', () => {
    const { files } = transform({
      modelJson: readFileSync(
        join(ROOT, 'examples/goda/LabResults.txt'),
        'utf8',
      ),
      engine: 'goda',
      fileName: 'LabResults',
    });
    expect(files.map((file) => file.fileName)).to.deep.equal([
      'Lab.nm',
      'ReachabilityMax.pctl',
      'ReachabilityMin.pctl',
      'CostMax.pctl',
      'CostMin.pctl',
      'reliability.out',
      'cost.out',
      'eval_formula.sh',
    ]);
    expect(
      files.filter((file) => file.primary).map((file) => file.id),
    ).to.deep.equal(['model']);
  });
});

describe('What the language grew for GODA, in Edge', () => {
  for (const definition of [edge, edgeV2])
    it(`${definition.name}: reads TX as an id, and reports a cost bracket`, () => {
      const read = goalNameParserFor(definition);
      // RTRegex.g4 read `TX` as a name and rejected the line (goal-language.md, divergence 6)
      const errors: string[] = [];
      expect(
        read({
          goalText: 'G1: Pick [G2;TX]',
          onSyntaxError: (message) => errors.push(message),
        }).executionDetail?.ids,
      ).to.deep.equal(['G2', 'TX']);
      expect(errors).to.deep.equal([]);
      const costs: string[] = [];
      read({
        goalText: 'T1: Pick [W = 1]',
        onSyntaxError: (message) => costs.push(message),
      });
      expect(costs).to.deep.equal([
        `1:9 A cost is not part of ${definition.name}`,
      ]);
      // and in its editors
      const doc = 'T1: Pick [W = 1]';
      expect(
        documentDiagnostics(definition as AnyDialect, doc, {
          elements: { T1: { kind: 'task', children: [], properties: {} } },
          variables: [],
        }).map((d) => [doc.slice(d.from, d.to), d.message]),
      ).to.deep.equal([['W = 1', `A cost is not part of ${definition.name}`]]);
    });

  it("GODA's reader takes the cost bracket", () => {
    const errors: string[] = [];
    goalNameParserFor(goda)({
      goalText: 'T1: Pick [W = 1]',
      onSyntaxError: (message) => errors.push(message),
    });
    expect(errors).to.deep.equal([]);
  });

  it('names an id’s kind by its longest prefix that a number or X follows', () => {
    expect(kindOfId(mutrose, 'AT1')).to.equal('task');
    expect(kindOfId(mutrose, 'G2')).to.equal('goal');
    expect(kindOfId(goda, 'T1.X')).to.equal('task');
    expect(kindOfId(goda, 'TX')).to.equal('task');
    expect(kindOfId(goda, 'Task')).to.equal(undefined);
    // two prefixes one of which starts the other: each takes its own ids only
    const overlapping = {
      elements: { goal: { prefix: 'A' }, task: { prefix: 'AT' } },
    } as never;
    expect(kindOfId(overlapping, 'AT1')).to.equal('task');
    expect(kindOfId(overlapping, 'ATX')).to.equal('task');
    expect(kindOfId(overlapping, 'A1')).to.equal('goal');
    expect(kindOfId(overlapping, 'AX')).to.equal('goal');
  });
});
