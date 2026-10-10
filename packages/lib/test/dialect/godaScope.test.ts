/**
 * Ids scoped by their goal, end to end (goal-controller#40): in GODA a task's
 * id is unique under its goal only (BSN has `T1.1` under G3 and under G4).
 * The view keys a repeated one by its goal (`G3/T1.1`), and the Notation view,
 * its diagnostics, the selection by line, the inspector's context and the
 * engine's trace all tell the two apart. Edge's ids stay the model's.
 */
import { expect } from 'chai';
import { existsSync, readFileSync } from 'fs';
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
import { edgeV2, goda, godaOutput } from '../../src';

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
