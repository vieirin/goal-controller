import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { isDeepStrictEqual } from 'util';
import { getGoalDetail } from '../../../src/parsers/goalNameParser';

/**
 * Differential test: the Langium front end (`edgeLangium`) must read every RT
 * text exactly like the ANTLR edgeV2 grammar: deep-equal GoalDetail when ANTLR
 * accepts it, an error when ANTLR rejects it. The only exceptions are the
 * KNOWN_DIVERGENCES below, which ANTLR accepts and Langium rejects on purpose.
 */

const ROOT = resolve(__dirname, '../../../../..');
const CORPORA = ['examples', 'dissertationExamples', 'experiments'];

const walkTxt = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'node_modules' ? [] : walkTxt(path);
    }
    return path.endsWith('.txt') ? [path] : [];
  });

/** every goal/task/resource text of every piStar model in the corpora */
const corpusTexts = (): string[] => {
  const texts = new Set<string>();
  for (const corpus of CORPORA) {
    for (const file of walkTxt(join(ROOT, corpus))) {
      let model: { actors?: { nodes?: { type: string; text: string }[] }[] };
      try {
        model = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue; // not a piStar model (notation.txt, logs, ...)
      }
      for (const actor of model.actors ?? []) {
        for (const node of actor.nodes ?? []) {
          if (/^istar\.(Goal|Task|Resource)$/.test(node.type)) {
            texts.add(node.text);
          }
        }
      }
    }
  }
  return [...texts];
};

const EDGE_CASES = [
  // precedence and associativity
  'G1: Mix [G2;G3#G4->G5|G6@2]',
  'G1: Mix [G2|G3?G4+G5#G6;G7->G8]',
  'G1: Mix [G2->G3;G4#G5+G6?G7|G8]',
  'G1: Chain [G2;G3;G4]',
  'G1: Chain [G2->G3->G4]',
  'G1: Choice [G2?G3]',
  'G1: Any [T2+T3+T4]',
  // retries
  'G14: goal [T15@3->G16->T19]',
  'G1: Retry [G2@2@3->G3]',
  'G1: Retry [G2@2]',
  'G1: Retry [G2;G3@4]',
  'G1: Retry [[G2;G3]@2->G4]',
  'G1: Retry [G2@1.5->G3]',
  // brackets, skip, ids
  'G1: Group [[G2;G3]#G4]',
  'G1: Group [G2;[G3#G4]]',
  'G1: Group [[[G2]]]',
  'G1: Skip [G2|skip]',
  'G1: Skip [skip]',
  'G1a: Sub ids [T1b;T2c]',
  'G1.2: Decimal ids [T1.2;T1.3X]',
  'G1X: Variant [GX|TX]',
  'R3: Resource',
  // names
  'G1: Goal',
  'T1: Task',
  'G2: Get the Robot',
  "T3: Robot's arm - Reset",
  'G4: skip the GG',
  'G5: Grab X [T6]',
  '',
  // malformed (both reject)
  'G1: x [G2; G3]',
  'G1: x [G2 ;G3]',
  'G1:[G2]',
  'G1 Name',
  'GX: name',
  'G1: Name [G2',
  'G1: Name G2]',
  'G1: Name [G2;]',
  'G1: Name [;G2]',
  'G1: Name []',
  'G1: Name [G2@]',
  'G1: Name [G2@->G3]',
  'G1: Name [G2] ',
  ' G1: Name',
  'G1: Step 2',
  'G1: Name [G2 & G3]',
  'G1: Name\nG2: Other',
  'G1: Name [G2$G3]',
  'G12a: Name',
  'G1: A [G2]G3: B',
];

/** ANTLR edgeV2 accepts these shapes; the Langium grammar rejects them on purpose. */
const KNOWN_DIVERGENCES: Record<string, string> = {
  'G1: Args [G2,G3]': '`G1, expr` (gArgs) is not part of the notation',
  'G1: Glued [G2G3]': '`G1 expr` (gIdContinued) inside a notation',
  'G1: After [G2];G3': 'operators after the closing bracket',
  'G1;G2': 'a notation without id and name',
  G1: 'an id without a name',
  ':Name': 'a name without an id (nameOnly)',
  '[G1;G2]': 'a bare notation (notationStart)',
  'G1: Nested [: Inner [G2]]':
    '`: word expr` (nameContinued) inside a notation',
};

const read = (goalText: string, grammar: 'edgeV2' | 'edgeLangium') => {
  const errors: string[] = [];
  const detail = getGoalDetail({
    goalText,
    grammar,
    onSyntaxError: (message) => errors.push(message),
  });
  return { detail, errors };
};

describe('edgeLangium reads RT texts like edgeV2 (differential)', () => {
  const corpus = corpusTexts();

  it('has a corpus to compare', () => {
    expect(corpus.length).to.be.greaterThan(500);
  });

  for (const [label, texts] of [
    ['corpus', corpus],
    ['edge cases', EDGE_CASES],
  ] as const) {
    it(`agrees on every ${label} text`, () => {
      const mismatches: string[] = [];
      for (const text of texts) {
        const antlr = read(text, 'edgeV2');
        const langium = read(text, 'edgeLangium');
        if (antlr.errors.length === 0) {
          if (langium.errors.length > 0) {
            mismatches.push(
              `${JSON.stringify(text)}: only Langium rejects it (${langium.errors[0]})`,
            );
          } else if (!isDeepStrictEqual(langium.detail, antlr.detail)) {
            mismatches.push(
              `${JSON.stringify(text)}: ${JSON.stringify(langium.detail)} != ${JSON.stringify(antlr.detail)}`,
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

  for (const [text, why] of Object.entries(KNOWN_DIVERGENCES)) {
    it(`diverges on purpose: ${JSON.stringify(text)} (${why})`, () => {
      expect(read(text, 'edgeV2').errors).to.deep.equal([]);
      expect(read(text, 'edgeLangium').errors).to.have.length.greaterThan(0);
    });
  }

  it('keeps the divergences out of the compared texts', () => {
    for (const text of Object.keys(KNOWN_DIVERGENCES)) {
      expect(corpus).not.to.include(text);
      expect(EDGE_CASES).not.to.include(text);
    }
  });
});
