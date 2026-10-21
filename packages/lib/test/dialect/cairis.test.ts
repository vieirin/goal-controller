/**
 * The CAIRIS seeds' Problems (goal-controller#192, D1): CAIRIS's values,
 * verbatim, against the `kaos` dialect's vocabularies drown the seeds (every
 * goal's `High`, every obstacle's `Vulnerability`); with the `cairis`
 * profile the seeds record, read in every KAOS mode, they are checked against
 * CAIRIS's own enumerations (goals.dtd) and lint clean, in the workbench's
 * Problems and in the Notation view. A model without the profile is read as
 * before.
 */
import { expect } from 'chai';
import { goalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
} from '@goal-controller/goal-language';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  dialectForModel,
  kaos,
  kaosres,
  kaosprop,
  vocabularyProfileOf,
  withVocabularyProfile,
} from '../../src';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { frameworkProblems } from '../../../ui/lib/workbench/frameworkProblems';
import { models } from './support/models';

const read = (text: string) => parseModel(text, 'kaos', 'kaos');
const SEEDS = models('examples/kaos', read).filter((s) =>
  s.file.includes('/cairis-'),
);
const seed = (name: string) =>
  SEEDS.find((s) => s.file.endsWith(`/${name}.txt`))!.model;

describe('CAIRIS seeds: Problems with and without the cairis profile (#192, D1)', () => {
  const byKey = (definition: AnyDialect, text: string) => {
    const counts: Record<string, number> = {};
    for (const p of frameworkProblems(read(text), definition)) {
      const key = `${p.code} ${p.key ?? ''}`.trim();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };

  // the source's obstructions of refined goals (CAIRIS lets any goal be
  // obstructed): warnings with or without the profile, as KAOSTools' are
  const NOT_A_LEAF = {
    'cairis-acme-water-day.txt': 1,
    'cairis-neurogrid-psychosis.txt': 2,
    'cairis-neurogrid-stroke.txt': 2,
  };

  it('drown without it: nearly every goal, obstacle and domain property is one', () => {
    const plain = Object.fromEntries(
      SEEDS.map(({ file, model }) => [
        file.split('/').pop(),
        byKey(kaosprop, model),
      ]),
    );
    const value = 'unknown-property-value';
    expect(plain).to.deep.equal({
      'cairis-acme-water-day.txt': {
        'not-a-leaf': 1,
        [`${value} Priority`]: 78,
        [`${value} Kind`]: 1,
        [`${value} Category`]: 21,
      },
      'cairis-acme-water-night.txt': {
        [`${value} Type`]: 3,
        [`${value} Priority`]: 4,
        [`${value} Kind`]: 1,
      },
      'cairis-balkan-rail-balkan-rail-corprate-hq.txt': {},
      'cairis-balkan-rail-central-station.txt': {},
      'cairis-balkan-rail-model.txt': { [`${value} Priority`]: 20 },
      'cairis-neurogrid-core-technology.txt': {
        [`${value} Kind`]: 3,
        [`${value} Category`]: 7,
      },
      'cairis-neurogrid-psychosis.txt': {
        'not-a-leaf': 2,
        [`${value} Priority`]: 22,
        [`${value} Type`]: 1,
        [`${value} Kind`]: 5,
        [`${value} Category`]: 10,
      },
      'cairis-neurogrid-stroke.txt': {
        'not-a-leaf': 2,
        [`${value} Priority`]: 22,
        [`${value} Type`]: 1,
        [`${value} Kind`]: 5,
        [`${value} Category`]: 18,
      },
    });
  });

  it('lint clean with it, in every KAOS mode, but for the source’s obstructions of refined goals', () => {
    for (const { file, model } of SEEDS) {
      expect(vocabularyProfileOf(JSON.parse(model)), file).to.equal('cairis');
      const name = file.split('/').pop()!;
      for (const definition of [
        kaos,
        kaosprop,
        kaosres,
      ] as unknown as AnyDialect[]) {
        const problems = frameworkProblems(
          read(model),
          dialectForModel(definition, JSON.parse(model)),
        );
        expect(
          problems.map((p) => [p.code, p.severity]),
          `${file} ${definition.id}`,
        ).to.deep.equal(
          Array.from(
            { length: NOT_A_LEAF[name as keyof typeof NOT_A_LEAF] ?? 0 },
            () => ['not-a-leaf', 'warning'],
          ),
        );
      }
    }
  });

  it('still checks a value: one outside goals.dtd’s is a Problem', () => {
    const json = JSON.parse(seed('cairis-acme-water-day'));
    json.orphans.find(
      (n: { type: string }) => n.type === 'kaos.BehavioralGoal',
    ).customProperties.Priority = 'high';
    const text = JSON.stringify(json, null, 2);
    expect(
      frameworkProblems(read(text), dialectForModel(kaosprop, json))
        .filter((p) => p.code === 'unknown-property-value')
        .map((p) => p.message),
    ).to.deep.equal(['Priority is one of Low, Medium, High, not "high"']);
  });

  it('declares the keys the importer writes beyond kaos’s, as text', () => {
    const profiled = withVocabularyProfile(kaosprop, 'cairis');
    const keys = (kind: string) => profiled.properties[kind]!.map((p) => p.key);
    expect(keys('kaos.BehavioralGoal')).to.include.members([
      'RequirementType',
      'RequirementPriority',
      'Label',
      'Reference',
      'ReferenceType',
      'Rationale',
      'Concern',
      'RSR',
      'ESR',
    ]);
    expect(keys('kaosObstacles.Obstacle')).to.include.members([
      'Probability',
      'Rationale',
      'Source',
    ]);
    expect(
      profiled.links!['kaos.RefinementLinkStart']!.map((p) => p.key),
    ).to.deep.equal(['Probability', 'Rationale', 'Alternative']);
  });

  it('changes nothing for a model without the profile', () => {
    const las = models('examples/kaos/las', read)[0]!.model;
    const definition = kaosprop;
    expect(dialectForModel(definition, JSON.parse(las))).to.equal(definition);
  });

  it('reads the Notation view with it: CAIRIS’s values are no line’s error', () => {
    // its elements named with their kinds' ids (G1, O1, …), as the Notation
    // view's lines are written
    const json = JSON.parse(seed('cairis-neurogrid-psychosis'));
    const prefix: Record<string, string> = {
      'kaos.BehavioralGoal': 'G',
      'kaos.Obstacle': 'O',
      'kaos.DomainProperty': 'DP',
      'kaos.Agent': 'A',
    };
    const n: Record<string, number> = {};
    for (const node of json.orphans) {
      const p = prefix[node.type]!;
      n[p] = (n[p] ?? 0) + 1;
      node.text = `${p}${n[p]}: ${node.text}`;
    }
    const text = JSON.stringify(json, null, 2);
    const definition = dialectForModel(kaosprop, JSON.parse(text));
    const view = goalView(read(text) as never, definition);
    const doc = notationDocument(definition, view).text;
    const errors = (of: AnyDialect) =>
      documentDiagnostics(of, doc, contextFromView(of, view, [])).filter((d) =>
        d.message.startsWith('One of'),
      ).length;
    expect(errors(definition)).to.equal(0);
    expect(errors(kaosprop)).to.be.greaterThan(30);
  });
});
