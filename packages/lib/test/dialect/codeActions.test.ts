/**
 * A dialect's own kinds created from the text (goal-controller#518; before,
 * the language server's `notInDiagram` quick fix, mapped through
 * `istarKindOf`, goal-controller#440): a KAOS or NFR kind word on a new line
 * creates an element of that kind, not just iStar's goal/task/resource/quality.
 */
import { expect } from 'chai';
import type { AnyDialect } from '@goal-controller/dialect';
import { notationEdits } from '@goal-controller/goal-language';
import { kaos, nfr } from '../../src';

const EMPTY = { nodes: new Map(), roots: [] };
const created = (dialect: AnyDialect, doc: string) =>
  notationEdits(dialect, doc, EMPTY, {
    newId: () => '7857cb00-0000-4000-8000-000000000000',
  });

describe("a dialect's own kinds, created from the text (goal-controller#440, #518)", () => {
  it('creates a KAOS kind from its word', () => {
    expect(
      created(kaos as unknown as AnyDialect, 'behavioral_goal Reach the lab'),
    ).to.deep.equal([
      {
        create: {
          iStarId: '7857cb00-0000-4000-8000-000000000000',
          kind: 'kaos.BehavioralGoal',
          text: 'Reach the lab',
          properties: {},
          after: null,
          line: 0,
          writeId: '7857cb00',
        },
      },
    ]);
  });

  it('creates an NFR kind from its word, its written id kept in its name', () => {
    expect(
      created(nfr as unknown as AnyDialect, 'nfr S1: Fast enough'),
    ).to.deep.equal([
      {
        create: {
          iStarId: '7857cb00-0000-4000-8000-000000000000',
          kind: 'nfr.NFR',
          text: 'S1: Fast enough',
          properties: {},
          after: null,
          line: 0,
          writeId: null,
        },
      },
    ]);
  });
});
