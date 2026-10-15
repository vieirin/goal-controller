/**
 * Tropos4AS in the Notation view: no ids, so an element's line is its name
 * as the figure draws it, its properties on lines under it (#138); both
 * seeds' documents read back to the same model, a renamed line renames its
 * element, and a property line sets its property.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { goalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import { tropos4as } from '../../../src/engines/tropos4as';

const EXAMPLES = path.join(__dirname, '../../../../../examples/tropos4as');

const view = (seed: string) =>
  goalView(
    parsePistar(
      JSON.parse(
        fs.readFileSync(path.join(EXAMPLES, seed, `${seed}.txt`), 'utf8'),
      ),
      { fileMetamodel: true },
    ),
    tropos4as,
  );

describe('Tropos4AS in the Notation view', () => {
  it("writes the Cleaner Agent's elements by their names, their properties under them", () => {
    assert.strictEqual(
      notationDocument(tropos4as, view('cleaner-agent')).text.trim(),
      [
        'RoomClean',
        '  achievement roomClean',
        '  WetCleaning',
        '    type perform',
        '    mop',
        '  DryCleaning',
        '    type perform',
        '    sweep',
        'MaintainBattLoaded',
        '  type maintain',
        '  maintain batteryLoaded',
        '  load battery',
        'efficiency',
      ].join('\n'),
    );
  });

  it("writes patient monitoring's errors, failures and artifacts with their properties", () => {
    const { text } = notationDocument(tropos4as, view('patient-monitoring'));
    for (const lines of [
      'ERROR: no dinner until 8PM\n  condition hour >= 20 & meals < 2\n  take medicine without dinner\n    precondition meals >= 2',
      'meal sensor\n  attributes meals:int',
      'meals not eaten\nmedicine not taken',
    ])
      assert.ok(text.includes(lines), lines);
  });

  for (const seed of ['cleaner-agent', 'patient-monitoring'])
    it(`${seed}: the document reads back to the same model, without a problem`, () => {
      const tree = view(seed);
      const { text } = notationDocument(tropos4as, tree);
      assert.deepStrictEqual(notationEdits(tropos4as, text, tree), []);
      assert.deepStrictEqual(
        documentDiagnostics(
          tropos4as,
          text,
          contextFromView(tropos4as, tree, []),
        ),
        [],
      );
    });

  it('renames an element from its line, and sets a property from its line', () => {
    const tree = view('cleaner-agent');
    const { text } = notationDocument(tropos4as, tree);
    assert.deepStrictEqual(
      notationEdits(
        tropos4as,
        text.replace('\nMaintainBattLoaded\n', '\nMaintainBattery\n'),
        tree,
      ),
      [{ iStarId: 'MBL', text: 'MaintainBattery' }],
    );
    assert.deepStrictEqual(
      notationEdits(
        tropos4as,
        text.replace('achievement roomClean', 'achievement roomClean & dry'),
        tree,
      ),
      [{ iStarId: 'RC', key: 'achievement', value: 'roomClean & dry' }],
    );
  });
});
