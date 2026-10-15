/**
 * goal-controller#135 on its toy (support/envToy.ts): a condition reading
 * an artifact's members, validated, completed and hovered from the
 * artifact's `attributes`; a made-up metamodel's XMI read through the
 * shared reader into piStar; an analysis returning three steps, as text
 * and through the workbench's step control.
 */
import { expect } from 'chai';
import * as z from 'zod/mini';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import type { DocumentNode, DocumentTree } from '@goal-controller/dialect';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  hoverAt,
  notationDocument,
  valueProblem,
} from '@goal-controller/goal-language';
import {
  analysisText,
  defineAnalyses,
  runAnalysis,
} from '../../src/engines/analysis';
import { readXmi } from '../../src/importers/xmi';
import {
  analysisDiagnostics,
  shownStep,
  stepped,
  type AnalysisRun,
} from '../../../ui/lib/workbench/analysis';
import { envChecks, envy } from './support/envToy';

const node = (
  id: string,
  kind: string,
  name: string,
  properties: Record<string, string>,
): DocumentNode => ({
  iStarId: `i-${id}`,
  id,
  kind,
  name,
  notation: null,
  properties,
  children: [],
});

const tree = (when: string): DocumentTree => ({
  nodes: new Map([
    ['G1', node('G1', 'goal', 'Keep clean', { when })],
    [
      'E1',
      node('E1', 'env.Artifact', 'Room', {
        attributes: 'clean:bool, level:number, mode:wet|dry',
      }),
    ],
  ]),
  roots: ['G1', 'E1'],
});

/** the document of a model whose goal's condition is `when`, and its context */
const model = (when: string) => {
  const t = tree(when);
  return {
    doc: notationDocument(envy, t).text,
    context: contextFromView(envy, t, ['x']),
  };
};

const errors = (when: string) => {
  const { doc, context } = model(when);
  return documentDiagnostics(envy, doc, context)
    .filter((d) => d.severity === 'error')
    .map((d) => d.message);
};

describe('members: a condition reads an artifact’s attributes (#135)', () => {
  it('writes and reads the toy’s lines', () => {
    expect(model('E1.clean').doc).to.equal(
      'G1: Keep clean\n  when E1.clean\nE1: Room\n  attributes clean:bool, level:number, mode:wet|dry',
    );
    for (const when of [
      'E1.clean',
      '!E1.clean & E1.level < 3',
      'E1.clean = true',
      'E1.mode = wet | E1.mode != dry',
      'E1.level >= x',
    ])
      expect(errors(when), when).to.deep.equal([]);
  });

  it('says what is wrong with a member: unknown, or on a kind that declares none', () => {
    expect(errors('E1.dirty')).to.deep.equal([
      'E1 has no member dirty (its members: clean, level, mode)',
    ]);
    expect(errors('G1.done')).to.deep.equal([
      'G1 is a goal, which has no members',
    ]);
    // a value that declares no members reads none
    const { context } = model('E1.clean');
    expect(
      valueProblem(
        { type: 'assertion', resolves: ['env.Artifact'] },
        'E1.clean',
        context,
      ),
    ).to.equal('E1.clean: this value reads no members');
    // `members: 'any'`: any name (declared elsewhere)
    expect(
      valueProblem(
        { type: 'assertion', resolves: ['env.Artifact'], members: 'any' },
        'E1.dirty',
        context,
      ),
    ).to.equal(null);
  });

  it('compares a member as its type says', () => {
    expect(errors('E1.level')).to.deep.equal([
      'E1.level is a number: compare it with a number',
    ]);
    expect(errors('E1.clean > 2')).to.deep.equal([
      'E1.clean is a bool: write E1.clean, or E1.clean = true',
    ]);
    expect(errors('E1.mode = damp')).to.deep.equal([
      'E1.mode is one of wet, dry, not damp',
    ]);
    expect(errors('E1.mode < 2')).to.deep.equal([
      'E1.mode is one of wet, dry: compare it with = or !=',
    ]);
  });

  it('runs a check that reads member nodes', () => {
    const check = envChecks['env.goal.when'];
    const context = { self: 'G1', kindOf: () => undefined };
    expect(check({ when: 'E1.clean' }, context)).to.equal(null);
    expect(check({ when: 'x > 3' }, context)).to.equal(
      'Reads no artifact’s member',
    );
  });

  it('completes an element’s members after the dot, with their types', () => {
    const { doc, context } = model('E1.');
    const at = doc.indexOf('E1.') + 3;
    const found = completionsAt(envy, doc, at, context);
    expect(found?.from).to.equal(at);
    expect(found?.options.map((o) => [o.label, o.detail])).to.deep.equal([
      ['clean', 'a bool'],
      ['level', 'a number'],
      ['mode', 'one of wet, dry'],
    ]);
    const typing = model('E1.le');
    const end = typing.doc.indexOf('E1.le') + 5;
    expect(completionsAt(envy, typing.doc, end, typing.context)?.from).to.equal(
      end - 2,
    );
  });

  it('hovers a member with its declared type', () => {
    const { doc, context } = model('E1.level < 3');
    expect(
      hoverAt(envy, doc, doc.indexOf('level') + 1, context)?.markdown,
    ).to.equal('**E1.level**: a number, a member of E1');
  });
});

/** a made-up metamodel: actors holding goals, `subgoals` an id list or fragments */
const SHOP = `<?xml version="1.0" encoding="UTF-8"?>
<shop:Model xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:shop="http://example.org/shop" name="Shop">
  <actors xmi:id="a1" name="Clerk">
    <goals xmi:id="g1" name="Serve" subgoals="g2 //@actors.0/@goals.2"/>
    <goals xmi:id="g2" name="Greet"/>
    <goals xmi:id="g3" name="Bill">
      <subgoals href="shop.xmi#g2"/>
      <subgoals href="shop.xmi#//@actors/@goals.0"/>
    </goals>
    <goals xsi:type="shop:Chore" name="Close" subgoals="g9">
      <subgoals href="other.xmi#g1"/>
    </goals>
  </actors>
  <till xmi:id="t1" name="Till" floats="many"/>
</shop:Model>`;

/** `shop:Model` into piStar: its actors and goals (ids their path fragments), `subgoals` AND refinements */
const shopToPistar = (text: string) => {
  const { reader } = readXmi(text, { fileName: 'shop.xmi' });
  const piStar = (type: string, n: { path: string; attributes: any }) => ({
    id: n.path,
    text: n.attributes.name,
    type,
    x: 0,
    y: 0,
    customProperties: {},
  });
  const actors = reader!
    .children(reader!.document.root, 'actors')
    .map((actor) => ({
      ...piStar('istar.Actor', actor),
      nodes: reader!
        .children(actor, 'goals')
        .map((goal) => piStar('istar.Goal', goal)),
    }));
  const links = reader!.document.nodes.flatMap((goal) =>
    reader!.references(goal, 'subgoals').map((sub) => ({
      id: `${goal.path}>${sub.path}`,
      type: 'istar.AndRefinementLink',
      source: sub.path,
      target: goal.path,
    })),
  );
  return {
    pistar: {
      actors,
      links,
      orphans: [],
      dependencies: [],
      display: {},
      istar: '2.0',
      diagram: { width: 9, height: 9, name: 'Shop' },
    },
    diagnostics: reader!.diagnostics,
  };
};

describe('the EMF XMI reader (#135)', () => {
  const { reader } = readXmi(SHOP, { fileName: 'shop.xmi' });

  it('reads nodes: feature, xsi:type, id, path, attributes, children', () => {
    const { root, byId, byPath } = reader!.document;
    expect(root).to.include({ feature: 'shop:Model', path: '/' });
    const close = byPath.get('//@actors.0/@goals.3')!;
    expect(close).to.include({
      feature: 'goals',
      type: 'shop:Chore',
      id: null,
    });
    expect(byId.get('g3')!.path).to.equal('//@actors.0/@goals.2');
    expect(reader!.children(byId.get('a1'), 'goals')).to.have.length(4);
  });

  it('resolves the forms EMF writes: id lists, path fragments, hrefs into the document', () => {
    const names = (id: string) =>
      reader!
        .references(reader!.document.byId.get(id)!, 'subgoals')
        .map((n) => n.attributes.name);
    expect(names('g1')).to.deep.equal(['Greet', 'Bill']);
    // `//@actors/@goals.0`: a single-valued feature's `.0` left out
    expect(names('g3')).to.deep.equal(['Greet', 'Serve']);
    expect(reader!.resolve('#g2')?.id).to.equal('g2');
    expect(reader!.resolve('other.xmi#g2')).to.equal(null);
  });

  it('says what it could not resolve, and types attributes or says why not', () => {
    const { reader: fresh } = readXmi(SHOP, { fileName: 'shop.xmi' });
    fresh!.references(
      fresh!.document.byPath.get('//@actors.0/@goals.3')!,
      'subgoals',
    );
    expect(fresh!.diagnostics.map((d) => d.message)).to.deep.equal([
      "<goals>: subgoals names g9, which the document doesn't have; left out",
      '<goals>: subgoals names other.xmi#g1, in another file; left out',
    ]);
    const till = fresh!.document.byId.get('t1')!;
    expect(fresh!.typed(z.object({ name: z.string() }), till)).to.deep.equal({
      name: 'Till',
    });
    expect(
      fresh!.typed(z.object({ floats: z.enum(['one', 'two']) }), till),
    ).to.equal(null);
    expect(fresh!.diagnostics.at(-1)!.message).to.match(
      /^<till id="t1">: floats: .*; left out$/,
    );
    // not XML: no reader, the problem said
    const broken = readXmi('<a><b></a>');
    expect(broken.reader).to.equal(null);
    expect(broken.diagnostics[0]).to.include({ severity: 'error' });
  });

  it('reads a made-up metamodel into piStar', () => {
    const { pistar } = shopToPistar(SHOP);
    const model = parsePistar(JSON.stringify(pistar));
    expect(
      [...model.elements.values()].map((e) => [e.kind, e.name]),
    ).to.deep.equal([
      ['istar.Actor', 'Clerk'],
      ['istar.Goal', 'Serve'],
      ['istar.Goal', 'Greet'],
      ['istar.Goal', 'Bill'],
      ['istar.Goal', 'Close'],
    ]);
    expect(model.links.size).to.equal(4);
  });
});

/** the toy's analysis: each element's state through three steps */
const envAnalyses = defineAnalyses(envy, {
  day: {
    label: 'A day',
    run: ({ elements }) => {
      const steps = ['active', 'pending', 'achieved'].map((value, i) => ({
        label: `hour ${i + 1}`,
        values: Object.fromEntries(elements.map((e) => [e.id, { value }])),
      }));
      return {
        cases: [{ id: 'day', label: 'A day', values: steps[2]!.values, steps }],
      };
    },
  },
});

describe('a step series in analysis results (#135)', () => {
  const elements = [
    { id: 'g', kind: 'istar.Goal', name: 'Keep clean', properties: {} },
  ];
  const ran = runAnalysis(envAnalyses.day, {
    actors: [],
    elements,
    links: [],
  });
  const result = 'result' in ran ? ran.result : null;

  it('lists each step as text', () => {
    expect(analysisText(result!, () => 'Keep clean')).to.equal(
      [
        'A day',
        '  step 1: hour 1',
        '    Keep clean: active',
        '  step 2: hour 2',
        '    Keep clean: pending',
        '  step 3: hour 3',
        '    Keep clean: achieved',
      ].join('\n'),
    );
  });

  it('steps through them in the workbench: previous, next, the step’s label', () => {
    const run: AnalysisRun = {
      analysis: 'day',
      label: 'A day',
      text: '',
      caseId: null,
      step: 0,
      result: result!,
    };
    expect(shownStep(run)).to.deep.equal({
      index: 0,
      count: 3,
      label: 'hour 1',
    });
    const last = stepped(stepped(stepped(run, 1), 1), 1);
    expect(shownStep(last)).to.include({ index: 2, label: 'hour 3' });
    expect(shownStep(stepped(run, -1))!.index).to.equal(0);
    expect(analysisDiagnostics(result!.cases[0], 1)).to.deep.equal([
      {
        elementId: 'g',
        severity: 'info',
        message: 'pending (A day, hour 2)',
        source: 'analysis',
      },
    ]);
    // a case without steps: none to show, its values as before
    const plain = {
      ...run,
      result: { cases: [{ id: 'c', label: 'C', values: {} }] },
    };
    expect(shownStep(plain)).to.equal(null);
    // its message keeps the case first (GRL's strategies)
    expect(
      analysisDiagnostics({
        id: 'c',
        label: 'C',
        values: { g: { value: 1, label: 'done' } },
      })[0]!.message,
    ).to.equal('C: done');
  });
});
