/**
 * The goal language against ANTLR: what RTRegex.g4 and AssertionRegex.g4 read
 * of every corpus goal text and assertion, the LSP branch's edge cases and
 * divergences (recorded in antlr-oracle.json before the ANTLR readers were
 * removed), and what the Edge readers read now. Every difference is named
 * below.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import {
  edgeGoalNames,
  edgeV2GoalNames,
  getAssertionVariables,
} from '../../../src/engines/edgeFamily/parsers';

type Oracle = {
  goalTexts: Record<
    'edge' | 'edgeV2',
    Record<string, { detail: unknown; rejected: boolean }>
  >;
  assertions: Record<string, unknown>;
};

const ORACLE: Oracle = JSON.parse(
  readFileSync(join(__dirname, 'antlr-oracle.json'), 'utf8'),
);

/**
 * Texts RTRegex.g4 accepted that the goal language does not read as it did:
 * shapes no model has (the LSP branch named them), and edge's bare `+`.
 */
export const DIVERGENT = {
  both: [
    // RTRegex.g4 read a notation without brackets, or after them, or nested names
    'G1;G2',
    'G1',
    ':Name',
    '[G1;G2]',
    'G1: After [G2];G3',
    'G1: Nested [: Inner [G2]]',
    // `G2G3` was two ids; the goal language reads ids apart only with an operator
    'G1: Glued [G2G3]',
    // `,` was RTRegex.g4's argument list (no construct); it is the catalog's `,`
    'G1: Args [G2,G3]',
  ],
  /**
   * Texts both reject, read differently after the error: each parser
   * recovers its own way (what is read past an error is never used, the
   * workbench shows the error).
   */
  recovered: [
    ' G1: Name',
    'G1 Name',
    'G12a: Name',
    'G1: Name\nG2: Other',
    'G1: Name G2]',
    'G1: Name [G2$G3]',
    'G1: Name [G2;]',
    'G1: Name [G2@->G3]',
    'G1: Step 2',
    'G1: x [G2 ;G3]',
    'G1: x [G2; G3]',
    'G1X: Variant [GX|TX]',
  ],
} as const;

const read = (grammar: 'edge' | 'edgeV2', goalText: string) => {
  const errors: string[] = [];
  const detail = (grammar === 'edge' ? edgeGoalNames : edgeV2GoalNames)({
    goalText,
    onSyntaxError: (message) => errors.push(message),
  });
  return { detail, rejected: errors.length > 0 };
};

/** What an engine does not read that the other one does: Edge has no `?` and no binary `+`. */
const usesEdgeV2Operators = (text: string) =>
  /\[[^\]]*(\?|[\w\]]\+[\w[])/.test(text);

describe('parity with the ANTLR readers', () => {
  for (const grammar of ['edge', 'edgeV2'] as const) {
    it(`${grammar}: reads every recorded goal text as RTRegex.g4 did, but the named divergences`, () => {
      const differ: string[] = [];
      let same = 0;
      for (const [text, antlr] of Object.entries(ORACLE.goalTexts[grammar])) {
        if ((DIVERGENT.both as readonly string[]).includes(text)) continue;
        // a cross-engine text: ANTLR recovered from the unknown operator
        if (grammar === 'edge' && usesEdgeV2Operators(text)) continue;
        const ours = read(grammar, text);
        if ((DIVERGENT.recovered as readonly string[]).includes(text)) {
          assert.strictEqual(antlr.rejected, true, text);
          assert.strictEqual(ours.rejected, true, text);
          continue;
        }
        try {
          assert.deepStrictEqual(ours.detail, antlr.detail);
          assert.strictEqual(ours.rejected, antlr.rejected);
          same++;
        } catch {
          differ.push(
            `${JSON.stringify(text)}: ${JSON.stringify(ours)} vs ${JSON.stringify(antlr)}`,
          );
        }
      }
      assert.deepStrictEqual(differ, []);
      assert.ok(same > 500, `${same} texts compared`);
    });
  }

  it('edge: rejects the edgeV2 operators the ANTLR reader rejected', () => {
    const texts = Object.keys(ORACLE.goalTexts.edge).filter(
      usesEdgeV2Operators,
    );
    assert.ok(texts.length > 50);
    for (const text of texts) {
      assert.strictEqual(ORACLE.goalTexts.edge[text]!.rejected, true, text);
      assert.strictEqual(read('edge', text).rejected, true, text);
    }
  });

  it('names its divergences: ANTLR accepted them, the goal language does not read them so', () => {
    for (const text of DIVERGENT.both)
      for (const grammar of ['edge', 'edgeV2'] as const)
        assert.notDeepStrictEqual(
          read(grammar, text),
          ORACLE.goalTexts[grammar][text],
          `${grammar} ${text}`,
        );
  });

  it('reads every recorded assertion as AssertionRegex.g4 did', () => {
    for (const [text, variables] of Object.entries(ORACLE.assertions))
      assert.deepStrictEqual(
        getAssertionVariables({ assertionSentence: text }),
        variables,
        text,
      );
  });
});
