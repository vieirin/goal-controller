import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { isDeepStrictEqual } from 'util';
import { getAssertionVariables } from '../../src/parsers/getAssertionVariables';

/**
 * Differential test: the Langium assertion grammar (`edgeLangium`) must read every
 * `assertion`/`maintain` value like AssertionRegex.g4: the same variables when ANTLR
 * accepts it, an error when ANTLR rejects it.
 */

const ROOT = resolve(__dirname, '../../../..');
const CORPORA = ['examples', 'dissertationExamples', 'experiments'];

const walkTxt = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'node_modules' ? [] : walkTxt(path);
    }
    return path.endsWith('.txt') ? [path] : [];
  });

/** every assertion and maintain value of every piStar model in the corpora */
const corpusConditions = (): string[] => {
  const values = new Set<string>();
  for (const corpus of CORPORA) {
    for (const file of walkTxt(join(ROOT, corpus))) {
      let model: {
        actors?: { nodes?: { customProperties?: Record<string, string> }[] }[];
      };
      try {
        model = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // not a piStar model
      }
      for (const actor of model.actors ?? []) {
        for (const node of actor.nodes ?? []) {
          for (const key of ['assertion', 'maintain']) {
            const value = node.customProperties?.[key];
            if (typeof value === 'string') values.add(value);
          }
        }
      }
    }
  }
  return [...values];
};

const EDGE_CASES = [
  // precedence: & binds tighter than |, ! negates what follows
  'a & b | c',
  'a | b & c',
  '!a & b',
  'a & !b | c',
  '!(a | b) & c',
  '((a))',
  // assignments count every time, identifiers once
  'a = true & a = true',
  'a & a = false & a',
  'a > 3 & a & a = true',
  // comparators
  'x = 5',
  'x != 5',
  'x < 10 & y <= 20 & z > 1 & w >= 100',
  'x>3&y<=4',
  // constants and identifiers
  'true',
  'false | ok',
  '_private1 & CamelCase',
  'trueish & falsey',
  '   ',
  '\tbattery\n& ok',
  // rejected by both
  'x > 0',
  'x > 05',
  'x = 1.5',
  'x = maybe',
  'a &',
  '& a',
  'a b',
  '(a',
  'a)',
  'Battery <= 20%',
  '1 > x',
  '!',
  'x == 3',
];

/** AssertionRegex.g4 accepts these; the Langium grammar rejects them on purpose. */
const KNOWN_DIVERGENCES: Record<string, string> = {};

const read = (text: string, grammar: 'edgeV2' | 'edgeLangium') => {
  const errors: string[] = [];
  const variables = getAssertionVariables({
    assertionSentence: text,
    grammar,
    onSyntaxError: (message) => errors.push(message),
  });
  return { variables, errors };
};

describe('edgeLangium reads assertions like AssertionRegex.g4 (differential)', () => {
  const corpus = corpusConditions();

  it('has a corpus to compare', () => {
    expect(corpus.length).to.be.greaterThan(40);
  });

  for (const [label, texts] of [
    ['corpus', corpus],
    ['edge cases', EDGE_CASES],
  ] as const) {
    it(`agrees on every ${label} condition`, () => {
      const mismatches: string[] = [];
      for (const text of texts) {
        const antlr = read(text, 'edgeV2');
        const langium = read(text, 'edgeLangium');
        if (antlr.errors.length === 0) {
          if (langium.errors.length > 0) {
            mismatches.push(
              `${JSON.stringify(text)}: only Langium rejects it (${langium.errors[0]})`,
            );
          } else if (!isDeepStrictEqual(langium.variables, antlr.variables)) {
            mismatches.push(
              `${JSON.stringify(text)}: ${JSON.stringify(langium.variables)} != ${JSON.stringify(antlr.variables)}`,
            );
          }
        } else if (langium.errors.length === 0) {
          mismatches.push(
            `${JSON.stringify(text)}: only ANTLR rejects it (${antlr.errors[0]})`,
          );
        }
      }
      expect(mismatches).to.deep.equal([]);
    });
  }

  it('rejects `x > 0` like AssertionRegex.g4 (its INT has no zero)', () => {
    expect(read('x > 0', 'edgeV2').errors).to.have.length.greaterThan(0);
    expect(read('x > 0', 'edgeLangium').errors).to.have.length.greaterThan(0);
  });

  for (const [text, why] of Object.entries(KNOWN_DIVERGENCES)) {
    it(`diverges on purpose: ${JSON.stringify(text)} (${why})`, () => {
      expect(read(text, 'edgeV2').errors).to.deep.equal([]);
      expect(read(text, 'edgeLangium').errors).to.have.length.greaterThan(0);
    });
  }
});
