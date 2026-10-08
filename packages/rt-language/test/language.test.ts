import { expect } from 'chai';
import { EmptyFileSystem } from 'langium';
import { expectCompletion, expectHover, validationHelper } from 'langium/test';
import type { Document } from '../src/generated/ast.js';
import { createRtServices } from '../src/lsp.js';

const { RtNotation } = createRtServices(EmptyFileSystem);
const validate = validationHelper<Document>(RtNotation);
const structure = RtNotation.structure.Structure;

const MODEL = [
  'G0: Root [G1#G2]',
  '  G1: One [T3;T4]',
  '    T3: Do',
  '    T4: Check',
  '  G2: Two',
].join('\n');

const messages = async (text: string) =>
  (await validate(text)).diagnostics.map((d) => d.message);

describe('rt-language validation', () => {
  afterEach(() => structure.set(undefined));

  it('accepts a whole indented model', async () => {
    expect(await messages(MODEL)).to.deep.equal([]);
  });

  it('reports grammar errors and unknown ids', async () => {
    const found = await messages('G0: Root [G1; G9]\n  G1: One');
    expect(found.some((m) => m.includes("but found: ' G'"))).to.equal(true);
    const unknown = await messages('G0: Root [G1;G9]\n  G1: One');
    expect(unknown).to.deep.equal([
      "Could not resolve reference to NodeLine named 'G9'.",
    ]);
  });

  it('reports duplicate ids and two elements on one line', async () => {
    expect(await messages('G1: A\nG1: B')).to.deep.equal(['Duplicate id G1']);
    expect(await messages('G1: A [G2]G2: B')).to.deep.equal([
      'Put each element on its own line',
    ]);
  });

  it('checks the notation against the structure when it is known', async () => {
    structure.set({
      G0: ['G1', 'G2'],
      G1: ['T3', 'T4'],
      T3: [],
      T4: [],
      G2: [],
    });
    expect(await messages(MODEL)).to.deep.equal([]);
    expect(await messages(MODEL.replace('[T3;T4]', '[T3;G2]'))).to.deep.equal([
      'Not a child of this goal',
      'Missing from the notation: T4',
    ]);
    expect(await messages(`${MODEL}\nT9: New`)).to.deep.equal([
      'Add this element in the diagram',
    ]);
  });
});

describe('rt-language completion and hover', () => {
  afterEach(() => structure.set(undefined));

  it("offers the goal's children where an id goes", async () => {
    structure.set({
      G0: ['G1', 'G2'],
      G1: ['T3', 'T4'],
      T3: [],
      T4: [],
      G2: [],
    });
    await expectCompletion(RtNotation)({
      text: 'G0: Root [G1#G2]\nG1: One [<|>\nT3: Do\nT4: Check',
      index: 0,
      assert: (list) => {
        const labels = list.items.map((i) => i.label);
        expect(labels).to.include.members(['T3', 'T4']);
        expect(labels).not.to.include.members(['G0', 'G', 'T']);
      },
      disposeAfterCheck: true,
    });
  });

  it('offers operators after an id', async () => {
    await expectCompletion(RtNotation)({
      text: 'G0: Root [G1<|>]\nG1: One',
      index: 0,
      assert: (list) => {
        const labels = list.items.map((i) => i.label);
        expect(labels).to.include.members([';', '#', '+', '|', '?', '->', '@']);
      },
      disposeAfterCheck: true,
    });
  });

  it('explains operators and ids on hover', async () => {
    await expectHover(RtNotation)({
      text: 'G0: Root [G1<|>->G2]\nG1: One\nG2: Two',
      index: 0,
      hover: /\*\*Degradation\*\* `->`: retries the first child/,
      disposeAfterCheck: true,
    });
    await expectHover(RtNotation)({
      text: 'G0: Root [G<|>1->G2]\nG1: One\nG2: Two',
      index: 0,
      hover: '**G1** One',
      disposeAfterCheck: true,
    });
  });
});

describe('rt-language document with properties and resources', () => {
  it('reads property lines under elements and resource declarations', async () => {
    const text = [
      'G0: Root [G1]',
      '  maintain battery > 20 & ok',
      '  type maintain',
      '  dependsOn G1',
      '  G1: One',
      '    variables x:3, y:2',
      'R1: Battery {int 0..100 = 80}',
      'R2: Alarm {bool = false}',
    ].join('\n');
    const result = await validate(text);
    expect(
      result.diagnostics.filter((d) => d.severity === 1).map((d) => d.message),
    ).to.deep.equal([]);
    const lines = result.document.parseResult.value.lines;
    expect(lines.map((l) => l.$type)).to.deep.equal([
      'NodeLine',
      'ConditionProperty',
      'RawProperty',
      'DependsOnProperty',
      'NodeLine',
      'RawProperty',
      'NodeLine',
      'NodeLine',
    ]);
  });
});
