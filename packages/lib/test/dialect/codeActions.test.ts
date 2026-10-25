/**
 * The goal language server's `notInDiagram` quick fix (goal-controller#416),
 * mapped through a dialect's own kinds (`istarKindOf`, goal-controller#440):
 * KAOS and NFR get one too, not just iStar's goal/task/resource/quality.
 */
import { expect } from 'chai';
import {
  createGoalLspServices,
  serverCodeActions,
} from '@goal-controller/goal-language/lsp';
import { kaos, nfr } from '../../src';

describe('the notInDiagram quick fix, through a dialect (goal-controller#440)', () => {
  it('offers one for a KAOS kind', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: kaos, context: { elements: {}, variables: [] } });
    const doc = 'G1: Reach the lab';
    const from = doc.indexOf('G1');
    const to = from + 'G1'.length;
    const actions = await serverCodeActions(
      shared,
      'file:///notation.goal',
      doc,
      {
        from,
        to,
      },
    );
    expect(actions).to.have.length(1);
    expect(actions[0]!.data).to.deep.equal({
      kind: 'createNode',
      elementTypeId: 'kaos.BehavioralGoal',
      args: { name: 'G1: BehavioralGoal' },
    });
  });

  it('offers one for an NFR kind', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: nfr, context: { elements: {}, variables: [] } });
    const doc = 'S1: Fast enough';
    const from = doc.indexOf('S1');
    const to = from + 'S1'.length;
    const actions = await serverCodeActions(
      shared,
      'file:///notation.goal',
      doc,
      {
        from,
        to,
      },
    );
    expect(actions).to.have.length(1);
    expect(actions[0]!.data).to.deep.equal({
      kind: 'createNode',
      elementTypeId: 'nfr.NFR',
      args: { name: 'S1: NFR' },
    });
  });
});
