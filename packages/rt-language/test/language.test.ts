import { expect } from 'chai';
import { EmptyFileSystem } from 'langium';
import { expectCompletion, expectHover, validationHelper } from 'langium/test';
import type { Document, NodeLine, PropertyLine } from '../src/generated/ast.js';
import {
  propertyLine,
  readPropertyLine,
  readResourceLine,
  resourceDecl,
  RESOURCE_KEYS,
} from '../src/properties.js';
import { createRtServices } from '../src/lsp.js';

const { RtNotation } = createRtServices(EmptyFileSystem);
const validate = validationHelper<Document>(RtNotation);
const context = RtNotation.context.Context;
const KIND = { G: 'goal', T: 'task', R: 'resource' } as const;

/** a context from each element's children (kinds from the id's letter) */
const structure = {
  set(
    children: Record<string, string[]> | undefined,
    properties: Record<string, Record<string, string>> = {},
    variables: string[] = [],
  ) {
    context.set(
      children && {
        elements: Object.fromEntries(
          Object.entries(children).map(([id, kids]) => [
            id,
            {
              kind: KIND[id[0] as keyof typeof KIND],
              children: kids,
              properties: properties[id] ?? {},
            },
          ]),
        ),
        variables,
      },
    );
  },
};

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

describe('property and resource line helpers agree with the grammar', () => {
  const { RtNotation: core } = createRtServices(EmptyFileSystem);

  it('round-trips resource declarations', () => {
    for (const properties of [
      { type: 'int', lowerBound: '0', upperBound: '100', initialValue: '80' },
      { type: 'int', lowerBound: '-5', upperBound: '5', initialValue: '-1' },
      { type: 'bool', initialValue: 'false' },
      { type: 'bool' },
    ]) {
      const line = `R1: Battery ${resourceDecl(properties)}`;
      const parsed = core.parser.LangiumParser.parse<Document>(line);
      expect(parsed.parserErrors).to.deep.equal([]);
      const decl = (parsed.value.lines[0] as NodeLine).resource!;
      const fromGrammar = Object.fromEntries(
        RESOURCE_KEYS.flatMap((key) =>
          decl[key] !== undefined ? [[key, decl[key]]] : [],
        ),
      );
      const fromHelper = readResourceLine(line);
      expect(fromHelper.text).to.equal('R1: Battery');
      expect(
        Object.fromEntries(
          Object.entries(fromHelper.resource ?? {}).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      ).to.deep.equal(fromGrammar);
      expect(fromGrammar).to.deep.equal(properties);
    }
  });

  it('round-trips property lines', () => {
    for (const [key, value] of [
      ['maintain', 'battery > 20 & ok'],
      ['dependsOn', 'G1, G2'],
      ['variables', 'x:3, y:2'],
      ['utility', '0.5'],
    ] as const) {
      const line = `  ${propertyLine(key, value)}`;
      expect(readPropertyLine(line)).to.deep.equal({ key, value });
      const parsed = core.parser.LangiumParser.parse<Document>(
        `G1: Goal\n${line}`,
      );
      expect(parsed.parserErrors).to.deep.equal([]);
      const property = parsed.value.lines[1] as PropertyLine;
      expect(property.key).to.equal(key);
      expect(property.value.$cstNode?.text.trim()).to.equal(value);
    }
  });
});

describe('property lines end at their line break', () => {
  it('does not read the next element as an empty dependsOn', async () => {
    const { document, diagnostics } = await validate(
      'G21: Trigger [T11]\n  dependsOn\n  T11: Enact\n    assertion ok',
    );
    expect(diagnostics.filter((d) => d.severity === 1)).to.deep.equal([]);
    expect(document.parseResult.value.lines.map((l) => l.$type)).to.deep.equal([
      'NodeLine',
      'DependsOnProperty',
      'NodeLine',
      'ConditionProperty',
    ]);
  });
});
