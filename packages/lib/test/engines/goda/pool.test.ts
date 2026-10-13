/**
 * GODA's definition pool (#58, ported from goal-controller#63): context
 * variables declared by their first use, a variable used both ways an
 * error on every use; and ids scoped by their goal (BSN's two T1.2, #71's
 * cases, read from the model's tree since #87).
 */
import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import {
  createPool,
  definitionAt,
  renameEdits,
  symbolAt,
} from '../../../src/engines/definitionPool';
import { goda } from '../../../src/engines/goda/definition';
import { godaPool } from '../../../src/engines/goda/pool';
import { withProperties } from '../poolModel';

const EXAMPLES = join(__dirname, '../../../../../examples/goda');

/** A GODA project's model (the one its project.json names). */
const modelOf = (project: string) => {
  const manifest = JSON.parse(
    readFileSync(join(EXAMPLES, project, 'project.json'), 'utf8'),
  ) as { models: { path: string }[] };
  return goalView(
    parsePistar(
      readFileSync(join(EXAMPLES, project, manifest.models[0]!.path), 'utf8'),
    ),
    goda,
  );
};

const BSN = modelOf('bsn');
const indexOf = (edits: Record<string, Record<string, string>> = {}) =>
  createPool(godaPool).update([
    { id: 'model', kind: 'model', value: withProperties(BSN, edits) },
  ]);

describe('GODA’s pool (#58)', () => {
  it('reports nothing on the seven committed models', () => {
    const projects = readdirSync(EXAMPLES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(projects).to.have.length(7);
    for (const project of projects)
      expect(
        createPool(godaPool).update([
          { id: 'model', kind: 'model', value: modelOf(project) },
        ]).diagnostics,
        project,
      ).to.deep.equal([]);
  });

  it('a variable used both as a boolean and as a number: an error on every use', () => {
    const index = indexOf({
      'G3/T1.1': { creationProperty: 'assertion trigger mode = true' },
      'G3/T1.2': { creationProperty: 'assertion trigger mode > 2' },
    });
    expect(
      index.diagnostics.map((d) => `${d.document} ${d.check}`).sort(),
    ).to.deep.equal([
      'model:G3/T1.1:creationProperty assertion-type-conflict',
      'model:G3/T1.2:creationProperty assertion-type-conflict',
    ]);
  });

  it('uses that agree type the variable: no problem', () => {
    expect(
      indexOf({
        'G3/T1.1': { creationProperty: 'assertion trigger level > 2' },
        'G3/T1.2': { creationProperty: 'assertion trigger level <= 0.5' },
      }).diagnostics,
    ).to.deep.equal([]);
  });

  it('the first use is the definition: go to it, and rename every use', () => {
    const index = indexOf({
      'G3/T1.1': { creationProperty: 'assertion trigger level > 2' },
      'G3/T1.2': { creationProperty: 'assertion trigger level <= 0.5' },
    });
    const at = 'assertion trigger '.length;
    expect(
      definitionAt(index, {
        document: 'model:G3/T1.2:creationProperty',
        offset: at + 1,
      }),
    ).to.deep.equal({
      document: 'model:G3/T1.1:creationProperty',
      from: at,
      to: at + 5,
    });
    const edits = renameEdits(
      index,
      { document: 'model:G3/T1.2:creationProperty', offset: at + 1 },
      'charge',
    );
    expect(edits).to.be.an('array');
    expect(
      (edits as { document: string }[]).map((e) => e.document).sort(),
    ).to.deep.equal([
      'model:G3/T1.1:creationProperty',
      'model:G3/T1.2:creationProperty',
    ]);
  });
});

describe('ids scoped by their goal (BSN’s T1.2 under G3 and under G4)', () => {
  const index = indexOf();

  it('keeps both, keyed by the view', () => {
    expect(
      index
        .definitionsOf('gm.task')
        .filter((d) => d.name === 'T1.2')
        .map((d) => d.id)
        .sort(),
    ).to.deep.equal(['gm.task:G3/T1.2', 'gm.task:G4/T1.2']);
  });

  it('a notation resolves among its own element’s children', () => {
    let checked = 0;
    for (const goal of ['G3', 'G4']) {
      const parent = [...BSN.nodes].find(
        ([, node]) => node.children.includes(`${goal}/T1.2`) && node.notation,
      );
      if (!parent) continue;
      const [key, node] = parent;
      const offset = node.notation!.indexOf('T1.2');
      expect(
        definitionAt(index, {
          document: `model:${key}:notation`,
          offset: offset + 1,
        })?.document,
      ).to.equal(`model:${goal}/T1.2:id`);
      // the id itself is the task's, before it is its parent's child
      expect(
        symbolAt(index, { document: `model:${goal}/T1.2:id`, offset: 1 })
          ?.definition?.kind,
      ).to.equal('gm.task');
      checked += 1;
    }
    expect(checked).to.be.greaterThan(0);
  });
});
