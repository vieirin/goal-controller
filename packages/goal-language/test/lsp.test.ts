/** The language server's services (src/lsp/server.ts), without a connection. */
import type { DefinitionContext } from '@goal-controller/dialect';
import { expect } from 'chai';
import { documentDiagnostics, fieldUri } from '../src/index.js';
import { createGoalLspServices, serverDiagnostics } from '../src/lsp/server.js';
import { toy } from '../../dialect/test/support/toy.js';

const context: DefinitionContext = {
  elements: {
    G1: { kind: 'goal', children: ['G2', 'T1'], properties: {} },
    G2: { kind: 'goal', children: [], properties: {} },
    T1: { kind: 'task', children: [], properties: {} },
    R1: { kind: 'resource', children: [], properties: { type: 'int' } },
  },
  variables: [],
};
const doc = 'G1: Go [G2;T9]\n  priority urgent\nG2: Wait\nT1: Do';

describe('the language server', () => {
  it('reports syntax errors only, without a context', async () => {
    const { shared } = createGoalLspServices();
    const found = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      'G1: Go [G2;;T1]',
    );
    expect(found.map((d) => d.severity)).to.deep.equal(['error']);
  });

  it('reports what the local support reports, with the dialect it is sent', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: toy, context });
    const found = await serverDiagnostics(shared, 'file:///notation.goal', doc);
    expect(found).to.deep.equal(documentDiagnostics(toy, doc, context));
    expect(found.map((d) => d.message)).to.include('Not a child');
  });

  it('runs the named checks the host gives it, by dialect id', async () => {
    const { shared, store } = createGoalLspServices(undefined, {
      checks: {
        toy: { 'toy.resource.bounds': () => 'out of bounds' },
      },
    });
    store.set({ dialect: toy, context });
    const found = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      'R1: Fuel {int 0..9 = 5}',
    );
    expect(found.map((d) => d.message)).to.deep.equal(['out of bounds']);
  });

  it('reads an inspector field with its property’s value type', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: toy, context });
    const found = await serverDiagnostics(
      shared,
      fieldUri('R1', 'lowerBound'),
      'x',
    );
    expect(found.map((d) => d.message)).to.deep.equal(['Not an integer: x']);
  });
});
