/**
 * Variants of a root (goal-controller#152), on the toy (toy.ts): the
 * enumeration's count, order, literals and truncation, a variant's context,
 * and which contexts are satisfiable under the analyst's relations.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { assertionText, readAssertion } from '@goal-controller/goal-language';
import {
  eachVariant,
  equivalent,
  implies,
  satisfiable,
  variantContext,
  variantsOf,
  type AnalysisElement,
  type AnalysisLink,
  type AnalysisModel,
  type Variant,
} from '../../../src';
import { contextGuard, situatedModel } from './toy';
import { SITUATED_MODEL } from './toyModel';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const model = (): AnalysisModel =>
  situatedModel(parsePistar(SITUATED_MODEL, { fileMetamodel: true }));

/** Bob's tree is followed into: the dependum's own link points at G6. */
const options = { guard: contextGuard, follow: () => true };

/** A variant's literals, as the paper's figures write a context. */
const literals = (variant: Variant) =>
  variant.literals.map(
    (l) => `${l.holds ? '' : '¬'}${assertionText(l.condition)}@${l.at}`,
  );

const context = (variant: Variant) => assertionText(variantContext(variant));

describe('variants of a root (#152)', () => {
  it('enumerates every variant in tree order: AND children kept, one OR child, a guarded AND child kept then dropped', () => {
    const { variants, truncated, total } = variantsOf(model(), 'g1', options);
    assert.strictEqual(total, 6);
    assert.strictEqual(truncated, false);
    assert.deepStrictEqual(
      variants.map((v) => v.leaves),
      [['t5', 't3'], ['t5', 't4'], ['t5'], ['t2', 't3'], ['t2', 't4'], ['t2']],
    );
    // the dependency followed into Bob's tree: the dependum, both its links
    assert.deepStrictEqual(variants[0], {
      elements: ['g1', 'g2', 't1', 'g5', 'g6', 't5', 'g3', 't3'],
      links: ['l1', 'l3', 'd1', 'd2', 'l7', 'l2', 'l5'],
      leaves: ['t5', 't3'],
      literals: variants[0]!.literals,
    });
    assert.deepStrictEqual(variants.map(literals), [
      ['C1 | C2@g1', 'C1@l3', 'C2@l2', '!C2@l5'],
      ['C1 | C2@g1', 'C1@l3', 'C2@l2'],
      ['C1 | C2@g1', 'C1@l3', '¬C2@l2'],
      ['C1 | C2@g1', '!C1@l4', 'C2@l2', '!C2@l5'],
      ['C1 | C2@g1', '!C1@l4', 'C2@l2'],
      ['C1 | C2@g1', '!C1@l4', '¬C2@l2'],
    ]);
  });

  it('stops at a dependum it isn’t told to follow, which is then a leaf', () => {
    const { variants } = variantsOf(model(), 'g1', { guard: contextGuard });
    assert.deepStrictEqual(variants[2], {
      elements: ['g1', 'g2', 't1', 'g5'],
      links: ['l1', 'l3', 'd1'],
      leaves: ['g5'],
      literals: variants[2]!.literals,
    });
    // a string names the element to go on at
    const at = variantsOf(model(), 'g1', { ...options, follow: () => 't5' });
    assert.deepStrictEqual(at.variants[2]!.elements, [
      'g1',
      'g2',
      't1',
      'g5',
      't5',
    ]);
  });

  it('asks the engine how a link joins: a dependency made an alternative', () => {
    const { total } = variantsOf(model(), 'g2', {
      ...options,
      relation: (link) =>
        link.kind === 'istar.OrRefinementLink' ||
        link.kind === 'istar.DependencyLink'
          ? 'or'
          : null,
    });
    // T1's dependency is its only alternative; G6's OR still takes T5
    assert.strictEqual(total, 2);
  });

  it('writes a variant’s context as a formula that reads back as itself', () => {
    const { variants } = variantsOf(model(), 'g1', options);
    assert.deepStrictEqual(variants.map(context), [
      '(C1 | C2) & C1 & C2 & !C2',
      '(C1 | C2) & C1 & C2',
      '(C1 | C2) & C1 & !C2',
      '(C1 | C2) & !C1 & C2 & !C2',
      '(C1 | C2) & !C1 & C2',
      '(C1 | C2) & !C1 & !C2',
    ]);
    for (const variant of variants) {
      const tree = variantContext(variant)!;
      const read = readAssertion(assertionText(tree))!;
      assert.strictEqual(equivalent(tree, read).holds, true);
    }
    assert.strictEqual(
      variantContext({ elements: [], links: [], leaves: [], literals: [] }),
      null,
    );
  });

  it('finds the unadoptable variants, and those the analyst’s relations rule out', () => {
    const contexts = variantsOf(model(), 'g1', options).variants.map((v) =>
      variantContext(v)!,
    );
    assert.deepStrictEqual(
      contexts.map((c) => satisfiable(c).satisfiable),
      [false, true, true, false, true, false],
    );
    // C1 → ¬C2: busy is never indoors
    const relations = [readAssertion('!C1 | !C2')!];
    const ruled = satisfiable(contexts[1]!, relations);
    assert.deepStrictEqual(ruled, {
      satisfiable: false,
      conflict: [0],
      opaque: [],
    });
    assert.deepStrictEqual(satisfiable(contexts[2]!, relations), {
      satisfiable: true,
      model: { C1: true, C2: false },
      opaque: [],
    });
    // guiding with the map (C2) and not guiding (!C2): neither applies where the other does
    assert.deepStrictEqual(implies(contexts[1]!, contexts[2]!), {
      holds: false,
      counterexample: { C1: true, C2: true },
      opaque: [],
    });
    // calling with the map is the context C2 & !C1, whatever the root's says
    assert.strictEqual(implies(contexts[4]!, readAssertion('C2')!).holds, true);
    assert.strictEqual(
      equivalent(contexts[4]!, readAssertion('C2 & !C1')!).holds,
      true,
    );
    assert.strictEqual(
      equivalent(contexts[4]!, readAssertion('C2')!).holds,
      false,
    );
  });

  it('is lazy, and reports truncation instead of enumerating every variant', () => {
    // ten AND children of four alternatives each: 4^10 variants
    const element = (id: string, kind: string): AnalysisElement => ({
      id,
      kind,
      name: id,
      properties: {},
      actor: 'a',
    });
    const elements = [element('r', 'istar.Goal')];
    const links: AnalysisLink[] = [];
    for (let i = 0; i < 10; i++) {
      elements.push(element(`g${i}`, 'istar.Goal'));
      links.push({
        id: `a${i}`,
        kind: 'istar.AndRefinementLink',
        source: `g${i}`,
        target: 'r',
        properties: {},
      });
      for (let j = 0; j < 4; j++) {
        elements.push(element(`t${i}.${j}`, 'istar.Task'));
        links.push({
          id: `o${i}.${j}`,
          kind: 'istar.OrRefinementLink',
          source: `t${i}.${j}`,
          target: `g${i}`,
          properties: {},
        });
      }
    }
    const big = { actors: [], elements, links } as AnalysisModel;
    const read = variantsOf(big, 'r', { guard: () => null, limit: 1000 });
    assert.strictEqual(read.total, 4 ** 10);
    assert.strictEqual(read.variants.length, 1000);
    assert.strictEqual(read.truncated, true);
    const first = eachVariant(big, 'r', { guard: () => null }).next();
    assert.deepStrictEqual(
      first.value!.leaves,
      Array.from({ length: 10 }, (_, i) => `t${i}.0`),
    );
  });

  it('stops a cycle of dependencies where it closes', () => {
    const element = (id: string, actor?: string) => ({
      id,
      kind: 'istar.Goal',
      name: id,
      properties: {},
      ...(actor && { actor }),
    });
    const link = (id: string, source: string, target: string) => ({
      id,
      kind: 'istar.DependencyLink',
      source,
      target,
      properties: {},
    });
    const cyclic = {
      actors: [],
      elements: [
        element('a', 'A'),
        element('b', 'B'),
        element('x'),
        element('y'),
      ],
      links: [
        link('1', 'a', 'x'),
        link('2', 'x', 'b'),
        link('3', 'b', 'y'),
        link('4', 'y', 'a'),
      ],
    } as AnalysisModel;
    const { variants } = variantsOf(cyclic, 'a', {
      guard: () => null,
      follow: () => true,
    });
    assert.deepStrictEqual(variants, [
      {
        elements: ['a', 'x', 'b', 'y', 'a'],
        links: ['1', '2', '3', '4'],
        leaves: ['a'],
        literals: [],
      },
    ]);
  });

  it('says which root it can’t find', () => {
    assert.throws(
      () => variantsOf(model(), 'nope', options),
      /variants: no element nope/,
    );
  });
});
