/**
 * GRL in the Notation view (goal-controller#106): its contributions'
 * properties as link lines, the target named by its text (GRL has no ids),
 * read back, edited, and checked with GRL's named checks.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { goalView } from '@goal-controller/goal-tree';
import {
  checkContextOf,
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import { grl, grlCheckRegistry } from '../../../src/engines/grl';

const MODEL = path.join(
  __dirname,
  '../../../../../examples/projects/grl-own/grl-own.txt',
);

const view = () =>
  goalView(
    parsePistar(JSON.parse(fs.readFileSync(MODEL, 'utf8')), {
      fileMetamodel: true,
    }),
    grl,
  );

describe('GRL in the Notation view', () => {
  it('writes each contribution under its source, the target by its text', () => {
    const { text } = notationDocument(grl, view());
    assert.ok(
      text.includes(
        '    Heat with the heat pump\n' +
          '      link "Low running cost" {contribution = Make} {quantitativeContribution = 100}\n' +
          '      link "Comfort" {contribution = Help} {quantitativeContribution = 25}\n',
      ),
      text,
    );
  });

  it('reads its own document back: no diagnostic, no edit', () => {
    const tree = view();
    const { text } = notationDocument(grl, tree);
    const context = contextFromView(grl, tree, []);
    assert.deepStrictEqual(documentDiagnostics(grl, text, context), []);
    assert.deepStrictEqual(notationEdits(grl, text, tree), []);
  });

  it('maps an edited contribution back to its link, and checks it with GRL’s checks', () => {
    const tree = view();
    const { text } = notationDocument(grl, tree);
    const context = contextFromView(grl, tree, []);
    const runCheck = (
      name: string,
      properties: Readonly<Record<string, string>>,
      self: string,
    ) =>
      grlCheckRegistry[name as keyof typeof grlCheckRegistry]?.(
        properties,
        checkContextOf(context, self),
      ) ?? null;
    const edited = text
      .replace(
        '"Comfort" {contribution = Help} {quantitativeContribution = 25}',
        '"Comfort" {contribution = Help} {quantitativeContribution = 30}',
      )
      .replace(
        '"Comfort" {contribution = Hurt} {quantitativeContribution = -50}',
        '"Comfort" {contribution = Hurt} {quantitativeContribution = 500}',
      );
    const link = (source: string) =>
      tree.links.find(
        (l) =>
          l.kind === 'istar.ContributionLink' &&
          tree.nodes.get(l.source ?? '')?.name === source &&
          tree.nodes.get(l.target ?? '')?.name === 'Comfort',
      )!.iStarId;
    assert.deepStrictEqual(notationEdits(grl, edited, tree), [
      {
        link: link('Heat with the heat pump'),
        key: 'quantitativeContribution',
        value: '30',
      },
      {
        link: link('Heat with the gas boiler'),
        key: 'quantitativeContribution',
        value: '500',
      },
    ]);
    assert.deepStrictEqual(
      documentDiagnostics(grl, edited, context, { runCheck }).map((d) => [
        edited.slice(d.from, d.to),
        d.check,
        d.message,
      ]),
      [
        [
          '500',
          'grl.link.quantitativeContribution',
          'A quantitative contribution is an integer, −100..100, not 500',
        ],
      ],
    );
  });
});
