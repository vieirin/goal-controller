/**
 * GRL's analyses read the view of the GoalModel (goal-controller#125): on
 * both example projects, every evaluation equals the one on the model as
 * the analyses read it before (`asWritten`: the piStar model's actors,
 * elements and links with every string property).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { grlAnalyses, grlAnalysisModel } from '../../../src/engines/grl';
import type { AnalysisModel } from '../../../src/engines/analysis';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
  isActor,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const PROJECTS = path.join(__dirname, '../../../../../examples/grl');

type Entry = {
  id: string;
  kind: string;
  name: string;
  parent?: string;
  source: string;
  target: string;
  label?: string;
  customProperties?: Record<string, string>;
};

/** The model as analyses read it before #125, straight from piStar. */
const asWritten = (model: {
  elements: Map<string, Entry>;
  links: Map<string, Entry>;
}): AnalysisModel => {
  const elements = [...model.elements.values()];
  return {
    actors: elements.filter(isActor).map((actor) => ({
      id: actor.id,
      kind: actor.kind,
      name: actor.name,
      properties: { ...actor.customProperties },
      elements: elements
        .filter((inner) => inner.parent === actor.id)
        .map((inner) => inner.id),
    })),
    elements: elements
      .filter((element) => !isActor(element))
      .map((element) => ({
        id: element.id,
        kind: element.kind,
        name: element.name,
        properties: { ...element.customProperties },
        ...(element.parent !== undefined && { actor: element.parent }),
      })),
    links: [...model.links.values()].map((link) => ({
      id: link.id,
      kind: link.kind,
      source: link.source,
      target: link.target,
      ...(link.label !== undefined && { label: link.label }),
      properties: { ...link.customProperties },
    })),
  };
};

describe('GRL: the analyses on the GoalModel’s view (#125)', () => {
  for (const [project, file] of [
    ['grl-own', 'grl-own.txt'],
    ['grl-smart-home', 'SmartHome2.txt'],
  ] as const)
    it(`${project}: every evaluation as before`, () => {
      const dir = path.join(PROJECTS, project);
      const model = parsePistar(fs.readFileSync(path.join(dir, file), 'utf8'), {
        fileMetamodel: true,
      });
      const strategies = Object.fromEntries(
        fs
          .readdirSync(path.join(dir, 'strategies'))
          .map((name) => [
            `strategies/${name}`,
            fs.readFileSync(path.join(dir, 'strategies', name), 'utf8'),
          ]),
      );
      const view = grlAnalysisModel(model);
      // an actor and a link keep GRL's properties; the rest of the view is the model's
      assert.deepStrictEqual(view.elements, asWritten(model).elements);
      for (const analysis of Object.values(grlAnalyses)) {
        const now = analysis.run(view, strategies);
        assert.ok(now.cases.length > 0);
        assert.deepStrictEqual(now, analysis.run(asWritten(model), strategies));
      }
    });
});
