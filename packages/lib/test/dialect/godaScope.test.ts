/**
 * Ids scoped by their goal, end to end (goal-controller#40): in GODA a task's
 * id is unique under its goal only (BSN has `T1.1` under G3 and under G4).
 * The view keys a repeated one by its goal (`G3/T1.1`), and the Notation view,
 * its diagnostics, the selection by line, the inspector's context and the
 * engine's trace all tell the two apart. Edge's ids stay the model's.
 */
import { expect } from 'chai';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { goalView, Model } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import { treeProblems } from '../../../ui/lib/workbench/localProblems';
import {
  elementOfLine,
  lineKeys,
} from '../../../ui/lib/workbench/notationDocument';
import { traceOfFile } from '../../../ui/lib/workbench/outputs';
import { edgeV2, goda, godaOutput, mutrose } from '../../src';
import { serverProblems } from '../../../ui/lib/workbench/diagnostics';

const ROOT_DIR = join(__dirname, '../../../..');

/** G1 → G3, G4; each goal → its own T1 → its own T1.1 (the texts differ, as BSN's). */
const MODEL = JSON.stringify({
  actors: [
    {
      id: 'actor',
      text: 'Robot',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      nodes: [
        ['g1', 'Goal', 'G1: Detect emergency', { selected: 'true' }],
        ['g3', 'Goal', 'G3: Monitor signs'],
        ['g4', 'Goal', 'G4: Analyze signs'],
        ['g3t1', 'Task', 'T1: Monitor'],
        ['g4t1', 'Task', 'T1: Analyze'],
        ['g3t11', 'Task', 'T1.1: Collect data'],
        ['g3t12', 'Task', 'T1.2: Read data'],
        ['g4t11', 'Task', 'T1.1: Fuse data'],
        ['g4t12', 'Task', 'T1.2: Detect status'],
      ].map(([id, kind, text, props], i) => ({
        id,
        text,
        type: `istar.${kind}`,
        x: i * 100,
        y: 100,
        ...(props && { customProperties: props }),
      })),
    },
  ],
  dependencies: [],
  links: [
    ['g3', 'g1'],
    ['g4', 'g1'],
    ['g3t1', 'g3'],
    ['g4t1', 'g4'],
    ['g3t11', 'g3t1'],
    ['g3t12', 'g3t1'],
    ['g4t11', 'g4t1'],
    ['g4t12', 'g4t1'],
  ].map(([source, target], i) => ({
    id: `link${i}`,
    type: 'istar.AndRefinementLink',
    source,
    target,
  })),
  tool: 'pistar.2.1.0',
  istar: '2.0',
  diagram: { width: 800, height: 600 },
});

const dialect = goda as AnyDialect;
const view = () => goalView(parsePistar(MODEL), goda);

describe('GODA: a task id repeated under two goals', () => {
  it('is two elements in the view, each keyed by its goal', () => {
    const tree = view();
    expect([...tree.nodes.keys()].sort()).to.deep.equal([
      'G1',
      'G3',
      'G3/T1',
      'G3/T1.1',
      'G3/T1.2',
      'G4',
      'G4/T1',
      'G4/T1.1',
      'G4/T1.2',
    ]);
    const g3t1 = tree.nodes.get('G3/T1')!;
    expect(g3t1.id).to.equal('T1');
    expect(g3t1.children).to.deep.equal(['G3/T1.1', 'G3/T1.2']);
    expect(tree.nodes.get('G4/T1.1')!.parent).to.equal('G4/T1');
    expect(tree.nodes.get('G4/T1.1')!.name).to.equal('Fuse data');
    expect(tree.byIStarId.get('g4t11')!.key).to.equal('G4/T1.1');
  });

  it('has a Notation line each, reads back unchanged, and gives no diagnostics', () => {
    const tree = view();
    const { text, ids } = notationDocument(goda, tree);
    expect(
      text.split('\n').filter((line) => /T1\.1:/.test(line)),
    ).to.deep.equal(['      T1.1: Collect data', '      T1.1: Fuse data']);
    expect(ids).to.include.members(['G3/T1.1', 'G4/T1.1']);
    expect(notationEdits(goda, text, tree)).to.deep.equal([]);
    // an edit names the element under its goal
    const renamed = text.replace('T1.1: Fuse data', 'T1.1: Merge data');
    expect(notationEdits(goda, renamed, tree)).to.deep.equal([
      { iStarId: 'g4t11', text: 'T1.1: Merge data' },
    ]);
    const context = contextFromView(goda, tree, []);
    expect(context.elements['G4/T1.1']).to.include({
      kind: 'task',
      id: 'T1.1',
    });
    expect(documentDiagnostics(dialect, text, context)).to.deep.equal([]);
  });

  it('attributes a diagnostic on a line to the element under its goal', () => {
    const tree = view();
    const { text } = notationDocument(goda, tree);
    const doc = text.replace(
      'T1.1: Fuse data',
      'T1.1: Fuse data\n        creationProperty x > 1',
    );
    const found = documentDiagnostics(
      dialect,
      doc,
      contextFromView(goda, tree, []),
    );
    expect(found.map((d) => [d.elementId, d.message])).to.deep.equal([
      ['G4/T1.1', 'Starts with assertion condition or assertion trigger'],
    ]);
  });

  it('selects the element of a Notation line under its goal', () => {
    const tree = view();
    const lines = notationDocument(goda, tree).text.split('\n');
    const has = (key: string) => tree.nodes.has(key);
    const keys = lineKeys(goda, lines, has);
    expect(keys.filter((key) => key?.endsWith('T1.1'))).to.deep.equal([
      'G3/T1.1',
      'G4/T1.1',
    ]);
    const fuse = lines.findIndex((line) => line.includes('Fuse data'));
    expect(elementOfLine(goda, lines, fuse, has)).to.equal('G4/T1.1');
  });

  it("traces the MDP's lines to each one, by piStar id", () => {
    const tree = view();
    const [nm] = godaOutput(Model.parse(MODEL), { modelName: 'm' }).files;
    const trace = traceOfFile(
      nm!,
      tree.nodes.keys(),
      (owner) => tree.byIStarId.get(owner)?.key ?? owner,
    )!;
    const lines = nm!.text.split('\n');
    const ownerOf = (module: string) =>
      trace.lines[
        lines.findIndex((line) => line.startsWith(`module ${module}`))
      ]?.primary;
    expect(ownerOf('G3_T1_1_CollectData')).to.deep.equal(['G3/T1.1']);
    expect(ownerOf('G4_T1_1_FuseData')).to.deep.equal(['G4/T1.1']);
  });

  it('reports a problem on the element under its goal', () => {
    const model = MODEL.replace('T1.1: Fuse data', 'Fuse data');
    const tree = goalView(parsePistar(model), goda);
    expect(
      treeProblems(tree, 'goda')
        .filter((p) => p.message.includes('has no id'))
        .map((p) => p.elementId),
    ).to.deep.equal(['g4t11']);
    // G3's T1.1 is the only one left: keyed by its id
    expect(tree.nodes.has('T1.1')).to.equal(true);
  });

  it('stays keyed by id in Edge, whose ids are the model’s (the first wins)', () => {
    const tree = goalView(parsePistar(MODEL), edgeV2);
    expect(tree.nodes.has('G3/T1.1')).to.equal(false);
    expect(tree.nodes.get('T1.1')!.name).to.equal('Collect data');
    expect(tree.byIStarId.get('g4t11')!.key).to.equal('T1.1');
  });
});

describe('GODA: BSN (fetched, #34 D1) in the editors', () => {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { EXAMPLES } = require('../../../../scripts/goda-stress/fetch.cjs');
  const file = join(EXAMPLES, 'BSN/BSN.txt');

  it('has an element, and a Notation line, for each of its 28, its repeated T1s and T1.1s apart', function () {
    if (!existsSync(file)) this.skip();
    const tree = goalView(parsePistar(readFileSync(file, 'utf8')), goda);
    expect(tree.nodes.size).to.equal(tree.byIStarId.size).and.to.equal(28);
    for (const key of [
      'G3/T1',
      'G4/T1',
      'G3/T1.1',
      'G4/T1.1',
      'T1.411',
      'T1.X',
    ])
      expect(tree.nodes.has(key), key).to.equal(true);
    const { text, ids } = notationDocument(goda, tree);
    expect(new Set(ids).size).to.equal(28);
    expect(notationEdits(goda, text, tree)).to.deep.equal([]);
    // the five-operand DM names G3's T1's children; the long conditions read
    // (a digit in a name, `SaO2`, is #38's: D17)
    const found = documentDiagnostics(
      dialect,
      text,
      contextFromView(goda, tree, []),
    ).filter((d) => !d.message.startsWith('Unexpected'));
    expect(found).to.deep.equal([]);
  });
});

/** One actor's nodes and its AND links (child → parent), in GODA. */
const tiny = (
  nodes: Array<[id: string, kind: 'Goal' | 'Task', text: string]>,
  links: Array<[child: string, parent: string]>,
) =>
  JSON.stringify({
    actors: [
      {
        id: 'actor',
        text: 'Robot',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: nodes.map(([id, kind, text], i) => ({
          id,
          text,
          type: `istar.${kind}`,
          x: i * 100,
          y: 100,
        })),
      },
    ],
    dependencies: [],
    links: links.map(([source, target], i) => ({
      id: `link${i}`,
      type: 'istar.AndRefinementLink',
      source,
      target,
    })),
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: { width: 800, height: 600 },
  });

describe('ids scoped by their goal: what falls back to the id', () => {
  it('keeps every element of the other engines keyed by its id (key === id)', () => {
    const examples = (dir: string) =>
      readdirSync(join(ROOT_DIR, dir))
        .filter((f) => f.endsWith('.txt') && !f.endsWith('.expected.txt'))
        .map((f) => readFileSync(join(ROOT_DIR, dir, f), 'utf8'))
        // goal models only (some .txt are notes or snippets)
        .filter((text) => text.trimStart().startsWith('{'));
    let checked = 0;
    for (const [definition, dir] of [
      [edgeV2, 'examples/edgeV2'],
      [mutrose, 'examples/mutrose'],
    ] as const)
      for (const text of examples(dir)) {
        const tree = goalView(parsePistar(text), definition);
        for (const [key, node] of tree.nodes) {
          expect(node.key, node.id).to.equal(node.id);
          expect(key).to.equal(node.id);
          checked++;
        }
      }
    expect(checked).to.be.greaterThan(20);
  });

  it('keys a repeated id with no goal above it by its id: the first wins', () => {
    // two tasks T9 linked to nothing, beside G1 → T1
    const tree = goalView(
      parsePistar(
        tiny(
          [
            ['g1', 'Goal', 'G1: Serve'],
            ['t1', 'Task', 'T1: Pick'],
            ['a', 'Task', 'T9: First'],
            ['b', 'Task', 'T9: Second'],
          ],
          [['t1', 'g1']],
        ),
      ),
      goda,
    );
    expect(tree.byIStarId.get('a')!.key).to.equal('T9');
    expect(tree.byIStarId.get('b')!.key).to.equal('T9');
    expect(tree.nodes.get('T9')!.iStarId).to.equal('a');
  });

  it('keys a repeated id under the same goal once, and reports the second line as a duplicate there', () => {
    const tree = goalView(
      parsePistar(
        tiny(
          [
            ['g1', 'Goal', 'G1: Serve'],
            ['a', 'Task', 'T1: First'],
            ['b', 'Task', 'T1: Second'],
          ],
          [
            ['a', 'g1'],
            ['b', 'g1'],
          ],
        ),
      ),
      goda,
    );
    expect(tree.byIStarId.get('a')!.key).to.equal('G1/T1');
    expect(tree.byIStarId.get('b')!.key).to.equal('G1/T1');
    expect(tree.nodes.get('G1/T1')!.iStarId).to.equal('a');
    const doc = 'G1: Serve\n  T1: First\n  T1: Second';
    const found = documentDiagnostics(
      dialect,
      doc,
      contextFromView(goda, tree, []),
    ).map((d) => [doc.slice(d.from, d.to), d.message]);
    expect(found).to.deep.include(['T1', 'Duplicate id T1 under G1']);
  });

  it("attributes a server's diagnostic by its line to the element under its goal (serverProblems)", () => {
    const tree = view();
    const doc = notationDocument(goda, tree).text;
    const line = doc.split('\n').findIndex((l) => l.includes('Fuse data'));
    const at = { start: { line, character: 0 }, end: { line, character: 2 } };
    const found = (has?: (key: string) => boolean) =>
      serverProblems(
        {
          uri: 'file:///notation.goal',
          diagnostics: [{ range: at, severity: 2, message: 'by range' }],
        },
        { id: 'engine', anchoring: 'range' },
        dialect,
        doc,
        has,
      ).map((p) => p.elementId);
    expect(found((key) => tree.nodes.has(key))).to.deep.equal(['G4/T1.1']);
    // without the model's keys, its id as written (no element of the view)
    expect(found()).to.deep.equal(['T1.1']);
  });
});
