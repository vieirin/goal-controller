/** The language server's services (src/lsp/server.ts), without a connection. */
import type { DefinitionContext } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  documentDiagnostics,
  fieldUri,
  type CheckContext,
} from '../src/index.js';
import {
  createGoalLspServices,
  serverCodeActions,
  serverDiagnostics,
} from '../src/lsp/server.js';
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

  it('shows the engine’s error on a line while it reads as saved', async () => {
    const { shared, store } = createGoalLspServices();
    const saved = { G2: { line: 'G2: Wait', error: 'no such goal' } };
    store.set({ dialect: toy, context, saved });
    const found = await serverDiagnostics(shared, 'file:///notation.goal', doc);
    expect(found).to.deep.equal(
      documentDiagnostics(toy, doc, context, { saved }),
    );
    expect(found.map((d) => d.message).join('\n')).to.include('no such goal');
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

  it('gives a check the whole model: elements, their kinds and positions', async () => {
    const seen: CheckContext[] = [];
    const { shared, store } = createGoalLspServices(undefined, {
      checks: {
        toy: {
          'toy.resource.bounds': (_properties, context) => {
            seen.push(context);
            return null;
          },
        },
      },
    });
    const model: DefinitionContext = {
      ...context,
      elements: {
        ...context.elements,
        R1: { ...context.elements.R1!, x: 120 },
      },
    };
    store.set({ dialect: toy, context: model });
    await serverDiagnostics(
      shared,
      'file:///notation.goal',
      'R1: Fuel {int 0..9 = 5}',
    );
    expect(seen.length).to.be.greaterThan(0);
    const [check] = seen;
    expect(check!.self).to.equal('R1');
    // the dialect's kind, as iStar's (goal-controller#222)
    expect(check!.kindOf('G2')).to.equal('istar.Goal');
    expect(check!.kindOf('R1')).to.equal('istar.Resource');
    expect(check!.kindOf('nowhere')).to.equal(undefined);
    expect(check!.elements?.R1?.x).to.equal(120);
    expect(Object.keys(check!.elements ?? {})).to.deep.equal([
      'G1',
      'G2',
      'T1',
      'R1',
    ]);
    expect(check!.projectResources).to.equal(undefined);
  });

  it('gives a check the project resources the client sends, as they are', async () => {
    const seen: CheckContext[] = [];
    const { shared, store } = createGoalLspServices(undefined, {
      checks: {
        toy: {
          'toy.resource.bounds': (_properties, context) => {
            seen.push(context);
            return null;
          },
        },
      },
    });
    const projectResources = {
      world: {
        symbols: {
          classes: [{ name: 'Room', members: [{ name: 'is_clean' }] }],
        },
        data: {
          classes: { Room: { attributes: ['is_clean'], instances: [] } },
        },
      },
    };
    store.set({ dialect: toy, context: { ...context, projectResources } });
    await serverDiagnostics(
      shared,
      'file:///notation.goal',
      'R1: Fuel {int 0..9 = 5}',
    );
    expect(seen[0]!.projectResources).to.deep.equal(projectResources);
  });

  // T9 is its own element line, naming no element of the context: notInDiagram
  const notInDiagramDoc = 'G1: Go [G2;T1]\nG2: Wait\nT1: Do\nT9: Lift';

  it('offers a createNode quick fix for a notInDiagram diagnostic (goal-controller#416)', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: toy, context });
    const from = notInDiagramDoc.indexOf('T9');
    const to = from + 'T9'.length;
    const actions = await serverCodeActions(
      shared,
      'file:///notation.goal',
      notInDiagramDoc,
      { from, to },
    );
    expect(actions).to.have.length(1);
    expect(actions[0]!.title).to.include('T9');
    expect(actions[0]!.data).to.deep.equal({
      kind: 'createNode',
      elementTypeId: 'istar.Task',
      args: { name: 'T9: Task' },
    });
  });

  it('offers no quick fix away from the diagnostic, or for a diagnostic without one', async () => {
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: toy, context });
    const elsewhere = await serverCodeActions(
      shared,
      'file:///notation.goal',
      notInDiagramDoc,
      { from: 0, to: 2 },
    );
    expect(elsewhere).to.deep.equal([]);
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
