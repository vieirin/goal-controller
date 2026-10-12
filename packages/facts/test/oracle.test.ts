/**
 * The oracle shared with #59's design (test/oracle/<case>/expected.json):
 * each broken copy of medicine-delivery gives exactly the diagnostics
 * expected, matched by file, element and field, underlined text and
 * severity (not offsets: the two designs may underline a quote apart).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { oracleDiagnostics } from './project';

type Expected = {
  file: string;
  element?: string;
  field?: string;
  text: string;
  severity: string;
  check: string;
};

const ORACLE = path.join(__dirname, 'oracle');

const key = (d: {
  file: string;
  element?: string;
  field?: string;
  text: string;
  severity: string;
}) => [d.file, d.element ?? '', d.field ?? '', d.text, d.severity].join(' | ');

describe('the #59 oracle (broken copies of medicine-delivery)', () => {
  for (const name of fs.readdirSync(ORACLE).filter((n) => !n.includes('.'))) {
    it(name, () => {
      const expected = JSON.parse(
        fs.readFileSync(path.join(ORACLE, name, 'expected.json'), 'utf8'),
      ) as Expected[];
      const actual = oracleDiagnostics(path.join(ORACLE, name));
      assert.deepStrictEqual(actual.map(key).sort(), expected.map(key).sort());
    });
  }
});
