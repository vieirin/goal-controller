/**
 * KAOSTools' textual KAOS (goal-controller#181), the format the goal
 * language serves (src/formats/kaos/kaos.langium): the grammar over the
 * corpus, the older forms it reads beside KAOSTools' PEG, a declaration
 * without its `end`, and the `.kaos` tab's highlighting. The corpus is
 * ./fixtures/kaos: ADS's six models (ancailliau/ADS `da3241f`,
 * `UCLouvain.AmbulanceSystem.Monitoring/Models`, MIT) and KAOSTools' LAS
 * (ancailliau/KAOSTools `6a25d84`, `Parsing.Tests/Examples/las.kaos`, MIT),
 * each with its licence. lib's importer tests read it too.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'mocha';
import {
  kaosLanguage,
  parseKaos,
  type KaosDeclaration,
} from '../src/formats/index.js';

const here = import.meta.dirname;
const fixture = (path: string) =>
  readFileSync(join(here, 'fixtures', 'kaos', path), 'utf8');
const CORPUS = [
  'las.kaos',
  'obstacles.kaos',
  'resolutions.kaos',
  'simple.kaos',
  'simple_new_syntax.kaos',
  'validation-model.kaos',
]
  .map((name) => `ads/${name}`)
  .concat('kaostools/las.kaos');

describe('the .kaos grammar (kaos.langium) over the corpus', () => {
  for (const path of CORPUS)
    it(`parses ${path} without an error`, () => {
      const { diagnostics } = parseKaos(fixture(path));
      assert.deepStrictEqual(diagnostics, []);
    });

  it('reads a formula to its end: time bounds, `when … then`, parentheses over lines, comments', () => {
    const { ast, diagnostics } = parseKaos(`declare obstacle [ o ]
  formalspec sooner-or-later (  # waits
    PendingIncident() and always, for 12 seconds, not AmbAvailable()
  )
  refinedby a, b
end
declare goal [ g ]
  formalspec when x() and not y() then sooner-or-later, before 2 minutes, z.done == true
end`);
    assert.deepStrictEqual(diagnostics, []);
    const [o, g] = ast.items as KaosDeclaration[];
    assert.deepStrictEqual(
      o!.attributes.map((a) => [a.name, a.values.map((v) => v.atom.$type)]),
      [
        ['formalspec', ['FormulaAtom']],
        ['refinedby', ['NameAtom', 'NameAtom']],
      ],
    );
    assert.strictEqual(g!.attributes[0]!.values[0]!.atom.$type, 'FormulaAtom');
  });

  it('reads the older forms: an `id` attribute, `resolvedby(pattern[anchor])`, a nested anonymous declaration, a tuple', () => {
    const { ast, diagnostics } = parseKaos(`declare obstacle
  id o
  resolvedby(mitigation[g]) r
  refinedby declare obstacle
      name "Paper Jam"
      probability[e4] (20%, 20%, 40%)
    end
end`);
    assert.deepStrictEqual(diagnostics, []);
    const [o] = ast.items as KaosDeclaration[];
    assert.strictEqual(o!.id, undefined);
    const [id, resolvedby, refinedby] = o!.attributes;
    assert.strictEqual(id!.name, 'id');
    assert.ok(resolvedby!.parenthesised);
    assert.strictEqual(resolvedby!.params[0]!.bracket[0]!.$cstNode!.text, 'g');
    const nested = refinedby!.values[0]!.atom;
    assert.strictEqual(nested.$type, 'DeclarationAtom');
    if (nested.$type !== 'DeclarationAtom') return;
    assert.strictEqual(
      nested.declaration.attributes[1]!.values[0]!.atom.$type,
      'TupleAtom',
    );
  });

  it('lets a top-level declaration lack its `end` (the next one starts it); a nested one takes the next `end`', () => {
    const open = parseKaos(
      'declare goal [ a ]\n  name "A"\ndeclare goal [ b ]\nend',
    );
    assert.deepStrictEqual(open.diagnostics, []);
    assert.deepStrictEqual(
      (open.ast.items as KaosDeclaration[]).map((d) => [d.id, d.closed]),
      [
        ['a', false],
        ['b', true],
      ],
    );
    // the nested declaration takes the `end`: the outer one is without its own
    const nested = parseKaos(
      'declare obstacle [ o ]\n  refinedby declare obstacle name "x"\nend',
    );
    assert.deepStrictEqual(nested.diagnostics, []);
    const [outer] = nested.ast.items as KaosDeclaration[];
    const inner = outer!.attributes[0]!.values[0]!.atom;
    assert.ok(
      !outer!.closed &&
        inner.$type === 'DeclarationAtom' &&
        inner.declaration.closed,
    );
  });

  it('highlights the .kaos tab: keywords, strings, numbers, comments', () => {
    const text = '# LAS\ndeclare goal [ g ]\n  name "G"\n  rsr 95%\nend';
    const kinds = kaosLanguage
      .highlight(text)
      .map((h) => `${h.kind}:${text.slice(h.from, h.to)}`);
    for (const expected of [
      'comment:# LAS',
      'keyword:declare',
      'string:"G"',
      'number:95%',
      'keyword:end',
    ])
      assert.ok(kinds.includes(expected), `${expected} in ${kinds.join(' ')}`);
  });
});
