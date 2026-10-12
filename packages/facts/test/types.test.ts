/**
 * #58's type rules, as rules over the pool: Edge's variables typed by
 * variables.json, GODA's by every use; and ids scoped by their goal (BSN's).
 */
import * as assert from 'assert';
import * as path from 'path';
import { describe, it } from 'mocha';
import { FactPool, poolFor, type PoolDocument } from '../src';
import {
  documentsOf,
  exampleProject,
  readProject,
  ROOT,
  withProperties,
} from './project';

/** A pool of a project's documents, some properties and resources changed. */
const pool = (
  files: Record<string, string>,
  edits: Record<string, Record<string, string>>,
  resources: Record<string, string> = {},
) => {
  const { definition, documents } = documentsOf(files);
  const changed: PoolDocument[] = withProperties(documents, edits).map((d) =>
    resources[d.id] === undefined ? d : { ...d, text: resources[d.id] },
  );
  const result = new FactPool(poolFor(definition)!);
  result.update(changed);
  return result;
};

const problems = (p: FactPool) =>
  p
    .diagnostics()
    .map(
      (d) =>
        `${d.location.document} ${d.severity} ${p.textOf(d.location.document)!.slice(d.location.from, d.location.to)}: ${d.message}`,
    )
    .sort();

describe('#58 types, Edge (variables.json)', () => {
  const files = exampleProject('tas3-edgev2');
  const variables = JSON.stringify({
    ...JSON.parse(files['variables.json']!),
    battery: 3,
    level: 0.5,
  }).replace('"level":0.5', '"level":0.50');
  const check = (assertion: string) =>
    problems(
      pool(files, { G3: { assertion } }, { 'variables.json': variables }),
    );

  it('the example has none', () => {
    assert.deepStrictEqual(problems(pool(files, {})), []);
  });

  it('an ordering comparator on a boolean is an error', () => {
    assert.deepStrictEqual(check('privacyEnabled > 3'), [
      'model:G3:assertion error privacyEnabled: `privacyEnabled` is a boolean: compare it with = or !=',
    ]);
  });

  it('= and != must match types', () => {
    assert.deepStrictEqual(check('privacyEnabled != 3'), [
      'model:G3:assertion error privacyEnabled: `privacyEnabled` is a boolean: compare it with true or false',
    ]);
    assert.deepStrictEqual(check('battery = true'), [
      'model:G3:assertion error battery: `battery` is a number (int): compare it with a number',
    ]);
  });

  it('a bare variable or a ! needs a boolean', () => {
    assert.deepStrictEqual(check('battery'), [
      'model:G3:assertion error battery: `battery` is a number (int): a condition needs a boolean',
    ]);
    assert.deepStrictEqual(check('!level & privacyEnabled'), [
      'model:G3:assertion error level: `level` is a number (number): a condition needs a boolean',
    ]);
  });

  it('an int compared with a decimal is a warning; a number with a decimal is fine', () => {
    assert.deepStrictEqual(check('battery > 2.5'), [
      'model:G3:assertion warning battery: `battery` is an int: compared with a decimal',
    ]);
    assert.deepStrictEqual(check('level > 0.5 & battery >= 2'), []);
  });

  it('an unknown name has no type, so no type error on top', () => {
    assert.deepStrictEqual(check('nowhere > 3'), [
      'model:G3:assertion error nowhere: No variable or resource named `nowhere`',
    ]);
  });

  it('a resource declares its type (R1 is an int)', () => {
    assert.deepStrictEqual(check('R1 > 2'), []);
    assert.deepStrictEqual(check('R1'), [
      'model:G3:assertion error R1: `R1` is a number (int): a condition needs a boolean',
    ]);
  });

  it('goes to variables.json from a use', () => {
    const p = pool(files, {});
    const [at] = p.definitionAt('model:G3:assertion', 1);
    assert.strictEqual(at?.document, 'variables.json');
    assert.strictEqual(
      p.textOf('variables.json')!.slice(at!.from, at!.to),
      'privacyEnabled',
    );
  });
});

describe('#58 types, GODA (declared by use)', () => {
  const files = readProject(path.join(ROOT, 'examples', 'goda', 'bsn'));

  it('BSN has none', () => {
    assert.deepStrictEqual(problems(pool(files, {})), []);
  });

  it('a variable used both ways is a diagnostic on every use', () => {
    assert.deepStrictEqual(
      problems(
        pool(files, {
          'G3/T1.1': { creationProperty: 'assertion trigger mode = true' },
          'G3/T1.2': { creationProperty: 'assertion trigger mode > 2' },
        }),
      ),
      [
        'model:G3/T1.1:creationProperty error mode: `mode` is used both as a boolean and as a number',
        'model:G3/T1.2:creationProperty error mode: `mode` is used both as a boolean and as a number',
      ],
    );
  });

  it('uses that agree type the variable: then the rules apply as in Edge', () => {
    const p = pool(files, {
      'G3/T1.1': { creationProperty: 'assertion trigger level > 2' },
      'G3/T1.2': { creationProperty: 'assertion trigger level <= 0.5' },
    });
    assert.deepStrictEqual(problems(p), []);
    assert.deepStrictEqual(p.db.query('gm.usedAs', ['level']), [
      ['level', 'number'],
    ]);
  });

  it('the first use is the definition: go to it, and rename every use', () => {
    const p = pool(files, {
      'G3/T1.1': { creationProperty: 'assertion trigger level > 2' },
      'G3/T1.2': { creationProperty: 'assertion trigger level <= 0.5' },
    });
    const at = 'assertion trigger '.length + 1;
    assert.deepStrictEqual(
      p.definitionAt('model:G3/T1.2:creationProperty', at),
      [
        {
          document: 'model:G3/T1.1:creationProperty',
          from: at - 1,
          to: at + 4,
        },
      ],
    );
    const renamed = p.renameAt('model:G3/T1.2:creationProperty', at, 'charge');
    assert.ok('edits' in renamed);
    assert.deepStrictEqual(renamed.edits.map((e) => e.document).sort(), [
      'model:G3/T1.1:creationProperty',
      'model:G3/T1.2:creationProperty',
    ]);
  });
});

describe('ids scoped by their goal (BSN’s T1.2 under G3 and under G4)', () => {
  const files = readProject(path.join(ROOT, 'examples', 'goda', 'bsn'));
  const { definition, documents } = documentsOf(files);
  const p = new FactPool(poolFor(definition)!);
  p.update(documents);

  it('keeps both, keyed by the view (not merged by their written id)', () => {
    const t12 = p.db
      .query('defines', [undefined, 'gm.task', 'T1.2'])
      .map((t) => t[0])
      .sort();
    assert.deepStrictEqual(t12, ['gm:G3/T1.2', 'gm:G4/T1.2']);
  });

  it('a notation resolves among its own element’s children', () => {
    for (const parent of ['G3/T1', 'G4/T1']) {
      const document = `model:${parent}:notation`;
      const text = p.textOf(document);
      if (!text) continue;
      const at = text.indexOf('T1.2');
      if (at < 0) continue;
      const [target] = p.definitionAt(document, at + 1);
      assert.strictEqual(
        target?.document,
        `model:${parent.split('/')[0]}/T1.2:id`.replace('G4/T1.2', 'G4/T1.2'),
      );
    }
  });

  it('a global reference to a repeated id is ambiguous, and a rename refuses it', () => {
    const toy = new FactPool(poolFor(definition)!);
    toy.update(
      withProperties(documents, {
        'G3/T1.1': { creationProperty: 'assertion trigger x = true' },
      }),
    );
    assert.ok(
      'refused' in toy.renameAt('model:G3/T1.2:id', 1, 'T1.1'),
      'G3 already has a T1.1',
    );
    assert.ok('edits' in toy.renameAt('model:G3/T1.2:id', 1, 'T1.9'));
  });
});
