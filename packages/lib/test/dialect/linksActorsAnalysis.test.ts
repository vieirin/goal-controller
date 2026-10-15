/**
 * Properties on links and actors, and analysis engines (goal-controller#107),
 * through the view and the workbench's React-free modules, on the toy
 * dialect (test/engines/analysis/toy.ts): no core change names it.
 */
import { expect } from 'chai';
import { parsePistar } from '@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import { checkContextOf } from '@goal-controller/goal-language';
import {
  toyAnalyses,
  toyAnalysisModel,
  toyGraph,
} from '../engines/analysis/toy';
import { TOY_MODEL } from '../engines/analysis/toyModel';
import {
  applyNotationEdits,
  contextOf,
  notationDocument,
  notationEdits,
} from '../../../ui/lib/workbench/notationDocument';
import { setLinkProperty } from '../../../ui/lib/workbench/pistar';
import {
  analyse,
  analysisDiagnostics,
  analysisResource,
  shownCase,
} from '../../../ui/lib/workbench/analysis';

const view = () => goalView(parsePistar(TOY_MODEL), toyGraph);

describe('links and actors in the view (#107)', () => {
  it('lists every link with its ends and properties, and every actor', () => {
    const { links, actors } = view();
    expect(links[0]).to.deep.equal({
      iStarId: 'l1',
      kind: 'istar.ContributionLink',
      source: 'T1',
      target: 'G1',
      ends: {
        source: { iStarId: 't1', kind: 'istar.Task' },
        target: { iStarId: 'g1', kind: 'istar.Goal' },
      },
      label: 'help',
      properties: { weight: '3' },
    });
    expect(
      actors.map((a) => [a.iStarId, a.kind, a.properties, a.elements]),
    ).to.deep.equal([
      [
        'a1',
        'istar.Actor',
        { Description: '', budget: '5' },
        ['G1', 'T1', 'T2'],
      ],
      ['b1', 'istar.Role', { Description: '' }, []],
    ]);
  });

  it('writes a contribution’s weight as a link line, and edits it back into the model', () => {
    const tree = view();
    const { text } = notationDocument(toyGraph, tree);
    expect(text).to.include('T1: drive\n  link G1 {weight = 3}');
    expect(text).to.include('T2: fly\n  link G1 {weight = 4}');
    const edits = notationEdits(
      toyGraph,
      text.replace('{weight = 3}', '{weight = 9}'),
      tree,
    );
    expect(edits).to.deep.equal([{ link: 'l1', key: 'weight', value: '9' }]);
    const model = JSON.parse(applyNotationEdits(TOY_MODEL, edits));
    expect(model.links[0].customProperties).to.deep.equal({ weight: '9' });
  });

  it('removes a link’s last property, and its customProperties with it', () => {
    const model = JSON.parse(setLinkProperty(TOY_MODEL, 'l1', 'weight', null));
    expect(model.links[0]).not.to.have.property('customProperties');
    expect(model.links[0].label).to.equal('help');
  });

  it('gives a link property’s check the link, its ends’ kinds included', () => {
    const check = checkContextOf(
      contextOf(
        toyGraph as unknown as Parameters<typeof contextOf>[0],
        view(),
        [],
      ),
      'l2',
    );
    expect(check.readLink?.('l2')?.ends?.target.kind).to.equal('istar.Goal');
    expect(check.readActor?.('a1')?.properties.budget).to.equal('5');
  });
});

describe('the workbench’s analysis (#107)', () => {
  it('runs an analysis on the model text, and draws its case as info diagnostics', () => {
    const run = analyse(
      'weights',
      toyAnalyses.weights,
      TOY_MODEL,
      toyAnalysisModel,
    );
    expect('result' in run).to.equal(true);
    expect(analysisDiagnostics(shownCase(run))).to.deep.equal([
      {
        elementId: 'a1',
        severity: 'warning',
        message: 'All contributions: 7',
        source: 'analysis',
      },
      {
        elementId: 'b1',
        severity: 'info',
        message: 'All contributions: 0',
        source: 'analysis',
      },
    ]);
  });

  it('shows the case picked, else the first', () => {
    const run = {
      analysis: 'x',
      label: 'X',
      text: '',
      caseId: 'b',
      result: {
        cases: [
          { id: 'a', label: 'A', values: { g1: { value: 1 } } },
          {
            id: 'b',
            label: 'B',
            values: { g1: { value: 'yes', label: 'Satisfied' } },
          },
        ],
      },
    };
    expect(analysisDiagnostics(shownCase(run))[0]!.message).to.equal(
      'B: Satisfied',
    );
    expect(shownCase({ ...run, caseId: null })!.id).to.equal('a');
    expect(shownCase(null)).to.equal(undefined);
  });

  it('gives an analysis its input’s files, as the tabs hold them', () => {
    const slots = [
      {
        kind: 'strategies',
        paths: ['strategies/a.json', 'strategies/b.json'],
      },
    ] as unknown as Parameters<typeof analysisResource>[1];
    expect(
      analysisResource({ input: 'strategies' }, slots, {
        'strategies/a.json': '{}',
        'other.txt': 'x',
      }),
    ).to.deep.equal({ 'strategies/a.json': '{}' });
    expect(analysisResource({}, slots, {})).to.equal(undefined);
  });

  it('says why an analysis didn’t run, with no values', () => {
    const run = analyse(
      'weights',
      toyAnalyses.weights,
      '{ not json',
      toyAnalysisModel,
    );
    expect('error' in run).to.equal(true);
    expect(analysisDiagnostics(shownCase(run))).to.deep.equal([]);
  });
});
