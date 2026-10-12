/**
 * The measurements of the relational core (#61): per project, the cold start
 * (rules compiled, then every document extracted and the rules run), a
 * keystroke that changes facts (one document extracted again, the rules run
 * again), a keystroke cut off (only locations move), a query (go to
 * definition), the pool's retained heap, and the bundle the package adds.
 *
 *   pnpm --filter @goal-controller/facts bench
 */
import * as path from 'path';
import * as zlib from 'zlib';
import { buildSync } from 'esbuild';
import type { GoalView, GoalViewNode } from '@goal-controller/goal-tree';
import { FactPool, poolFor, type PoolDocument } from '../src';
import {
  documentsOf,
  exampleProject,
  readProject,
  ROOT,
  withProperties,
} from '../test/project';

const gc = (globalThis as { gc?: () => void }).gc;
const now = () => performance.now();
const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const ms = (x: number) => `${x.toFixed(2)} ms`;

type Scenario = {
  name: string;
  files: Record<string, string>;
  /** a keystroke that changes facts: the documents after it */
  edit: (documents: PoolDocument[], i: number) => PoolDocument[];
  /** a keystroke that moves locations only */
  move: (documents: PoolDocument[], i: number) => PoolDocument[];
  /** a definition to go to: document and offset */
  query: [string, number];
};

/** A resource's text, changed. */
const retext = (
  documents: PoolDocument[],
  id: string,
  change: (text: string) => string,
) =>
  documents.map((d) =>
    d.id === id ? { ...d, text: change(d.text ?? '') } : d,
  );

/** A synthetic GODA model: n goals of 10 tasks, each with a context condition (scale). */
const scaled = (
  base: Record<string, string>,
  goals: number,
): Record<string, string> => {
  const model = JSON.parse(base['BSN.txt']!);
  const actor = model.actors[0];
  const nodes = [
    {
      id: 'root',
      text: 'G0: root',
      type: 'istar.Goal',
      x: 0,
      y: 0,
      customProperties: {},
    },
  ];
  const links: unknown[] = [];
  for (let g = 1; g <= goals; g += 1) {
    nodes.push({
      id: `g${g}`,
      text: `G${g}: goal [${Array.from({ length: 10 }, (_, t) => `T${g}.${t + 1}`).join(';')}]`,
      type: 'istar.Goal',
      x: g,
      y: 1,
      customProperties: {},
    });
    links.push({
      id: `l${g}`,
      type: 'istar.AndRefinementLink',
      source: `g${g}`,
      target: 'root',
    });
    for (let t = 1; t <= 10; t += 1) {
      nodes.push({
        id: `t${g}_${t}`,
        text: `T${g}.${t}: task`,
        type: 'istar.Task',
        x: g,
        y: 2,
        customProperties: {
          creationProperty: `assertion trigger sensor${t} = true & level${g % 20} > 0.${t}`,
        },
      });
      links.push({
        id: `l${g}_${t}`,
        type: 'istar.AndRefinementLink',
        source: `t${g}_${t}`,
        target: `g${g}`,
      });
    }
  }
  actor.nodes = nodes;
  model.links = links;
  return { ...base, 'BSN.txt': JSON.stringify(model) };
};

const goda = (name: string) =>
  readProject(path.join(ROOT, 'examples', 'goda', name));
/** a GODA model's first condition, changed (or its spaces moved) */
const firstCondition = (documents: PoolDocument[]) => {
  const view = documents[0]!.value as GoalView;
  return [...view.nodes.values()].find(
    (n: GoalViewNode) => n.properties.creationProperty,
  )!;
};
const godaScenario = (
  name: string,
  files: Record<string, string>,
): Scenario => ({
  name,
  files,
  edit: (documents, i) => {
    const node = firstCondition(documents);
    return withProperties(documents, {
      [node.key]: {
        creationProperty: `assertion trigger probe${i % 2} = true`,
      },
    });
  },
  move: (documents, i) => {
    const node = firstCondition(documents);
    return withProperties(documents, {
      [node.key]: {
        creationProperty: `${node.properties.creationProperty}${' '.repeat(i % 2)}`,
      },
    });
  },
  query: ['model:G1:id', 0],
});

const SCENARIOS: Scenario[] = [
  {
    name: 'medicine-delivery (model, world, HDDL, configuration)',
    files: exampleProject('medicine-delivery'),
    edit: (documents, i) =>
      retext(documents, 'hddl/domain.hddl', (t) =>
        t.replace('(:task handover', `(:task handover${i % 2 ? 'x' : ''}`),
      ),
    move: (documents, i) =>
      retext(documents, 'hddl/domain.hddl', (t) => (i % 2 ? `${t} ` : t)),
    query: ['configuration/configuration.json', 0],
  },
  {
    name: 'tas3-edgev2 (model, variables.json)',
    files: exampleProject('tas3-edgev2'),
    edit: (documents, i) =>
      withProperties(documents, {
        G3: { assertion: i % 2 ? 'privacyEnabled' : 'enoughBattery' },
      }),
    move: (documents, i) =>
      withProperties(documents, {
        G3: { assertion: i % 2 ? 'privacyEnabled ' : 'privacyEnabled' },
      }),
    query: ['model:G3:assertion', 1],
  },
  godaScenario('GODA BSN', goda('bsn')),
  godaScenario('GODA Fragmented', goda('fragmented')),
  godaScenario(
    'synthetic GODA, 200 goals × 10 tasks',
    scaled(goda('bsn'), 200),
  ),
];

const RUNS = 30;
const rows: string[] = [];
for (const scenario of SCENARIOS) {
  const { definition, documents } = documentsOf(scenario.files);
  gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  let t = now();
  const setup = poolFor(definition)!;
  const compile = now() - t;
  t = now();
  const pool = new FactPool(setup);
  pool.update(documents);
  pool.diagnostics();
  const build = now() - t;
  gc?.();
  const heap = (process.memoryUsage().heapUsed - heapBefore) / 1024;
  const facts = Object.values(pool.db.counts).reduce((a, b) => a + b, 0);
  const documentsCount = [
    ...(
      pool as unknown as { documents: Map<string, unknown> }
    ).documents.keys(),
  ].length;

  const time = (step: (i: number) => void) => {
    const times: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const start = now();
      step(i);
      times.push(now() - start);
    }
    return median(times);
  };
  const before = { ...pool.stats };
  const split: number[] = [];
  const run: number[] = [];
  const keystroke = time((i) => {
    pool.update(scenario.edit(documents, i + 1));
    pool.diagnostics();
    split.push(pool.stats.lastUpdate);
    run.push(pool.stats.lastEvaluation);
  });
  const evaluations = pool.stats.evaluations - before.evaluations;
  pool.update(documents);
  const cut = { ...pool.stats };
  const cutOff = time((i) => {
    pool.update(scenario.move(documents, i + 1));
    pool.diagnostics();
  });
  const cutOffs = pool.stats.cutOffs - cut.cutOffs;
  const query = time(() => pool.definitionAt(...scenario.query));
  rows.push(
    `| ${scenario.name} | ${documentsCount} | ${facts} | ${ms(compile)} | ${ms(build)} | ${ms(keystroke)} (${evaluations}/${RUNS} runs: inputs ${ms(median(split))}, rules ${ms(median(run))}) | ${ms(cutOff)} (${cutOffs}/${RUNS} cut off) | ${ms(query)} | ${heap.toFixed(0)} kB |`,
  );
}

console.log(
  '| Project | Documents | Tuples (facts + derived) | Rules compiled | Cold start (extract + run) | Keystroke, facts change | Keystroke, cut off | Go to definition | Retained heap |',
);
console.log('|---|---|---|---|---|---|---|---|---|');
rows.forEach((row) => console.log(row));

// the bundle the package adds to the workbench's worker: what the UI already
// ships (the goal language and Langium, lib, dialect, goal-tree) left out
const bundle = buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'index.ts')],
  bundle: true,
  minify: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  external: [
    '@goal-controller/goal-language',
    '@goal-controller/dialect',
    '@goal-controller/goal-tree',
    '@goal-controller/lib',
  ],
  logLevel: 'silent',
});
const code = bundle.outputFiles[0]!.contents;
console.log(
  `\nBundle (packages/facts alone, minified): ${(code.length / 1024).toFixed(1)} kB, ${(zlib.gzipSync(code).length / 1024).toFixed(1)} kB gzipped`,
);
