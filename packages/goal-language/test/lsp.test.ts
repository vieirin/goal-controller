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
const doc =
  'goal G1: Go [G2;T9]\n  priority urgent\ngoal G2: Wait\ntask T1: Do';

describe('the language server', () => {
  it('reports syntax errors only, without a context', async () => {
    const { shared } = createGoalLspServices();
    const found = await serverDiagnostics(
      shared,
      'file:///notation.goal',
      // no dialect: no kind words, the element part alone
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
    // the line as its element's text stores it
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
      'resource R1: Fuel {int 0..9 = 5}',
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
      'resource R1: Fuel {int 0..9 = 5}',
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
      'resource R1: Fuel {int 0..9 = 5}',
    );
    expect(seen[0]!.projectResources).to.deep.equal(projectResources);
  });

  it('offers no quick fix for a line naming no element: the line creates it (goal-controller#518)', async () => {
    const created =
      'goal G1: Go [G2;T1]\ngoal G2: Wait\ntask T1: Do\ntask T9: Lift';
    const { shared, store } = createGoalLspServices();
    store.set({ dialect: toy, context });
    expect(
      await serverDiagnostics(shared, 'file:///notation.goal', created),
    ).to.deep.equal([]);
    const from = created.indexOf('T9');
    expect(
      await serverCodeActions(shared, 'file:///notation.goal', created, {
        from,
        to: from + 'T9'.length,
      }),
    ).to.deep.equal([]);
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
