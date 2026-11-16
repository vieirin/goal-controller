/**
 * tropos4as's `failure` is a kind's word (`tropos4as.Failure`) and a goal's
 * property key (goal-controller#518): the line's form decides. A goal's
 * `failure hour >= 20` under its line is its property line, as before; a
 * `failure <id>: <name>` line declares a failure.
 */
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { goalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
  readLine,
} from '@goal-controller/goal-language';
import type { AnyDialect } from '@goal-controller/dialect';
import { tropos4as } from '../../../src/engines/tropos4as/definition';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const dialect = tropos4as as unknown as AnyDialect;
const MODEL = path.join(
  __dirname,
  '../../../../../examples/tropos4as/patient-monitoring/patient-monitoring.txt',
);

describe('tropos4as: `failure`, a kind word and a property key (#518)', () => {
  it('reads a goal’s failure condition as its property line, as before', () => {
    const read = readLine(dialect, '    failure hour >= 20');
    expect(read.kind === 'property' && [read.key, read.value]).to.deep.equal([
      'failure',
      'hour >= 20',
    ]);
  });

  it('reads a failure declared with an id as an element line', () => {
    const read = readLine(dialect, 'failure f1: Cannot reach');
    expect(
      read.kind === 'element' && [read.word?.kind, read.id, read.text],
    ).to.deep.equal(['tropos4as.Failure', 'f1', 'f1: Cannot reach']);
  });

  it('round-trips the patient-monitoring model: its failure lines change nothing', () => {
    // its piStar ids are words (`takeMedicine`, `takeMedicineReminder`):
    // their first 8 characters collide, so each is written as its id
    const json = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
    for (const actor of json.actors)
      for (const node of actor.nodes) node.text = `${node.id}: ${node.text}`;
    const model = parsePistar(json, { fileMetamodel: true });
    const view = goalView(model, dialect);
    const { text } = notationDocument(dialect, view);
    expect(text).to.match(/\n\s+failure hour >= 20\n/);
    expect(notationEdits(dialect, text, view)).to.deep.equal([]);
    expect(
      documentDiagnostics(dialect, text, contextFromView(dialect, view, [])),
    ).to.deep.equal([]);
    const edited = text.replace('failure hour >= 20', 'failure hour >= 21');
    expect(
      notationEdits(dialect, edited, view).map((edit) =>
        'key' in edit ? [edit.key, edit.value] : edit,
      ),
    ).to.deep.equal([['failure', 'hour >= 21']]);
  });
});
