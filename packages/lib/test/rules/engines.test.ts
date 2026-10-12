/**
 * The engines on the rule layer (goal-controller#75): their readers give
 * #63's facts on medicine-delivery, tas3-edgev2, BSN and Fragmented; the 10
 * MutRoSe oracle cases give #63's problems, where #59's oracle expects them;
 * all 7 GODA models come out clean.
 */
import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as nemo from 'nemo-wasm';
import type { AnyDialect } from '@goal-controller/dialect';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import type { NemoModule } from '../../src/rules';
import {
  checkProject,
  readProject,
  type EngineRules,
  type RuleProject,
} from '../../src/engines/ruleFacts/engine';
import { modelFieldOf } from '../../src/engines/ruleFacts/goalModel';
import { mutrose } from '../../src/engines/mutrose/definition';
import { mutroseRules } from '../../src/engines/mutrose/rules';
import { goda } from '../../src/engines/goda/definition';
import { godaRules } from '../../src/engines/goda/rules';
import { edgeV2 } from '../../src/engines/edgeV2/definition';
import { edgeV2Rules } from '../../src/engines/edgeV2/rules';

const NEMO = nemo as unknown as NemoModule;
const ROOT = join(__dirname, '../../../..');
const FIXTURES = join(__dirname, 'fixtures');
const ORACLE = join(__dirname, 'oracle');

const ENGINES: Record<string, { dialect: AnyDialect; rules: EngineRules }> = {
  mutrose: { dialect: mutrose as AnyDialect, rules: mutroseRules },
  edgev2: { dialect: edgeV2 as AnyDialect, rules: edgeV2Rules },
  goda: { dialect: goda as AnyDialect, rules: godaRules },
};

type Manifest = {
  dialect: string;
  models: { path: string }[];
  projectResources?: Record<string, string | string[]>;
};

/** A project directory as the engine reads it: its first model's view, its resources. */
const projectOf = (dir: string) => {
  const manifest = JSON.parse(
    readFileSync(join(dir, 'project.json'), 'utf8'),
  ) as Manifest;
  const { dialect, rules } = ENGINES[manifest.dialect]!;
  const project: RuleProject = {
    model: goalView(
      parsePistar(readFileSync(join(dir, manifest.models[0]!.path), 'utf8')),
      dialect,
    ),
    resources: Object.entries(manifest.projectResources ?? {}).flatMap(
      ([kind, paths]) =>
        (Array.isArray(paths) ? paths : [paths]).map((path) => ({
          kind,
          path,
          text: readFileSync(join(dir, path), 'utf8'),
        })),
    ),
  };
  return { manifest, rules, project };
};

type Fixture = {
  tuples: [string, (string | number)[]][];
  problems: (string | number)[][];
};
const fixture = (name: string): Fixture =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'));

/** Facts as comparable rows (Nemo's names: no dots), without the kinds' scopes (each engine declares its own). */
const rowsOf = (tuples: Iterable<readonly [string, readonly unknown[]]>) =>
  [...tuples]
    .filter(([relation]) => relation !== 'kindScope')
    .map(
      ([relation, row]) => `${relation.replace(/\./g, '_')}(${row.join('|')})`,
    )
    .sort();

describe('the engines’ readers give #63’s facts', () => {
  const PROJECTS: [string, string][] = [
    ['medicine-delivery', 'examples/projects/medicine-delivery'],
    ['tas3-edgev2', 'examples/projects/tas3-edgev2'],
    ['bsn', 'examples/goda/bsn'],
    ['fragmented', 'examples/goda/fragmented'],
  ];
  for (const [name, dir] of PROJECTS)
    it(name, () => {
      const { rules, project } = projectOf(join(ROOT, dir));
      const { facts } = readProject(rules, project);
      const read = [...facts.rows].flatMap(([relation, rows]) =>
        rows.map((row) => [relation, row] as const),
      );
      expect(rowsOf(read)).to.deep.equal(rowsOf(fixture(name).tuples));
    });
});

describe('the MutRoSe oracle (#59’s broken copies of medicine-delivery)', () => {
  for (const name of readdirSync(ORACLE))
    it(name, async () => {
      const dir = join(ORACLE, name);
      const { manifest, rules, project } = projectOf(dir);
      const { evaluation, diagnostics, read } = await checkProject(
        NEMO,
        rules,
        project,
      );
      // #63's problems
      expect(
        evaluation.problems
          .map((p) => [p.id, p.severity, p.check, p.detail].join('|'))
          .sort(),
      ).to.deep.equal(
        [
          ...new Set(
            fixture(`oracle-${name}`).problems.map((p) =>
              p.map(String).join('|'),
            ),
          ),
        ].sort(),
      );
      // where the oracle expects them: the file (element and field), the text underlined
      const kinds = Object.fromEntries(
        Object.entries(manifest.projectResources ?? {}).map(([kind, path]) => [
          path,
          kind,
        ]),
      );
      const where = (d: {
        file: string;
        element?: string;
        field?: string;
        text: string;
        severity: string;
      }) =>
        [d.file, d.element ?? '', d.field ?? '', d.text, d.severity].join(
          ' | ',
        );
      expect(
        diagnostics
          .map(({ location, severity }) => {
            const field = modelFieldOf(location.document);
            return where({
              file: field ? 'model' : kinds[location.document]!,
              ...(field && { element: field.key, field: field.field }),
              text: read.texts
                .get(location.document)!
                .slice(location.from, location.to),
              severity,
            });
          })
          .sort(),
      ).to.deep.equal(
        (
          JSON.parse(
            readFileSync(join(dir, 'expected.json'), 'utf8'),
          ) as Parameters<typeof where>[0][]
        )
          .map(where)
          .sort(),
      );
    });
});

describe('the 7 GODA models', () => {
  const dirs = readdirSync(join(ROOT, 'examples/goda'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('are 7, and each comes out clean', async () => {
    expect(dirs).to.have.length(7);
    for (const dir of dirs) {
      const { rules, project } = projectOf(join(ROOT, 'examples/goda', dir));
      const { diagnostics } = await checkProject(NEMO, rules, project);
      expect(diagnostics, dir).to.deep.equal([]);
    }
  });
});
