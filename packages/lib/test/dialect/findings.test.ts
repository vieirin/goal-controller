/**
 * Findings as an analysis's result (goal-controller#162): a toy design-time
 * check over #107's toy graph (an actor whose contributions exceed its
 * budget) returns a list of findings, not a value per element. The
 * workbench badges what each involves, a finding picked is drawn as a
 * selection, and the result reads as text.
 */
import { expect } from 'chai';
import { toyAnalysisModel, toyGraph } from '../engines/analysis/toy';
import { TOY_MODEL } from '../engines/analysis/toyModel';
import {
  analyse,
  analysisDiagnostics,
  findingLabel,
  selectionStyle,
  shownCase,
  shownFinding,
  type AnalysisRun,
} from '../../../ui/lib/workbench/analysis';
import {
  analysisText,
  defineAnalyses,
  findingText,
  type AnalysisFinding,
  type AnalysisModel,
} from '../../src';

/** Each actor over its budget: one error, its contributions' links and sources involved. */
const budgets = (model: AnalysisModel) => ({
  cases: [
    {
      id: 'budgets',
      label: 'Budgets',
      values: {},
      findings: model.actors.flatMap((actor): AnalysisFinding[] => {
        const links = model.links.filter((link) =>
          actor.elements.includes(link.source),
        );
        const total = links.reduce(
          (sum, link) => sum + Number(link.properties.weight ?? 0),
          0,
        );
        const budget = Number(actor.properties.budget ?? Infinity);
        return total > budget
          ? [
              {
                kind: 'overBudget',
                severity: 'error',
                message: `${actor.name} spends ${total} of ${budget}`,
                elements: [actor.id, ...links.map((link) => link.source)],
                links: links.map((link) => link.id),
                details: { total: String(total), budget: String(budget) },
              },
            ]
          : [];
      }),
    },
  ],
});

const analyses = defineAnalyses(toyGraph, {
  budgets: { label: 'Budgets', run: budgets },
});

const run = (): AnalysisRun =>
  analyse('budgets', analyses.budgets, TOY_MODEL, toyAnalysisModel);

const FINDING =
  'error overBudget: Ann spends 7 of 5 · total=7 · budget=5 · elements a1, t1, t2 · links l1, l2';

describe('findings (#162)', () => {
  it('are a case’s list, each with its kind, severity, message, what it involves and its details', () => {
    const result = run();
    expect(
      'result' in result && result.result.cases[0]!.findings,
    ).to.deep.equal([
      {
        kind: 'overBudget',
        severity: 'error',
        message: 'Ann spends 7 of 5',
        elements: ['a1', 't1', 't2'],
        links: ['l1', 'l2'],
        details: { total: '7', budget: '5' },
      },
    ]);
  });

  it('read as text: a finding on one line, the result with its findings', () => {
    const [finding] = shownCase(run())!.findings!;
    expect(findingText(finding!)).to.equal(FINDING);
    expect(findingText(finding!, (id) => id.toUpperCase())).to.match(
      /elements A1, T1, T2 · links L1, L2$/,
    );
    const result = run();
    expect('result' in result && analysisText(result.result)).to.equal(
      `Budgets\n  finding: ${FINDING}`,
    );
  });

  it('badge every element, actor and link a finding involves, with its severity', () => {
    expect(analysisDiagnostics(shownCase(run()))).to.deep.equal(
      ['a1', 't1', 't2', 'l1', 'l2'].map((elementId) => ({
        elementId,
        severity: 'error',
        message: 'overBudget: Ann spends 7 of 5',
        source: 'analysis',
      })),
    );
    expect(findingLabel(shownCase(run())!.findings![0]!)).to.equal(
      'overBudget: Ann spends 7 of 5',
    );
  });

  it('draw a finding picked as a selection: what it involves kept, the rest dimmed', () => {
    const picked = { ...run(), finding: 0 };
    expect(shownFinding(picked)).to.equal(0);
    expect(shownFinding(run())).to.equal(null);
    // a finding the case shown doesn't have is none
    expect(shownFinding({ ...picked, finding: 3 })).to.equal(null);
    // nor one that is no index
    expect(shownFinding({ ...picked, finding: -1 })).to.equal(null);
    expect(shownFinding({ ...picked, finding: 0.5 })).to.equal(null);
    const style = selectionStyle(shownCase(picked), shownFinding(picked));
    expect(style).to.include('{ opacity: 0.25; }');
    for (const id of ['a1', 't1', 't2', 'l1', 'l2'])
      expect(style).to.include(`[data-id="${id}"]`);
    expect(style).not.to.include('[data-id="g1"]');
    // none picked, and the case is no selection: nothing dimmed
    expect(selectionStyle(shownCase(picked), null)).to.equal(null);
    // a finding that involves nothing (the model's as a whole): nothing dimmed
    const whole = {
      id: 'model',
      label: 'Model',
      values: {},
      findings: [
        {
          kind: 'noAgent',
          severity: 'warning' as const,
          message: 'no agent plays a role',
          elements: [],
          links: [],
        },
      ],
    };
    expect(selectionStyle(whole, 0)).to.equal(null);
  });
});
