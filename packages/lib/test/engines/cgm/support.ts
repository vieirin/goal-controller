/**
 * The contextual goal models' seeds, as the analyses read them, and small
 * models for the tests: every element in one actor (unless it says
 * otherwise), named by its id.
 */
import * as fs from 'fs';
import * as path from 'path';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import type { AnalysisModel } from '../../../src/engines/analysis';
import { cgm, cgmAnalysisModel } from '../../../src/engines/cgm';

export const SEEDS = [
  'museum-guide',
  'museum-guide-costs',
  'smart-home',
] as const;
export type Seed = (typeof SEEDS)[number];

export const EXAMPLES = path.join(__dirname, '../../../../../examples/cgm');

const istarModel = (seed: Seed) =>
  parsePistar(
    JSON.parse(
      fs.readFileSync(path.join(EXAMPLES, seed, `${seed}.txt`), 'utf8'),
    ),
    { fileMetamodel: true },
  );

export const seedModel = (seed: Seed): AnalysisModel =>
  cgmAnalysisModel(istarModel(seed));

export const seedView = (seed: Seed) => goalView(istarModel(seed), cgm);

/** A seed's resource files of a kind, path → text, as the workbench gives them. */
export const seedResource = (
  seed: Seed,
  kind: 'situations' | 'relations',
): Record<string, string> => {
  const dir = path.join(EXAMPLES, seed, kind);
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .map((file) => [
        `${kind}/${file}`,
        fs.readFileSync(path.join(dir, file), 'utf8'),
      ]),
  );
};

type ElementSpec = [
  id: string,
  kind: string,
  properties?: Record<string, string>,
  actor?: string | null,
];
type LinkSpec = [
  source: string,
  kind: string,
  target: string,
  properties?: Record<string, string>,
  label?: string,
];

const KINDS: Record<string, string> = {
  goal: 'istar.Goal',
  task: 'istar.Task',
  quality: 'istar.Quality',
  context: 'cgm.Context',
  statement: 'cgm.Statement',
  fact: 'cgm.Fact',
};
const LINKS: Record<string, string> = {
  and: 'istar.AndRefinementLink',
  or: 'istar.OrRefinementLink',
  dependency: 'istar.DependencyLink',
  contribution: 'istar.ContributionLink',
  neededBy: 'istar.NeededByLink',
  includes: 'cgm.IncludesLink',
  intersects: 'cgm.IntersectsLink',
};

export const toy = (
  elements: readonly ElementSpec[],
  links: readonly LinkSpec[] = [],
): AnalysisModel => {
  const placed = elements.map(([id, kind, properties = {}, actor = 'A']) => ({
    id,
    kind: KINDS[kind] ?? kind,
    name: `${id}: ${id.toLowerCase()}`,
    properties,
    ...(actor !== null && { actor }),
  }));
  const actors = [
    ...new Set(placed.flatMap((e) => (e.actor ? [e.actor] : []))),
  ];
  return {
    actors: actors.map((id) => ({
      id,
      kind: 'istar.Actor',
      name: id,
      properties: {},
      elements: placed.filter((e) => e.actor === id).map((e) => e.id),
    })),
    elements: placed,
    links: links.map(([source, kind, target, properties = {}, label], i) => ({
      id: `l${i}`,
      kind: LINKS[kind] ?? kind,
      source,
      target,
      ...(label !== undefined && { label }),
      properties,
    })),
  };
};
