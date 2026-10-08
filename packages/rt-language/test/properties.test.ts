import { expect } from 'chai';
import { EmptyFileSystem, URI } from 'langium';
import {
  expectCompletion,
  expectGoToDefinition,
  expectHover,
  parseHelper,
} from 'langium/test';
import type { RtPropertyRules } from '../src/context.js';
import type { Document } from '../src/generated/ast.js';
import { createRtServices } from '../src/lsp.js';

const { shared, RtNotation } = createRtServices(EmptyFileSystem);
const context = RtNotation.context.Context;
const parse = parseHelper<Document>(RtNotation);

/** rules shaped like the UI's PROPERTY_SPECS (the engine's checks) */
const RULES: RtPropertyRules = {
  goal: [
    { key: 'type' },
    {
      key: 'maintain',
      applies: (p) => p.type === 'maintain',
      notApplying: () => 'Only read when type is maintain',
      validate: (p) =>
        p.type === 'maintain' && !p.maintain?.trim() ? 'needs maintain' : null,
    },
    { key: 'assertion' },
    {
      key: 'dependsOn',
      validate: (p, { kindOf }) => {
        const missing = (p.dependsOn ?? '')
          .split(',')
          .map((d) => d.trim())
          .find((d) => d && !kindOf(d));
        return missing ? `Dependency ${missing} not found` : null;
      },
    },
  ],
  task: [{ key: 'assertion' }],
  resource: [
    {
      key: 'initialValue',
      validate: (p) =>
        p.type === 'bool' &&
        p.initialValue !== 'true' &&
        p.initialValue !== 'false'
          ? 'bool needs true or false'
          : null,
    },
  ],
};

const MODEL = {
  elements: {
    G0: {
      kind: 'goal',
      children: ['G1', 'T1'],
      properties: { dependsOn: 'G1' },
    },
    G1: { kind: 'goal', children: [], properties: { dependsOn: 'G2' } },
    G2: { kind: 'goal', children: [], properties: {} },
    T1: { kind: 'task', children: [], properties: { assertion: 'R1 > 3' } },
    R1: {
      kind: 'resource',
      children: [],
      properties: {
        type: 'int',
        lowerBound: '0',
        upperBound: '10',
        initialValue: '5',
      },
    },
    R2: {
      kind: 'resource',
      children: [],
      properties: { type: 'bool', initialValue: 'false' },
    },
  },
  variables: ['inEmergency'],
} as const;

const diagnostics = async (text: string, uri?: string) => {
  const document = await parse(text, uri ? { documentUri: uri } : {});
  await shared.workspace.DocumentBuilder.build([document], {
    validation: true,
  });
  const found = (document.diagnostics ?? []).map((d) => [
    d.severity,
    d.message,
  ]);
  await shared.workspace.DocumentBuilder.update([], [document.uri]);
  return found;
};

describe('rt-language property checks', () => {
  beforeEach(() => {
    context.rules = RULES;
    context.set(MODEL as never);
  });
  afterEach(() => {
    context.rules = undefined;
    context.set(undefined);
  });

  it('checks assertions against the resources they compare', async () => {
    const found = await diagnostics(
      [
        'G0: Root [G1#T1]',
        '  assertion R1 = true & R2 > 3 & R1 > 20 & inEmergency & nowhere',
      ].join('\n'),
    );
    expect(found).to.deep.include.members([
      [1, 'R1 is an int resource: compare it with a number'],
      [1, 'R2 is a bool resource: use R2 = true or false'],
      [2, "20 is outside R1's bounds [0..10]"],
      [4, 'nowhere is not a resource of this model or a known variable'],
    ]);
    expect(found.map(([, m]) => m)).not.to.include(
      'inEmergency is not a resource of this model or a known variable',
    );
  });

  it('runs the engine rules on property lines and resource declarations', async () => {
    const found = await diagnostics(
      [
        'G0: Root [G1#T1]',
        '  type maintain',
        '  dependsOn G9',
        '  T1: Task',
        '    maintain R1 > 3',
        'R2: Alarm {bool = maybe}',
      ].join('\n'),
    );
    expect(found).to.deep.include.members([
      [1, 'needs maintain'],
      [1, 'Dependency G9 not found'],
      [2, 'Not read for a task'],
      [1, 'bool needs true or false'],
    ]);
  });

  it('warns about dependsOn on itself and cycles', async () => {
    const self = await diagnostics('G0: Root [G1#T1]\n  dependsOn G0');
    expect(self).to.deep.include([2, 'G0 depends on itself']);
    // G2 -> G0 (here), G0 -> G1 (model), G1 -> G2 (model)
    const cycle = await diagnostics('G2: Leaf\n  dependsOn G0');
    expect(cycle).to.deep.include([
      2,
      'Circular dependency: G2 → G0 → G1 → G2',
    ]);
  });

  it('checks an inspector field with the element’s other properties', async () => {
    const found = await diagnostics(
      'R1 = true',
      'file:///fields/T1/assertion.rtp',
    );
    expect(found).to.deep.equal([
      [1, 'R1 is an int resource: compare it with a number'],
    ]);
    const deps = await diagnostics('G9', 'file:///fields/G0/dependsOn.rtp');
    expect(deps).to.deep.equal([[1, 'Dependency G9 not found']]);
  });
});

describe('rt-language property completion, hover and definition', () => {
  beforeEach(() => {
    context.rules = RULES;
    context.set(MODEL as never);
  });
  afterEach(() => {
    context.rules = undefined;
    context.set(undefined);
  });

  it('offers resources and variables in an assertion line and field', async () => {
    await expectCompletion(RtNotation)({
      text: 'G0: Root [G1#T1]\n  assertion <|>',
      index: 0,
      assert: (list) => {
        expect(list.items.map((i) => i.label)).to.include.members([
          'R1',
          'R2',
          'inEmergency',
        ]);
      },
      disposeAfterCheck: true,
    });
    const document = await shared.workspace.LangiumDocumentFactory.fromString(
      'R',
      URI.parse('file:///fields/T1/assertion.rtp'),
    );
    shared.workspace.LangiumDocuments.addDocument(document);
    const list = await RtNotation.lsp.CompletionProvider!.getCompletion(
      document,
      {
        textDocument: { uri: document.uri.toString() },
        position: { line: 0, character: 1 },
      },
    );
    expect(list?.items.map((i) => i.label)).to.deep.equal(['R1', 'R2']);
    shared.workspace.LangiumDocuments.deleteDocument(document.uri);
  });

  it('offers the property keys a goal reads', async () => {
    await expectCompletion(RtNotation)({
      text: 'G0: Root [G1#T1]\n  <|>',
      index: 0,
      assert: (list) => {
        const labels = list.items.map((i) => i.label);
        expect(labels).to.include.members(['type', 'maintain', 'dependsOn']);
        expect(labels).not.to.include('utility'); // not in these rules
      },
      disposeAfterCheck: true,
    });
  });

  it('shows a resource on hover and jumps to its line', async () => {
    await expectHover(RtNotation)({
      text: 'G0: Root [G1#T1]\n  assertion R<|>1 > 3\nR1: Battery {int 0..10 = 5}',
      index: 0,
      hover: '**R1** resource: `int 0..10 = 5`',
      disposeAfterCheck: true,
    });
    await expectGoToDefinition(RtNotation)({
      text: 'G0: Root [G1#T1]\n  assertion R<|>1 > 3\n<|R1: Battery {int 0..10 = 5}|>',
      index: 0,
      rangeIndex: 0,
      disposeAfterCheck: true,
    });
  });
});
